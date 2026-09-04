import { z } from "zod";

import { CASE_SHAPES } from "./sheet-intake";
import { CURRENCIES, derivePriceBand } from "./questionnaire";

export const QUESTIONNAIRE_V3_VERSION = 3 as const;
export const QUESTIONNAIRE_V3_STORAGE_KEY =
  "the-reserve:diagnostic:v3" as const;

export const WATER_RESISTANCE_MINIMUMS = [0, 30, 50, 100, 200, 300] as const;
export const MOVEMENT_TYPE_CHOICES = [
  "automatic",
  "manual",
  "quartz",
  "solar",
  "spring_drive",
  "hybrid",
] as const;
export const MOVEMENT_CONSTRUCTIONS = ["mass_produced", "manufacture"] as const;
export const CRYSTAL_CHOICES = [
  "sapphire",
  "mineral",
  "acrylic",
  "other",
] as const;
export const ALLERGY_CONSTRAINTS_V3 = ["none", "nickel_contact"] as const;

export const profileV3Schema = z
  .object({
    version: z.literal(QUESTIONNAIRE_V3_VERSION),
    budgetCurrency: z.enum(CURRENCIES),
    budgetMax: z.number().finite().positive().max(10_000_000),
    wearingScenarios: z.array(z.string().min(1)).min(1).max(12),
    minimumWaterResistanceM: z.number().int().nonnegative().max(12_000),
    caseDiameterMinMm: z.number().finite().min(20).max(60),
    caseDiameterMaxMm: z.number().finite().min(20).max(60),
    movementTypes: z.array(z.enum(MOVEMENT_TYPE_CHOICES)).min(1),
    requiredComplications: z.array(z.string().min(1)).max(24),
    allergyConstraint: z.enum(ALLERGY_CONSTRAINTS_V3),
    maxCaseThicknessMm: z.number().finite().min(3).max(30).optional(),
    caseShape: z.enum(CASE_SHAPES).optional(),
    movementConstruction: z.enum(MOVEMENT_CONSTRUCTIONS).optional(),
    displayCaseback: z.boolean().optional(),
    crystal: z.enum(CRYSTAL_CHOICES).optional(),
    microAdjustmentRequired: z.boolean().optional(),
  })
  .strict()
  .superRefine((profile, context) => {
    const unique = (values: string[]) => new Set(values).size === values.length;
    if (profile.caseDiameterMaxMm < profile.caseDiameterMinMm) {
      context.addIssue({
        code: "custom",
        path: ["caseDiameterMaxMm"],
        message: "The maximum diameter cannot be below the minimum.",
      });
    }
    if (!unique(profile.movementTypes)) {
      context.addIssue({
        code: "custom",
        path: ["movementTypes"],
        message: "A movement type can only be selected once.",
      });
    }
    if (!unique(profile.wearingScenarios)) {
      context.addIssue({
        code: "custom",
        path: ["wearingScenarios"],
        message: "A wearing scenario can only be selected once.",
      });
    }
    if (!unique(profile.requiredComplications)) {
      context.addIssue({
        code: "custom",
        path: ["requiredComplications"],
        message: "A complication can only be selected once.",
      });
    }
  });

export type ProfileV3 = z.infer<typeof profileV3Schema>;

export function normalizeProfileV3(profile: ProfileV3) {
  return {
    ...profile,
    derived: {
      priceBand: derivePriceBand(profile.budgetMax),
      effectiveBudgetCeiling: profile.budgetMax,
    },
  };
}
