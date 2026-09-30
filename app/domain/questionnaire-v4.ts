import { z } from "zod";

import { CASE_SHAPES } from "./sheet-intake";
import {
  ALLERGY_CONSTRAINTS_V3,
  CRYSTAL_CHOICES,
  MOVEMENT_CONSTRUCTIONS,
  MOVEMENT_TYPE_CHOICES,
} from "./questionnaire-v3";

export const QUESTIONNAIRE_V4_VERSION = 4 as const;
export const QUESTIONNAIRE_V4_STORAGE_KEY = "the-reserve:diagnostic:v4" as const;

export const BUDGET_CURRENCIES = ["USD", "EUR", "GBP", "CHF"] as const;
export type BudgetCurrency = (typeof BUDGET_CURRENCIES)[number];

export type PriceRange = {
  id: string;
  minimum: number;
  /** null for the open-ended top range. */
  maximum: number | null;
};

function buildPriceRanges(): PriceRange[] {
  const bounds = [0, 500, 1_000];
  for (let value = 2_000; value <= 10_000; value += 1_000) bounds.push(value);
  for (let value = 15_000; value <= 50_000; value += 5_000) bounds.push(value);
  for (let value = 75_000; value <= 100_000; value += 25_000) bounds.push(value);
  for (let value = 200_000; value <= 1_000_000; value += 100_000) bounds.push(value);
  const ranges: PriceRange[] = bounds.slice(0, -1).map((minimum, index) => ({
    id: `${minimum}_${bounds[index + 1]}`,
    minimum,
    maximum: bounds[index + 1]!,
  }));
  ranges.push({ id: "1000000_plus", minimum: 1_000_000, maximum: null });
  return ranges;
}

/**
 * 0–500, 500–1k, then 1k steps to 10k, 5k steps to 50k, 25k steps to 100k,
 * 100k steps to 1M, then 1M+. The same numbers apply in every currency.
 */
export const PRICE_RANGES: readonly PriceRange[] = buildPriceRanges();
const PRICE_RANGE_IDS = PRICE_RANGES.map((range) => range.id) as [
  string,
  ...string[],
];

export function findPriceRange(id: string) {
  return PRICE_RANGES.find((range) => range.id === id) ?? null;
}

function compact(value: number) {
  if (value >= 1_000_000) return `${value / 1_000_000}M`;
  if (value >= 1_000) return `${value / 1_000}k`;
  return String(value);
}

export function priceRangeLabel(range: PriceRange, currency?: string) {
  const prefix = currency ? `${currency} ` : "";
  return range.maximum === null
    ? `${prefix}${compact(range.minimum)}+`
    : `${prefix}${compact(range.minimum)}–${compact(range.maximum)}`;
}

export const WRIST_CM_MIN = 12;
export const WRIST_CM_MAX = 25;

/**
 * A conventional proportion guide: the case diameter range that sits well
 * on a wrist of this circumference. It replaces asking for a diameter.
 */
export function caseDiameterForWrist(wristCm: number) {
  if (wristCm < 15) return { minimumMm: 34, maximumMm: 38 };
  if (wristCm < 16) return { minimumMm: 35, maximumMm: 39 };
  if (wristCm < 17) return { minimumMm: 37, maximumMm: 40 };
  if (wristCm < 18) return { minimumMm: 38, maximumMm: 42 };
  if (wristCm < 19) return { minimumMm: 40, maximumMm: 43 };
  if (wristCm < 20) return { minimumMm: 41, maximumMm: 44 };
  return { minimumMm: 42, maximumMm: 46 };
}

export const CASE_DIAMETER_MM_MIN = 20;
export const CASE_DIAMETER_MM_MAX = 60;

/**
 * The enforced case diameter range: the visitor's edited range when given,
 * otherwise the one the wrist suggests.
 */
export function diameterRangeFor(profile: {
  wristCm: number;
  caseDiameterMinMm?: number;
  caseDiameterMaxMm?: number;
}) {
  if (profile.caseDiameterMinMm !== undefined && profile.caseDiameterMaxMm !== undefined) {
    return { minimumMm: profile.caseDiameterMinMm, maximumMm: profile.caseDiameterMaxMm };
  }
  return caseDiameterForWrist(profile.wristCm);
}

export const profileV4Schema = z
  .object({
    version: z.literal(QUESTIONNAIRE_V4_VERSION),
    budgetCurrency: z.enum(BUDGET_CURRENCIES),
    priceRange: z.enum(PRICE_RANGE_IDS, {
      message: "Choose a price range.",
    }),
    wristCm: z
      .number()
      .finite()
      .min(WRIST_CM_MIN, "Enter a wrist size of at least 12 cm (4.7 in).")
      .max(WRIST_CM_MAX, "Enter a wrist size of at most 25 cm (9.8 in)."),
    caseDiameterMinMm: z
      .number()
      .finite()
      .min(CASE_DIAMETER_MM_MIN, "Enter a case diameter of at least 20 mm.")
      .max(CASE_DIAMETER_MM_MAX, "Enter a case diameter of at most 60 mm.")
      .optional(),
    caseDiameterMaxMm: z
      .number()
      .finite()
      .min(CASE_DIAMETER_MM_MIN, "Enter a case diameter of at least 20 mm.")
      .max(CASE_DIAMETER_MM_MAX, "Enter a case diameter of at most 60 mm.")
      .optional(),
    wearingScenarios: z.array(z.string().min(1)).min(1).max(12),
    minimumWaterResistanceM: z.number().int().nonnegative().max(12_000),
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
    if ((profile.caseDiameterMinMm === undefined) !== (profile.caseDiameterMaxMm === undefined)) {
      context.addIssue({
        code: "custom",
        path: ["caseDiameterMaxMm"],
        message: "Enter both the smallest and the largest case diameter.",
      });
    } else if (
      profile.caseDiameterMinMm !== undefined &&
      profile.caseDiameterMaxMm !== undefined &&
      profile.caseDiameterMinMm > profile.caseDiameterMaxMm
    ) {
      context.addIssue({
        code: "custom",
        path: ["caseDiameterMaxMm"],
        message: "The largest case diameter must not be smaller than the smallest.",
      });
    }
    for (const field of [
      "wearingScenarios",
      "movementTypes",
      "requiredComplications",
    ] as const) {
      if (!unique(profile[field])) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: "Each option can only be selected once.",
        });
      }
    }
  });

export type ProfileV4 = z.infer<typeof profileV4Schema>;
