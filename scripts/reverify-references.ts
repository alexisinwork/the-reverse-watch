// Re-checks every catalogue watch shown as "reference confirmed". Until
// 2026-09-30 a missing (404) maker page could confirm a reference when the
// URL contained it, and AI output sometimes invented such URLs. For each
// watch: the stored page is checked again with the fixed rule; if it does
// not show the reference, the maker's or an authorised retailer's real page
// is searched for. Found: that page is stored. Not found: the badge is
// dropped, so the watch shows under "Also worth a look".
//   node --env-file=.env --import tsx scripts/reverify-references.ts [--dry-run] [--limit N]
import { writeFileSync } from "node:fs";

import { defaultDeps, findPages } from "../app/domain/ai-providers.server";
import {
  classifySource,
  normalizeReference,
} from "../app/domain/ai-watch-guardrails";
import { inspectSourcePage } from "../app/domain/source-pages.server";
import type { CatalogueWatch } from "../app/domain/watch-catalogue";
import {
  catalogueClient,
  listCatalogue,
  reviewCatalogueWatch,
} from "../app/domain/watch-catalogue.server";

const DRY_RUN = process.argv.includes("--dry-run");
const limitIndex = process.argv.indexOf("--limit");
const LIMIT =
  limitIndex === -1 ? Infinity : Number(process.argv[limitIndex + 1]);
const CONCURRENCY = 8;

const client = catalogueClient();
const deps = defaultDeps();
if (!client || !deps.config.perplexity) {
  throw new Error("Supabase service key and PERPLEXITY_API_KEY are required.");
}

type Outcome =
  "page still good" | "real page found" | "badge dropped" | "error";
type Row = { watch: CatalogueWatch; outcome: Outcome; detail: string };

async function reverify(watch: CatalogueWatch): Promise<Row> {
  const stored = watch.sourceUrl
    ? await inspectSourcePage(watch.sourceUrl, watch.referenceCode, fetch)
    : null;
  if (stored?.referenceFound) {
    return { watch, outcome: "page still good", detail: watch.sourceUrl! };
  }

  const reference = normalizeReference(watch.referenceCode);
  const hits = reference
    ? await findPages([`${watch.brand} ${watch.referenceCode}`], deps)
    : [];
  const candidates = hits
    .filter(
      (hit) =>
        hit.url !== watch.sourceUrl &&
        classifySource(hit.url, watch.brand) !== null &&
        `${hit.url} ${hit.title} ${hit.snippet}`
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .includes(reference!),
    )
    .map((hit) => hit.url)
    .filter((url, index, all) => all.indexOf(url) === index)
    .slice(0, 3);
  for (const url of candidates) {
    const page = await inspectSourcePage(url, watch.referenceCode, fetch);
    // Only a page that opened and shows the reference counts here.
    if (!page.reachable || !page.referenceFound) continue;
    if (!DRY_RUN) {
      await reviewCatalogueWatch(client!, watch.id, null, {
        sourceUrl: url,
        ...(watch.imageUrl || !page.imageUrl
          ? {}
          : { imageUrl: page.imageUrl }),
      });
    }
    return { watch, outcome: "real page found", detail: url };
  }

  if (!DRY_RUN) {
    await reviewCatalogueWatch(client!, watch.id, null, {
      referenceConfirmed: false,
    });
  }
  return {
    watch,
    outcome: "badge dropped",
    detail: reference
      ? "no maker or authorised-retailer page shows this reference"
      : "no reference to confirm",
  };
}

const confirmed = (await listCatalogue(client, true))
  .filter(
    (watch) => watch.reviewStatus !== "rejected" && watch.referenceConfirmed,
  )
  .slice(0, LIMIT);
console.log(
  `${confirmed.length} watches marked "reference confirmed" to re-check${DRY_RUN ? " (dry run: nothing is written)" : ""}.`,
);

const queue = [...confirmed];
const rows: Row[] = [];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let watch = queue.shift(); watch; watch = queue.shift()) {
      const row = await reverify(watch).catch((error: unknown): Row => ({
        watch,
        outcome: "error",
        detail: error instanceof Error ? error.message.slice(0, 120) : "error",
      }));
      rows.push(row);
      if (rows.length % 25 === 0 || row.outcome === "error") {
        console.log(
          `${String(rows.length).padStart(4)}/${confirmed.length} ${row.outcome.padEnd(15)} ${watch.brand} ${watch.model}: ${row.detail}`,
        );
      }
    }
  }),
);

const count = (outcome: Outcome) =>
  rows.filter((row) => row.outcome === outcome).length;
const report = [
  `# Reference re-check (${new Date().toISOString().slice(0, 10)})${DRY_RUN ? " — dry run" : ""}`,
  "",
  `Re-checked ${rows.length} watches marked "reference confirmed".`,
  "",
  `- Stored page is real and shows the reference: **${count("page still good")}**`,
  `- Stored page was wrong; the real maker/retailer page was found and stored: **${count("real page found")}**`,
  `- No page confirms the reference; badge dropped (now under "Also worth a look"): **${count("badge dropped")}**`,
  `- Errors (unchanged; rerun to retry): **${count("error")}**`,
  "",
  "## Badge dropped",
  "",
  ...rows
    .filter((row) => row.outcome === "badge dropped")
    .map(
      (row) =>
        `- ${row.watch.brand} ${row.watch.model}${row.watch.referenceCode ? ` (${row.watch.referenceCode})` : ""} [${row.watch.reviewStatus}]`,
    ),
  "",
];
const file = `reference-recheck${DRY_RUN ? "-dry-run" : ""}.md`;
writeFileSync(`.catalogue-build/${file}`, report.join("\n"));
writeFileSync(
  `C:/Users/alexi/OneDrive/Desktop/TheReserve_${file}`,
  report.join("\n"),
);
console.log(`\n${report.slice(2, 9).join("\n")}`);
