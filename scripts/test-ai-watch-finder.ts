import {
  quizBrief,
  runAiWatchSearch,
} from "../app/domain/ai-watch-finder.server";
import { goldenEvaluationProfiles } from "../app/domain/evaluation-fixtures";
import { QUESTIONNAIRE_V3_VERSION, type ProfileV3 } from "../app/domain/questionnaire-v3";

// Deliberately unsatisfiable, to exercise the honest "no match" path.
const impossibleProfile: ProfileV3 = {
  version: QUESTIONNAIRE_V3_VERSION,
  budgetCurrency: "USD",
  budgetMax: 50,
  wearingScenarios: ["diving"],
  minimumWaterResistanceM: 300,
  caseDiameterMinMm: 59,
  caseDiameterMaxMm: 60,
  movementTypes: ["spring_drive"],
  requiredComplications: [],
  allergyConstraint: "none",
};

async function run(label: string, profile: ProfileV3) {
  const brief = quizBrief(profile);
  console.log(`\n=== ${label} ===`);
  console.log("Brief sent to the AI (the only data it sees):");
  console.log([brief.task, ...brief.lines].join("\n"));

  const started = Date.now();
  const result = await runAiWatchSearch(brief);
  console.log(`\nResult after ${Math.round((Date.now() - started) / 1000)} s: ${result.status}`);
  if (result.status === "found") {
    console.log(result.summary);
    result.watches.forEach((watch, index) => {
      console.log(
        `${index + 1}. ${watch.brand} ${watch.model}${watch.referenceCode ? ` (${watch.referenceCode})` : ""}` +
          `${watch.priceNote ? ` — ${watch.priceNote}` : ""}\n   source: ${watch.sourceUrl}\n   image:  ${watch.imageUrl ?? "none"}`,
      );
    });
  } else if (result.status === "no_match") {
    console.log(result.summary);
  }
}

async function main() {
  await run("Broad profile", goldenEvaluationProfiles[0]!);
  await run("Impossible profile", impossibleProfile);
}

await main();
