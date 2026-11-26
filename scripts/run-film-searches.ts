// Runs film and people searches through the visitors' own search function
// with paid research on, and records every card for the owner's review
// (owner, 2026-11-26: test on 5-10 queries and on the IMDb Top 250 films,
// their actors and characters). Spending stops before --budget the same way
// as the live evaluation: the ledger is read before every search, and a
// search starts only while
//   spent this run + (searches running, this one included) x $1
// stays within the budget.
//
//   node --env-file=.env --import tsx scripts/run-film-searches.ts \
//     --queries data/eval/film-queries-2026-11-26.json --budget 25 --label owner-test
//
// The queries file holds { "queries": [{ "query": "...", "kind": "movie" }] }
// and/or { "titles": ["..."] } (titles are searched as movies). Writes
// docs/reports/film-searches-<label>-<date>.json in the live evaluation's
// case format, so scripts/build-rating-sheet.ts can turn it into a page.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import type { AiSearchView, FoundWatch } from "../app/domain/ai-watch-types";
import { runFilmSearch } from "../app/domain/film-search-run.server";
import {
  FILM_SUBJECT_KINDS,
  type FilmSubjectKind,
} from "../app/domain/film-subject";
import { validationBudgetStatus } from "../app/domain/validation-budget.server";
import { catalogueClient } from "../app/domain/watch-catalogue.server";

function option(name: string) {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : undefined;
}
const queriesFile = option("queries");
const budgetUsd = Number(option("budget"));
const label = option("label") ?? "run";
const concurrency = Number(option("concurrency") ?? 3);
if (!queriesFile) throw new Error("--queries <file> is required.");
if (!Number.isFinite(budgetUsd) || budgetUsd <= 0 || budgetUsd > 60)
  throw new Error("--budget <usd> is required: above 0 and at most 60.");
if (!/^[a-z0-9-]{1,40}$/.test(label))
  throw new Error("--label takes lowercase letters, digits and dashes.");
if (![1, 2, 3, 4].includes(concurrency))
  throw new Error("--concurrency takes 1-4.");

const file = JSON.parse(readFileSync(queriesFile, "utf8")) as {
  queries?: { query: string; kind: string }[];
  titles?: string[];
};
const queries = [
  ...(file.queries ?? []),
  ...(file.titles ?? []).map((query) => ({ query, kind: "movie" })),
];
for (const { kind } of queries)
  if (!(FILM_SUBJECT_KINDS as readonly string[]).includes(kind))
    throw new Error(`Unknown subject kind: ${kind}`);

const client = catalogueClient();
if (!client) throw new Error("The catalogue is not configured.");
const startedAt = new Date().toISOString();
const runId = startedAt.replace(/[^0-9]/g, "").slice(0, 14);

/** More than one film search can reserve (one attempt, 8 cards x $0.025). */
const SEARCH_CEILING_USD = 1;
const before = await validationBudgetStatus(client);
if (before.halted) throw new Error("The spend ledger is halted.");
const baseline = before.spentUsd + before.reservedUsd;
let running = 0;
let stopReason: string | null = null;
async function claimSlot() {
  // This search's own place among those running decides, so searches that
  // start together cannot all count each other and all refuse.
  const position = ++running;
  const status = await validationBudgetStatus(client!);
  const used = status.spentUsd + status.reservedUsd - baseline;
  let refuse: string | null = null;
  if (status.halted) refuse = "the spend ledger halted";
  else if (used + position * SEARCH_CEILING_USD > budgetUsd)
    refuse = `the next search could pass $${budgetUsd} (spent $${used.toFixed(4)})`;
  if (refuse) {
    stopReason ??= refuse;
    running--;
    return false;
  }
  return true;
}

const card = (watch: FoundWatch, section: "main" | "alsoWorth") => ({
  section,
  brand: watch.brand,
  model: watch.model,
  referenceCode: watch.referenceCode,
  price: watch.details.price ?? null,
  priceCondition: watch.details.priceCondition ?? null,
  priceConfirmed: watch.details.priceConfirmed ?? null,
  caseDiameterMm: watch.details.caseDiameterMm ?? null,
  movement: watch.details.movement ?? null,
  waterResistanceM: watch.details.waterResistanceM ?? null,
  verified: watch.details.verificationStatus !== "unverified",
  verificationNote: watch.details.verificationNote ?? null,
  misses: watch.details.misses ?? [],
  reviewStatus: watch.details.reviewStatus ?? null,
  person: watch.details.person ?? null,
  work: watch.details.work ?? null,
  sourceUrl: watch.sourceUrl,
  referenceSourceUrl: watch.details.referenceSourceUrl ?? null,
  evidence: (watch.details.validationEvidence ?? []).map((item) => ({
    provider: item.provider,
    sourceUrl: item.sourceUrl,
    sourceQuote: item.sourceQuote ?? null,
  })),
  imageUrl: watch.imageUrl,
  rationale: watch.rationale.slice(0, 400),
});
const statusOf = (view: AiSearchView) =>
  view.status === "unavailable"
    ? `unavailable${view.reason ? `:${view.reason}` : ""}`
    : view.status;

const cases: {
  tool: "film";
  id: string;
  round: 1;
  input: { query: string; kind: string };
  status: string;
  ms: number;
  cards: ReturnType<typeof card>[];
  checks: Record<string, unknown>;
  violations: string[];
  error?: string;
}[] = [];
let next = 0;
const lane = async () => {
  while (next < queries.length) {
    const index = next++;
    const query = queries[index]!;
    const id = `film-${label}-${String(index + 1).padStart(3, "0")}`;
    if (stopReason || !(await claimSlot())) {
      cases.push({
        tool: "film",
        id,
        round: 1,
        input: query,
        status: `not_run: ${stopReason}`,
        ms: 0,
        cards: [],
        checks: {},
        violations: [],
      });
      continue;
    }
    const started = Date.now();
    try {
      const view = await runFilmSearch({
        query: query.query,
        kind: query.kind as FilmSubjectKind,
        rateKey: `film-searches-${runId}-${index}`,
      });
      const cards =
        view.status === "found"
          ? [
              ...view.watches.map((watch) => card(watch, "main")),
              ...(view.alsoWorth ?? []).map((watch) =>
                card(watch, "alsoWorth"),
              ),
            ]
          : [];
      cases.push({
        tool: "film",
        id,
        round: 1,
        input: query,
        status: statusOf(view),
        ms: Date.now() - started,
        cards,
        checks: {
          confirmedCards: cards.filter((entry) => entry.verified).length,
          possibleCards: cards.filter((entry) => !entry.verified).length,
        },
        violations: [],
      });
    } catch (error) {
      cases.push({
        tool: "film",
        id,
        round: 1,
        input: query,
        status: "error",
        ms: Date.now() - started,
        cards: [],
        checks: {},
        violations: [],
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      running--;
    }
    const last = cases.at(-1)!;
    console.log(
      `${last.id} ${query.kind} "${query.query}": ${last.status}, ${Number(last.checks.confirmedCards ?? 0)} confirmed, ${Number(last.checks.possibleCards ?? 0)} possible, ${(last.ms / 1000).toFixed(0)} s`,
    );
  }
};
await Promise.all(Array.from({ length: concurrency }, lane));
cases.sort((a, b) => a.id.localeCompare(b.id));

const after = await validationBudgetStatus(client);
const ran = cases.filter((entry) => !entry.status.startsWith("not_run"));
const report = {
  startedAt,
  finishedAt: new Date().toISOString(),
  dryRun: false,
  label,
  queriesFile,
  budgetUsd,
  stopReason,
  spendUsd: Number((after.spentUsd + after.reservedUsd - baseline).toFixed(4)),
  ledger: { before, after },
  summary: {
    searches: cases.length,
    ran: ran.length,
    withConfirmed: ran.filter(
      (entry) => Number(entry.checks.confirmedCards) > 0,
    ).length,
    withAnyCard: ran.filter((entry) => entry.cards.length > 0).length,
    confirmedCards: ran.reduce(
      (sum, entry) => sum + Number(entry.checks.confirmedCards ?? 0),
      0,
    ),
    possibleCards: ran.reduce(
      (sum, entry) => sum + Number(entry.checks.possibleCards ?? 0),
      0,
    ),
    statuses: Object.fromEntries(
      [...new Set(ran.map((entry) => entry.status))].map((status) => [
        status,
        ran.filter((entry) => entry.status === status).length,
      ]),
    ),
  },
  cases,
};
const output = resolve(
  `docs/reports/film-searches-${label}-${startedAt.slice(0, 10)}.json`,
);
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(
  JSON.stringify(
    { spendUsd: report.spendUsd, stopReason, summary: report.summary },
    null,
    2,
  ),
);
console.log(`Wrote ${output}`);
process.exit(0);
