// Proves on the real catalogue that the archetype window (migration 0116)
// gives exactly the catalogue supplements the old whole-pool read gave, for
// every archetype and price band, and measures both. Read-only: no writes,
// no paid provider calls.
//
//   node --env-file=.env --import tsx scripts/check-archetype-window-equivalence.ts
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  archetypeCatalogueWindow,
  rankEnrichedArchetype,
} from "../app/domain/archetype-catalogue.server";
import {
  ARCHETYPE_BANDS,
  type PriceComfort,
} from "../app/domain/archetype-picks";
import type { ArchetypeId } from "../app/domain/discovery-archetype";
import { loadFxTable } from "../app/domain/fx.server";
import {
  catalogueClient,
  listCatalogue,
  loadArchetypeWindow,
  loadCatalogueRowsById,
} from "../app/domain/watch-catalogue.server";

const client = catalogueClient();
if (!client) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}
const fx = await loadFxTable();
if (!fx) {
  throw new Error("Exchange rates are unavailable; rerun later.");
}
const ARCHETYPES: ArchetypeId[] = [
  "field_rationalist",
  "quiet_custodian",
  "architectural_modernist",
  "expressive_collector",
  "mechanical_connoisseur",
  "recognised_standard_bearer",
];
const BANDS = Object.keys(ARCHETYPE_BANDS) as PriceComfort[];

let startedAt = performance.now();
const full = await listCatalogue(client);
const fullReadMs = Math.round(performance.now() - startedAt);
const fullById = new Map(full.map((row) => [row.id, row]));
console.log(`Whole pool: ${full.length} rows in ${fullReadMs} ms`);

const differences: string[] = [];
const results = [];
for (const archetype of ARCHETYPES) {
  for (const band of BANDS) {
    const label = `${archetype} / ${band}`;
    // Old path: rank the whole pool, keep rows that become cards, first 20.
    const old = rankEnrichedArchetype(full, archetype, band, fx)
      .filter((watch) => watch.sourceUrl)
      .slice(0, 20)
      .map((watch) => watch.id);
    startedAt = performance.now();
    const window =
      archetype === "recognised_standard_bearer"
        ? []
        : await loadArchetypeWindow(
            client,
            archetypeCatalogueWindow(archetype, band, fx),
          );
    const windowMs = Math.round(performance.now() - startedAt);
    const next = rankEnrichedArchetype(window, archetype, band, fx)
      .filter((watch) => watch.sourceUrl)
      .slice(0, 20)
      .map((watch) => watch.id);
    if (old.length !== next.length || old.some((id, i) => id !== next[i])) {
      differences.push(`${label}: supplements differ`);
      console.error(`DIFFERENCE: ${label}`);
    }
    const hydrated = await loadCatalogueRowsById(client, next);
    if (hydrated.length !== next.length) {
      differences.push(
        `${label}: ${next.length - hydrated.length} rows not read`,
      );
    }
    for (const row of hydrated) {
      if (JSON.stringify(row) !== JSON.stringify(fullById.get(row.id))) {
        differences.push(`${label}: full row ${row.id} differs`);
      }
    }
    results.push({
      archetype,
      band,
      windowRows: window.length,
      windowMs,
      supplements: next.length,
    });
  }
}

const times = results
  .filter((result) => result.archetype !== "recognised_standard_bearer")
  .map((result) => result.windowMs)
  .sort((a, b) => a - b);
const report = {
  at: new Date().toISOString(),
  fxDate: fx.date,
  wholePool: { rows: full.length, readMs: fullReadMs },
  combinations: results.length,
  supplementsCompared: results.reduce((sum, r) => sum + r.supplements, 0),
  window: {
    rowsMax: Math.max(...results.map((r) => r.windowRows)),
    readMsP50: times[Math.floor(times.length / 2)],
    readMsMax: times.at(-1),
  },
  results,
  differences,
  result: differences.length === 0 ? "PASS" : "FAIL",
};
const output = resolve(
  `docs/reports/archetype-window-equivalence-${report.at.slice(0, 10)}.json`,
);
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(
  JSON.stringify(
    { ...report, results: undefined, differences: differences.length },
    null,
    2,
  ),
);
console.log(`Wrote ${output}`);
if (differences.length) {
  process.exit(1);
}
