// The paid live round of the quality evaluation (owner approval,
// 2026-11-26: $60 for one round; docs/evaluation-budget.md). It runs the
// labelled sets of scripts/run-evals.ts through the visitors' own search
// functions with paid research switched on, and scores the answers with the
// same rules (scripts/eval-sets.ts).
//
// Spending stops before the approved amount. Every paid provider request in
// the visitor path first reserves money in the spend ledger
// (validation-runtime.server.ts → ai_watch_validation_reserve_v5), and the
// database refuses reservations beyond its $100 monthly limit. On top of
// that, this script reads the ledger before every case and starts a case
// only while
//   spent this round + (cases running, this one included) × CASE_CEILING_USD
// stays within --budget. CASE_CEILING_USD is more than one search can
// reserve, so the round cannot pass the budget even if every running case
// hits its worst case.
//
//   node --env-file=.env --import tsx scripts/run-evals-live.ts --budget 60
//   options: --tools quiz,archetype,alternatives,film  --concurrency 3
//            --rounds 2  --dry-run
//
// --dry-run refuses every provider request and every database write (the
// free evaluation's guard), so the harness can be tested at no cost.
// Writes docs/reports/eval-live-<date>[-dry-run].json with every card shown,
// which the rating sheet reads.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { normalizeMovement } from "../app/domain/ai-watch-guardrails";
import type { AiSearchView, FoundWatch } from "../app/domain/ai-watch-types";
import { budgetWindow, SIZE_TOLERANCE_MM } from "../app/domain/alternatives";
import {
  startAlternativesSearch,
  type AlternativesForm,
} from "../app/domain/alternatives-search.server";
import { archetypeCatalogueResult } from "../app/domain/archetype-catalogue.server";
import {
  ARCHETYPE_BANDS,
  type PriceComfort,
} from "../app/domain/archetype-picks";
import {
  ARCHETYPE_IDS,
  PRICE_COMFORTS,
  type ArchetypeId,
} from "../app/domain/discovery-archetype";
import { runFilmSearch } from "../app/domain/film-search-run.server";
import type { FilmSubjectKind } from "../app/domain/film-subject";
import { convert } from "../app/domain/fx";
import { loadFxTable } from "../app/domain/fx.server";
import type { ProfileV4 } from "../app/domain/questionnaire-v4";
import { searchQuiz } from "../app/domain/quiz-search.server";
import { SEARCH_RESULT_TARGET } from "../app/domain/search-coverage";
import { validationBudgetStatus } from "../app/domain/validation-budget.server";
import { catalogueClient } from "../app/domain/watch-catalogue.server";
import { uniqueWatchResults } from "../app/domain/watch-result-dedup";
import {
  INDEPENDENT_FILM_FILE,
  independentHit,
  isExactQuizCard,
  loadIndependentFilmSet,
  loadOwnerAlternatives,
  matchesPick,
  ownerCaseBudget,
  quizRuleFailures,
  READ_ONLY_RPC,
  seededQuizProfiles,
  type IndependentLabel,
} from "./eval-sets";

// ---------------------------------------------------------------------------
// Options

function option(name: string) {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : undefined;
}
const budgetUsd = Number(option("budget"));
if (!Number.isFinite(budgetUsd) || budgetUsd <= 0 || budgetUsd > 100)
  throw new Error(
    "--budget <usd> is required: above 0 and at most the $100 monthly limit.",
  );
const dryRun = process.argv.includes("--dry-run");
const TOOLS = ["quiz", "archetype", "alternatives", "film"] as const;
type Tool = (typeof TOOLS)[number];
const tools = (option("tools") ?? TOOLS.join(",")).split(",") as Tool[];
if (!tools.every((tool) => TOOLS.includes(tool)))
  throw new Error(`--tools takes a comma list of ${TOOLS.join(", ")}.`);
const concurrency = Number(option("concurrency") ?? 3);
const rounds = Number(option("rounds") ?? 2);
if (![1, 2, 3, 4].includes(concurrency) || ![1, 2].includes(rounds))
  throw new Error("--concurrency takes 1–4 and --rounds takes 1 or 2.");

/** More than one search can reserve: a search makes at most two paid
 * attempts (its own and one top-up), each at most 8 cards × $0.025. */
const CASE_CEILING_USD = 1;
/** A case still running after this is recorded as timed out; its ledger
 * slot stays taken, since it may still spend. */
const CASE_TIMEOUT_MS = 8 * 60_000;
/** The validation backoff (migration 0121) refuses a repeat of a failed
 * search for five minutes; round 2 waits longer than that. */
const ROUND_PAUSE_MS = 6 * 60_000;

// ---------------------------------------------------------------------------
// Network: count every request by kind; in a dry run refuse providers and
// writes exactly like the free evaluation.

const supabaseHost = new URL(process.env.SUPABASE_URL!).host;
const providerHosts = new Map([
  ["api.perplexity.ai", "Perplexity"],
  [
    new URL(process.env.MUSE_SPARK_BASE_URL?.trim() || "https://api.meta.ai/v1")
      .host,
    "Muse Spark",
  ],
  ["api.openai.com", "OpenAI"],
]);
const requests: Record<string, number> = {};
const refused: string[] = [];
const realFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = async (input, init) => {
  const url = new URL(
    typeof input === "string" || input instanceof URL ? input : input.url,
  );
  const rpc = url.pathname.match(/\/rest\/v1\/rpc\/([a-z0-9_]+)$/)?.[1];
  const kind =
    providerHosts.get(url.host) ??
    (url.host === supabaseHost
      ? "database"
      : url.host === "www.ecb.europa.eu"
        ? "exchange rates"
        : url.host.endsWith("upstash.io")
          ? "rate limiter"
          : "other web pages");
  requests[kind] = (requests[kind] ?? 0) + 1;
  if (dryRun) {
    // The rate limiter is not a provider; with unique keys it only counts.
    const allowed =
      url.host === "www.ecb.europa.eu" ||
      url.host.endsWith("upstash.io") ||
      (url.host === supabaseHost &&
        rpc !== undefined &&
        (READ_ONLY_RPC.has(rpc) ||
          rpc === "ai_watch_validation_admin_status_v1"));
    if (!allowed) {
      refused.push(rpc ?? kind);
      return new Response("refused by the dry-run guard", { status: 403 });
    }
  }
  return realFetch(input, init);
};

const client = catalogueClient();
if (!client) throw new Error("The catalogue is not configured.");
const fx = await loadFxTable();
if (!fx) throw new Error("Exchange rates are unavailable; rerun later.");
const startedAt = new Date().toISOString();
const runId = startedAt.replace(/[^0-9]/g, "").slice(0, 14);

// ---------------------------------------------------------------------------
// The spend ledger and the hard stop

const ledgerBefore = await validationBudgetStatus(client);
if (ledgerBefore.halted)
  throw new Error("The spend ledger is halted; reconcile it before a round.");
const baselineUsd = ledgerBefore.spentUsd + ledgerBefore.reservedUsd;
let running = 0;
let stopReason: string | null = null;
let roundSpentUsd = 0;

async function spentThisRound() {
  const status = await validationBudgetStatus(client!);
  roundSpentUsd = Math.max(
    roundSpentUsd,
    status.spentUsd + status.reservedUsd - baselineUsd,
  );
  return { status, used: status.spentUsd + status.reservedUsd - baselineUsd };
}

/** Take a slot for one more case, or stop the round. */
async function claimSlot() {
  // This search's own place among those running decides, so searches that
  // start together cannot all count each other and all refuse.
  const position = ++running;
  const { status, used } = await spentThisRound();
  let refuse: string | null = null;
  if (status.halted) refuse = "the spend ledger halted after an overrun";
  else if (used + position * CASE_CEILING_USD > budgetUsd)
    refuse = `the next case could pass the approved $${budgetUsd} (spent $${used.toFixed(4)})`;
  if (refuse) {
    stopReason ??= refuse;
    running--;
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Cases and what is recorded for each

type Card = ReturnType<typeof cardOf>;
type Outcome = {
  status: string;
  view?: AiSearchView;
  checks: Record<string, unknown>;
  violations: string[];
  target?: string | null;
};
type Case = {
  tool: Tool;
  id: string;
  input: unknown;
  /** Rerun in round 2 when the first answer is short of ten. */
  completes: boolean;
  run: () => Promise<Outcome>;
};
type CaseResult = {
  tool: Tool;
  id: string;
  round: number;
  input: unknown;
  status: string;
  ms: number;
  distinctCards: number;
  coverage: { total: number; target: number; status: string } | null;
  reachedTen: boolean;
  checks: Record<string, unknown>;
  violations: string[];
  target?: string | null;
  cards: Card[];
  error?: string;
};

function cardOf(watch: FoundWatch, section: "main" | "alsoWorth") {
  const details = watch.details;
  return {
    section,
    brand: watch.brand,
    model: watch.model,
    referenceCode: watch.referenceCode,
    price: details.price ?? null,
    priceCondition: details.priceCondition ?? null,
    priceConfirmed: details.priceConfirmed ?? null,
    caseDiameterMm: details.caseDiameterMm ?? null,
    movement: details.movement ?? null,
    waterResistanceM: details.waterResistanceM ?? null,
    verified: details.verificationStatus !== "unverified",
    verificationNote: details.verificationNote ?? null,
    misses: details.misses ?? [],
    reviewStatus: details.reviewStatus ?? null,
    person: details.person ?? null,
    work: details.work ?? null,
    sourceUrl: watch.sourceUrl,
    referenceSourceUrl: details.referenceSourceUrl ?? null,
    imageUrl: watch.imageUrl,
    rationale: watch.rationale.slice(0, 400),
  };
}
const cardsOf = (view: AiSearchView | undefined) =>
  view?.status === "found"
    ? [
        ...view.watches.map((watch) => cardOf(watch, "main")),
        ...(view.alsoWorth ?? []).map((watch) => cardOf(watch, "alsoWorth")),
      ]
    : [];
const watchesOf = (view: AiSearchView) =>
  view.status === "found" ? [...view.watches, ...(view.alsoWorth ?? [])] : [];
const statusOf = (view: AiSearchView) =>
  view.status === "unavailable"
    ? `unavailable${view.reason ? `:${view.reason}` : ""}`
    : view.status;
const usd = (price: { amount: number; currency: string }) =>
  price.currency === "USD"
    ? price.amount
    : convert(price.amount, price.currency, "USD", fx);
const MECHANICAL = new Set(["automatic", "manual", "spring_drive"]);

// 1. Diagnostic quiz: the 40 seeded answers.
const quizCases: Case[] = seededQuizProfiles().profiles.map(
  (profile: ProfileV4, index) => ({
    tool: "quiz",
    id: `quiz-${String(index + 1).padStart(2, "0")}`,
    input: profile,
    completes: true,
    run: async () => {
      const view = await searchQuiz(profile, {});
      const cards = watchesOf(view);
      const exact = cards.filter(isExactQuizCard);
      const close = cards.filter((watch) => watch.details.misses?.length);
      return {
        status: statusOf(view),
        view,
        checks: {
          exactCards: exact.length,
          closeFits: close.length,
          closeFitsWithoutReason: close.filter(
            (watch) =>
              !watch.details.misses?.every((miss) => miss.trim().length > 0),
          ).length,
        },
        violations: exact.flatMap((watch) =>
          quizRuleFailures(watch, profile, fx).map(
            (failure) => `${watch.brand} ${watch.model}: ${failure}`,
          ),
        ),
      };
    },
  }),
);

// 2. Archetype quiz: every archetype in every price band.
const archetypeCases: Case[] = ARCHETYPE_IDS.flatMap((archetype: ArchetypeId) =>
  PRICE_COMFORTS.map((band: PriceComfort) => ({
    tool: "archetype" as const,
    id: `archetype-${archetype}-${band}`,
    input: { archetype, band },
    completes: true,
    run: async () => {
      const view = await archetypeCatalogueResult(archetype, band);
      const bounds = ARCHETYPE_BANDS[band];
      // A card without the "not fully verified" label claims the band (and,
      // for the mechanical connoisseur, a mechanical movement).
      const violations = watchesOf(view)
        .filter((watch) => watch.details.verificationStatus !== "unverified")
        .flatMap((watch) => {
          const name = `${watch.brand} ${watch.model}`;
          const failures: string[] = [];
          const price = watch.details.price;
          if (!price) failures.push(`${name}: price unknown but not labelled`);
          else {
            const amount = usd(price);
            if (amount === null)
              failures.push(`${name}: no USD rate for ${price.currency}`);
            else if (
              amount < bounds.minimumUsd ||
              (bounds.maximumUsd !== null && amount > bounds.maximumUsd)
            )
              failures.push(`${name}: USD ${Math.round(amount)} outside band`);
          }
          if (
            archetype === "mechanical_connoisseur" &&
            !MECHANICAL.has(
              normalizeMovement(watch.details.movement ?? null) ?? "",
            )
          )
            failures.push(`${name}: movement ${watch.details.movement}`);
          return failures;
        });
      return { status: statusOf(view), view, checks: {}, violations };
    },
  })),
);

// 3. Cheaper alternatives: the owner's 20 watches × 3 suggested alternatives.
const alternativesCases: Case[] = loadOwnerAlternatives().cases.flatMap(
  (testCase, caseIndex) =>
    testCase.alternatives.map((alternative, pickIndex) => {
      const budget = ownerCaseBudget(alternative);
      const allowQuartz = Boolean(alternative.quartz);
      const id = `alternatives-${String(caseIndex + 1).padStart(2, "0")}-${pickIndex + 1}`;
      return {
        tool: "alternatives" as const,
        id,
        input: {
          original: testCase.original,
          ownerPick: alternative.watch,
          budget,
          allowQuartz,
        },
        completes: true,
        run: async (): Promise<Outcome> => {
          const form: AlternativesForm = {
            name: testCase.original,
            reference: "",
            mode: "exact",
            amount: String(budget.amount),
            currency: budget.currency,
            range: "",
            quartz: allowQuartz ? "yes" : "no",
          };
          let search = await startAlternativesSearch(form, {
            rateKey: `eval-live-${runId}-${id}`,
          });
          // A name with several matches shows "Which one do you mean?"
          // chips; like a visitor, follow the first chip.
          let chosenOption: string | null = null;
          if (search.kind === "options" && search.options[0]) {
            const first = search.options[0];
            chosenOption = first.label;
            search = await startAlternativesSearch(
              { ...form, name: first.name, reference: first.reference },
              { rateKey: `eval-live-${runId}-${id}-chip` },
            );
          }
          if (search.kind === "error")
            return {
              status: `error:${search.code}`,
              checks: { message: search.error, chosenOption },
              violations: [],
            };
          if (search.kind !== "search")
            return { status: search.kind, checks: {}, violations: [] };
          const page = await search.page;
          const view = page.result;
          const target = page.target?.card ?? null;
          const watches = watchesOf(view);
          const position = watches.findIndex((watch) =>
            matchesPick(alternative.watch, watch.brand, watch.model),
          );
          const window = budgetWindow(budget);
          const targetMm = target?.details.caseDiameterMm ?? null;
          const violations = watches
            .filter(
              (watch) => watch.details.verificationStatus !== "unverified",
            )
            .flatMap((watch) => {
              const name = `${watch.brand} ${watch.model}`;
              const failures: string[] = [];
              const price = watch.details.price;
              if (price) {
                const amount =
                  price.currency === window.currency
                    ? price.amount
                    : convert(
                        price.amount,
                        price.currency,
                        window.currency,
                        fx,
                      );
                if (amount === null)
                  failures.push(`${name}: no rate for ${price.currency}`);
                else if (
                  amount < window.minimum ||
                  (window.maximum !== null && amount > window.maximum)
                )
                  failures.push(
                    `${name}: ${window.currency} ${Math.round(amount)} outside ${window.minimum}–${window.maximum ?? "no maximum"}`,
                  );
              }
              const mm = watch.details.caseDiameterMm ?? null;
              if (
                targetMm !== null &&
                mm !== null &&
                Math.abs(mm - targetMm) > SIZE_TOLERANCE_MM
              )
                failures.push(`${name}: ${mm} mm vs ${targetMm} mm`);
              const movement = normalizeMovement(
                watch.details.movement ?? null,
              );
              if (!allowQuartz && movement && !MECHANICAL.has(movement))
                failures.push(`${name}: movement ${movement}`);
              if (
                target &&
                watch.brand === target.brand &&
                (watch.referenceCode ?? watch.model) ===
                  (target.referenceCode ?? target.model)
              )
                failures.push(`${name}: the named watch itself`);
              return failures;
            });
          return {
            status: statusOf(view),
            view,
            target: target
              ? `${target.brand} ${target.model}${target.referenceCode ? ` (${target.referenceCode})` : ""}`
              : null,
            checks: {
              ownerPickPosition: position >= 0 ? position + 1 : null,
              chosenOption,
            },
            violations,
          };
        },
      };
    }),
);

// 4. Film and people: the 17 independent searches and the 2 invented controls.
const { sha256: filmSha256, set: filmSet } = loadIndependentFilmSet();
const filmQueries = new Map<string, IndependentLabel[]>();
for (const label of filmSet.positives) {
  const key = `${label.kind}|${label.query}`;
  filmQueries.set(key, [...(filmQueries.get(key) ?? []), label]);
}
const filmCase = (
  id: string,
  query: string,
  kind: string,
  labels: IndependentLabel[],
): Case => ({
  tool: "film",
  id,
  input: { query, kind, labels: labels.map((label) => label.id) },
  completes: false,
  run: async () => {
    const view = await runFilmSearch({
      query,
      kind: kind as FilmSubjectKind,
      rateKey: `eval-live-${runId}-${id}`,
    });
    const watches = watchesOf(view);
    const confirmed = watches.filter(
      (watch) => watch.details.verificationStatus !== "unverified",
    );
    if (labels.length === 0)
      // An invented subject: any confirmed card is an invented sighting.
      return {
        status: statusOf(view),
        view,
        checks: {
          control: true,
          confirmedCards: confirmed.length,
          possibleCards: watches.length - confirmed.length,
        },
        violations: confirmed.map(
          (watch) => `invented sighting: ${watch.brand} ${watch.model}`,
        ),
      };
    const labelResults = Object.fromEntries(
      labels.map((label) => {
        const hits = watches.filter((watch) => independentHit(watch, label));
        return [
          label.id,
          hits.some(
            (watch) => watch.details.verificationStatus !== "unverified",
          )
            ? "confirmed"
            : hits.length
              ? "possible"
              : "missed",
        ];
      }),
    );
    return {
      status: statusOf(view),
      view,
      checks: {
        labels: labelResults,
        confirmedCards: confirmed.length,
        possibleCards: watches.length - confirmed.length,
      },
      violations: [],
    };
  },
});
const filmCases: Case[] = [
  ...[...filmQueries.values()].map((labels, index) =>
    filmCase(
      `film-${String(index + 1).padStart(2, "0")}`,
      labels[0]!.query,
      labels[0]!.kind,
      labels,
    ),
  ),
  ...filmSet.controls.map((control) =>
    filmCase(`film-${control.id}`, control.query, control.kind, []),
  ),
];

const casesByTool: Record<Tool, Case[]> = {
  quiz: quizCases,
  archetype: archetypeCases,
  alternatives: alternativesCases,
  film: filmCases,
};

// ---------------------------------------------------------------------------
// Running

async function withTimeout<T>(promise: Promise<T>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(`timed out after ${CASE_TIMEOUT_MS / 60_000} min`),
            ),
          CASE_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function resultOf(
  item: Case,
  round: number,
  ms: number,
  outcome: Outcome | null,
  error?: string,
): CaseResult {
  const view = outcome?.view;
  const distinctCards =
    view?.status === "found"
      ? uniqueWatchResults([...view.watches, ...(view.alsoWorth ?? [])]).length
      : 0;
  const coverage =
    view?.status === "found" && view.coverage
      ? {
          total: view.coverage.total,
          target: view.coverage.target,
          status: view.coverage.status,
        }
      : null;
  return {
    tool: item.tool,
    id: item.id,
    round,
    input: item.input,
    status: error ? "error" : (outcome?.status ?? "not_run"),
    ms,
    distinctCards,
    coverage,
    reachedTen:
      distinctCards >= SEARCH_RESULT_TARGET &&
      (coverage?.total ?? 0) >= SEARCH_RESULT_TARGET,
    checks: outcome?.checks ?? {},
    violations: outcome?.violations ?? [],
    target: outcome?.target,
    cards: cardsOf(view),
    ...(error ? { error } : {}),
  };
}

async function runCases(items: Case[], round: number) {
  const results: CaseResult[] = [];
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const item = items[next++]!;
      if (stopReason || !(await claimSlot())) {
        results.push({
          ...resultOf(item, round, 0, null),
          status: `not_run: ${stopReason}`,
        });
        continue;
      }
      const started = Date.now();
      let timedOut = false;
      try {
        const outcome = await withTimeout(item.run());
        results.push(resultOf(item, round, Date.now() - started, outcome));
      } catch (error) {
        timedOut =
          error instanceof Error && error.message.startsWith("timed out");
        results.push(
          resultOf(
            item,
            round,
            Date.now() - started,
            null,
            error instanceof Error ? error.message : String(error),
          ),
        );
      } finally {
        if (!timedOut) running--;
      }
      const last = results.at(-1)!;
      console.log(
        `${last.id} r${round}: ${last.status}, ${last.distinctCards} cards${last.violations.length ? `, ${last.violations.length} rule failures` : ""}, ${(last.ms / 1000).toFixed(0)} s, round spend $${roundSpentUsd.toFixed(4)}`,
      );
    }
  };
  await Promise.all(Array.from({ length: concurrency }, lane));
  return results.sort((a, b) => a.id.localeCompare(b.id));
}

const all: CaseResult[] = [];
const spendByTool: Record<string, number> = {};
for (let round = 1; round <= rounds; round++) {
  if (round > 1) {
    console.log(
      `Waiting ${ROUND_PAUSE_MS / 60_000} minutes before round ${round}…`,
    );
    await new Promise((resolveWait) => setTimeout(resolveWait, ROUND_PAUSE_MS));
  }
  for (const tool of tools) {
    const items =
      round === 1
        ? casesByTool[tool]
        : casesByTool[tool].filter((item) => {
            const first = all.find(
              (result) => result.id === item.id && result.round === 1,
            );
            if (!first || first.status.startsWith("not_run")) return false;
            // A second chance for an answer short of ten, or one that
            // failed (the backoff pause has passed by now).
            return (
              first.status.startsWith("unavailable") ||
              (item.completes && first.status === "found" && !first.reachedTen)
            );
          });
    if (items.length === 0) continue;
    const before = (await spentThisRound()).used;
    all.push(...(await runCases(items, round)));
    const after = (await spentThisRound()).used;
    spendByTool[tool] = (spendByTool[tool] ?? 0) + (after - before);
  }
}

// ---------------------------------------------------------------------------
// Scores

const ledgerAfter = await validationBudgetStatus(client);
const totalUsd = ledgerAfter.spentUsd + ledgerAfter.reservedUsd - baselineUsd;
/** The answer a visitor would get now: round 2 where it ran, else round 1. */
const finalResults = [
  ...new Map(all.map((result) => [result.id, result])).values(),
];
const share = (part: number, whole: number) =>
  whole === 0 ? null : Number((part / whole).toFixed(4));
function summary(tool: Tool) {
  const results = finalResults.filter((result) => result.tool === tool);
  const ran = results.filter((result) => !result.status.startsWith("not_run"));
  const found = ran.filter((result) => result.status === "found");
  const cards = found.flatMap((result) => result.cards);
  return {
    cases: results.length,
    ran: ran.length,
    notRun: results.length - ran.length,
    statuses: Object.fromEntries(
      [...new Set(ran.map((result) => result.status))].map((status) => [
        status,
        ran.filter((result) => result.status === status).length,
      ]),
    ),
    found: found.length,
    reachedTen: found.filter((result) => result.reachedTen).length,
    cards: cards.length,
    verifiedCards: cards.filter((card) => card.verified).length,
    verifiedShare: share(
      cards.filter((card) => card.verified).length,
      cards.length,
    ),
    ruleFailures: ran.reduce(
      (sum, result) => sum + result.violations.length,
      0,
    ),
    ruleFailureExamples: ran
      .flatMap((result) =>
        result.violations.map((text) => `${result.id}: ${text}`),
      )
      .slice(0, 15),
    spendUsd: Number((spendByTool[tool] ?? 0).toFixed(4)),
  };
}
const filmLabelResults = finalResults
  .filter((result) => result.tool === "film" && result.checks.labels)
  .flatMap((result) =>
    Object.entries(result.checks.labels as Record<string, string>),
  );
const filmControls = finalResults.filter(
  (result) => result.tool === "film" && result.checks.control,
);
const quizExactCards = finalResults
  .filter((result) => result.tool === "quiz")
  .reduce((sum, result) => sum + Number(result.checks.exactCards ?? 0), 0);

const report = {
  startedAt,
  finishedAt: new Date().toISOString(),
  dryRun,
  budgetUsd,
  caseCeilingUsd: CASE_CEILING_USD,
  concurrency,
  rounds,
  stopReason,
  ledger: { before: ledgerBefore, after: ledgerAfter },
  spend: {
    totalUsd: Number(totalUsd.toFixed(4)),
    byTool: Object.fromEntries(
      Object.entries(spendByTool).map(([tool, value]) => [
        tool,
        Number(value.toFixed(4)),
      ]),
    ),
  },
  requests,
  refusedInDryRun: dryRun ? [...new Set(refused)] : undefined,
  quiz: {
    ...summary("quiz"),
    exactCards: quizExactCards,
    exactPrecision:
      quizExactCards === 0
        ? null
        : Number(
            (1 - summary("quiz").ruleFailures / quizExactCards).toFixed(4),
          ),
  },
  archetype: summary("archetype"),
  alternatives: {
    ...summary("alternatives"),
    searched: finalResults.filter(
      (result) => result.tool === "alternatives" && result.target,
    ).length,
    ownerPickInTop10: finalResults.filter(
      (result) =>
        result.tool === "alternatives" &&
        typeof result.checks.ownerPickPosition === "number" &&
        result.checks.ownerPickPosition <= 10,
    ).length,
  },
  film: {
    ...summary("film"),
    file: INDEPENDENT_FILM_FILE,
    sha256: filmSha256,
    labels: filmLabelResults.length,
    confirmed: filmLabelResults.filter(([, value]) => value === "confirmed")
      .length,
    possible: filmLabelResults.filter(([, value]) => value === "possible")
      .length,
    missed: filmLabelResults.filter(([, value]) => value === "missed").length,
    controlsWithConfirmedCards: filmControls.filter(
      (result) => Number(result.checks.confirmedCards) > 0,
    ).length,
    controlsWithPossibleCards: filmControls.filter(
      (result) => Number(result.checks.possibleCards) > 0,
    ).length,
  },
  gates: {
    withinApprovedBudget: totalUsd <= budgetUsd,
    zeroQuizHardRuleFailures: summary("quiz").ruleFailures === 0,
    zeroArchetypeRuleFailures: summary("archetype").ruleFailures === 0,
    zeroAlternativesRuleFailures: summary("alternatives").ruleFailures === 0,
    zeroInventedSightingsForControls: filmControls.every(
      (result) => Number(result.checks.confirmedCards) === 0,
    ),
  },
  cases: all,
};
const date = new Date().toISOString().slice(0, 10);
// --label names a further run of the same day (for example one tool again).
const labelAt = process.argv.indexOf("--label");
const runLabel = labelAt > 0 ? process.argv[labelAt + 1] : undefined;
if (runLabel !== undefined && !/^[a-z0-9-]{1,40}$/.test(runLabel))
  throw new Error("--label takes lowercase letters, digits and dashes.");
const output = resolve(
  `docs/reports/eval-live-${date}${runLabel ? `-${runLabel}` : ""}${dryRun ? "-dry-run" : ""}.json`,
);
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(
  JSON.stringify({ ...report, ledger: undefined, cases: undefined }, null, 2),
);
console.log(`Wrote ${output}`);
if (Object.values(report.gates).some((passed) => !passed)) process.exit(1);
process.exit(0);
