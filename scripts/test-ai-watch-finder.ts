// Live end-to-end timing of the AI search engine against real providers.
//   npx tsx --env-file=.env scripts/test-ai-watch-finder.ts
import { searchFilmWatches } from "../app/domain/film-search.server";
import { searchQuizWatches } from "../app/domain/quiz-live-search.server";
import type { AiSearchOutcome } from "../app/domain/ai-watch-types";
import type { ProfileV4 } from "../app/domain/questionnaire-v4";

async function time(label: string, run: () => Promise<AiSearchOutcome>) {
  const started = performance.now();
  const result = await run();
  console.log(
    `\n=== ${label}: ${((performance.now() - started) / 1000).toFixed(1)} s, ${result.status} ===`,
  );
  if (result.status === "no_match") console.log(result.summary);
  if (result.status === "found") {
    console.log(result.summary);
    for (const watch of result.watches) {
      console.log(
        `  ${watch.brand} ${watch.model} ${watch.referenceCode ?? ""} ${watch.priceNote ?? ""}` +
          ` | ${watch.details.sourceKind ?? watch.details.person ?? ""} | photo ${watch.imageUrl ? "yes" : "no"}`,
      );
    }
  }
}

const office: ProfileV4 = {
  version: 4,
  budgetCurrency: "EUR",
  priceRange: "3000_4000",
  wristCm: 17.5,
  wearingScenarios: ["office", "everyday"],
  minimumWaterResistanceM: 100,
  movementTypes: ["automatic"],
  requiredComplications: [],
  allergyConstraint: "none",
};

await time("quiz: EUR 3k-4k, office, 100 m, automatic", () =>
  searchQuizWatches(office),
);
await time("quiz: USD 1k-2k, nickel allergy", () =>
  searchQuizWatches({
    ...office,
    budgetCurrency: "USD",
    priceRange: "1000_2000",
    allergyConstraint: "nickel_contact",
  }),
);
await time("film: Daniel Craig", () => searchFilmWatches("Daniel Craig"));
await time("film: Succession", () => searchFilmWatches("Succession"));
