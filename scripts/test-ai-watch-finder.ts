import {
  findWatchWithAi,
  loadAiWatchFinderConfig,
} from "../app/domain/ai-watch-finder.server";
import { goldenEvaluationProfiles } from "../app/domain/evaluation-fixtures";
import { QUESTIONNAIRE_V3_VERSION, type ProfileV3 } from "../app/domain/questionnaire-v3";

// Deliberately unsatisfiable by any real catalogue entry. With the
// vetted-candidate gate removed, this now still goes through the exact same
// Muse Spark -> Perplexity tool-calling path as any other profile.
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
  console.log(`\n=== ${label} ===`);
  console.log("Outgoing non-PII constraint payload (this is ALL the AI ever sees):");
  console.log(JSON.stringify(profile, null, 2));

  const config = loadAiWatchFinderConfig();
  try {
    const result = await findWatchWithAi(profile, config);
    switch (result.status) {
      case "found":
        console.log(
          `RESULT: found ${result.brand} ${result.model} ` +
            `(${result.referenceCode ?? "no reference code"}) — ${result.sourceUrl ?? "no source URL"}`,
        );
        console.log(`Rationale: ${result.rationale}`);
        break;
      case "no_match":
        console.log(`RESULT: no match. Rationale: ${result.rationale}`);
        break;
      case "unavailable":
        console.log(`RESULT: unavailable — ${result.reason}`);
        break;
    }
  } catch (error) {
    console.log(`RESULT: error — ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main() {
  await run("Broad, easily satisfiable profile", goldenEvaluationProfiles[0]!);
  await run("Deliberately impossible profile", impossibleProfile);
}

await main();
