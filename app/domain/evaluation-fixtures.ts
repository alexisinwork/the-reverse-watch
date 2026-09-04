import type { ProfileV3 } from "./questionnaire-v3";
import { QUESTIONNAIRE_V3_VERSION } from "./questionnaire-v3";

const EVERY_SCENARIO = [
  "everyday",
  "office",
  "smart_casual",
  "suit",
  "evening",
  "reception",
  "sport",
  "field",
  "diving",
] as const;

const EVERY_MOVEMENT = [
  "automatic",
  "manual",
  "quartz",
  "solar",
  "spring_drive",
  "hybrid",
] as const;

/**
 * Profiles shared by parity and deterministic baseline evaluations. Each one
 * isolates a single hard dimension so a SQL/TypeScript divergence names itself.
 */
export const goldenEvaluationProfiles: readonly ProfileV3[] = [
  {
    version: QUESTIONNAIRE_V3_VERSION,
    budgetCurrency: "USD",
    budgetMax: 1_000_000,
    wearingScenarios: [...EVERY_SCENARIO],
    minimumWaterResistanceM: 0,
    caseDiameterMinMm: 20,
    caseDiameterMaxMm: 60,
    movementTypes: [...EVERY_MOVEMENT],
    requiredComplications: [],
    allergyConstraint: "none",
  },
  {
    version: QUESTIONNAIRE_V3_VERSION,
    budgetCurrency: "USD",
    budgetMax: 1_000,
    wearingScenarios: [...EVERY_SCENARIO],
    minimumWaterResistanceM: 0,
    caseDiameterMinMm: 20,
    caseDiameterMaxMm: 60,
    movementTypes: [...EVERY_MOVEMENT],
    requiredComplications: [],
    allergyConstraint: "none",
  },
  {
    version: QUESTIONNAIRE_V3_VERSION,
    budgetCurrency: "EUR",
    budgetMax: 15_000,
    wearingScenarios: [...EVERY_SCENARIO],
    minimumWaterResistanceM: 0,
    caseDiameterMinMm: 38,
    caseDiameterMaxMm: 40,
    movementTypes: [...EVERY_MOVEMENT],
    requiredComplications: [],
    allergyConstraint: "none",
  },
  {
    version: QUESTIONNAIRE_V3_VERSION,
    budgetCurrency: "USD",
    budgetMax: 25_000,
    wearingScenarios: [...EVERY_SCENARIO],
    minimumWaterResistanceM: 300,
    caseDiameterMinMm: 20,
    caseDiameterMaxMm: 60,
    movementTypes: [...EVERY_MOVEMENT],
    requiredComplications: [],
    allergyConstraint: "none",
  },
  {
    version: QUESTIONNAIRE_V3_VERSION,
    budgetCurrency: "CHF",
    budgetMax: 7_000,
    wearingScenarios: [...EVERY_SCENARIO],
    minimumWaterResistanceM: 0,
    caseDiameterMinMm: 20,
    caseDiameterMaxMm: 60,
    movementTypes: ["quartz"],
    requiredComplications: [],
    allergyConstraint: "none",
  },
  {
    version: QUESTIONNAIRE_V3_VERSION,
    budgetCurrency: "GBP",
    budgetMax: 20_000,
    wearingScenarios: ["office", "everyday"],
    minimumWaterResistanceM: 0,
    caseDiameterMinMm: 20,
    caseDiameterMaxMm: 60,
    movementTypes: [...EVERY_MOVEMENT],
    requiredComplications: ["date"],
    allergyConstraint: "nickel_contact",
  },
];
