import { z } from "zod";

export const QUESTIONNAIRE_VERSION = 2 as const;
export const QUESTIONNAIRE_STORAGE_KEY = "the-reserve:diagnostic:v2" as const;

export const CURRENCIES = ["USD", "EUR", "GBP", "CHF", "PLN"] as const;

export const PRICE_BANDS = [
  { id: "under_300", minimum: 0, maximumExclusive: 300, label: "Under 300" },
  { id: "300_500", minimum: 300, maximumExclusive: 500, label: "300–500" },
  {
    id: "500_1000",
    minimum: 500,
    maximumExclusive: 1_000,
    label: "500–1,000",
  },
  {
    id: "1000_2000",
    minimum: 1_000,
    maximumExclusive: 2_000,
    label: "1,000–2,000",
  },
  {
    id: "2000_5000",
    minimum: 2_000,
    maximumExclusive: 5_000,
    label: "2,000–5,000",
  },
  {
    id: "5000_10000",
    minimum: 5_000,
    maximumExclusive: 10_000,
    label: "5,000–10,000",
  },
  {
    id: "10000_15000",
    minimum: 10_000,
    maximumExclusive: 15_000,
    label: "10,000–15,000",
  },
  {
    id: "15000_plus",
    minimum: 15_000,
    maximumExclusive: null,
    label: "15,000+",
  },
] as const;

const INCHES_TO_MM = 25.4;

export const WRIST_BANDS = [
  {
    id: "under_5_75",
    minimumMm: 100,
    maximumExclusiveMm: 5.75 * INCHES_TO_MM,
    label: "Under 5.75 in",
  },
  {
    id: "5_75_6_25",
    minimumMm: 5.75 * INCHES_TO_MM,
    maximumExclusiveMm: 6.25 * INCHES_TO_MM,
    label: "5.75–6.25 in",
  },
  {
    id: "6_25_6_75",
    minimumMm: 6.25 * INCHES_TO_MM,
    maximumExclusiveMm: 6.75 * INCHES_TO_MM,
    label: "6.25–6.75 in",
  },
  {
    id: "6_75_7_5",
    minimumMm: 6.75 * INCHES_TO_MM,
    maximumExclusiveMm: 7.5 * INCHES_TO_MM,
    label: "6.75–7.5 in",
  },
  {
    id: "7_5_plus",
    minimumMm: 7.5 * INCHES_TO_MM,
    maximumExclusiveMm: null,
    label: "Over 7.5 in",
  },
] as const;

export const DEPLOYMENT_ENVIRONMENTS = [
  "field_water_abuse",
  "studio_desk_daily",
  "formal_architectural",
] as const;

export const OWNERSHIP_FRICTION_LEVELS = [
  "zero_maintenance",
  "workhorse_mechanical",
  "specialist_mechanical",
] as const;

export const ACCURACY_TOLERANCES = [
  "seconds_per_month",
  "within_5_seconds_per_day",
  "within_15_seconds_per_day",
  "no_requirement",
] as const;

export const WEIGHT_LIMITS = [
  "under_80_g",
  "under_120_g",
  "under_160_g",
  "no_limit",
] as const;

export const WEIGHT_LIMIT_GRAMS = {
  under_80_g: 80,
  under_120_g: 120,
  under_160_g: 160,
  no_limit: null,
} as const satisfies Record<(typeof WEIGHT_LIMITS)[number], number | null>;

export const COMPLICATIONS = [
  "gmt",
  "chronograph",
  "moonphase",
  "power_reserve",
  "alarm",
  "world_time",
  "perpetual_calendar",
] as const;

export const DATE_PREFERENCES = ["required", "forbidden", "either"] as const;

export const SOCIAL_SIGNALS = [
  "discreet_competence",
  "quiet_continuity",
  "unapologetic_benchmark",
  "anti_luxury",
] as const;

export const AESTHETIC_DNA = [
  "structural_tool",
  "mid_century_industrial",
  "integrated_geometry",
  "extravagant_creative",
  "high_art",
] as const;

export const PROVENANCE_PREFERENCES = [
  "sovereign_independent",
  "industrial_reality",
  "modern_transparent",
] as const;

export const EMOTIONAL_OBJECTIVES = [
  "dependability",
  "custody",
  "differentiation",
  "milestone",
] as const;

export const MARKET_STANCES = [
  "evergreen",
  "contrarian",
  "trend_agnostic",
] as const;
export const SPECULATIVE_RISK_TOLERANCES = ["avoid", "accept"] as const;
export const LUG_CURVATURES = ["flat", "moderate", "steep"] as const;
export const ATTACHMENT_TYPES = [
  "spring_bar",
  "quick_release",
  "proprietary",
  "integrated",
] as const;
export const ACQUISITION_CHANNELS = [
  "authorized_dealer",
  "grey_market",
  "secondary_market",
] as const;
export const AVAILABILITY_TOLERANCES = [
  "in_stock_only",
  "short_wait",
  "waitlist_or_allocation",
] as const;
export const LIQUIDITY_PREFERENCES = [
  "not_important",
  "prefer_60_percent_plus",
  "require_80_percent_plus",
] as const;
export const LUME_PREFERENCES = [
  "not_important",
  "some_lume",
  "strong_lume",
] as const;
export const CROWN_POSITIONS = ["3", "4", "9_destro"] as const;
export const COSMETIC_TOLERANCES = [
  "wear_and_patina_ok",
  "light_wear_ok",
  "keep_looking_new",
] as const;
export const CONDITIONS = [
  "new",
  "certified_pre_owned",
  "pre_owned",
  "vintage",
] as const;
export const ALLERGY_CONSTRAINTS = ["none", "nickel_contact"] as const;

const coreProfileBaseSchema = z
  .object({
    version: z.literal(QUESTIONNAIRE_VERSION),
    budgetCurrency: z.enum(CURRENCIES),
    budgetMax: z.number().finite().positive().max(10_000_000),
    wristCircumferenceMm: z.number().finite().min(100).max(300),
    deploymentEnvironment: z.enum(DEPLOYMENT_ENVIRONMENTS),
    ownershipFriction: z.enum(OWNERSHIP_FRICTION_LEVELS),
    accuracyTolerance: z.enum(ACCURACY_TOLERANCES),
    weightLimit: z.enum(WEIGHT_LIMITS),
    requiredComplications: z
      .array(z.enum(COMPLICATIONS))
      .max(COMPLICATIONS.length),
    datePreference: z.enum(DATE_PREFERENCES),
  })
  .strict();

export const coreProfileSchema = coreProfileBaseSchema.superRefine(
  (profile, context) => {
    if (
      new Set(profile.requiredComplications).size !==
      profile.requiredComplications.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["requiredComplications"],
        message: "A complication can only be selected once.",
      });
    }
  },
);

const countryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, "Use a two-letter country code.");

const refinementBaseSchema = z
  .object({
    socialSignal: z.enum(SOCIAL_SIGNALS).optional(),
    aestheticDna: z.enum(AESTHETIC_DNA).optional(),
    provenancePreference: z.enum(PROVENANCE_PREFERENCES).optional(),
    emotionalObjective: z.enum(EMOTIONAL_OBJECTIVES).optional(),
    marketStance: z.enum(MARKET_STANCES).optional(),
    speculativeRiskTolerance: z.enum(SPECULATIVE_RISK_TOLERANCES).optional(),
    requiredLugCurvature: z.enum(LUG_CURVATURES).optional(),
    requiredAttachmentType: z.enum(ATTACHMENT_TYPES).optional(),
    requiredLugWidthMm: z.number().finite().min(8).max(40).optional(),
    quickReleaseRequired: z.boolean().optional(),
    acquisitionChannels: z.array(z.enum(ACQUISITION_CHANNELS)).optional(),
    availabilityTolerance: z.enum(AVAILABILITY_TOLERANCES).optional(),
    premiumAllowancePercent: z.number().int().min(0).max(100).optional(),
    liquidityPreference: z.enum(LIQUIDITY_PREFERENCES).optional(),
    lumePreference: z.enum(LUME_PREFERENCES).optional(),
    crownPosition: z.enum(CROWN_POSITIONS).optional(),
    purchaseCountry: countryCodeSchema.optional(),
    serviceCountry: countryCodeSchema.optional(),
    cosmeticTolerance: z.enum(COSMETIC_TOLERANCES).optional(),
    acceptedConditions: z.array(z.enum(CONDITIONS)).optional(),
    allergyConstraint: z.enum(ALLERGY_CONSTRAINTS).optional(),
  })
  .strict();

export const refinementSchema = refinementBaseSchema.superRefine(
  (refinement, context) => {
    const premium = refinement.premiumAllowancePercent ?? 0;
    const premiumChannelSelected = refinement.acquisitionChannels?.some(
      (channel) => channel === "grey_market" || channel === "secondary_market",
    );

    if (premium > 0 && !premiumChannelSelected) {
      context.addIssue({
        code: "custom",
        path: ["premiumAllowancePercent"],
        message:
          "A premium allowance requires a grey- or secondary-market channel.",
      });
    }

    if (
      refinement.acceptedConditions &&
      new Set(refinement.acceptedConditions).size !==
        refinement.acceptedConditions.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["acceptedConditions"],
        message: "A condition can only be selected once.",
      });
    }
  },
);

export const questionnaireProfileSchema = z
  .object({
    core: coreProfileSchema,
    refinement: refinementSchema.optional(),
  })
  .strict();

export type CoreProfile = z.infer<typeof coreProfileSchema>;
export type RefinementProfile = z.infer<typeof refinementSchema>;
export type QuestionnaireProfile = z.infer<typeof questionnaireProfileSchema>;
export type PriceBandId = (typeof PRICE_BANDS)[number]["id"];
export type WristBandId = (typeof WRIST_BANDS)[number]["id"];

export function derivePriceBand(amount: number): PriceBandId {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new RangeError("Price must be a positive finite number.");
  }

  const band = PRICE_BANDS.find(
    ({ minimum, maximumExclusive }) =>
      amount >= minimum &&
      (maximumExclusive === null || amount < maximumExclusive),
  );

  if (!band) throw new RangeError("Price is outside the supported bands.");
  return band.id;
}

export function deriveWristBand(circumferenceMm: number): WristBandId {
  if (
    !Number.isFinite(circumferenceMm) ||
    circumferenceMm < 100 ||
    circumferenceMm > 300
  ) {
    throw new RangeError("Wrist circumference must be between 100 and 300 mm.");
  }

  const band = WRIST_BANDS.find(
    ({ minimumMm, maximumExclusiveMm }) =>
      circumferenceMm >= minimumMm &&
      (maximumExclusiveMm === null || circumferenceMm < maximumExclusiveMm),
  );

  if (!band) throw new RangeError("Wrist is outside the supported bands.");
  return band.id;
}

export function effectiveBudgetCeiling(
  budgetMax: number,
  premiumAllowancePercent = 0,
): number {
  if (!Number.isFinite(budgetMax) || budgetMax <= 0) {
    throw new RangeError("Budget must be a positive finite number.");
  }
  if (
    !Number.isInteger(premiumAllowancePercent) ||
    premiumAllowancePercent < 0 ||
    premiumAllowancePercent > 100
  ) {
    throw new RangeError("Premium allowance must be an integer from 0 to 100.");
  }

  return budgetMax * (1 + premiumAllowancePercent / 100);
}

export function permitsSpeculativeCandidate(
  refinement: RefinementProfile | undefined,
): boolean {
  const acceptsEligibleChannel = refinement?.acquisitionChannels?.some(
    (channel) => channel === "grey_market" || channel === "secondary_market",
  );

  return (
    acceptsEligibleChannel === true &&
    refinement?.speculativeRiskTolerance === "accept"
  );
}

export function normalizeProfile(profile: QuestionnaireProfile) {
  const premiumAllowancePercent =
    profile.refinement?.premiumAllowancePercent ?? 0;

  return {
    ...profile,
    derived: {
      priceBand: derivePriceBand(profile.core.budgetMax),
      wristBand: deriveWristBand(profile.core.wristCircumferenceMm),
      weightLimitGrams: WEIGHT_LIMIT_GRAMS[profile.core.weightLimit],
      effectiveBudgetCeiling: effectiveBudgetCeiling(
        profile.core.budgetMax,
        premiumAllowancePercent,
      ),
      speculativeCandidatesAllowed: permitsSpeculativeCandidate(
        profile.refinement,
      ),
    },
  };
}
