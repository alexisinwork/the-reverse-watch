// The review queue of /admin/catalogue, checked before approval (owner,
// 2026-11-27: "approve all pending watches in admin/catalogue проверяя его
// судьей-perplexity-muse").
//
// 1. scripts/repair-catalogue.ts --set pending --run pending-1 checks every
//    pending watch against the maker's or a shop's page (Perplexity names
//    the pages, our server opens them, Muse Spark reads them), and
//    --apply-only writes the facts it read there.
// 2. This script, --sheet: watches whose reference no such page gave go
//    into a judge sheet (docs/reports/rating-sheet-pending-<date>.json) for
//    scripts/judge-cards.ts.
// 3. --approve: approves a watch when the page check found the maker's or
//    an authorised retailer's page giving its exact reference, or, without
//    such a page, when the judge found no wrong fact (--judge <report>).
//    Everything else stays pending, with its reason in the report.
//
//   node --env-file=.env --import tsx scripts/review-pending.ts --run pending-1 --sheet
//   node --env-file=.env --import tsx scripts/review-pending.ts --run pending-1 \
//     --judge docs/reports/judge-pending-<date>.json --approve
//
// Approvals go one at a time with a pause, through the admin page's own
// function (watch_catalogue_review_v1); nothing is rejected or deleted.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import postgres from "postgres";
import { z } from "zod";

import {
  catalogueWatchSchema,
  type CatalogueWatch,
} from "../app/domain/watch-catalogue";
import {
  catalogueClient,
  reviewCatalogueWatch,
} from "../app/domain/watch-catalogue.server";
import { databaseTls } from "./database-tls";
import { pageKind } from "./repair-rules";

function option(name: string) {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : undefined;
}
const run = option("run") ?? "pending-1";
const judgePath = option("judge");
const approve = process.argv.includes("--approve");
const makeSheet = process.argv.includes("--sheet");
const date = new Date().toISOString().slice(0, 10);

type Entry = {
  id: string;
  pageUrl: string | null;
  pageKind: "maker" | "retailer" | null;
  referenceOnPage: boolean;
  identityChanged: boolean;
  error?: string;
};
const journal = new Map<string, Entry>();
for (const line of readFileSync(
  resolve(`.scratch/repair/${run}.jsonl`),
  "utf8",
).split("\n")) {
  if (!line.trim()) continue;
  try {
    const entry = JSON.parse(line) as Entry;
    journal.set(entry.id, entry);
  } catch {
    continue;
  }
}

const databaseUrl = process.env.DIRECT_DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DIRECT_DATABASE_URL is not set.");
const sql = postgres(databaseUrl, {
  max: 1,
  ssl: databaseTls(),
  connect_timeout: 15,
  onnotice: () => undefined,
});
let pending: CatalogueWatch[];
try {
  pending = z.array(catalogueWatchSchema).parse(
    (
      await sql<{ row: unknown }[]>`
        select private.watch_catalogue_json(w) as row
        from private.watch_catalogue w where w.review_status = 'pending'`
    ).map((entry) => entry.row),
  );
} finally {
  await sql.end();
}

/** The maker's or a shop's page our server opened gave the exact reference. */
const pageChecked = (watch: CatalogueWatch) => {
  const entry = journal.get(watch.id);
  return Boolean(
    entry &&
    !entry.error &&
    entry.referenceOnPage &&
    entry.pageUrl &&
    pageKind(entry.pageUrl, watch.brand),
  );
};
const byPage = pending.filter(pageChecked);
const withoutPage = pending.filter((watch) => !pageChecked(watch));
console.log(
  `${pending.length} pending: ${byPage.length} with the maker's or a shop's page, ${withoutPage.length} without (${withoutPage.filter((watch) => !journal.has(watch.id)).length} not checked).`,
);

if (makeSheet) {
  const sheet = {
    id: `pending-${date}`,
    date,
    report: `.scratch/repair/${run}.jsonl`,
    cards: withoutPage.map((watch) => ({
      id: watch.id,
      caseId: "pending-review",
      tool: "quiz" as const,
      request: {
        en: "Catalogue entry waiting for review, not a recommendation for one visitor: check that every fact on the card is right for this exact reference.",
        ru: "Запись каталога на проверке: верен ли каждый факт для этого референса.",
      },
      section: "main",
      brand: watch.brand,
      model: watch.model,
      referenceCode: watch.referenceCode,
      price:
        watch.priceAmount !== null && watch.priceCurrency
          ? { amount: watch.priceAmount, currency: watch.priceCurrency }
          : null,
      priceConfirmed: watch.priceStatus === "confirmed",
      caseDiameterMm: watch.caseDiameterMm,
      movement: watch.movement,
      waterResistanceM: watch.waterResistanceM,
      verified: watch.referenceConfirmed,
      sourceUrl: watch.sourceUrl,
    })),
  };
  const output = resolve(`docs/reports/rating-sheet-pending-${date}.json`);
  writeFileSync(output, `${JSON.stringify(sheet, null, 2)}\n`);
  console.log(`Wrote ${output} (${sheet.cards.length} cards for the judge).`);
}

const verdicts = new Map<string, { rating: string; reason: string }>();
if (judgePath)
  for (const verdict of (
    JSON.parse(readFileSync(judgePath, "utf8")) as {
      verdicts: { card: string; rating?: string; reason?: string }[];
    }
  ).verdicts)
    if (verdict.rating)
      verdicts.set(verdict.card, {
        rating: verdict.rating,
        reason: verdict.reason ?? "",
      });

const decisions = pending.map((watch) => {
  if (pageChecked(watch))
    return {
      watch,
      approve: true,
      reason: "the maker's or a shop's page gives the reference",
    };
  const verdict = verdicts.get(watch.id);
  if (!verdict)
    return {
      watch,
      approve: false,
      reason: "no page and not judged",
    };
  return verdict.rating === "wrong"
    ? {
        watch,
        approve: false,
        reason: `judge: ${verdict.reason.slice(0, 200)}`,
      }
    : {
        watch,
        approve: true,
        reason: `no page; judge found no wrong fact (${verdict.rating})`,
      };
});

let approved = 0;
let failed = 0;
if (approve) {
  const client = catalogueClient();
  if (!client) throw new Error("No catalogue client.");
  for (const decision of decisions) {
    if (!decision.approve) continue;
    try {
      if (await reviewCatalogueWatch(client, decision.watch.id, "approved"))
        approved += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
    await new Promise((done) => setTimeout(done, 250));
  }
}
const report = {
  at: new Date().toISOString(),
  run,
  judge: judgePath ?? null,
  pending: pending.length,
  byPage: byPage.length,
  withoutPage: withoutPage.length,
  toApprove: decisions.filter((decision) => decision.approve).length,
  approved,
  failed,
  stayPending: decisions
    .filter((decision) => !decision.approve)
    .map((decision) => ({
      id: decision.watch.id,
      brand: decision.watch.brand,
      model: decision.watch.model,
      reference: decision.watch.referenceCode,
      reason: decision.reason,
    })),
};
if (approve || judgePath) {
  const output = resolve(`docs/reports/review-pending-${date}.json`);
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Wrote ${output}`);
}
console.log(
  JSON.stringify({ ...report, stayPending: report.stayPending.length }),
);
process.exit(0);
