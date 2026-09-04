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

const MILLIMETRES_PER_INCH = 25.4;

export const WRIST_BANDS = [
  {
    id: "under_5_75",
    minimumMm: 100,
    maximumExclusiveMm: 5.75 * MILLIMETRES_PER_INCH,
    label: "Under 5.75 in",
  },
  {
    id: "5_75_6_25",
    minimumMm: 5.75 * MILLIMETRES_PER_INCH,
    maximumExclusiveMm: 6.25 * MILLIMETRES_PER_INCH,
    label: "5.75–6.25 in",
  },
  {
    id: "6_25_6_75",
    minimumMm: 6.25 * MILLIMETRES_PER_INCH,
    maximumExclusiveMm: 6.75 * MILLIMETRES_PER_INCH,
    label: "6.25–6.75 in",
  },
  {
    id: "6_75_7_5",
    minimumMm: 6.75 * MILLIMETRES_PER_INCH,
    maximumExclusiveMm: 7.5 * MILLIMETRES_PER_INCH,
    label: "6.75–7.5 in",
  },
  {
    id: "7_5_plus",
    minimumMm: 7.5 * MILLIMETRES_PER_INCH,
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

export const EMOTIONAL_OBJECTIVES = [
  "dependability",
  "custody",
  "differentiation",
  "milestone",
] as const;

export const ACQUISITION_CHANNELS = [
  "authorized_dealer",
  "grey_market",
  "secondary_market",
] as const;
export const CONDITIONS = [
  "new",
  "certified_pre_owned",
  "pre_owned",
  "vintage",
] as const;
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
