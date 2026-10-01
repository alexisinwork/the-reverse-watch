// Scores the cheaper-alternative finder against the owner's test set
// (data/alternatives/): for each popular watch and each of its three
// budgets, is the owner's suggested alternative in our top 5 / top 10, and
// what do we suggest instead? Catalogue only, no web search, no cost.
//   node --env-file=.env --import tsx scripts/evaluate-alternatives.ts
import { readFileSync, writeFileSync } from "node:fs";

import { rankAlternatives } from "../app/domain/alternatives";
import { resolveNamedWatch } from "../app/domain/alternatives.server";
import { loadFxTable } from "../app/domain/fx.server";
import {
  catalogueClient,
  listCatalogue,
} from "../app/domain/watch-catalogue.server";

type TestCase = {
  original: string;
  alternatives: {
    watch: string;
    eur?: [number, number];
    usd?: [number, number];
    quartz?: boolean;
    used?: boolean;
  }[];
};
const set = JSON.parse(
  readFileSync("data/alternatives/owner-test-set-2026-10-01.json", "utf8"),
) as { cases: TestCase[] };

const client = catalogueClient();
if (!client) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");
const catalogue = await listCatalogue(client);
const fx = await loadFxTable();

const fold = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9 ]/g, " ");
const words = (value: string) =>
  fold(value)
    .split(/\s+/)
    .filter(
      (word) =>
        word.length > 1 &&
        !["mm", "the", "automatic", "auto", "quartz"].includes(word),
    );
const matchesOwnerPick = (pick: string, brand: string, model: string) => {
  const have = fold(`${brand} ${model}`);
  return words(pick)
    .slice(0, 3)
    .every((word) => have.includes(word));
};

const lines: string[] = [];
let budgets = 0;
let inTop5 = 0;
let inTop10 = 0;
let ownerPickInCatalogue = 0;
let withResults = 0;

for (const testCase of set.cases) {
  const resolved = resolveNamedWatch(catalogue, testCase.original, null);
  const target =
    resolved.status === "found"
      ? resolved.watch
      : resolved.status === "ambiguous"
        ? resolved.options[0]!
        : null;
  lines.push(
    `### ${testCase.original}${target ? ` → ${target.brand} ${target.model} (${target.caseDiameterMm ?? "?"} mm, traits ${target.designTraits ? "read" : "missing"})` : " → not in the catalogue"}`,
    "",
  );
  if (!target) continue;
  for (const alternative of testCase.alternatives) {
    const [low, high] = alternative.eur ?? alternative.usd!;
    const currency = alternative.eur ? "EUR" : "USD";
    const amount = Math.round((low + high) / 2);
    budgets += 1;
    const ranked = rankAlternatives(
      target,
      catalogue,
      { kind: "exact", amount, currency },
      alternative.quartz === true,
      fx,
    );
    if (ranked.length > 0) withResults += 1;
    const position = ranked.findIndex((entry) =>
      matchesOwnerPick(alternative.watch, entry.watch.brand, entry.watch.model),
    );
    const inCatalogue = catalogue.some((watch) =>
      matchesOwnerPick(alternative.watch, watch.brand, watch.model),
    );
    if (inCatalogue) ownerPickInCatalogue += 1;
    if (position >= 0 && position < 5) inTop5 += 1;
    if (position >= 0 && position < 10) inTop10 += 1;
    lines.push(
      `- **${currency} ${amount.toLocaleString("en")}${alternative.quartz ? ", quartz OK" : ""}**: your pick *${alternative.watch}* ${position >= 0 ? `is our #${position + 1}` : inCatalogue ? "is in the catalogue but not in our top 10" : "isn't in our catalogue"}.`,
      `  Our top 3: ${
        ranked
          .slice(0, 3)
          .map(
            (entry) =>
              `${entry.watch.brand} ${entry.watch.model} (${Math.round(entry.price.amount)} ${entry.price.currency}${entry.price.condition === "pre-owned" ? ", pre-owned" : ""})`,
          )
          .join("; ") || "nothing in this budget"
      }`,
    );
  }
  lines.push("");
}

const percent = (part: number, whole: number) =>
  `${Math.round((part / Math.max(1, whole)) * 100)}%`;
const report = [
  `# Cheaper-alternative finder vs the owner's test set (${new Date().toISOString().slice(0, 10)})`,
  "",
  `${set.cases.length} popular watches × 3 budgets = ${budgets} searches, catalogue only (no live search, no pre-owned lookups).`,
  "",
  `- Searches with at least one alternative: **${withResults}/${budgets}** (${percent(withResults, budgets)})`,
  `- Your pick is in our catalogue at all: ${ownerPickInCatalogue}/${budgets}`,
  `- Your pick in our top 5: **${inTop5}** (${percent(inTop5, ownerPickInCatalogue)} of those in the catalogue); top 10: ${inTop10}`,
  "",
  "Your picks are one good answer each, not the only one: the top 3 we suggest are listed so you can judge them.",
  "",
  ...lines,
];
writeFileSync(".catalogue-build/alternatives-evaluation.md", report.join("\n"));
writeFileSync(
  "C:/Users/alexi/OneDrive/Desktop/TheReserve_alternatives-evaluation.md",
  report.join("\n"),
);
console.log(report.slice(0, 8).join("\n"));
