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
import type { QuestionnaireProfile } from "./questionnaire";
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
  candidate: EvaluatedCandidate,
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

function compareCandidates(a: EvaluatedCandidate, b: EvaluatedCandidate) {
  return (
    b.score - a.score ||
    a.brand.localeCompare(b.brand) ||
    a.referenceCode.localeCompare(b.referenceCode)
  );
}

function diversify(candidates: EvaluatedCandidate[], limit: number) {
  const selected: EvaluatedCandidate[] = [];
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
  }: { asOf?: string; hardFilterEvaluation?: HardFilterEvaluation } = {},
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
