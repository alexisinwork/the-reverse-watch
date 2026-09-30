// Checks every pending catalogue watch once more using only Muse Spark's own
// web search, and approves those Muse confirms: the watch exists and is
// in production, its reference and case size agree with ours, and it has
// a price (ours, or one Muse found, stored as approximate). Watches Muse
// cannot confirm stay pending, with the reason in the report.
//   node --env-file=.env --import tsx scripts/muse-review-pending.ts [--dry-run] [--limit N] [--budget 20]
import { writeFileSync } from "node:fs";

import {
  defaultDeps,
  museWebResearch,
  parseModelJson,
} from "../app/domain/ai-providers.server";
import { normalizeReference } from "../app/domain/ai-watch-guardrails";
import type { CatalogueWatch } from "../app/domain/watch-catalogue";
import {
  catalogueClient,
  listCatalogue,
  recordCataloguePrice,
  reviewCatalogueWatch,
} from "../app/domain/watch-catalogue.server";

const argument = (name: string) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};
const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = Number(argument("--limit") ?? Infinity);
const BUDGET_USD = Number(argument("--budget") ?? 20);
const CONCURRENCY = 6;
// Meta's price: $2.50 per 1,000 searches or page opens, plus tokens
// (measured at about one cent per call of this size).
const COST_PER_TOOL_CALL = 0.0025;
const COST_PER_CALL = 0.01;

const client = catalogueClient();
const deps = defaultDeps();
if (!client || !deps.config.museSpark) {
  throw new Error("Supabase service key and MUSE_SPARK_API_KEY are required.");
}

const INSTRUCTIONS = [
  "You are the fact-checking desk of The Reserve, a watch publication.",
  "For the watch given, search the live web and open the manufacturer's own product page; if you cannot find it, an authorised retailer's page or a well-known watch publication or dealer listing of it new.",
  "Report only what those pages show; use null for anything you could not confirm. Never guess a reference, size or price.",
  "found is true if a page you opened shows this watch (same brand and model; a slightly different model name is fine when the reference matches). inProduction is false only if a page says it is discontinued.",
  "price is the manufacturer's or an authorised retailer's current list price for a new watch.",
  "Answer only in the JSON format requested.",
].join(" ");

const SCHEMA = {
  type: "object",
  properties: {
    found: { type: "boolean" },
    inProduction: { type: ["boolean", "null"] },
    referenceCode: { type: ["string", "null"] },
    caseDiameterMm: { type: ["number", "null"] },
    priceAmount: { type: ["number", "null"] },
    priceCurrency: { type: ["string", "null"] },
    pageUrl: { type: ["string", "null"] },
  },
  required: ["found"],
};

type MuseAnswer = {
  found?: unknown;
  inProduction?: unknown;
  referenceCode?: unknown;
  caseDiameterMm?: unknown;
  priceAmount?: unknown;
  priceCurrency?: unknown;
  pageUrl?: unknown;
};

type Row = {
  watch: CatalogueWatch;
  outcome: "approved" | "stays pending" | "error";
  reason: string;
};

const PRICE_CURRENCIES = new Set(["USD", "EUR", "GBP", "CHF"]);

function sameReference(ours: string | null, theirs: unknown) {
  const a = normalizeReference(ours);
  const b = typeof theirs === "string" ? normalizeReference(theirs) : null;
  if (!a || !b) return true;
  return a === b || a.includes(b) || b.includes(a);
}

let spent = 0;

async function review(watch: CatalogueWatch): Promise<Row> {
  const research = await museWebResearch(
    [
      `Watch: ${watch.brand} ${watch.model}`,
      watch.referenceCode ? `Reference: ${watch.referenceCode}` : null,
      watch.sourceUrl
        ? `Open this page first; it is where we found the watch: ${watch.sourceUrl}`
        : null,
      watch.caseDiameterMm
        ? `Case diameter we have: ${watch.caseDiameterMm} mm`
        : null,
    ]
      .filter(Boolean)
      .join("\n"),
    deps,
    {
      instructions: INSTRUCTIONS,
      schema: SCHEMA,
      maxToolCalls: 8,
      timeoutMs: 90_000,
    },
  );
  spent += COST_PER_CALL + research.toolCalls * COST_PER_TOOL_CALL;
  const answer = parseModelJson(research.text) as MuseAnswer;

  if (answer.found !== true)
    return {
      watch,
      outcome: "stays pending",
      reason: "Muse found no page for this exact watch",
    };
  if (answer.inProduction === false)
    return {
      watch,
      outcome: "stays pending",
      reason: "Muse found it discontinued",
    };
  if (!sameReference(watch.referenceCode, answer.referenceCode))
    return {
      watch,
      outcome: "stays pending",
      reason: `reference differs (Muse: ${String(answer.referenceCode)})`,
    };
  if (
    typeof answer.caseDiameterMm === "number" &&
    watch.caseDiameterMm !== null &&
    Math.abs(answer.caseDiameterMm - watch.caseDiameterMm) > 1
  ) {
    return {
      watch,
      outcome: "stays pending",
      reason: `case size differs (Muse: ${answer.caseDiameterMm} mm, ours ${watch.caseDiameterMm} mm)`,
    };
  }

  let priced =
    watch.priceStatus !== "unconfirmed" && watch.priceAmount !== null;
  let priceNote = priced ? `our ${watch.priceStatus} price` : "";
  const currency =
    typeof answer.priceCurrency === "string"
      ? answer.priceCurrency.toUpperCase()
      : null;
  if (
    !priced &&
    typeof answer.priceAmount === "number" &&
    answer.priceAmount > 0 &&
    currency &&
    PRICE_CURRENCIES.has(currency)
  ) {
    if (!DRY_RUN) {
      await recordCataloguePrice(client!, watch.id, {
        kind: "approximate",
        amount: answer.priceAmount,
        currency,
        evidence: {
          method: "muse_review",
          pageUrl: typeof answer.pageUrl === "string" ? answer.pageUrl : null,
          openedPages: research.openedPages.slice(0, 5),
          checkedAt: new Date().toISOString(),
        },
      });
    }
    priced = true;
    priceNote = `Muse price ${currency} ${answer.priceAmount}`;
  }
  if (!priced)
    return { watch, outcome: "stays pending", reason: "no price found" };

  if (!DRY_RUN) await reviewCatalogueWatch(client!, watch.id, "approved");
  return {
    watch,
    outcome: "approved",
    reason: `confirmed by Muse; ${priceNote}`,
  };
}

const pending = (await listCatalogue(client, true))
  .filter((watch) => watch.reviewStatus === "pending")
  .slice(0, LIMIT);
console.log(
  `${pending.length} pending watches to check${DRY_RUN ? " (dry run: nothing is written)" : ""}.`,
);

const queue = [...pending];
const rows: Row[] = [];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let watch = queue.shift(); watch; watch = queue.shift()) {
      if (spent >= BUDGET_USD) break;
      const row = await review(watch).catch((error: unknown): Row => ({
        watch,
        outcome: "error",
        reason: error instanceof Error ? error.message.slice(0, 120) : "error",
      }));
      rows.push(row);
      console.log(
        `${String(rows.length).padStart(4)}/${pending.length} $${spent.toFixed(2)} ${row.outcome.padEnd(13)} ${watch.brand} ${watch.model}: ${row.reason}`,
      );
    }
  }),
);

const count = (outcome: Row["outcome"]) =>
  rows.filter((row) => row.outcome === outcome).length;
const report = [
  `# Muse check of pending catalogue watches (${new Date().toISOString().slice(0, 10)})${DRY_RUN ? " — dry run" : ""}`,
  "",
  `Checked ${rows.length} of ${pending.length} pending watches with Muse Spark's web search only. About $${spent.toFixed(2)} spent.`,
  "",
  `- Approved: **${count("approved")}**`,
  `- Still pending: **${count("stays pending")}**`,
  `- Errors (will be retried on the next run): **${count("error")}**`,
  "",
  "## Still pending, and why",
  "",
  ...rows
    .filter((row) => row.outcome !== "approved")
    .map(
      (row) =>
        `- ${row.watch.brand} ${row.watch.model}${row.watch.referenceCode ? ` (${row.watch.referenceCode})` : ""}: ${row.reason}`,
    ),
  "",
];
const file = `muse-pending-review${DRY_RUN ? "-dry-run" : ""}.md`;
writeFileSync(`.catalogue-build/${file}`, report.join("\n"));
writeFileSync(
  `C:/Users/alexi/OneDrive/Desktop/TheReserve_${file}`,
  report.join("\n"),
);
console.log(`\n${report.slice(2, 8).join("\n")}`);
