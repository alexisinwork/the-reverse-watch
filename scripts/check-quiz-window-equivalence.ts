// Proves on the real catalogue that the quiz's database window (migration
// 0115) selects exactly what the old whole-catalogue read selected, and
// measures both. Read-only: no writes, no paid provider calls.
//
//   node --env-file=.env --import tsx scripts/check-quiz-window-equivalence.ts
//
// Writes docs/reports/quiz-window-equivalence-<date>.json and exits 1 on any
// difference.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { normalizeReference } from "../app/domain/ai-watch-guardrails";
import { loadFxTable } from "../app/domain/fx.server";
import { PRICE_RANGES, type ProfileV4 } from "../app/domain/questionnaire-v4";
import {
  broaderNearFits,
  catalogueIdentityKey,
  matchCatalogue,
  nearFits,
  QUIZ_RESULT_LIMIT,
  quizCatalogueWindow,
  type CatalogueMatchFacts,
  type CatalogueWatch,
} from "../app/domain/watch-catalogue";
import {
  catalogueClient,
  listCatalogue,
  loadCatalogueRowsById,
  loadPoolIdentityKeysCached,
  loadQuizWindow,
  lookupPoolRows,
} from "../app/domain/watch-catalogue.server";

const client = catalogueClient();
if (!client) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}
const fx = await loadFxTable();
if (!fx) {
  throw new Error("Exchange rates are unavailable; rerun later.");
}

const differences: string[] = [];
const differ = (message: string) => {
  differences.push(message);
  console.error(`DIFFERENCE: ${message}`);
};

// 1. The old path: the whole recommendation pool.
let startedAt = performance.now();
const full = await listCatalogue(client);
const fullReadMs = Math.round(performance.now() - startedAt);
const fullById = new Map(full.map((row) => [row.id, row]));
console.log(`Whole pool: ${full.length} rows in ${fullReadMs} ms`);

// 2. Identity keys: stored keys equal the keys the quiz computes.
const recomputed = full.filter(
  (row) =>
    catalogueIdentityKey(row.brand, row.model, row.referenceCode) !==
    row.identityKey,
);
if (recomputed.length) {
  differ(`${recomputed.length} pool rows store a different identity key`);
}
startedAt = performance.now();
const poolKeys = await loadPoolIdentityKeysCached(client);
const poolKeysMs = Math.round(performance.now() - startedAt);
const fullKeys = new Set(full.map((row) => row.identityKey));
if (
  poolKeys.size !== fullKeys.size ||
  [...fullKeys].some((key) => !poolKeys.has(key))
) {
  differ(
    `pool identity keys: ${poolKeys.size} from the database, ${fullKeys.size} in the whole pool`,
  );
}

// 3. Quiz answers across budgets, currencies, sizes and requirements.
const currencies = ["USD", "EUR", "GBP", "CHF"] as const;
const ranges = PRICE_RANGES.filter(
  (range) => range.maximum === null || range.maximum <= 20_000,
).concat(PRICE_RANGES.filter((range) => range.minimum >= 50_000).slice(0, 2));
const scenarios = [["office"], ["everyday"], ["resort"], ["travel", "office"]];
const profiles: ProfileV4[] = [];
ranges.forEach((range, rangeIndex) => {
  currencies.forEach((currency, currencyIndex) => {
    const variant = rangeIndex * currencies.length + currencyIndex;
    const custom = variant % 3 === 0;
    profiles.push({
      version: 4,
      budgetCurrency: currency,
      priceRange: range.id,
      wristCm: 15 + (variant % 6),
      ...(custom
        ? {
            caseDiameterMinMm: 36 + (variant % 5),
            caseDiameterMaxMm: 39 + (variant % 5),
          }
        : {}),
      wearingScenarios: scenarios[variant % scenarios.length]!,
      minimumWaterResistanceM: [0, 50, 100, 200][variant % 4]!,
      movementTypes:
        variant % 5 === 0 ? ["quartz", "solar"] : ["automatic", "manual"],
      requiredComplications: variant % 7 === 0 ? ["date"] : [],
      allergyConstraint: variant % 11 === 0 ? "nickel_contact" : "none",
      ...(variant % 4 === 1 ? { caseShape: "round" } : {}),
      ...(variant % 6 === 2 ? { crystal: "sapphire" } : {}),
    });
  });
});

const ids = (rows: readonly { id: string }[]) => rows.map((row) => row.id);
const same = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);
const windowTimes: number[] = [];
const windowSizes: number[] = [];
const totals = { exact: 0, close: 0, broader: 0, hydrated: 0 };

for (const [index, profile] of profiles.entries()) {
  const label = `#${index} ${profile.budgetCurrency} ${profile.priceRange}`;
  startedAt = performance.now();
  const window = await loadQuizWindow(client, quizCatalogueWindow(profile, fx));
  windowTimes.push(performance.now() - startedAt);
  windowSizes.push(window.length);

  const select = (rows: readonly CatalogueMatchFacts[]) => {
    const matched = matchCatalogue(rows, profile, fx);
    const taken = new Set(
      [...matched.main, ...matched.alsoWorth].map((row) => row.identityKey),
    );
    const limit =
      QUIZ_RESULT_LIMIT * 3 - matched.main.length - matched.alsoWorth.length;
    const close = nearFits(rows, profile, fx, limit, taken);
    const broader = broaderNearFits(
      rows,
      profile,
      fx,
      limit - close.length,
      new Set([...taken, ...close.map(({ watch }) => watch.identityKey)]),
    );
    return { ...matched, close, broader };
  };
  const old = select(full);
  const next = select(window);
  if (!same(ids(old.main), ids(next.main))) differ(`${label}: shortlist`);
  if (!same(ids(old.alsoWorth), ids(next.alsoWorth)))
    differ(`${label}: also worth a look`);
  const entries = (list: { watch: { id: string }; misses: string[] }[]) =>
    list.map(({ watch, misses }) => `${watch.id}:${misses.join(",")}`);
  if (!same(entries(old.close), entries(next.close)))
    differ(`${label}: close fits`);
  if (!same(entries(old.broader), entries(next.broader)))
    differ(`${label}: broader close fits`);
  totals.exact += old.main.length + old.alsoWorth.length;
  totals.close += old.close.length;
  totals.broader += old.broader.length;

  // Shown watches are read again in full; they must equal the old rows.
  const shown = [
    ...next.main,
    ...next.alsoWorth,
    ...next.close.map(({ watch }) => watch),
    ...next.broader.map(({ watch }) => watch),
  ];
  const hydrated = await loadCatalogueRowsById(client, ids(shown));
  totals.hydrated += hydrated.length;
  if (hydrated.length !== new Set(ids(shown)).size)
    differ(`${label}: ${shown.length - hydrated.length} shown rows not read`);
  for (const row of hydrated) {
    if (JSON.stringify(row) !== JSON.stringify(fullById.get(row.id))) {
      differ(`${label}: full row ${row.id} differs from the whole-pool read`);
    }
  }
}

// 4. Lookups used for live and saved results.
const fold = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const sample = full.filter((row) => normalizeReference(row.referenceCode));
const lookups = Array.from(
  { length: 60 },
  (_, index) => sample[(index * 7919) % sample.length]!,
);
for (const row of lookups) {
  const expected = new Set(
    full
      .filter(
        (candidate: CatalogueWatch) =>
          candidate.identityKey === row.identityKey ||
          (fold(candidate.brand) === fold(row.brand) &&
            normalizeReference(candidate.referenceCode) ===
              normalizeReference(row.referenceCode)),
      )
      .map((candidate) => candidate.id),
  );
  const found = await lookupPoolRows(client, {
    identityKeys: [row.identityKey],
    references: [{ brand: row.brand, referenceCode: row.referenceCode! }],
  });
  const got = new Set(found.map((candidate) => candidate.id));
  if (got.size !== expected.size || [...expected].some((id) => !got.has(id))) {
    differ(`lookup ${row.identityKey}: ${got.size} vs ${expected.size}`);
  }
}

const sorted = [...windowTimes].sort((a, b) => a - b);
const percentile = (p: number) =>
  Math.round(
    sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!,
  );
const report = {
  at: new Date().toISOString(),
  fxDate: fx.date,
  wholePool: { rows: full.length, readMs: fullReadMs },
  poolIdentityKeys: { keys: poolKeys.size, readMs: poolKeysMs },
  profiles: profiles.length,
  window: {
    rowsMin: Math.min(...windowSizes),
    rowsMedian: [...windowSizes].sort((a, b) => a - b)[
      Math.floor(windowSizes.length / 2)
    ],
    rowsMax: Math.max(...windowSizes),
    readMsP50: percentile(0.5),
    readMsP95: percentile(0.95),
    readMsMax: Math.round(sorted.at(-1)!),
  },
  compared: totals,
  lookupsCompared: lookups.length,
  differences,
  result: differences.length === 0 ? "PASS" : "FAIL",
};
const output = resolve(
  `docs/reports/quiz-window-equivalence-${report.at.slice(0, 10)}.json`,
);
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(
  JSON.stringify({ ...report, differences: differences.length }, null, 2),
);
console.log(`Wrote ${output}`);
if (differences.length) {
  process.exit(1);
}
