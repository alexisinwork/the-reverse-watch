// Proves on the real catalogue that the cheaper-alternative finder's new
// reads (migration 0117) give exactly what the old whole-pool read gave:
// the same resolved watch for each typed name, the same ranked alternatives
// for each budget, and the same full rows. Targets and budgets come from the
// owner's test set (data/alternatives/owner-test-set-2026-10-01.json).
// Read-only: no writes, no paid provider calls.
//
//   node --env-file=.env --import tsx scripts/check-alternatives-window-equivalence.ts
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  alternativesCatalogueWindow,
  hasComparisonFacts,
  rankAlternatives,
  type AlternativesBudget,
} from "../app/domain/alternatives";
import { resolveNamedWatch } from "../app/domain/alternatives.server";
import { loadFxTable } from "../app/domain/fx.server";
import {
  catalogueClient,
  listCatalogue,
  loadAlternativesWindow,
  loadCatalogueRowsById,
  loadNameIndexCached,
} from "../app/domain/watch-catalogue.server";

type TestCase = {
  original: string;
  alternatives: { eur?: [number, number]; usd?: [number, number] }[];
};
const set = JSON.parse(
  readFileSync("data/alternatives/owner-test-set-2026-10-01.json", "utf8"),
) as { cases: TestCase[] };

const client = catalogueClient();
if (!client) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}
const fx = await loadFxTable();
if (!fx) {
  throw new Error("Exchange rates are unavailable; rerun later.");
}

let startedAt = performance.now();
const full = await listCatalogue(client);
const fullReadMs = Math.round(performance.now() - startedAt);
const fullById = new Map(full.map((row) => [row.id, row]));
startedAt = performance.now();
const index = await loadNameIndexCached(client);
const indexReadMs = Math.round(performance.now() - startedAt);
console.log(
  `Whole pool ${full.length} rows in ${fullReadMs} ms; name index ${index.length} rows in ${indexReadMs} ms`,
);

const differences: string[] = [];
const differ = (message: string) => {
  differences.push(message);
  console.error(`DIFFERENCE: ${message}`);
};
if (index.length !== full.length) {
  differ(`name index has ${index.length} rows, pool ${full.length}`);
}

// Typed names: each original as typed, a shortened form and a near miss.
const names = set.cases.flatMap((testCase) => {
  const words = testCase.original.split(" ");
  return [
    testCase.original,
    words.slice(0, 2).join(" "),
    words.length >= 3 ? [...words.slice(0, -1), "Zzz"].join(" ") : null,
  ].filter((name): name is string => name !== null);
});
const windowTimes: number[] = [];
let resolvedCount = 0;
let rankedCount = 0;
const shownIds = new Set<string>();

for (const name of [...new Set(names)]) {
  const old = resolveNamedWatch(full, name, null);
  const next = resolveNamedWatch(index, name, null);
  const describe = (result: typeof old | typeof next) =>
    result.status === "found"
      ? `found:${result.watch.id}`
      : result.status === "ambiguous"
        ? `ambiguous:${result.options.map((option) => option.id).join(",")}`
        : "not_found";
  if (describe(old) !== describe(next)) {
    differ(`resolve "${name}": ${describe(old)} vs ${describe(next)}`);
    continue;
  }
  if (old.status !== "found" || !hasComparisonFacts(old.watch)) {
    continue;
  }
  resolvedCount++;
  const target = old.watch;
  const testCase = set.cases.find((entry) => entry.original === name);
  const budgets: AlternativesBudget[] = [
    { kind: "range", rangeId: "0_500", currency: "EUR" },
    { kind: "range", rangeId: "500_1000", currency: "USD" },
    { kind: "range", rangeId: "2000_3000", currency: "GBP" },
    { kind: "exact", amount: 1_500, currency: "USD" },
    { kind: "exact", amount: 6_000, currency: "CHF" },
    ...(testCase?.alternatives ?? []).map((alternative) => {
      const [low, high] = alternative.usd ?? alternative.eur ?? [500, 500];
      return {
        kind: "exact" as const,
        amount: Math.max(50, Math.round((low + high) / 2)),
        currency: alternative.usd ? "USD" : "EUR",
      };
    }),
  ];
  for (const budget of budgets) {
    for (const allowQuartz of [true, false]) {
      const label = `${name} / ${JSON.stringify(budget)} / quartz ${allowQuartz}`;
      const before = rankAlternatives(
        target,
        full,
        budget,
        allowQuartz,
        fx,
        30,
      );
      startedAt = performance.now();
      const window = await loadAlternativesWindow(
        client,
        alternativesCatalogueWindow(target, budget, allowQuartz, fx),
      );
      windowTimes.push(performance.now() - startedAt);
      const after = rankAlternatives(
        target,
        window,
        budget,
        allowQuartz,
        fx,
        30,
      );
      const key = (list: typeof before | typeof after) =>
        list
          .map(
            (entry) =>
              `${entry.watch.id}:${entry.points.toFixed(6)}:${entry.price.condition}:${entry.price.amount.toFixed(4)}`,
          )
          .join("|");
      if (key(before) !== key(after)) {
        differ(`${label}: ranked alternatives differ`);
      }
      rankedCount += before.length;
      for (const entry of after) shownIds.add(entry.watch.id);
    }
  }
}

const hydrated = await loadCatalogueRowsById(client, [...shownIds]);
if (hydrated.length !== shownIds.size) {
  differ(`${shownIds.size - hydrated.length} shown rows not read in full`);
}
for (const row of hydrated) {
  if (JSON.stringify(row) !== JSON.stringify(fullById.get(row.id))) {
    differ(`full row ${row.id} differs from the whole-pool read`);
  }
}

const sorted = [...windowTimes].sort((a, b) => a - b);
const report = {
  at: new Date().toISOString(),
  fxDate: fx.date,
  wholePool: { rows: full.length, readMs: fullReadMs },
  nameIndex: { rows: index.length, readMs: indexReadMs },
  namesCompared: new Set(names).size,
  targetsResolved: resolvedCount,
  windowsCompared: windowTimes.length,
  alternativesCompared: rankedCount,
  fullRowsCompared: hydrated.length,
  window: {
    readMsP50: Math.round(sorted[Math.floor(sorted.length / 2)] ?? 0),
    readMsMax: Math.round(sorted.at(-1) ?? 0),
  },
  differences,
  result: differences.length === 0 ? "PASS" : "FAIL",
};
const output = resolve(
  `docs/reports/alternatives-window-equivalence-${report.at.slice(0, 10)}.json`,
);
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(
  JSON.stringify({ ...report, differences: differences.length }, null, 2),
);
console.log(`Wrote ${output}`);
if (differences.length) {
  process.exit(1);
}
