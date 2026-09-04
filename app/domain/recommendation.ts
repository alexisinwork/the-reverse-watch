import type {
  EvidenceField,
  SeedCatalogue,
  SeedReferenceVariant,
} from "./catalogue";
import {
  convertMinorCurrency,
  hasVerifiedField,
  isFieldNotApplicable,
  supportedAccuracyTolerances,
  verifiedCaseWearingSpanMm,
} from "./catalogue";
import type { ProfileV3 } from "./questionnaire-v3";
import type {
  AESTHETIC_DNA,
  QuestionnaireProfile,
  SOCIAL_SIGNALS,
} from "./questionnaire";
import {
  effectiveBudgetCeiling,
  permitsSpeculativeCandidate,
  WEIGHT_LIMIT_GRAMS,
} from "./questionnaire";

export const RECOMMENDATION_ENGINE_VERSION = 2 as const;
export const MAX_LUG_TO_LUG_TO_WRIST_RATIO = 0.31;

export const HARD_REASON_CODES = [
  "over_budget",
  "fit_exceeds_wrist",
  "deployment_mismatch",
  "ownership_mismatch",
  "accuracy_mismatch",
  "weight_exceeds_limit",
  "missing_complication",
  "date_required",
  "date_forbidden",
  "lug_curvature_mismatch",
  "attachment_mismatch",
  "lug_width_mismatch",
  "lug_width_not_applicable",
  "quick_release_required",
  "channel_mismatch",
  "availability_mismatch",
  "liquidity_mismatch",
  "lume_mismatch",
  "crown_mismatch",
  "condition_mismatch",
  "service_country_mismatch",
  "allergy_risk",
  "speculative_suppressed",
] as const;

export const MISSING_FACT_CODES = [
  "fx_rate",
  "price",
  "purchase_country",
  "service_country",
  "lug_to_lug",
  "accuracy",
  "weight",
  "lug_curvature",
  "attachment",
  "lug_width",
  "availability",
  "liquidity",
  "lume",
  "crown_position",
  "nickel_contact_risk",
] as const;

export type HardReasonCode = (typeof HARD_REASON_CODES)[number];
export type MissingFactCode = (typeof MISSING_FACT_CODES)[number];

export type HardFilterEvaluation = Record<
  string,
  {
    hardReasons: HardReasonCode[];
    missingFacts: MissingFactCode[];
  }
>;

export type ScoreFactor = {
  factor: string;
  points: number;
  explanation: string;
};

export type EvaluatedCandidate = {
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
    currency: QuestionnaireProfile["core"]["budgetCurrency"];
    sourceCurrency: SeedReferenceVariant["price"]["currency"];
    sourceAmountMinor: number;
    marketCountry: string;
    fxObservedAt: string;
  };
  geometry: SeedReferenceVariant["geometry"];
  movement: SeedReferenceVariant["movement"];
  complications: SeedReferenceVariant["complications"];
  dateStatus: SeedReferenceVariant["dateStatus"];
  hardReasons: { code: HardReasonCode; explanation: string }[];
  missingFacts: { code: MissingFactCode; explanation: string }[];
  score: number;
  scoreTrace: ScoreFactor[];
  sourceIds: string[];
};

export type RecommendationResult = {
  engineVersion: typeof RECOMMENDATION_ENGINE_VERSION;
  catalogueVersion: number;
  evaluatedAt: string;
  recommendations: EvaluatedCandidate[];
  verificationRequired: EvaluatedCandidate[];
  whyNot: EvaluatedCandidate[];
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

type EvaluationContext = {
  profile: QuestionnaireProfile;
  catalogue: SeedCatalogue;
  asOfMs: number;
  hardFilterEvaluation?: HardFilterEvaluation;
  storyContext?: {
    socialSignal: (typeof SOCIAL_SIGNALS)[number] | null;
    aestheticDna: (typeof AESTHETIC_DNA)[number] | null;
  };
};

const HARD_REASON_EXPLANATIONS: Record<HardReasonCode, string> = {
  over_budget:
    "The verified converted price exceeds the explicit budget ceiling.",
  fit_exceeds_wrist:
    "The verified case span exceeds the conservative wrist-width boundary.",
  deployment_mismatch:
    "The reviewed deployment profile does not cover the selected environment.",
  ownership_mismatch:
    "The movement/service profile conflicts with the selected ownership tolerance.",
  accuracy_mismatch:
    "The published accuracy range is outside the selected tolerance.",
  weight_exceeds_limit:
    "The verified full-watch weight is not under the selected limit.",
  missing_complication: "A required function is absent.",
  date_required: "A date display is required.",
  date_forbidden: "A no-date watch is required.",
  lug_curvature_mismatch: "Lug curvature differs from the required geometry.",
  attachment_mismatch: "The attachment system is not the requested type.",
  lug_width_mismatch: "Verified lug width does not match the requested width.",
  lug_width_not_applicable:
    "The verified case architecture has no conventional lug width.",
  quick_release_required:
    "The supplied strap or bracelet is not quick release.",
  channel_mismatch:
    "No verified price exists in an accepted acquisition channel.",
  availability_mismatch:
    "Current availability is outside the selected wait tolerance.",
  liquidity_mismatch:
    "The verified secondary-value floor is below the requested threshold.",
  lume_mismatch: "Verified lume does not meet the selected requirement.",
  crown_mismatch: "Crown position differs from the requested position.",
  condition_mismatch: "No verified price exists in an accepted condition.",
  service_country_mismatch:
    "The verified manufacturer service network does not cover the selected country.",
  allergy_risk:
    "The documented material profile cannot satisfy the contact-allergy constraint.",
  speculative_suppressed:
    "Speculative candidates require both an eligible secondary channel and explicit risk acceptance.",
};

const MISSING_FACT_EXPLANATIONS: Record<MissingFactCode, string> = {
  fx_rate:
    "The exchange-rate snapshot needed for this budget conversion has expired or is unavailable.",
  price: "The current price lacks verified, unexpired evidence.",
  purchase_country:
    "The accepted price snapshot is not for the selected purchase country.",
  service_country:
    "Manufacturer service coverage is not verified for the selected country.",
  lug_to_lug:
    "The across-wrist case span is not verified, so wrist fit cannot pass silently.",
  accuracy: "No numerical manufacturer accuracy specification is available.",
  weight: "Full-watch weight is missing or not manufacturer-verified.",
  lug_curvature: "Lug curvature is not verified.",
  attachment: "The attachment system is not verified.",
  lug_width: "Lug width is not verified.",
  availability: "Current availability is unknown or stale.",
  liquidity: "No current verified secondary-value floor is available.",
  lume: "Lume performance is not verified.",
  crown_position: "Crown position is not verified.",
  nickel_contact_risk:
    "Nickel/contact safety is not verified for all skin-contact components.",
};

function addReason(
  candidate: EvaluatedCandidate,
  code: HardReasonCode,
  explanation: string,
) {
  candidate.hardReasons.push({ code, explanation });
}

function addMissing(
  candidate: EvaluatedCandidate,
  code: MissingFactCode,
  explanation: string,
) {
  if (candidate.missingFacts.some((fact) => fact.code === code)) return;
  candidate.missingFacts.push({ code, explanation });
}

function requireFact(
  variant: SeedReferenceVariant,
  candidate: EvaluatedCandidate,
  evidenceField: EvidenceField,
  missingCode: MissingFactCode,
  explanation: string,
  value: unknown,
) {
  if (value === null || !hasVerifiedField(variant, evidenceField)) {
    addMissing(candidate, missingCode, explanation);
    return false;
  }
  return true;
}

function initialCandidate(
  variant: SeedReferenceVariant,
  context: EvaluationContext,
): EvaluatedCandidate {
  const convertedPrice = convertMinorCurrency(
    variant.price.amountMinor,
    variant.price.currency,
    context.profile.core.budgetCurrency,
    context.catalogue.fx,
  );
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
      amountMinor: convertedPrice,
      currency: context.profile.core.budgetCurrency,
      sourceCurrency: variant.price.currency,
      sourceAmountMinor: variant.price.amountMinor,
      marketCountry: variant.price.marketCountry,
      fxObservedAt: context.catalogue.fx.observedAt,
    },
    geometry: variant.geometry,
    movement: variant.movement,
    complications: variant.complications,
    dateStatus: variant.dateStatus,
    hardReasons: [],
    missingFacts: [],
    score: 0,
    scoreTrace: [],
    sourceIds: [],
  };
}

function evaluateCoreHardFilters(
  variant: SeedReferenceVariant,
  candidate: EvaluatedCandidate,
  context: EvaluationContext,
) {
  const { core } = context.profile;
  const premiumChannel = variant.price.channels.some(
    (channel) =>
      (channel === "grey_market" || channel === "secondary_market") &&
      context.profile.refinement?.acquisitionChannels?.includes(channel),
  );
  const budgetMinor = Math.round(
    effectiveBudgetCeiling(
      core.budgetMax,
      premiumChannel
        ? (context.profile.refinement?.premiumAllowancePercent ?? 0)
        : 0,
    ) * 100,
  );

  const requiresFx = variant.price.currency !== core.budgetCurrency;

  if (
    requiresFx &&
    context.asOfMs > Date.parse(context.catalogue.fx.staleAfter)
  ) {
    addMissing(
      candidate,
      "fx_rate",
      "The exchange-rate snapshot needed for this budget conversion has expired.",
    );
  }

  if (
    !hasVerifiedField(variant, "price") ||
    context.asOfMs > Date.parse(variant.price.staleAfter)
  ) {
    addMissing(
      candidate,
      "price",
      "The current price lacks verified, unexpired evidence.",
    );
  } else if (
    (!requiresFx ||
      context.asOfMs <= Date.parse(context.catalogue.fx.staleAfter)) &&
    candidate.price.amountMinor > budgetMinor
  ) {
    addReason(
      candidate,
      "over_budget",
      `Converted price exceeds the explicit ${core.budgetCurrency} budget ceiling.`,
    );
  }

  const wearingSpanMm = verifiedCaseWearingSpanMm(variant);
  if (wearingSpanMm === null) {
    addMissing(
      candidate,
      "lug_to_lug",
      "The across-wrist case span lacks verified evidence, so wrist fit cannot pass silently.",
    );
  } else if (
    wearingSpanMm >
    core.wristCircumferenceMm * MAX_LUG_TO_LUG_TO_WRIST_RATIO
  ) {
    addReason(
      candidate,
      "fit_exceeds_wrist",
      "The verified case span exceeds the conservative wrist-width boundary.",
    );
  }

  if (!variant.eligibleEnvironments.includes(core.deploymentEnvironment)) {
    addReason(
      candidate,
      "deployment_mismatch",
      "The reviewed deployment profile does not cover the selected environment.",
    );
  }

  if (!variant.ownershipFrictionLevels.includes(core.ownershipFriction)) {
    addReason(
      candidate,
      "ownership_mismatch",
      "The movement/service profile conflicts with the selected ownership tolerance.",
    );
  }

  if (core.accuracyTolerance !== "no_requirement") {
    if (
      requireFact(
        variant,
        candidate,
        "accuracy",
        "accuracy",
        "No numerical manufacturer accuracy specification is available.",
        variant.movement.accuracyPeriodDays,
      ) &&
      !supportedAccuracyTolerances(variant.movement).includes(
        core.accuracyTolerance,
      )
    ) {
      addReason(
        candidate,
        "accuracy_mismatch",
        "The published accuracy range is outside the selected tolerance.",
      );
    }
  }

  const weightLimit = WEIGHT_LIMIT_GRAMS[core.weightLimit];
  if (weightLimit !== null) {
    if (
      requireFact(
        variant,
        candidate,
        "weightFullG",
        "weight",
        "Full-watch weight is missing or not manufacturer-verified.",
        variant.geometry.weightFullG,
      ) &&
      variant.geometry.weightFullG !== null &&
      variant.geometry.weightFullG >= weightLimit
    ) {
      addReason(
        candidate,
        "weight_exceeds_limit",
        `Verified full-watch weight is not under ${weightLimit} g.`,
      );
    }
  }

  const missingComplications = core.requiredComplications.filter(
    (complication) => !variant.complications.includes(complication),
  );
  if (missingComplications.length > 0) {
    addReason(
      candidate,
      "missing_complication",
      `Missing required function: ${missingComplications.join(", ")}.`,
    );
  }
  if (core.datePreference === "required" && variant.dateStatus !== "present") {
    addReason(candidate, "date_required", "A date display is required.");
  }
  if (core.datePreference === "forbidden" && variant.dateStatus !== "absent") {
    addReason(candidate, "date_forbidden", "A no-date watch is required.");
  }
}

function evaluateRefinementHardFilters(
  variant: SeedReferenceVariant,
  candidate: EvaluatedCandidate,
  context: EvaluationContext,
) {
  const refinement = context.profile.refinement;

  if (
    variant.market.speculativeBubble === true &&
    !permitsSpeculativeCandidate(refinement)
  ) {
    addReason(
      candidate,
      "speculative_suppressed",
      "Speculative candidates require both an eligible secondary channel and explicit risk acceptance.",
    );
  }
  if (!refinement) return;

  if (
    refinement.purchaseCountry &&
    refinement.purchaseCountry !== variant.price.marketCountry
  ) {
    addMissing(
      candidate,
      "purchase_country",
      `The accepted price snapshot is for ${variant.price.marketCountry}, not ${refinement.purchaseCountry}.`,
    );
  }

  if (refinement.serviceCountry) {
    if (
      variant.brand.serviceCountries === null ||
      !hasVerifiedField(variant, "serviceCountries")
    ) {
      addMissing(
        candidate,
        "service_country",
        "Manufacturer service coverage is not verified for the selected country.",
      );
    } else if (
      !variant.brand.serviceCountries.includes(refinement.serviceCountry)
    ) {
      addReason(
        candidate,
        "service_country_mismatch",
        "The verified manufacturer service network does not cover the selected country.",
      );
    }
  }

  if (refinement.requiredLugCurvature) {
    if (
      requireFact(
        variant,
        candidate,
        "lugCurvature",
        "lug_curvature",
        "Lug curvature is not verified.",
        variant.geometry.lugCurvature,
      ) &&
      variant.geometry.lugCurvature !== refinement.requiredLugCurvature
    ) {
      addReason(
        candidate,
        "lug_curvature_mismatch",
        "Lug curvature differs from the required geometry.",
      );
    }
  }

  if (refinement.requiredAttachmentType) {
    if (
      requireFact(
        variant,
        candidate,
        "attachmentType",
        "attachment",
        "The attachment system is not verified.",
        variant.operation.attachmentType,
      ) &&
      variant.operation.attachmentType !== refinement.requiredAttachmentType
    ) {
      addReason(
        candidate,
        "attachment_mismatch",
        "The attachment system is not the requested type.",
      );
    }
  }

  if (refinement.requiredLugWidthMm !== undefined) {
    if (isFieldNotApplicable(variant, "lugWidthMm")) {
      addReason(
        candidate,
        "lug_width_not_applicable",
        "The verified case architecture has no conventional lug width.",
      );
    } else if (
      requireFact(
        variant,
        candidate,
        "lugWidthMm",
        "lug_width",
        "Lug width is not verified.",
        variant.geometry.lugWidthMm,
      ) &&
      variant.geometry.lugWidthMm !== refinement.requiredLugWidthMm
    ) {
      addReason(
        candidate,
        "lug_width_mismatch",
        "Verified lug width does not match the requested width.",
      );
    }
  }

  if (refinement.quickReleaseRequired === true) {
    if (
      requireFact(
        variant,
        candidate,
        "attachmentType",
        "attachment",
        "Quick-release capability is not verified.",
        variant.operation.attachmentType,
      ) &&
      variant.operation.attachmentType !== "quick_release"
    ) {
      addReason(
        candidate,
        "quick_release_required",
        "The supplied strap or bracelet is not quick release.",
      );
    }
  }

  if (
    refinement.acquisitionChannels &&
    !variant.price.channels.some((channel) =>
      refinement.acquisitionChannels?.includes(channel),
    )
  ) {
    addReason(
      candidate,
      "channel_mismatch",
      "No verified price exists in an accepted acquisition channel.",
    );
  }

  if (refinement.availabilityTolerance) {
    if (
      !hasVerifiedField(variant, "availability") ||
      variant.price.availability === "unknown" ||
      variant.price.availabilityStaleAfter === null ||
      context.asOfMs > Date.parse(variant.price.availabilityStaleAfter)
    ) {
      addMissing(
        candidate,
        "availability",
        "Current availability is unknown or stale.",
      );
    } else {
      const acceptedAvailability = {
        in_stock_only: ["in_stock"],
        short_wait: ["in_stock", "short_wait"],
        waitlist_or_allocation: [
          "in_stock",
          "short_wait",
          "waitlist_or_allocation",
        ],
      }[refinement.availabilityTolerance];
      if (!acceptedAvailability.includes(variant.price.availability)) {
        addReason(
          candidate,
          "availability_mismatch",
          "Current availability is outside the selected wait tolerance.",
        );
      }
    }
  }

  if (
    refinement.acceptedConditions &&
    !variant.price.conditions.some((condition) =>
      refinement.acceptedConditions?.includes(condition),
    )
  ) {
    addReason(
      candidate,
      "condition_mismatch",
      "No verified price exists in an accepted condition.",
    );
  }

  if (
    refinement.liquidityPreference !== undefined &&
    refinement.liquidityPreference !== "not_important"
  ) {
    const threshold =
      refinement.liquidityPreference === "require_80_percent_plus" ? 0.8 : 0.6;
    if (
      !hasVerifiedField(variant, "market") ||
      variant.market.secondaryRatioLow === null
    ) {
      addMissing(
        candidate,
        "liquidity",
        "No current verified secondary-value floor is available.",
      );
    } else if (variant.market.secondaryRatioLow < threshold) {
      addReason(
        candidate,
        "liquidity_mismatch",
        "The verified secondary-value floor is below the requested threshold.",
      );
    }
  }

  if (
    refinement.lumePreference &&
    refinement.lumePreference !== "not_important"
  ) {
    if (
      requireFact(
        variant,
        candidate,
        "lumeGrade",
        "lume",
        "Lume performance is not verified.",
        variant.operation.lumeGrade,
      )
    ) {
      const grade = variant.operation.lumeGrade;
      const passes =
        refinement.lumePreference === "strong_lume"
          ? grade === "strong"
          : grade !== "none";
      if (!passes) {
        addReason(
          candidate,
          "lume_mismatch",
          "Verified lume does not meet the selected requirement.",
        );
      }
    }
  }

  if (refinement.crownPosition) {
    if (
      variant.operation.crownPosition === null ||
      !hasVerifiedField(variant, "crownPosition")
    ) {
      addMissing(
        candidate,
        "crown_position",
        "Crown position is not verified.",
      );
    } else if (variant.operation.crownPosition !== refinement.crownPosition) {
      addReason(
        candidate,
        "crown_mismatch",
        "Crown position differs from the requested position.",
      );
    }
  }

  if (refinement.allergyConstraint === "nickel_contact") {
    if (
      requireFact(
        variant,
        candidate,
        "nickelContactRisk",
        "nickel_contact_risk",
        "Nickel/contact safety is not verified for all skin-contact components.",
        variant.operation.nickelContactRisk,
      ) &&
      variant.operation.nickelContactRisk !== "none_known"
    ) {
      addReason(
        candidate,
        "allergy_risk",
        "The documented material profile cannot satisfy the contact-allergy constraint.",
      );
    }
  }
}

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

function scoreCandidate(
  variant: SeedReferenceVariant,
  candidate: EvaluatedCandidate,
  context: EvaluationContext,
) {
  const premiumChannel = variant.price.channels.some(
    (channel) =>
      (channel === "grey_market" || channel === "secondary_market") &&
      context.profile.refinement?.acquisitionChannels?.includes(channel),
  );
  const ceilingMinor = Math.round(
    effectiveBudgetCeiling(
      context.profile.core.budgetMax,
      premiumChannel
        ? (context.profile.refinement?.premiumAllowancePercent ?? 0)
        : 0,
    ) * 100,
  );
  const budgetHeadroom = Math.max(
    0,
    (ceilingMinor - candidate.price.amountMinor) / ceilingMinor,
  );
  addScore(
    candidate,
    "budget_headroom",
    Math.round(Math.min(10, budgetHeadroom * 20) * 10) / 10,
    "Leaves room below the explicit purchase ceiling.",
  );

  const wearingSpanMm = verifiedCaseWearingSpanMm(variant);
  if (wearingSpanMm !== null) {
    const fitRatio = wearingSpanMm / context.profile.core.wristCircumferenceMm;
    const fitPoints = Math.max(0, 12 - Math.abs(fitRatio - 0.27) * 120);
    addScore(
      candidate,
      "fit_proportion",
      Math.round(fitPoints * 10) / 10,
      "Rewards a case span near the conservative proportional-fit target.",
    );
  }

  const refinement = context.profile.refinement;
  if (
    refinement?.socialSignal &&
    variant.traits.socialSignals.includes(refinement.socialSignal)
  ) {
    addScore(
      candidate,
      "social_signal",
      16,
      "Matches the selected social signal.",
    );
  }
  if (
    refinement?.aestheticDna &&
    variant.traits.aestheticDna.includes(refinement.aestheticDna)
  ) {
    addScore(
      candidate,
      "aesthetic_dna",
      24,
      "Matches the selected design language.",
    );
  }
  if (
    !refinement?.socialSignal &&
    context.storyContext?.socialSignal &&
    variant.traits.socialSignals.includes(context.storyContext.socialSignal)
  ) {
    addScore(
      candidate,
      "story_context_social_signal",
      6,
      "Softly aligns with the reviewed story attribution context.",
    );
  }
  if (
    !refinement?.aestheticDna &&
    context.storyContext?.aestheticDna &&
    variant.traits.aestheticDna.includes(context.storyContext.aestheticDna)
  ) {
    addScore(
      candidate,
      "story_context_aesthetic_dna",
      8,
      "Softly aligns with the reviewed story design context.",
    );
  }
  if (
    refinement?.emotionalObjective &&
    variant.traits.emotionalObjectives.includes(refinement.emotionalObjective)
  ) {
    addScore(
      candidate,
      "emotional_objective",
      16,
      "Matches the selected ownership objective.",
    );
  }
  if (
    refinement?.marketStance === "contrarian" &&
    variant.market.hypeRisk === "high"
  ) {
    addScore(
      candidate,
      "contrarian_hype_penalty",
      -20,
      "High verified hype conflicts with a contrarian market stance.",
    );
  }
  if (
    refinement?.marketStance === "contrarian" &&
    variant.market.hypeRisk === "low"
  ) {
    addScore(
      candidate,
      "contrarian_market_fit",
      12,
      "Low verified hype supports a contrarian market stance.",
    );
  }

  addScore(
    candidate,
    "evidence_completeness",
    Math.max(0, 8 - candidate.missingFacts.length * 2),
    "Rewards verified decision fields without treating unknowns as facts.",
  );
}

function evaluateVariant(
  variant: SeedReferenceVariant,
  context: EvaluationContext,
) {
  const candidate = initialCandidate(variant, context);
  if (context.hardFilterEvaluation) {
    const evaluation = context.hardFilterEvaluation[variant.id];
    if (!evaluation) {
      throw new RangeError(
        `Hard-filter evaluation is missing catalogue variant ${variant.id}.`,
      );
    }
    candidate.hardReasons = evaluation.hardReasons.map((code) => ({
      code,
      explanation: HARD_REASON_EXPLANATIONS[code],
    }));
    candidate.missingFacts = evaluation.missingFacts.map((code) => ({
      code,
      explanation: MISSING_FACT_EXPLANATIONS[code],
    }));
  } else {
    evaluateCoreHardFilters(variant, candidate, context);
    evaluateRefinementHardFilters(variant, candidate, context);
  }
  scoreCandidate(variant, candidate, context);
  candidate.sourceIds = [
    ...new Set(variant.evidence.map((evidence) => evidence.sourceId)),
  ];
  return candidate;
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

function buildRelaxations(
  profile: QuestionnaireProfile,
  rejected: EvaluatedCandidate[],
) {
  const relaxations: { code: string; explanation: string }[] = [];
  if (
    profile.refinement?.liquidityPreference &&
    profile.refinement.liquidityPreference !== "not_important"
  ) {
    relaxations.push({
      code: "relax_liquidity",
      explanation:
        "Remove the residual-value threshold; no current verified market floor survives it.",
    });
  }
  if (profile.refinement?.acquisitionChannels?.length) {
    relaxations.push({
      code: "relax_acquisition",
      explanation:
        "Allow a verified official/authorized retail price as an alternative channel.",
    });
  }
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
  return relaxations.slice(0, 4);
}

function buildUnscoredPreferences(
  profile: QuestionnaireProfile,
  catalogue: SeedCatalogue,
) {
  const unscored: { field: string; explanation: string }[] = [];
  if (profile.refinement?.provenancePreference) {
    unscored.push({
      field: "provenancePreference",
      explanation:
        "The seed does not yet contain reviewed brand-ownership context, so provenance did not affect this ranking.",
    });
  }
  if (profile.refinement?.cosmeticTolerance) {
    unscored.push({
      field: "cosmeticTolerance",
      explanation:
        "Reviewed surface-finish and wear-behavior tags are not yet complete, so cosmetic tolerance did not affect this ranking.",
    });
  }
  if (
    profile.refinement?.marketStance &&
    !catalogue.variants.some(
      (variant) =>
        hasVerifiedField(variant, "market") && variant.market.hypeRisk !== null,
    )
  ) {
    unscored.push({
      field: "marketStance",
      explanation:
        "The seed has no accepted current hype observations, so market stance did not affect this ranking.",
    });
  }
  return unscored;
}

function evaluationTimestamp(asOf: string) {
  const asOfMs = Date.parse(asOf);
  if (!Number.isFinite(asOfMs)) {
    throw new RangeError("Recommendation evaluation time must be ISO-8601.");
  }
  return asOfMs;
}

function assertHardFilterCoverage(
  catalogue: SeedCatalogue,
  evaluation: HardFilterEvaluation,
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

export function evaluateHardFilterPartition(
  profile: QuestionnaireProfile,
  catalogue: SeedCatalogue,
  { asOf = new Date().toISOString() }: { asOf?: string } = {},
): HardFilterEvaluation {
  const context: EvaluationContext = {
    profile,
    catalogue,
    asOfMs: evaluationTimestamp(asOf),
  };
  return Object.fromEntries(
    catalogue.variants.map((variant) => {
      const candidate = initialCandidate(variant, context);
      evaluateCoreHardFilters(variant, candidate, context);
      evaluateRefinementHardFilters(variant, candidate, context);
      return [
        variant.id,
        {
          hardReasons: candidate.hardReasons.map((reason) => reason.code),
          missingFacts: candidate.missingFacts.map((fact) => fact.code),
        },
      ];
    }),
  );
}

export function recommendWatches(
  profile: QuestionnaireProfile,
  catalogue: SeedCatalogue,
  {
    asOf = new Date().toISOString(),
    hardFilterEvaluation,
    storyContext,
  }: {
    asOf?: string;
    hardFilterEvaluation?: HardFilterEvaluation;
    storyContext?: EvaluationContext["storyContext"];
  } = {},
): RecommendationResult {
  const asOfMs = evaluationTimestamp(asOf);
  if (hardFilterEvaluation) {
    assertHardFilterCoverage(catalogue, hardFilterEvaluation);
  }
  const context: EvaluationContext = {
    profile,
    catalogue,
    asOfMs,
    hardFilterEvaluation,
    storyContext,
  };
  const evaluated = catalogue.variants.map((variant) =>
    evaluateVariant(variant, context),
  );
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
    engineVersion: RECOMMENDATION_ENGINE_VERSION,
    catalogueVersion: catalogue.catalogueVersion,
    evaluatedAt: new Date(asOfMs).toISOString(),
    recommendations,
    verificationRequired: verificationRequired.slice(0, 3),
    whyNot: rejected.slice(0, 3),
    relaxations:
      recommendations.length === 0 ? buildRelaxations(profile, rejected) : [],
    unscoredPreferences: buildUnscoredPreferences(profile, catalogue),
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

export function recommendWatchesV3(
  profile: ProfileV3,
  catalogue: SeedCatalogue,
  { asOf = new Date().toISOString() }: { asOf?: string } = {},
): RecommendationResultV3 {
  const asOfMs = evaluationTimestamp(asOf);
  const evaluated = catalogue.variants.map((variant) => {
    const candidate = initialCandidateV3(variant, profile, catalogue);
    const { hardReasons, missingFacts } = evaluateHardFiltersV3(
      variant,
      profile,
      asOfMs,
      catalogue.fx,
    );
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
