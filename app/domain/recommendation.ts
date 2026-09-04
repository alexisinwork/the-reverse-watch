import type { SeedCatalogue, SeedReferenceVariant } from "./catalogue";
import { convertMinorCurrency, hasVerifiedField } from "./catalogue";
import type { ProfileV3 } from "./questionnaire-v3";

export type ScoreFactor = {
  factor: string;
  points: number;
  explanation: string;
};

function addScore(
  candidate: { score: number; scoreTrace: ScoreFactor[] },
  factor: string,
  points: number,
  explanation: string,
) {
  if (points === 0) return;
  candidate.scoreTrace.push({ factor, points, explanation });
  candidate.score += points;
}

type ComparableCandidate = {
  score: number;
  brand: string;
  referenceCode: string;
};

function compareCandidates<T extends ComparableCandidate>(a: T, b: T) {
  return (
    b.score - a.score ||
    a.brand.localeCompare(b.brand) ||
    a.referenceCode.localeCompare(b.referenceCode)
  );
}

type DiversifiableCandidate = {
  brandSlug: string;
  primaryArchetype: string;
};

function diversify<T extends DiversifiableCandidate>(
  candidates: T[],
  limit: number,
) {
  const selected: T[] = [];
  const brands = new Set<string>();
  const archetypes = new Set<string>();
  for (const candidate of candidates) {
    if (
      brands.has(candidate.brandSlug) ||
      archetypes.has(candidate.primaryArchetype)
    ) {
      continue;
    }
    selected.push(candidate);
    brands.add(candidate.brandSlug);
    archetypes.add(candidate.primaryArchetype);
    if (selected.length === limit) break;
  }
  return selected;
}

function evaluationTimestamp(asOf: string) {
  const asOfMs = Date.parse(asOf);
  if (!Number.isFinite(asOfMs)) {
    throw new RangeError("Recommendation evaluation time must be ISO-8601.");
  }
  return asOfMs;
}

export const RECOMMENDATION_V3_ENGINE_VERSION = 3 as const;

export const HARD_REASON_CODES_V3 = [
  "over_budget",
  "case_diameter_out_of_range",
  "water_resistance_below_minimum",
  "movement_type_mismatch",
  "scenario_mismatch",
  "missing_complication",
  "allergy_risk",
] as const;

export const MISSING_FACT_CODES_V3 = [
  "fx_rate",
  "price",
  "case_diameter",
  "water_resistance",
  "wearing_scenarios",
  "nickel_contact_risk",
] as const;

export type HardReasonCodeV3 = (typeof HARD_REASON_CODES_V3)[number];
export type MissingFactCodeV3 = (typeof MISSING_FACT_CODES_V3)[number];

export type HardFilterEvaluationV3 = Record<
  string,
  {
    hardReasons: HardReasonCodeV3[];
    missingFacts: MissingFactCodeV3[];
  }
>;

export function evaluateHardFiltersV3(
  variant: SeedReferenceVariant,
  profile: ProfileV3,
  asOfMs: number,
  fx?: SeedCatalogue["fx"],
) {
  const hardReasons: HardReasonCodeV3[] = [];
  const missingFacts: MissingFactCodeV3[] = [];
  const reject = (code: HardReasonCodeV3) => {
    if (!hardReasons.includes(code)) hardReasons.push(code);
  };
  const missing = (code: MissingFactCodeV3) => {
    if (!missingFacts.includes(code)) missingFacts.push(code);
  };

  const requiresFx =
    fx !== undefined && variant.price.currency !== profile.budgetCurrency;
  const fxUsable = !requiresFx || asOfMs <= Date.parse(fx.staleAfter);
  if (requiresFx && !fxUsable) missing("fx_rate");

  if (
    !hasVerifiedField(variant, "price") ||
    asOfMs > Date.parse(variant.price.staleAfter)
  ) {
    missing("price");
  } else if (fxUsable) {
    const amountMinor = fx
      ? convertMinorCurrency(
          variant.price.amountMinor,
          variant.price.currency,
          profile.budgetCurrency,
          fx,
        )
      : variant.price.amountMinor;
    if (amountMinor > Math.round(profile.budgetMax * 100))
      reject("over_budget");
  }

  const diameter = variant.geometry.caseDiameterMm;
  if (diameter === null || !hasVerifiedField(variant, "caseDiameterMm")) {
    missing("case_diameter");
  } else if (
    diameter < profile.caseDiameterMinMm ||
    diameter > profile.caseDiameterMaxMm
  ) {
    reject("case_diameter_out_of_range");
  }

  if (profile.minimumWaterResistanceM > 0) {
    const resistance = variant.operation.waterResistanceM;
    if (resistance === null || !hasVerifiedField(variant, "waterResistanceM")) {
      missing("water_resistance");
    } else if (resistance < profile.minimumWaterResistanceM) {
      reject("water_resistance_below_minimum");
    }
  }

  if (!profile.movementTypes.includes(variant.movement.type)) {
    reject("movement_type_mismatch");
  }

  if (variant.wearingScenarios.length === 0) {
    missing("wearing_scenarios");
  } else if (
    !variant.wearingScenarios.some((scenario) =>
      profile.wearingScenarios.includes(scenario),
    )
  ) {
    reject("scenario_mismatch");
  }

  if (
    profile.requiredComplications.some(
      (complication) => !variant.complicationSlugs.includes(complication),
    )
  ) {
    reject("missing_complication");
  }

  if (profile.allergyConstraint === "nickel_contact") {
    const risk = variant.operation.nickelContactRisk;
    if (risk === null || !hasVerifiedField(variant, "nickelContactRisk")) {
      missing("nickel_contact_risk");
    } else if (risk !== "none_known") {
      reject("allergy_risk");
    }
  }

  return { hardReasons, missingFacts };
}

const HARD_REASON_EXPLANATIONS_V3: Record<HardReasonCodeV3, string> = {
  over_budget:
    "The verified converted price exceeds the explicit budget ceiling.",
  case_diameter_out_of_range:
    "The verified case diameter falls outside the requested range.",
  water_resistance_below_minimum:
    "The verified water resistance is below the requested minimum.",
  movement_type_mismatch:
    "The movement type is not one of the accepted movement types.",
  scenario_mismatch:
    "The reviewed wearing scenarios do not cover any selected scenario.",
  missing_complication: "A required function is absent.",
  allergy_risk:
    "A skin-contact nickel risk conflicts with the declared allergy constraint.",
};

const MISSING_FACT_EXPLANATIONS_V3: Record<MissingFactCodeV3, string> = {
  fx_rate:
    "The exchange-rate snapshot needed for this budget conversion has expired or is unavailable.",
  price: "The current price lacks verified, unexpired evidence.",
  case_diameter:
    "The case diameter is not verified, so the size range cannot pass silently.",
  water_resistance: "Water resistance is not verified.",
  wearing_scenarios: "No reviewed wearing scenario exists for this reference.",
  nickel_contact_risk:
    "Nickel/contact safety is not verified for all skin-contact components.",
};

const SOFT_PREFERENCE_LABELS_V3 = {
  caseShape: "case shape",
  displayCaseback: "display caseback",
  movementConstruction: "movement construction",
  microAdjustmentRequired: "clasp micro-adjustment",
} as const;

export type EvaluatedCandidateV3 = {
  id: string;
  brand: string;
  brandSlug: string;
  model: string;
  referenceCode: string;
  variantName: string;
  productUrl: string;
  primaryArchetype: string;
  price: {
    amountMinor: number;
    currency: ProfileV3["budgetCurrency"];
    sourceCurrency: SeedReferenceVariant["price"]["currency"];
    sourceAmountMinor: number;
    marketCountry: string;
    fxObservedAt: string;
  };
  geometry: SeedReferenceVariant["geometry"];
  movement: SeedReferenceVariant["movement"];
  operation: SeedReferenceVariant["operation"];
  wearingScenarios: SeedReferenceVariant["wearingScenarios"];
  complicationSlugs: SeedReferenceVariant["complicationSlugs"];
  positioningLine: SeedReferenceVariant["positioningLine"];
  positioningGroup: SeedReferenceVariant["positioningGroup"];
  hardReasons: { code: HardReasonCodeV3; explanation: string }[];
  missingFacts: { code: MissingFactCodeV3; explanation: string }[];
  score: number;
  scoreTrace: ScoreFactor[];
  sourceIds: string[];
};

export type RecommendationResultV3 = {
  engineVersion: typeof RECOMMENDATION_V3_ENGINE_VERSION;
  catalogueVersion: number;
  evaluatedAt: string;
  recommendations: EvaluatedCandidateV3[];
  verificationRequired: EvaluatedCandidateV3[];
  whyNot: EvaluatedCandidateV3[];
  relaxations: { code: string; explanation: string }[];
  unscoredPreferences: { field: string; explanation: string }[];
  sources: SeedCatalogue["sources"];
  diagnostics: {
    evaluated: number;
    hardRejected: number;
    verificationRequired: number;
    eligibleBeforeDiversity: number;
    diversityExcluded: number;
  };
};

function roundToTenth(value: number) {
  return Math.round(value * 10) / 10;
}

/**
 * Scores one variant against a version-3 profile.
 *
 * `priceMinor` carries the budget-currency price when the caller has an
 * exchange-rate snapshot; without one the source amount is only comparable
 * when the currencies already match. `missingFacts` comes from
 * `evaluateHardFiltersV3`; when it is omitted the evidence-completeness
 * factor is left out of the trace rather than assumed complete.
 */
export function scoreVariantV3(
  variant: SeedReferenceVariant,
  profile: ProfileV3,
  {
    priceMinor,
    missingFacts,
  }: {
    priceMinor?: number;
    missingFacts?: readonly MissingFactCodeV3[];
  } = {},
) {
  const candidate = { score: 0, scoreTrace: [] as ScoreFactor[] };

  const comparablePriceMinor =
    priceMinor ??
    (variant.price.currency === profile.budgetCurrency
      ? variant.price.amountMinor
      : null);
  if (comparablePriceMinor !== null) {
    const ceilingMinor = Math.round(profile.budgetMax * 100);
    const headroom = Math.max(
      0,
      (ceilingMinor - comparablePriceMinor) / ceilingMinor,
    );
    addScore(
      candidate,
      "budget_headroom",
      roundToTenth(Math.min(10, headroom * 20)),
      "Leaves room below the explicit purchase ceiling.",
    );
  }

  const diameter = variant.geometry.caseDiameterMm;
  if (diameter !== null && hasVerifiedField(variant, "caseDiameterMm")) {
    const midpoint =
      (profile.caseDiameterMinMm + profile.caseDiameterMaxMm) / 2;
    addScore(
      candidate,
      "diameter_centring",
      roundToTenth(Math.max(0, 10 - Math.abs(diameter - midpoint) * 2)),
      "Sits near the middle of the requested diameter range.",
    );
  }

  const thickness = variant.geometry.caseThicknessMm;
  if (
    profile.maxCaseThicknessMm !== undefined &&
    thickness !== null &&
    hasVerifiedField(variant, "caseThicknessMm")
  ) {
    addScore(
      candidate,
      "thickness_fit",
      thickness <= profile.maxCaseThicknessMm ? 8 : 0,
      "Stays within the stated thickness limit.",
    );
  }

  if (
    profile.caseShape !== undefined &&
    variant.geometry.caseShape === profile.caseShape
  ) {
    addScore(candidate, "shape_match", 6, "Matches the requested case shape.");
  }

  if (
    profile.displayCaseback !== undefined &&
    variant.materials.displayCaseback === profile.displayCaseback
  ) {
    addScore(
      candidate,
      "display_caseback_match",
      4,
      "Matches the requested caseback.",
    );
  }

  if (
    profile.movementConstruction !== undefined &&
    variant.movement.construction === profile.movementConstruction
  ) {
    addScore(
      candidate,
      "construction_match",
      6,
      "Matches the requested movement construction.",
    );
  }

  if (
    profile.crystal !== undefined &&
    variant.operation.crystal === profile.crystal
  ) {
    addScore(candidate, "crystal_match", 6, "Matches the requested crystal.");
  }

  if (
    profile.microAdjustmentRequired !== undefined &&
    variant.operation.microAdjustment !== null &&
    variant.operation.microAdjustment.present ===
      profile.microAdjustmentRequired
  ) {
    addScore(
      candidate,
      "micro_adjustment_match",
      4,
      "Matches the requested clasp micro-adjustment.",
    );
  }

  if (missingFacts !== undefined) {
    addScore(
      candidate,
      "evidence_completeness",
      Math.max(0, 8 - missingFacts.length * 2),
      "Carries verified evidence for the facts this profile filters on.",
    );
  }

  return candidate;
}

function initialCandidateV3(
  variant: SeedReferenceVariant,
  profile: ProfileV3,
  catalogue: SeedCatalogue,
): EvaluatedCandidateV3 {
  return {
    id: variant.id,
    brand: variant.brand.name,
    brandSlug: variant.brand.slug,
    model: variant.model,
    referenceCode: variant.referenceCode,
    variantName: variant.variantName,
    productUrl: variant.productUrl,
    primaryArchetype: variant.traits.primaryArchetype,
    price: {
      amountMinor: convertMinorCurrency(
        variant.price.amountMinor,
        variant.price.currency,
        profile.budgetCurrency,
        catalogue.fx,
      ),
      currency: profile.budgetCurrency,
      sourceCurrency: variant.price.currency,
      sourceAmountMinor: variant.price.amountMinor,
      marketCountry: variant.price.marketCountry,
      fxObservedAt: catalogue.fx.observedAt,
    },
    geometry: variant.geometry,
    movement: variant.movement,
    operation: variant.operation,
    wearingScenarios: variant.wearingScenarios,
    complicationSlugs: variant.complicationSlugs,
    positioningLine: variant.positioningLine,
    positioningGroup: variant.positioningGroup,
    hardReasons: [],
    missingFacts: [],
    score: 0,
    scoreTrace: [],
    sourceIds: [],
  };
}

function buildRelaxationsV3(rejected: EvaluatedCandidateV3[]) {
  const relaxations: { code: string; explanation: string }[] = [];
  if (
    rejected.some((candidate) =>
      candidate.hardReasons.some((reason) => reason.code === "over_budget"),
    )
  ) {
    relaxations.push({
      code: "budget_plus_10_percent",
      explanation:
        "Offer an explicit 10% budget-ceiling expansion; it is never applied automatically.",
    });
  }
  if (
    rejected.some((candidate) =>
      candidate.hardReasons.some(
        (reason) => reason.code === "case_diameter_out_of_range",
      ),
    )
  ) {
    relaxations.push({
      code: "widen_diameter_range",
      explanation:
        "Widen the requested diameter range by two millimetres on each side.",
    });
  }
  if (
    rejected.some((candidate) =>
      candidate.hardReasons.some(
        (reason) => reason.code === "water_resistance_below_minimum",
      ),
    )
  ) {
    relaxations.push({
      code: "lower_water_resistance",
      explanation:
        "Lower the water-resistance minimum to the next supported step.",
    });
  }
  if (
    rejected.some((candidate) =>
      candidate.hardReasons.some(
        (reason) => reason.code === "scenario_mismatch",
      ),
    )
  ) {
    relaxations.push({
      code: "widen_scenarios",
      explanation: "Add an adjacent wearing scenario to the selection.",
    });
  }
  return relaxations.slice(0, 4);
}

function buildUnscoredPreferencesV3(
  profile: ProfileV3,
  catalogue: SeedCatalogue,
) {
  const unscored: { field: string; explanation: string }[] = [];
  const report = (
    field: keyof typeof SOFT_PREFERENCE_LABELS_V3,
    populated: boolean,
  ) => {
    if (populated) return;
    unscored.push({
      field,
      explanation: `No reviewed ${SOFT_PREFERENCE_LABELS_V3[field]} data exists in the catalogue yet, so this preference did not affect the ranking.`,
    });
  };

  if (profile.caseShape !== undefined) {
    report(
      "caseShape",
      catalogue.variants.some((variant) => variant.geometry.caseShape !== null),
    );
  }
  if (profile.displayCaseback !== undefined) {
    report(
      "displayCaseback",
      catalogue.variants.some(
        (variant) => variant.materials.displayCaseback !== null,
      ),
    );
  }
  if (profile.movementConstruction !== undefined) {
    report(
      "movementConstruction",
      catalogue.variants.some(
        (variant) => variant.movement.construction !== null,
      ),
    );
  }
  if (profile.microAdjustmentRequired !== undefined) {
    report(
      "microAdjustmentRequired",
      catalogue.variants.some(
        (variant) => variant.operation.microAdjustment !== null,
      ),
    );
  }
  return unscored;
}

export function evaluateHardFilterPartitionV3(
  profile: ProfileV3,
  catalogue: SeedCatalogue,
  { asOf = new Date().toISOString() }: { asOf?: string } = {},
): HardFilterEvaluationV3 {
  const asOfMs = evaluationTimestamp(asOf);
  return Object.fromEntries(
    catalogue.variants.map((variant) => [
      variant.id,
      evaluateHardFiltersV3(variant, profile, asOfMs, catalogue.fx),
    ]),
  );
}

function assertHardFilterCoverageV3(
  catalogue: SeedCatalogue,
  evaluation: HardFilterEvaluationV3,
) {
  const expected = new Set(catalogue.variants.map((variant) => variant.id));
  const actual = new Set(Object.keys(evaluation));
  const missing = [...expected].filter((id) => !actual.has(id));
  const unexpected = [...actual].filter((id) => !expected.has(id));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new RangeError(
      `Hard-filter evaluation does not match the catalogue (missing: ${missing.join(", ") || "none"}; unexpected: ${unexpected.join(", ") || "none"}).`,
    );
  }
}

export function recommendWatchesV3(
  profile: ProfileV3,
  catalogue: SeedCatalogue,
  {
    asOf = new Date().toISOString(),
    hardFilterEvaluation,
  }: { asOf?: string; hardFilterEvaluation?: HardFilterEvaluationV3 } = {},
): RecommendationResultV3 {
  const asOfMs = evaluationTimestamp(asOf);
  if (hardFilterEvaluation) {
    assertHardFilterCoverageV3(catalogue, hardFilterEvaluation);
  }
  const evaluated = catalogue.variants.map((variant) => {
    const candidate = initialCandidateV3(variant, profile, catalogue);
    // A supplied evaluation is authoritative: it is the database predicate the
    // parity audit holds to the same result as the TypeScript one.
    const { hardReasons, missingFacts } = hardFilterEvaluation
      ? hardFilterEvaluation[variant.id]!
      : evaluateHardFiltersV3(variant, profile, asOfMs, catalogue.fx);
    candidate.hardReasons = hardReasons.map((code) => ({
      code,
      explanation: HARD_REASON_EXPLANATIONS_V3[code],
    }));
    candidate.missingFacts = missingFacts.map((code) => ({
      code,
      explanation: MISSING_FACT_EXPLANATIONS_V3[code],
    }));
    const { score, scoreTrace } = scoreVariantV3(variant, profile, {
      priceMinor: candidate.price.amountMinor,
      missingFacts,
    });
    candidate.score = score;
    candidate.scoreTrace = scoreTrace;
    candidate.sourceIds = [
      ...new Set(variant.evidence.map((evidence) => evidence.sourceId)),
    ];
    return candidate;
  });

  const rejected = evaluated
    .filter((candidate) => candidate.hardReasons.length > 0)
    .sort(
      (a, b) =>
        a.hardReasons.length - b.hardReasons.length || compareCandidates(a, b),
    );
  const verificationRequired = evaluated
    .filter(
      (candidate) =>
        candidate.hardReasons.length === 0 && candidate.missingFacts.length > 0,
    )
    .sort(compareCandidates);
  const eligible = evaluated
    .filter(
      (candidate) =>
        candidate.hardReasons.length === 0 &&
        candidate.missingFacts.length === 0,
    )
    .sort(compareCandidates);
  const recommendations = diversify(eligible, 3);
  const sourceIds = new Set(
    [
      ...recommendations,
      ...verificationRequired.slice(0, 3),
      ...rejected.slice(0, 3),
    ].flatMap((candidate) => candidate.sourceIds),
  );
  if (
    [...recommendations, ...verificationRequired.slice(0, 3)].some(
      (candidate) =>
        candidate.price.sourceCurrency !== candidate.price.currency,
    )
  ) {
    sourceIds.add(catalogue.fx.sourceId);
  }

  return {
    engineVersion: RECOMMENDATION_V3_ENGINE_VERSION,
    catalogueVersion: catalogue.catalogueVersion,
    evaluatedAt: new Date(asOfMs).toISOString(),
    recommendations,
    verificationRequired: verificationRequired.slice(0, 3),
    whyNot: rejected.slice(0, 3),
    relaxations:
      recommendations.length === 0 ? buildRelaxationsV3(rejected) : [],
    unscoredPreferences: buildUnscoredPreferencesV3(profile, catalogue),
    sources: catalogue.sources.filter((source) => sourceIds.has(source.id)),
    diagnostics: {
      evaluated: evaluated.length,
      hardRejected: rejected.length,
      verificationRequired: verificationRequired.length,
      eligibleBeforeDiversity: eligible.length,
      diversityExcluded: Math.max(0, eligible.length - recommendations.length),
    },
  };
}
