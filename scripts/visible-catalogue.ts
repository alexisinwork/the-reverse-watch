// The catalogue watches the tools actually show (catalogue completion,
// owner 2026-11-27: "детально дополни существующий каталог"). Completing
// every imported record would cost about $70 and take most of a day, so the
// completion starts with the records visitors can see: this script runs the
// site's own selection code, without paid calls or writes, over a grid of
// quiz answers (every price range up to 10k, three wrists, six wearing
// scenarios, two water-resistance needs, two movement choices), every
// archetype and price band, and the owner's 60 cheaper-alternative cases,
// and lists every catalogue record that reaches the first 20 places.
//
//   node --env-file=.env --import tsx scripts/visible-catalogue.ts --out <ids.json>
//
// The output is a JSON list of catalogue ids, most often shown first.
import { writeFileSync } from "node:fs";

import type { ProfileV4 } from "../app/domain/questionnaire-v4";
import { PRICE_RANGES } from "../app/domain/questionnaire-v4";
import {
  archetypeCatalogueWindow,
  rankEnrichedArchetype,
} from "../app/domain/archetype-catalogue.server";
import {
  alternativesCatalogueWindow,
  hasComparisonFacts,
  rankAlternatives,
  type AlternativesBudget,
} from "../app/domain/alternatives";
import { resolveNamedWatch } from "../app/domain/alternatives.server";
import {
  ARCHETYPE_IDS,
  PRICE_COMFORTS,
} from "../app/domain/discovery-archetype";
import { loadFxTable } from "../app/domain/fx.server";
import { searchQuiz } from "../app/domain/quiz-search.server";
import {
  catalogueClient,
  listCatalogue,
  loadAlternativesWindow,
  loadArchetypeWindow,
  loadCatalogueRowsById,
  loadNameIndexCached,
} from "../app/domain/watch-catalogue.server";
import { fold, loadOwnerAlternatives, ownerCaseBudget } from "./eval-sets";

const at = process.argv.indexOf("--out");
const out = at > 0 ? process.argv[at + 1] : undefined;
if (!out) throw new Error("--out <ids.json> is required.");
const client = catalogueClient();
if (!client) throw new Error("SUPABASE_URL and the service key are required.");
const fx = await loadFxTable();
if (!fx) throw new Error("Exchange rates are unavailable; rerun later.");

const catalogue = await listCatalogue(client);
const byKey = new Map(
  catalogue
    .filter((watch) => watch.referenceCode)
    .map((watch) => [
      `${fold(watch.brand)}|${fold(watch.referenceCode!)}`,
      watch.id,
    ]),
);
const shown = new Map<string, number>();
const see = (id: string | undefined) => {
  if (id) shown.set(id, (shown.get(id) ?? 0) + 1);
};

// 1. The quiz, without live search.
const profiles: ProfileV4[] = [];
for (const range of PRICE_RANGES.filter(
  (item) => item.maximum !== null && item.maximum <= 10_000,
))
  for (const wristCm of [15.5, 17, 18.5])
    for (const scenario of [
      "office",
      "everyday",
      "black_tie",
      "sport",
      "diving",
      "travel",
    ])
      for (const minimumWaterResistanceM of [0, 100])
        for (const movementTypes of [
          ["automatic", "manual"],
          ["quartz", "solar"],
        ])
          profiles.push({
            version: 4,
            budgetCurrency: "USD",
            priceRange: range.id,
            wristCm,
            wearingScenarios: [scenario],
            minimumWaterResistanceM,
            movementTypes,
            requiredComplications: [],
            allergyConstraint: "none",
          } as ProfileV4);
let next = 0;
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (next < profiles.length) {
      const profile = profiles[next++]!;
      const view = await searchQuiz(profile, {
        client,
        loadFx: () => Promise.resolve(fx),
        runLive: () => Promise.resolve({ status: "unavailable" as const }),
      });
      if (view.status !== "found") continue;
      for (const card of [...view.watches, ...(view.alsoWorth ?? [])].slice(
        0,
        20,
      ))
        if (card.referenceCode)
          see(byKey.get(`${fold(card.brand)}|${fold(card.referenceCode)}`));
    }
  }),
);
const afterQuiz = shown.size;

// 2. The archetype quiz's catalogue supplements.
for (const archetype of ARCHETYPE_IDS)
  for (const band of PRICE_COMFORTS) {
    if (archetype === "recognised_standard_bearer") continue;
    const window = await loadArchetypeWindow(
      client,
      archetypeCatalogueWindow(archetype, band, fx),
    );
    for (const watch of rankEnrichedArchetype(window, archetype, band, fx)
      .filter((row) => row.sourceUrl)
      .slice(0, 20))
      see(watch.id);
  }
const afterArchetype = shown.size;

// 3. Cheaper alternatives for the owner's cases.
const nameIndex = await loadNameIndexCached(client);
for (const testCase of loadOwnerAlternatives().cases) {
  const resolved = resolveNamedWatch(nameIndex, testCase.original, null);
  if (resolved.status !== "found" || !hasComparisonFacts(resolved.watch))
    continue;
  const [target] = await loadCatalogueRowsById(client, [resolved.watch.id]);
  if (!target) continue;
  for (const alternative of testCase.alternatives) {
    const budget: AlternativesBudget = ownerCaseBudget(alternative);
    const allowQuartz = Boolean(alternative.quartz);
    const window = await loadAlternativesWindow(
      client,
      alternativesCatalogueWindow(target, budget, allowQuartz, fx),
    );
    for (const entry of rankAlternatives(
      target,
      window,
      budget,
      allowQuartz,
      fx,
      20,
    ))
      see(entry.watch.id);
  }
}

const ids = [...shown].sort((a, b) => b[1] - a[1]).map(([id]) => id);
const records = new Map(catalogue.map((watch) => [watch.id, watch]));
const imported = ids.filter(
  (id) => records.get(id)?.sourceKind === "catalogue",
);
writeFileSync(out, `${JSON.stringify(ids, null, 0)}\n`);
console.log(
  JSON.stringify({
    quizProfiles: profiles.length,
    shownRecords: ids.length,
    fromQuiz: afterQuiz,
    addedByArchetype: afterArchetype - afterQuiz,
    addedByAlternatives: ids.length - afterArchetype,
    importedFromDatabases: imported.length,
    importedLackingWaterPhotoOrThickness: imported.filter((id) => {
      const watch = records.get(id)!;
      return (
        !watch.waterResistanceM || !watch.imageUrl || !watch.caseThicknessMm
      );
    }).length,
  }),
);
process.exit(0);
