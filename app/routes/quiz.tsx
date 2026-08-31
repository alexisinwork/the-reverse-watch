import { useEffect, useMemo, useRef, useState } from "react";
import {
  data,
  Form,
  Link,
  useActionData,
  useLocation,
  useNavigation,
} from "react-router";
import { z } from "zod";

import type { Route } from "./+types/quiz";
import { recordQuizAnalyticsEvent } from "../domain/analytics.server";
import { loadRecommendationData } from "../domain/catalogue.server";
import { parseCoreQuizHandoff } from "../domain/discovery-archetype";
import {
  createEmailDeliveryDeduplicationClient,
  emailDeliveryDeduplicationKey,
} from "../domain/email-deduplication.server";
import {
  ACCURACY_TOLERANCES,
  ACQUISITION_CHANNELS,
  AESTHETIC_DNA,
  ALLERGY_CONSTRAINTS,
  ATTACHMENT_TYPES,
  AVAILABILITY_TOLERANCES,
  COMPLICATIONS,
  CONDITIONS,
  COSMETIC_TOLERANCES,
  CROWN_POSITIONS,
  CURRENCIES,
  DATE_PREFERENCES,
  DEPLOYMENT_ENVIRONMENTS,
  EMOTIONAL_OBJECTIVES,
  LIQUIDITY_PREFERENCES,
  LUG_CURVATURES,
  LUME_PREFERENCES,
  MARKET_STANCES,
  MILLIMETRES_PER_INCH,
  normalizeProfile,
  OWNERSHIP_FRICTION_LEVELS,
  PRICE_BANDS,
  PROVENANCE_PREFERENCES,
  QUESTIONNAIRE_STORAGE_KEY,
  QUESTIONNAIRE_VERSION,
  questionnaireProfileSchema,
  refinementSchema,
  SOCIAL_SIGNALS,
  SPECULATIVE_RISK_TOLERANCES,
  coreProfileSchema,
  WEIGHT_LIMITS,
  WRIST_BANDS,
  WRIST_UNITS,
  wristCircumferenceToMm,
} from "../domain/questionnaire";
import type {
  CoreProfile,
  RefinementProfile,
  WristUnit,
} from "../domain/questionnaire";
import type {
  EvaluatedCandidate,
  RecommendationResult,
} from "../domain/recommendation";
import {
  evaluateHardFilterPartition,
  recommendWatches,
} from "../domain/recommendation";
import {
  parseBeehiivConfiguration,
  subscribeToBeehiiv,
} from "../domain/beehiiv.server";
import { renderDossierEmail } from "../domain/dossier-email";
import {
  summarizeEmailDelivery,
  type DeliveryChannelStatus,
} from "../domain/email-delivery";
import {
  parseResendConfiguration,
  sendDossierWithResend,
} from "../domain/resend.server";
import {
  consumeRateLimit,
  parseRateLimitPolicy,
} from "../domain/rate-limit.server";
import type { RateLimitDecision } from "../domain/rate-limit.server";
import {
  consumeUpstashRateLimit,
  createUpstashRateLimitClient,
  parseUpstashRateLimitConfiguration,
} from "../domain/rate-limit-upstash.server";
import "../styles/quiz.css";

const CORE_STEP_COUNT = 6;
const REFINE_STEP_COUNT = 7;
const SUMMARY_STEP = CORE_STEP_COUNT + REFINE_STEP_COUNT;

type ActionResult =
  | {
      ok: true;
      intent: "core" | "refine";
      profile: ReturnType<typeof normalizeProfile>;
      recommendation: RecommendationResult;
      subscription: SubscriptionResult;
    }
  | { ok: false; errors: string[] };

type SubscriptionResult =
  | {
      status: "not_requested";
      message: string;
      newsletterStatus: "not_requested";
      dossierStatus: "not_requested";
    }
  | {
      status:
        "sent" | "partial" | "unavailable" | "failed" | "already_requested";
      message: string;
      newsletterStatus: DeliveryChannelStatus;
      dossierStatus: DeliveryChannelStatus;
    };

type EvaluationSummary = {
  recommendationCount: number;
  verificationCount: number;
  whyNotCount: number;
  hardFilterViolationCount: number;
  evaluationDurationMs: number;
  providerCostUsd: number;
  topRecommendationScore: number | null;
  meanRecommendationScore: number | null;
};

const emailSchema = z.string().trim().email().max(320);

type CoreDraft = {
  budgetCurrency: CoreProfile["budgetCurrency"];
  budgetMax: string;
  wristCircumference: string;
  wristUnit: WristUnit;
  deploymentEnvironment: CoreProfile["deploymentEnvironment"] | "";
  ownershipFriction: CoreProfile["ownershipFriction"] | "";
  accuracyTolerance: CoreProfile["accuracyTolerance"] | "";
  weightLimit: CoreProfile["weightLimit"] | "";
  requiredComplications: CoreProfile["requiredComplications"];
  datePreference: CoreProfile["datePreference"] | "";
};

type OptionalValue<T> = T | "";

type RefinementDraft = {
  socialSignal: OptionalValue<NonNullable<RefinementProfile["socialSignal"]>>;
  aestheticDna: OptionalValue<NonNullable<RefinementProfile["aestheticDna"]>>;
  provenancePreference: OptionalValue<
    NonNullable<RefinementProfile["provenancePreference"]>
  >;
  emotionalObjective: OptionalValue<
    NonNullable<RefinementProfile["emotionalObjective"]>
  >;
  marketStance: OptionalValue<NonNullable<RefinementProfile["marketStance"]>>;
  speculativeRiskTolerance: OptionalValue<
    NonNullable<RefinementProfile["speculativeRiskTolerance"]>
  >;
  requiredLugCurvature: OptionalValue<
    NonNullable<RefinementProfile["requiredLugCurvature"]>
  >;
  requiredAttachmentType: OptionalValue<
    NonNullable<RefinementProfile["requiredAttachmentType"]>
  >;
  requiredLugWidthMm: string;
  quickReleaseRequired: "" | "yes" | "no";
  acquisitionChannels: NonNullable<RefinementProfile["acquisitionChannels"]>;
  availabilityTolerance: OptionalValue<
    NonNullable<RefinementProfile["availabilityTolerance"]>
  >;
  premiumAllowancePercent: string;
  liquidityPreference: OptionalValue<
    NonNullable<RefinementProfile["liquidityPreference"]>
  >;
  lumePreference: OptionalValue<
    NonNullable<RefinementProfile["lumePreference"]>
  >;
  crownPosition: OptionalValue<NonNullable<RefinementProfile["crownPosition"]>>;
  purchaseCountry: string;
  serviceCountry: string;
  cosmeticTolerance: OptionalValue<
    NonNullable<RefinementProfile["cosmeticTolerance"]>
  >;
  acceptedConditions: NonNullable<RefinementProfile["acceptedConditions"]>;
  allergyConstraint: OptionalValue<
    NonNullable<RefinementProfile["allergyConstraint"]>
  >;
};

type SavedDraft = {
  version: typeof QUESTIONNAIRE_VERSION;
  core: CoreDraft;
  refinement: RefinementDraft;
  step: number;
};

const INITIAL_CORE: CoreDraft = {
  budgetCurrency: "USD",
  budgetMax: "",
  wristCircumference: "",
  wristUnit: "mm",
  deploymentEnvironment: "",
  ownershipFriction: "",
  accuracyTolerance: "",
  weightLimit: "",
  requiredComplications: [],
  datePreference: "",
};

const INITIAL_REFINEMENT: RefinementDraft = {
  socialSignal: "",
  aestheticDna: "",
  provenancePreference: "",
  emotionalObjective: "",
  marketStance: "",
  speculativeRiskTolerance: "",
  requiredLugCurvature: "",
  requiredAttachmentType: "",
  requiredLugWidthMm: "",
  quickReleaseRequired: "",
  acquisitionChannels: [],
  availabilityTolerance: "",
  premiumAllowancePercent: "0",
  liquidityPreference: "",
  lumePreference: "",
  crownPosition: "",
  purchaseCountry: "",
  serviceCountry: "",
  cosmeticTolerance: "",
  acceptedConditions: [],
  allergyConstraint: "",
};

const LABELS: Record<string, string> = {
  field_water_abuse: "Field, water, or abuse",
  studio_desk_daily: "Studio, desk, or daily wear",
  formal_architectural: "Formal or architectural",
  zero_maintenance: "Quartz, solar, or digital precision",
  workhorse_mechanical: "Workhorse mechanical",
  specialist_mechanical: "Specialist mechanical is acceptable",
  seconds_per_month: "Seconds per month",
  within_5_seconds_per_day: "Within ±5 seconds per day",
  within_15_seconds_per_day: "Within ±15 seconds per day",
  no_requirement: "No accuracy requirement",
  under_80_g: "Under 80 g",
  under_120_g: "Under 120 g",
  under_160_g: "Under 160 g",
  no_limit: "No weight limit",
  required: "Date required",
  forbidden: "No date",
  either: "Either is acceptable",
  discreet_competence: "Discreet competence",
  quiet_continuity: "Quiet continuity",
  unapologetic_benchmark: "Unapologetic benchmark",
  anti_luxury: "Anti-luxury tool",
  structural_tool: "Structural tool",
  mid_century_industrial: "Mid-century industrial",
  integrated_geometry: "Integrated geometry",
  extravagant_creative: "Extravagant or creative",
  high_art: "High art and finishing",
  sovereign_independent: "Sovereign independent",
  industrial_reality: "Industrial reality",
  modern_transparent: "Transparent modern rebirth",
  dependability: "Dependable armor",
  custody: "Generational custody",
  differentiation: "Creative differentiation",
  milestone: "Milestone marker",
  evergreen: "Evergreen",
  contrarian: "Contrarian",
  trend_agnostic: "Trend agnostic",
  avoid: "Avoid speculative risk",
  accept: "Accept speculative risk",
  spring_bar: "Standard spring bars",
  quick_release: "Quick release",
  proprietary: "Proprietary attachment",
  integrated: "Integrated bracelet",
  authorized_dealer: "Authorized dealer",
  grey_market: "Grey market",
  secondary_market: "Secondary market",
  in_stock_only: "In stock only",
  short_wait: "Short wait is acceptable",
  waitlist_or_allocation: "Wait-list or allocation is acceptable",
  not_important: "Not important",
  prefer_60_percent_plus: "Prefer 60%+ residual value",
  require_80_percent_plus: "Require 80%+ residual value",
  some_lume: "Some lume",
  strong_lume: "Strong lume",
  wear_and_patina_ok: "Wear and patina are welcome",
  light_wear_ok: "Light wear is acceptable",
  keep_looking_new: "Should keep looking new",
  new: "New only",
  certified_pre_owned: "Certified pre-owned",
  pre_owned: "Pre-owned",
  vintage: "Vintage",
  none: "No known contact allergy",
  nickel_contact: "Nickel/contact allergy",
  flat: "Flat",
  moderate: "Moderate",
  steep: "Steep",
  gmt: "GMT",
  chronograph: "Chronograph",
  moonphase: "Moon phase",
  power_reserve: "Power reserve display",
  alarm: "Alarm",
  world_time: "World time",
  perpetual_calendar: "Perpetual calendar",
  "3": "3 o'clock",
  "4": "4 o'clock",
  "9_destro": "9 o'clock / destro",
};

const OPTION_DETAILS: Record<string, string> = {
  discreet_competence: "Recognizable mainly to people who understand watches.",
  quiet_continuity:
    "Understated lineage and continuity over broad recognition.",
  unapologetic_benchmark:
    "A clear, widely understood expression of achievement and status.",
  anti_luxury: "Utility and indifference to conventional luxury cues.",
  structural_tool:
    "Function-led form: protection, legibility, and purpose are visible.",
  mid_century_industrial:
    "Restrained instruments with field, pilot, or marine roots.",
  integrated_geometry:
    "Architectural cases, strong angles, and bracelet continuity.",
  extravagant_creative:
    "Sculptural or unconventional forms that attract attention.",
  high_art: "Fine finishing and traditional handcraft as the visual focus.",
  sovereign_independent:
    "Independent or foundation-backed ownership matters to you.",
  industrial_reality:
    "How the watch is made matters more than its corporate structure.",
  modern_transparent:
    "Honest modern origins matter more than an invented heritage.",
  dependability: "A reliable object that reduces daily friction.",
  custody: "A lasting object intended to carry memory forward.",
  differentiation: "A personal choice that rejects generic consensus.",
  milestone: "A visible marker of progress or achievement.",
};

function labelFor(value: string) {
  return LABELS[value] ?? value.replaceAll("_", " ");
}

function formatWristMeasurement(value: number) {
  return String(Number(value.toFixed(2)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type SavedDraftInput = {
  version: typeof QUESTIONNAIRE_VERSION;
  core?: unknown;
  refinement?: unknown;
  step?: unknown;
};

function readSavedDraft(): SavedDraftInput | null {
  try {
    const raw = window.sessionStorage.getItem(QUESTIONNAIRE_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== QUESTIONNAIRE_VERSION) {
      return null;
    }
    return {
      version: QUESTIONNAIRE_VERSION,
      core: parsed.core,
      refinement: parsed.refinement,
      step: parsed.step,
    };
  } catch {
    return null;
  }
}

function hydrateCoreDraft(value: unknown): CoreDraft {
  if (!isRecord(value)) return INITIAL_CORE;

  const saved = value as Partial<CoreDraft> & {
    wristCircumferenceMm?: unknown;
  };
  const wristUnit = WRIST_UNITS.includes(saved.wristUnit as WristUnit)
    ? (saved.wristUnit as WristUnit)
    : "mm";
  const wristCircumference =
    typeof saved.wristCircumference === "string"
      ? saved.wristCircumference
      : typeof saved.wristCircumferenceMm === "string"
        ? saved.wristCircumferenceMm
        : "";
  delete saved.wristCircumferenceMm;

  return {
    ...INITIAL_CORE,
    ...saved,
    wristCircumference,
    wristUnit,
  };
}

function wristDraftToMm(draft: CoreDraft) {
  if (draft.wristCircumference.trim() === "") return Number.NaN;
  const circumference = Number(draft.wristCircumference);
  if (!Number.isFinite(circumference)) return Number.NaN;
  return wristCircumferenceToMm(circumference, draft.wristUnit);
}

function convertWristDraftUnit(value: string, from: WristUnit, to: WristUnit) {
  if (value.trim() === "" || from === to) return value;
  const circumference = Number(value);
  if (!Number.isFinite(circumference)) return "";
  const millimetres = wristCircumferenceToMm(circumference, from);
  const converted =
    to === "mm" ? millimetres : millimetres / MILLIMETRES_PER_INCH;
  return String(Number(converted.toFixed(to === "mm" ? 2 : 4)));
}

function buildCoreDraft(draft: CoreDraft): unknown {
  return {
    version: QUESTIONNAIRE_VERSION,
    budgetCurrency: draft.budgetCurrency,
    budgetMax: Number(draft.budgetMax),
    wristCircumferenceMm: wristDraftToMm(draft),
    deploymentEnvironment: draft.deploymentEnvironment,
    ownershipFriction: draft.ownershipFriction,
    accuracyTolerance: draft.accuracyTolerance,
    weightLimit: draft.weightLimit,
    requiredComplications: draft.requiredComplications,
    datePreference: draft.datePreference,
  };
}

function includeOptional(
  target: Record<string, unknown>,
  key: string,
  value: string,
) {
  if (value !== "") target[key] = value;
}

function buildRefinementDraft(draft: RefinementDraft): unknown {
  const value: Record<string, unknown> = {};
  includeOptional(value, "socialSignal", draft.socialSignal);
  includeOptional(value, "aestheticDna", draft.aestheticDna);
  includeOptional(value, "provenancePreference", draft.provenancePreference);
  includeOptional(value, "emotionalObjective", draft.emotionalObjective);
  includeOptional(value, "marketStance", draft.marketStance);
  includeOptional(
    value,
    "speculativeRiskTolerance",
    draft.speculativeRiskTolerance,
  );
  includeOptional(value, "requiredLugCurvature", draft.requiredLugCurvature);
  includeOptional(
    value,
    "requiredAttachmentType",
    draft.requiredAttachmentType,
  );
  includeOptional(value, "availabilityTolerance", draft.availabilityTolerance);
  includeOptional(value, "liquidityPreference", draft.liquidityPreference);
  includeOptional(value, "lumePreference", draft.lumePreference);
  includeOptional(value, "crownPosition", draft.crownPosition);
  includeOptional(value, "cosmeticTolerance", draft.cosmeticTolerance);
  includeOptional(value, "allergyConstraint", draft.allergyConstraint);

  if (draft.requiredLugWidthMm !== "") {
    value.requiredLugWidthMm = Number(draft.requiredLugWidthMm);
  }
  if (draft.quickReleaseRequired !== "") {
    value.quickReleaseRequired = draft.quickReleaseRequired === "yes";
  }
  if (draft.acquisitionChannels.length > 0) {
    value.acquisitionChannels = draft.acquisitionChannels;
  }
  if (draft.premiumAllowancePercent !== "") {
    value.premiumAllowancePercent = Number(draft.premiumAllowancePercent);
  }
  if (draft.purchaseCountry.trim() !== "") {
    value.purchaseCountry = draft.purchaseCountry;
  }
  if (draft.serviceCountry.trim() !== "") {
    value.serviceCountry = draft.serviceCountry;
  }
  if (draft.acceptedConditions.length > 0) {
    value.acceptedConditions = draft.acceptedConditions;
  }

  return value;
}

function issueMessages(error: { issues: { message: string }[] }) {
  return [...new Set(error.issues.map((issue) => issue.message))];
}

function parseEmailOptIn(formData: FormData) {
  const emailValue = formData.get("email");
  const optIn = formData.get("emailOptIn");
  const hasEmail = typeof emailValue === "string" && emailValue.trim() !== "";

  if (emailValue !== null && typeof emailValue !== "string") {
    return { error: "The email field is invalid." } as const;
  }
  if (hasEmail && optIn !== "yes") {
    return { error: "Email delivery requires explicit opt-in." } as const;
  }
  if (optIn === "yes" && !hasEmail) {
    return { error: "Enter an email address to request delivery." } as const;
  }
  if (!hasEmail) return { email: null } as const;

  const parsed = emailSchema.safeParse(emailValue);
  return parsed.success
    ? ({ email: parsed.data } as const)
    : ({ error: "Enter a valid email address." } as const);
}

function rateLimitKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const address =
    forwarded?.split(",", 1)[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown";
  return `quiz:${address}`;
}

function rateLimitHeaders(decision: ReturnType<typeof consumeRateLimit>) {
  const headers = new Headers();
  if (decision.limit !== null) {
    headers.set("X-RateLimit-Limit", String(decision.limit));
    headers.set("X-RateLimit-Remaining", String(decision.remaining));
    headers.set(
      "X-RateLimit-Reset",
      String(Math.ceil((decision.resetAt ?? Date.now()) / 1_000)),
    );
  }
  if (decision.retryAfterSeconds !== null) {
    headers.set("Retry-After", String(decision.retryAfterSeconds));
  }
  return headers;
}

export async function action({ request }: Route.ActionArgs) {
  const rateLimitPolicy = parseRateLimitPolicy();
  const upstashConfiguration = parseUpstashRateLimitConfiguration();
  if (!rateLimitPolicy.configured && rateLimitPolicy.reason === "invalid") {
    return data<ActionResult>(
      {
        ok: false,
        errors: ["The diagnostic is temporarily unavailable. Try again later."],
      },
      { status: 503 },
    );
  }
  if (
    !upstashConfiguration.configured &&
    upstashConfiguration.reason === "invalid"
  ) {
    return data<ActionResult>(
      {
        ok: false,
        errors: ["The diagnostic is temporarily unavailable. Try again later."],
      },
      { status: 503 },
    );
  }

  const key = rateLimitKey(request);
  let rateLimitDecision: RateLimitDecision;
  if (rateLimitPolicy.configured && upstashConfiguration.configured) {
    try {
      rateLimitDecision = await consumeUpstashRateLimit(
        createUpstashRateLimitClient(rateLimitPolicy, upstashConfiguration),
        key,
      );
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "rate_limit_error",
          message: error instanceof Error ? error.message : "unknown error",
        }),
      );
      return data<ActionResult>(
        {
          ok: false,
          errors: [
            "The diagnostic is temporarily unavailable. Try again later.",
          ],
        },
        { status: 503 },
      );
    }
  } else {
    rateLimitDecision = consumeRateLimit(key, rateLimitPolicy);
  }
  if (!rateLimitDecision.allowed) {
    return data<ActionResult>(
      {
        ok: false,
        errors: ["Too many diagnostic attempts. Please try again shortly."],
      },
      { status: 429, headers: rateLimitHeaders(rateLimitDecision) },
    );
  }

  const formData = await request.formData();
  const emailOptIn = parseEmailOptIn(formData);
  const intent = formData.get("intent");
  const serialized = formData.get("profile");

  if (
    (intent !== "core" && intent !== "refine") ||
    typeof serialized !== "string"
  ) {
    return data<ActionResult>(
      { ok: false, errors: ["The diagnostic submission is incomplete."] },
      { status: 400 },
    );
  }

  let rawProfile: unknown;
  try {
    rawProfile = JSON.parse(serialized);
  } catch {
    return data<ActionResult>(
      { ok: false, errors: ["The diagnostic payload is not valid JSON."] },
      { status: 400 },
    );
  }

  const parsed = questionnaireProfileSchema.safeParse(rawProfile);
  if (!parsed.success) {
    return data<ActionResult>(
      { ok: false, errors: issueMessages(parsed.error) },
      { status: 400 },
    );
  }

  if (intent === "core" && parsed.data.refinement !== undefined) {
    return data<ActionResult>(
      {
        ok: false,
        errors: ["Core submissions cannot include refinement data."],
      },
      { status: 400 },
    );
  }

  const profile = normalizeProfile(parsed.data);
  const evaluatedAt = new Date().toISOString();
  const evaluationStartedAt = performance.now();
  const catalogueLoad = await loadRecommendationData(parsed.data, evaluatedAt);
  const recommendation = recommendWatches(
    parsed.data,
    catalogueLoad.catalogue,
    {
      asOf: evaluatedAt,
      hardFilterEvaluation: catalogueLoad.hardFilterEvaluation,
    },
  );
  const hardFilterEvaluation =
    catalogueLoad.hardFilterEvaluation ??
    evaluateHardFilterPartition(parsed.data, catalogueLoad.catalogue, {
      asOf: evaluatedAt,
    });
  const hardFilterViolationCount = recommendation.recommendations.filter(
    (candidate) => {
      const evaluation = hardFilterEvaluation[candidate.id];
      return (
        candidate.hardReasons.length > 0 ||
        candidate.missingFacts.length > 0 ||
        evaluation === undefined ||
        evaluation.hardReasons.length > 0 ||
        evaluation.missingFacts.length > 0
      );
    },
  ).length;
  const evaluationDurationMs = Number(
    (performance.now() - evaluationStartedAt).toFixed(2),
  );
  let subscription: SubscriptionResult = {
    status: "not_requested",
    message: "Results are available without email.",
    newsletterStatus: "not_requested",
    dossierStatus: "not_requested",
  };
  if ("error" in emailOptIn) {
    subscription = {
      status: "failed",
      message: emailOptIn.error ?? "Email delivery request was rejected.",
      newsletterStatus: "failed",
      dossierStatus: "failed",
    };
  } else if (emailOptIn.email !== null) {
    const beehiivConfiguration = parseBeehiivConfiguration();
    const resendConfiguration = parseResendConfiguration();
    const dossier = renderDossierEmail({
      profile,
      recommendation,
    });
    const deduplicationClient =
      upstashConfiguration.configured &&
      (beehiivConfiguration.configured || resendConfiguration.configured)
        ? createEmailDeliveryDeduplicationClient(upstashConfiguration)
        : null;
    const deliver = async (
      channel: "newsletter" | "dossier",
      send: () => Promise<void>,
    ): Promise<DeliveryChannelStatus> => {
      const key = deduplicationClient
        ? emailDeliveryDeduplicationKey({
            channel,
            email: emailOptIn.email,
            intent,
            profile,
          })
        : null;
      if (!deduplicationClient || !key) {
        await send();
        return "sent";
      }

      let claimed: boolean;
      try {
        claimed = await deduplicationClient.claim(key);
      } catch (error) {
        console.error(
          JSON.stringify({
            event: "email_deduplication_error",
            channel,
            operation: "claim",
            message: error instanceof Error ? error.message : "unknown error",
          }),
        );
        return "failed";
      }
      if (!claimed) return "already_requested";

      try {
        await send();
        return "sent";
      } catch (error) {
        try {
          await deduplicationClient.release(key);
        } catch (releaseError) {
          console.error(
            JSON.stringify({
              event: "email_deduplication_error",
              channel,
              operation: "release",
              message:
                releaseError instanceof Error
                  ? releaseError.message
                  : "unknown error",
            }),
          );
        }
        throw error;
      }
    };
    let newsletterStatus: DeliveryChannelStatus =
      beehiivConfiguration.configured
        ? "failed"
        : beehiivConfiguration.reason === "invalid"
          ? "misconfigured"
          : "unavailable";
    let dossierStatus: DeliveryChannelStatus = resendConfiguration.configured
      ? "failed"
      : resendConfiguration.reason === "invalid"
        ? "misconfigured"
        : "unavailable";
    if (beehiivConfiguration.configured) {
      try {
        newsletterStatus = await deliver("newsletter", () =>
          subscribeToBeehiiv(emailOptIn.email, beehiivConfiguration),
        );
      } catch (error) {
        console.error(
          JSON.stringify({
            event: "beehiiv_subscription_error",
            message: error instanceof Error ? error.message : "unknown error",
          }),
        );
      }
    }
    if (resendConfiguration.configured) {
      try {
        dossierStatus = await deliver("dossier", () =>
          sendDossierWithResend(emailOptIn.email, dossier, resendConfiguration),
        );
      } catch (error) {
        console.error(
          JSON.stringify({
            event: "resend_dossier_error",
            message: error instanceof Error ? error.message : "unknown error",
          }),
        );
      }
    }
    const summary = summarizeEmailDelivery(newsletterStatus, dossierStatus);
    subscription = {
      ...summary,
    };
  }

  const recommendationScores = recommendation.recommendations.map(
    (candidate) => candidate.score,
  );
  const evaluation: EvaluationSummary = {
    recommendationCount: recommendation.recommendations.length,
    verificationCount: recommendation.verificationRequired.length,
    whyNotCount: recommendation.whyNot.length,
    hardFilterViolationCount,
    evaluationDurationMs,
    providerCostUsd: 0,
    topRecommendationScore: recommendationScores[0] ?? null,
    meanRecommendationScore:
      recommendationScores.length === 0
        ? null
        : Number(
            (
              recommendationScores.reduce((total, score) => total + score, 0) /
              recommendationScores.length
            ).toFixed(2),
          ),
  };

  if (subscription.status === "not_requested") {
    await recordQuizAnalyticsEvent({
      name: "evaluation",
      intent,
      catalogueOrigin: catalogueLoad.origin,
      ...evaluation,
    });
  } else {
    await recordQuizAnalyticsEvent({
      name: "subscription",
      intent,
      catalogueOrigin: catalogueLoad.origin,
      status: subscription.status,
    });
  }

  return data<ActionResult>(
    {
      ok: true,
      intent,
      profile,
      recommendation,
      subscription,
    },
    "error" in emailOptIn ? { status: 400 } : undefined,
  );
}

export function meta(): ReturnType<Route.MetaFunction> {
  return [
    { title: "Watch Diagnostic · The Reserve" },
    {
      name: "description",
      content:
        "Define the physical, financial, and operational constraints for your next watch.",
    },
  ];
}

type ChoiceGroupProps<T extends string> = {
  legend: string;
  name: string;
  options: readonly T[];
  value: T | "";
  onChange: (value: T) => void;
};

function ChoiceGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: ChoiceGroupProps<T>) {
  return (
    <fieldset className="quiz-fieldset">
      <legend>{legend}</legend>
      <div className="choice-list">
        {options.map((option) => (
          <label
            className={`choice-card ${value === option ? "is-selected" : ""}`}
            key={option}
          >
            <input
              checked={value === option}
              name={name}
              onChange={() => onChange(option)}
              type="radio"
              value={option}
            />
            <span>{labelFor(option)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

type CheckboxGroupProps<T extends string> = {
  legend: string;
  options: readonly T[];
  values: T[];
  onChange: (values: T[]) => void;
};

function CheckboxGroup<T extends string>({
  legend,
  options,
  values,
  onChange,
}: CheckboxGroupProps<T>) {
  const toggle = (option: T) => {
    onChange(
      values.includes(option)
        ? values.filter((value) => value !== option)
        : [...values, option],
    );
  };

  return (
    <fieldset className="quiz-fieldset">
      <legend>{legend}</legend>
      <div className="choice-list choice-list--compact">
        {options.map((option) => (
          <label
            className={`choice-card ${values.includes(option) ? "is-selected" : ""}`}
            key={option}
          >
            <input
              checked={values.includes(option)}
              onChange={() => toggle(option)}
              type="checkbox"
              value={option}
            />
            <span>{labelFor(option)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

type OptionalSelectProps<T extends string> = {
  label: string;
  options: readonly T[];
  value: T | "";
  onChange: (value: T | "") => void;
};

function OptionalSelect<T extends string>({
  label,
  options,
  value,
  onChange,
}: OptionalSelectProps<T>) {
  return (
    <label className="input-stack">
      <span>{label}</span>
      <select
        onChange={(event) => onChange(event.target.value as T | "")}
        value={value}
      >
        <option value="">No preference</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {labelFor(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

type OptionalChoiceGroupProps<T extends string> = {
  legend: string;
  name: string;
  options: readonly T[];
  value: T | "";
  onChange: (value: T | "") => void;
};

function OptionalChoiceGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: OptionalChoiceGroupProps<T>) {
  return (
    <fieldset className="quiz-fieldset">
      <legend>{legend}</legend>
      <div className="choice-list choice-list--described">
        <label className={`choice-card ${value === "" ? "is-selected" : ""}`}>
          <input
            checked={value === ""}
            name={name}
            onChange={() => onChange("")}
            type="radio"
            value=""
          />
          <span className="choice-card__copy">
            <strong>No preference</strong>
            <small>Keep this dimension open.</small>
          </span>
        </label>
        {options.map((option) => (
          <label
            className={`choice-card ${value === option ? "is-selected" : ""}`}
            key={option}
          >
            <input
              checked={value === option}
              name={name}
              onChange={() => onChange(option)}
              type="radio"
              value={option}
            />
            <span className="choice-card__copy">
              <strong>{labelFor(option)}</strong>
              <small>{OPTION_DETAILS[option]}</small>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ProfileSummary({
  profile,
  recommendation,
  profilePayload,
  intent,
  subscription,
  onEdit,
  onRefine,
  onRestart,
}: {
  profile: ReturnType<typeof normalizeProfile>;
  recommendation: RecommendationResult;
  profilePayload: string;
  intent: "core" | "refine";
  subscription: SubscriptionResult;
  onEdit: () => void;
  onRefine: () => void;
  onRestart: () => void;
}) {
  const complicationText =
    profile.core.requiredComplications.length === 0
      ? "No required complication"
      : profile.core.requiredComplications.map(labelFor).join(", ");

  return (
    <section className="profile-summary" aria-labelledby="profile-heading">
      <span className="eyebrow">Constraint profile complete</span>
      <h1 id="profile-heading">Your search boundary</h1>
      <p>
        Your profile was compared with individually reviewed watch
        configurations. Confirmed matches meet every non-negotiable requirement;
        watches with missing evidence stay clearly separated.
      </p>
      <dl className="profile-grid">
        <div>
          <dt>Budget ceiling</dt>
          <dd>
            {profile.core.budgetCurrency}{" "}
            {profile.core.budgetMax.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt>Derived price band</dt>
          <dd>{labelFor(profile.derived.priceBand)}</dd>
        </div>
        <div>
          <dt>Wrist</dt>
          <dd>
            {formatWristMeasurement(profile.core.wristCircumferenceMm)} mm ·{" "}
            {formatWristMeasurement(
              profile.core.wristCircumferenceMm / MILLIMETRES_PER_INCH,
            )}{" "}
            in · {labelFor(profile.derived.wristBand)}
          </dd>
        </div>
        <div>
          <dt>Deployment</dt>
          <dd>{labelFor(profile.core.deploymentEnvironment)}</dd>
        </div>
        <div>
          <dt>Ownership tolerance</dt>
          <dd>{labelFor(profile.core.ownershipFriction)}</dd>
        </div>
        <div>
          <dt>Accuracy</dt>
          <dd>{labelFor(profile.core.accuracyTolerance)}</dd>
        </div>
        <div>
          <dt>Weight</dt>
          <dd>{labelFor(profile.core.weightLimit)}</dd>
        </div>
        <div>
          <dt>Function</dt>
          <dd>
            {complicationText}; {labelFor(profile.core.datePreference)}
          </dd>
        </div>
        {profile.refinement?.premiumAllowancePercent ? (
          <div>
            <dt>Explicit effective ceiling</dt>
            <dd>
              {profile.core.budgetCurrency}{" "}
              {profile.derived.effectiveBudgetCeiling.toLocaleString()}
            </dd>
          </div>
        ) : null}
        {profile.refinement ? (
          <div>
            <dt>Speculative candidates</dt>
            <dd>
              {profile.derived.speculativeCandidatesAllowed
                ? "Allowed with warning"
                : "Suppressed"}
            </dd>
          </div>
        ) : null}
        {profile.refinement?.socialSignal ? (
          <div>
            <dt>How you want to be perceived</dt>
            <dd>{labelFor(profile.refinement.socialSignal)}</dd>
          </div>
        ) : null}
        {profile.refinement?.aestheticDna ? (
          <div>
            <dt>Visual impression</dt>
            <dd>{labelFor(profile.refinement.aestheticDna)}</dd>
          </div>
        ) : null}
        {profile.refinement?.provenancePreference ? (
          <div>
            <dt>Heritage preference</dt>
            <dd>{labelFor(profile.refinement.provenancePreference)}</dd>
          </div>
        ) : null}
        {profile.refinement?.emotionalObjective ? (
          <div>
            <dt>Emotional purpose</dt>
            <dd>{labelFor(profile.refinement.emotionalObjective)}</dd>
          </div>
        ) : null}
      </dl>
      <RecommendationSummary recommendation={recommendation} />
      <DossierDelivery
        intent={intent}
        profilePayload={profilePayload}
        subscription={subscription}
      />
      <div className="summary-actions">
        <button
          className="button button--primary"
          onClick={onRefine}
          type="button"
        >
          Edit personal answers
        </button>
        <button className="button button--quiet" onClick={onEdit} type="button">
          Edit essential answers
        </button>
        <button
          className="button button--quiet"
          onClick={onRestart}
          type="button"
        >
          Restart diagnostic
        </button>
      </div>
    </section>
  );
}

function DossierDelivery({
  intent,
  profilePayload,
  subscription,
}: {
  intent: "core" | "refine";
  profilePayload: string;
  subscription: SubscriptionResult;
}) {
  return (
    <section className="delivery-panel" aria-labelledby="delivery-heading">
      <span className="eyebrow">Optional, explicit opt-in</span>
      <h2 id="delivery-heading">Keep the dossier</h2>
      <p>
        Results stay visible here. If you want the newsletter opt-in and a
        source-backed custom dossier, enter an address and check the opt-in;
        email is not required to use the diagnostic.
      </p>
      {subscription.status !== "sent" &&
      subscription.status !== "already_requested" ? (
        <Form className="delivery-form" method="post">
          <input name="intent" type="hidden" value={intent} />
          <input name="profile" type="hidden" value={profilePayload} />
          <label className="input-stack" htmlFor="delivery-email">
            <span>Email address</span>
            <input
              id="delivery-email"
              name="email"
              placeholder="you@example.com"
              type="email"
            />
          </label>
          <label className="delivery-opt-in">
            <input name="emailOptIn" type="checkbox" value="yes" />
            <span>
              I explicitly opt in to receive this diagnostic dossier by email
              and, where enabled, subscribe to The Reserve&apos;s email
              publication.
            </span>
          </label>
          <button className="button button--primary" type="submit">
            Request email delivery
          </button>
        </Form>
      ) : null}
      <p
        className={`delivery-status delivery-status--${subscription.status}`}
        role={
          subscription.status === "failed" || subscription.status === "partial"
            ? "alert"
            : "status"
        }
      >
        {subscription.message}
      </p>
    </section>
  );
}

function formatCandidatePrice(
  price: RecommendationResult["recommendations"][number]["price"],
) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: price.currency,
    maximumFractionDigits: 0,
  }).format(price.amountMinor / 100);
}

function CandidateCard({
  candidate,
  status,
}: {
  candidate: EvaluatedCandidate;
  status: "confirmed" | "verification";
}) {
  return (
    <article className="candidate-card">
      <div className="candidate-card__heading">
        <div>
          <span className="eyebrow">
            {status === "confirmed" ? "Confirmed fit" : "Verify before buying"}
          </span>
          <h3>
            {candidate.brand} {candidate.model}
          </h3>
          <p>
            Ref. {candidate.referenceCode} · {candidate.variantName}
          </p>
        </div>
        <div className="candidate-price">
          <strong>{formatCandidatePrice(candidate.price)}</strong>
          <span>
            {candidate.price.marketCountry} price · FX dated{" "}
            {candidate.price.fxObservedAt.slice(0, 10)}
          </span>
        </div>
      </div>

      <dl className="candidate-specs">
        <div>
          <dt>Case</dt>
          <dd>
            {candidate.geometry.caseDiameterMm !== null
              ? `${candidate.geometry.caseDiameterMm} mm diameter`
              : candidate.geometry.caseLengthMm !== null &&
                  candidate.geometry.caseWidthMm !== null
                ? `${candidate.geometry.caseLengthMm} × ${candidate.geometry.caseWidthMm} mm`
                : "Unknown size"}
            {" · "}Wrist span{" "}
            {candidate.geometry.lugToLugMm ??
              candidate.geometry.caseLengthMm ??
              "?"}{" "}
            mm
          </dd>
        </div>
        <div>
          <dt>Movement</dt>
          <dd>
            {labelFor(candidate.movement.type)}
            {candidate.movement.caliber
              ? ` · ${candidate.movement.caliber}`
              : ""}
          </dd>
        </div>
        <div>
          <dt>Weight</dt>
          <dd>
            {candidate.geometry.weightFullG === null
              ? "Not published"
              : `${candidate.geometry.weightFullG} g`}
          </dd>
        </div>
        <div>
          <dt>Score</dt>
          <dd>{candidate.score.toFixed(1)}</dd>
        </div>
      </dl>

      {candidate.scoreTrace.length > 0 ? (
        <ul className="factor-list" aria-label="Score factors">
          {candidate.scoreTrace.slice(0, 4).map((factor) => (
            <li key={factor.factor}>
              <strong>
                {factor.points > 0 ? "+" : ""}
                {factor.points}
              </strong>{" "}
              {factor.explanation}
            </li>
          ))}
        </ul>
      ) : null}

      {candidate.missingFacts.length > 0 ? (
        <ul
          className="verification-list"
          aria-label="Facts requiring verification"
        >
          {candidate.missingFacts.map((fact) => (
            <li key={fact.code}>{fact.explanation}</li>
          ))}
        </ul>
      ) : null}

      <a
        className="candidate-link"
        href={candidate.productUrl}
        rel="noreferrer"
        target="_blank"
      >
        Inspect manufacturer source
      </a>
    </article>
  );
}

function RecommendationSummary({
  recommendation,
}: {
  recommendation: RecommendationResult;
}) {
  return (
    <div className="recommendation-summary">
      <section aria-labelledby="confirmed-heading">
        <div className="result-section-heading">
          <div>
            <span className="eyebrow">Best fit</span>
            <h2 id="confirmed-heading">Confirmed matches</h2>
          </div>
          <span>
            {recommendation.recommendations.length} /{" "}
            {recommendation.diagnostics.evaluated}
          </span>
        </div>
        {recommendation.recommendations.length > 0 ? (
          <div className="candidate-list">
            {recommendation.recommendations.map((candidate) => (
              <CandidateCard
                candidate={candidate}
                key={candidate.id}
                status="confirmed"
              />
            ))}
          </div>
        ) : (
          <p className="empty-result">
            No reviewed watch configuration meets every non-negotiable
            requirement with complete evidence. Nothing was silently relaxed.
          </p>
        )}
      </section>

      {recommendation.verificationRequired.length > 0 ? (
        <section aria-labelledby="verification-heading">
          <div className="result-section-heading">
            <div>
              <span className="eyebrow">Evidence boundary</span>
              <h2 id="verification-heading">Promising, but verify first</h2>
            </div>
          </div>
          <div className="candidate-list">
            {recommendation.verificationRequired.map((candidate) => (
              <CandidateCard
                candidate={candidate}
                key={candidate.id}
                status="verification"
              />
            ))}
          </div>
        </section>
      ) : null}

      {recommendation.relaxations.length > 0 ? (
        <section aria-labelledby="relaxation-heading">
          <div className="result-section-heading">
            <div>
              <span className="eyebrow">No silent compromise</span>
              <h2 id="relaxation-heading">Optional next relaxations</h2>
            </div>
          </div>
          <ol className="explanation-list">
            {recommendation.relaxations.map((relaxation) => (
              <li key={relaxation.code}>{relaxation.explanation}</li>
            ))}
          </ol>
        </section>
      ) : null}

      {recommendation.whyNot.length > 0 ? (
        <section aria-labelledby="why-not-heading">
          <div className="result-section-heading">
            <div>
              <span className="eyebrow">Exclusion trace</span>
              <h2 id="why-not-heading">Why not these</h2>
            </div>
          </div>
          <div className="why-not-list">
            {recommendation.whyNot.map((candidate) => (
              <article key={candidate.id}>
                <h3>
                  {candidate.brand} {candidate.model}
                </h3>
                <ul>
                  {candidate.hardReasons.map((reason) => (
                    <li key={reason.code}>{reason.explanation}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {recommendation.unscoredPreferences.length > 0 ? (
        <section aria-labelledby="unscored-heading">
          <div className="result-section-heading">
            <div>
              <span className="eyebrow">Evidence boundary</span>
              <h2 id="unscored-heading">Preferences not scored yet</h2>
            </div>
          </div>
          <ul className="explanation-list">
            {recommendation.unscoredPreferences.map((preference) => (
              <li key={preference.field}>{preference.explanation}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="source-register" aria-labelledby="sources-heading">
        <h2 id="sources-heading">Sources used in this result</h2>
        <ol>
          {recommendation.sources.map((source) => (
            <li key={source.id}>
              <a href={source.url} rel="noreferrer" target="_blank">
                {source.publisher}: {source.title}
              </a>{" "}
              <span>retrieved {source.retrievedAt.slice(0, 10)}</span>
            </li>
          ))}
        </ol>
        <p>
          Evaluated {recommendation.evaluatedAt.slice(0, 10)}. The reviewed
          collection is still limited; absence is not evidence that a suitable
          watch does not exist.
        </p>
      </section>
    </div>
  );
}

export default function Quiz() {
  const actionData = useActionData<typeof action>();
  const location = useLocation();
  const navigation = useNavigation();
  const [core, setCore] = useState<CoreDraft>(INITIAL_CORE);
  const [refinement, setRefinement] =
    useState<RefinementDraft>(INITIAL_REFINEMENT);
  const [step, setStep] = useState(0);
  const [storageReady, setStorageReady] = useState(false);
  const startTracked = useRef(false);

  useEffect(() => {
    const saved = readSavedDraft();
    const archetypeHandoff = parseCoreQuizHandoff(
      new URLSearchParams(location.search),
    );
    const timer = window.setTimeout(() => {
      if (saved?.core) setCore(hydrateCoreDraft(saved.core));
      if (
        (saved?.refinement && isRecord(saved.refinement)) ||
        archetypeHandoff
      ) {
        setRefinement({
          ...INITIAL_REFINEMENT,
          ...(saved?.refinement && isRecord(saved.refinement)
            ? (saved.refinement as Partial<RefinementDraft>)
            : {}),
          ...(archetypeHandoff ?? {}),
        });
      }
      if (
        typeof saved?.step === "number" &&
        saved.step >= 0 &&
        saved.step < SUMMARY_STEP
      ) {
        setStep(saved.step);
      }
      setStorageReady(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [location.search]);

  useEffect(() => {
    if (!storageReady) return;
    const saved: SavedDraft = {
      version: QUESTIONNAIRE_VERSION,
      core,
      refinement,
      step: step === SUMMARY_STEP ? CORE_STEP_COUNT - 1 : step,
    };
    window.sessionStorage.setItem(
      QUESTIONNAIRE_STORAGE_KEY,
      JSON.stringify(saved),
    );
  }, [core, refinement, step, storageReady]);

  useEffect(() => {
    if (!actionData?.ok) return;
    const timer = window.setTimeout(
      () =>
        setStep(actionData.intent === "core" ? CORE_STEP_COUNT : SUMMARY_STEP),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [actionData]);

  const resultData = actionData?.ok ? actionData : null;
  const resultIntent = resultData?.intent;

  const coreParse = useMemo(
    () => coreProfileSchema.safeParse(buildCoreDraft(core)),
    [core],
  );
  const wristCircumferenceMm = useMemo(() => wristDraftToMm(core), [core]);
  const refinementParse = useMemo(
    () => refinementSchema.safeParse(buildRefinementDraft(refinement)),
    [refinement],
  );

  const profilePayload = useMemo(
    () =>
      JSON.stringify({
        core: buildCoreDraft(core),
        ...(step >= CORE_STEP_COUNT && step < SUMMARY_STEP
          ? { refinement: buildRefinementDraft(refinement) }
          : {}),
      }),
    [core, refinement, step],
  );

  const resultProfilePayload = useMemo(
    () =>
      JSON.stringify({
        core: buildCoreDraft(core),
        ...(resultIntent === "refine"
          ? { refinement: buildRefinementDraft(refinement) }
          : {}),
      }),
    [resultIntent, core, refinement],
  );

  const stepIsComplete =
    step === 0
      ? Number(core.budgetMax) > 0
      : step === 1
        ? wristCircumferenceMm >= 100 && wristCircumferenceMm <= 300
        : step === 2
          ? core.deploymentEnvironment !== ""
          : step === 3
            ? core.ownershipFriction !== "" && core.accuracyTolerance !== ""
            : step === 4
              ? core.weightLimit !== ""
              : step === 5
                ? core.datePreference !== "" && coreParse.success
                : refinementParse.success;

  const isSubmitting = navigation.state === "submitting";
  const totalVisibleSteps =
    step < CORE_STEP_COUNT ? CORE_STEP_COUNT : REFINE_STEP_COUNT;
  const visibleStep =
    step < CORE_STEP_COUNT ? step + 1 : step - CORE_STEP_COUNT + 1;

  const goBack = () => setStep((current) => Math.max(0, current - 1));

  const recordStart = () => {
    if (startTracked.current) return;
    startTracked.current = true;
    if (import.meta.env.PROD) {
      void fetch("/analytics/quiz-started", {
        method: "POST",
        keepalive: true,
      }).catch(() => undefined);
    }
  };

  const restartQuiz = () => {
    window.sessionStorage.removeItem(QUESTIONNAIRE_STORAGE_KEY);
    setCore(INITIAL_CORE);
    setRefinement(INITIAL_REFINEMENT);
    setStep(0);
    startTracked.current = false;
  };

  if (step === SUMMARY_STEP && resultData) {
    return (
      <main className="quiz-shell">
        <nav className="quiz-nav" aria-label="Diagnostic navigation">
          <Link to="/">The Reserve</Link>
          <span>Reference diagnostic</span>
        </nav>
        <ProfileSummary
          onEdit={() => setStep(0)}
          onRefine={() => setStep(CORE_STEP_COUNT)}
          onRestart={restartQuiz}
          profile={resultData.profile}
          profilePayload={resultProfilePayload}
          recommendation={resultData.recommendation}
          intent={resultData.intent}
          subscription={resultData.subscription}
        />
      </main>
    );
  }

  return (
    <main className="quiz-shell">
      <nav className="quiz-nav" aria-label="Diagnostic navigation">
        <Link to="/">The Reserve</Link>
        <span>
          {step < CORE_STEP_COUNT ? "Essential fit" : "Personal profile"}
        </span>
      </nav>

      <section className="quiz-panel" aria-labelledby="question-heading">
        <div className="progress-copy">
          <span className="eyebrow">
            {step < CORE_STEP_COUNT ? "Essential" : "Personal"} · {visibleStep}{" "}
            / {totalVisibleSteps}
          </span>
          <span>{Math.round((visibleStep / totalVisibleSteps) * 100)}%</span>
        </div>
        <div className="progress-track" aria-hidden="true">
          <span
            style={{ width: `${(visibleStep / totalVisibleSteps) * 100}%` }}
          />
        </div>

        {step === 0 ? (
          <div className="question-block">
            <h1 id="question-heading">What is the actual purchase ceiling?</h1>
            <p>
              Enter the maximum outlay. The exact number sets your purchase
              boundary.
            </p>
            <div className="split-inputs">
              <label className="input-stack input-stack--currency">
                <span>Currency</span>
                <select
                  onChange={(event) =>
                    setCore((current) => ({
                      ...current,
                      budgetCurrency: event.target
                        .value as CoreProfile["budgetCurrency"],
                    }))
                  }
                  value={core.budgetCurrency}
                >
                  {CURRENCIES.map((currency) => (
                    <option key={currency}>{currency}</option>
                  ))}
                </select>
              </label>
              <label className="input-stack">
                <span>Maximum amount</span>
                <input
                  inputMode="decimal"
                  min="1"
                  onChange={(event) =>
                    setCore((current) => ({
                      ...current,
                      budgetMax: event.target.value,
                    }))
                  }
                  placeholder="10000"
                  type="number"
                  value={core.budgetMax}
                />
              </label>
            </div>
            <p className="reference-note">
              Shared bands: {PRICE_BANDS.map((band) => band.label).join(" · ")}
            </p>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="question-block">
            <h1 id="question-heading">Measure your wrist</h1>
            <p>
              Wrap a flexible tape flush above the wrist bone without slack.
              Choose millimetres or inches. The diagnostic normalizes the exact
              measurement to millimetres before filtering.
            </p>
            <div className="split-inputs wrist-inputs">
              <label className="input-stack">
                <span>Unit</span>
                <select
                  onChange={(event) => {
                    const wristUnit = event.target.value as WristUnit;
                    setCore((current) => ({
                      ...current,
                      wristCircumference: convertWristDraftUnit(
                        current.wristCircumference,
                        current.wristUnit,
                        wristUnit,
                      ),
                      wristUnit,
                    }));
                  }}
                  value={core.wristUnit}
                >
                  <option value="mm">Millimetres (mm)</option>
                  <option value="in">Inches (in)</option>
                </select>
              </label>
              <label className="input-stack">
                <span>Wrist circumference ({core.wristUnit})</span>
                <input
                  inputMode="decimal"
                  max={core.wristUnit === "mm" ? "300" : "11.81"}
                  min={core.wristUnit === "mm" ? "100" : "3.94"}
                  onChange={(event) =>
                    setCore((current) => ({
                      ...current,
                      wristCircumference: event.target.value,
                    }))
                  }
                  placeholder={core.wristUnit === "mm" ? "170" : "6.7"}
                  step={core.wristUnit === "mm" ? "0.1" : "0.01"}
                  type="number"
                  value={core.wristCircumference}
                />
              </label>
            </div>
            <p className="reference-note">
              One display scale:{" "}
              {WRIST_BANDS.map((band) => band.label).join(" · ")}
            </p>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="question-block">
            <h1 id="question-heading">Where will it operate?</h1>
            <p>Deployment changes water, shock, and thickness requirements.</p>
            <ChoiceGroup
              legend="Primary environment"
              name="deployment"
              onChange={(deploymentEnvironment) =>
                setCore((current) => ({
                  ...current,
                  deploymentEnvironment,
                }))
              }
              options={DEPLOYMENT_ENVIRONMENTS}
              value={core.deploymentEnvironment}
            />
          </div>
        ) : null}

        {step === 3 ? (
          <div className="question-block">
            <h1 id="question-heading">
              What ownership friction is acceptable?
            </h1>
            <p>
              Service tolerance and accuracy are separate constraints; neither
              is inferred from the other.
            </p>
            <ChoiceGroup
              legend="Movement and service tolerance"
              name="friction"
              onChange={(ownershipFriction) =>
                setCore((current) => ({ ...current, ownershipFriction }))
              }
              options={OWNERSHIP_FRICTION_LEVELS}
              value={core.ownershipFriction}
            />
            <ChoiceGroup
              legend="Required accuracy"
              name="accuracy"
              onChange={(accuracyTolerance) =>
                setCore((current) => ({ ...current, accuracyTolerance }))
              }
              options={ACCURACY_TOLERANCES}
              value={core.accuracyTolerance}
            />
          </div>
        ) : null}

        {step === 4 ? (
          <div className="question-block">
            <h1 id="question-heading">How much weight is comfortable?</h1>
            <p>
              If a watch&apos;s full weight has not been verified, it appears
              separately for review instead of passing silently.
            </p>
            <ChoiceGroup
              legend="Maximum full-watch weight"
              name="weight"
              onChange={(weightLimit) =>
                setCore((current) => ({ ...current, weightLimit }))
              }
              options={WEIGHT_LIMITS}
              value={core.weightLimit}
            />
          </div>
        ) : null}

        {step === 5 ? (
          <div className="question-block">
            <h1 id="question-heading">Which functions are non-negotiable?</h1>
            <p>
              Leave complications empty for time-only or simple-date candidates.
            </p>
            <CheckboxGroup
              legend="Required complications"
              onChange={(requiredComplications) =>
                setCore((current) => ({
                  ...current,
                  requiredComplications,
                }))
              }
              options={COMPLICATIONS}
              values={core.requiredComplications}
            />
            <ChoiceGroup
              legend="Date preference"
              name="date"
              onChange={(datePreference) =>
                setCore((current) => ({ ...current, datePreference }))
              }
              options={DATE_PREFERENCES}
              value={core.datePreference}
            />
          </div>
        ) : null}

        {step === 6 ? (
          <div className="question-block">
            <h1 id="question-heading">How do you want to be perceived?</h1>
            <p>
              The remaining 21 preferences are optional across seven screens.
              Choose what feels true, or leave any dimension open.
            </p>
            <OptionalChoiceGroup
              legend="The signal it sends"
              name="social-signal"
              onChange={(socialSignal) =>
                setRefinement((current) => ({ ...current, socialSignal }))
              }
              options={SOCIAL_SIGNALS}
              value={refinement.socialSignal}
            />
          </div>
        ) : null}

        {step === 7 ? (
          <div className="question-block">
            <h1 id="question-heading">
              What visual impression should it create?
            </h1>
            <p>
              Pick the design language that should be apparent before anyone
              reads the name on the dial.
            </p>
            <OptionalChoiceGroup
              legend="Visual character"
              name="aesthetic-dna"
              onChange={(aestheticDna) =>
                setRefinement((current) => ({ ...current, aestheticDna }))
              }
              options={AESTHETIC_DNA}
              value={refinement.aestheticDna}
            />
          </div>
        ) : null}

        {step === 8 ? (
          <div className="question-block">
            <h1 id="question-heading">What kind of history should it carry?</h1>
            <p>
              Decide whether ownership, industrial execution, or an honest
              modern story matters most to you.
            </p>
            <OptionalChoiceGroup
              legend="Ownership and lineage"
              name="provenance-preference"
              onChange={(provenancePreference) =>
                setRefinement((current) => ({
                  ...current,
                  provenancePreference,
                }))
              }
              options={PROVENANCE_PREFERENCES}
              value={refinement.provenancePreference}
            />
          </div>
        ) : null}

        {step === 9 ? (
          <div className="question-block">
            <h1 id="question-heading">What should this watch make you feel?</h1>
            <p>
              Choose the emotional job the watch should perform in your life.
            </p>
            <OptionalChoiceGroup
              legend="Emotional purpose"
              name="emotional-objective"
              onChange={(emotionalObjective) =>
                setRefinement((current) => ({
                  ...current,
                  emotionalObjective,
                }))
              }
              options={EMOTIONAL_OBJECTIVES}
              value={refinement.emotionalObjective}
            />
          </div>
        ) : null}

        {step === 10 ? (
          <div className="question-block">
            <h1 id="question-heading">How should it fit and age?</h1>
            <p>
              These six optional answers define attachment, comfort, and wear
              boundaries.
            </p>
            <div className="select-grid">
              <OptionalSelect
                label="How should the lugs follow your wrist?"
                onChange={(requiredLugCurvature) =>
                  setRefinement((current) => ({
                    ...current,
                    requiredLugCurvature,
                  }))
                }
                options={LUG_CURVATURES}
                value={refinement.requiredLugCurvature}
              />
              <OptionalSelect
                label="What strap or bracelet connection do you prefer?"
                onChange={(requiredAttachmentType) =>
                  setRefinement((current) => ({
                    ...current,
                    requiredAttachmentType,
                  }))
                }
                options={ATTACHMENT_TYPES}
                value={refinement.requiredAttachmentType}
              />
              <label className="input-stack">
                <span>Do you need a specific lug width? (mm)</span>
                <input
                  max="40"
                  min="8"
                  onChange={(event) =>
                    setRefinement((current) => ({
                      ...current,
                      requiredLugWidthMm: event.target.value,
                    }))
                  }
                  type="number"
                  value={refinement.requiredLugWidthMm}
                />
              </label>
              <OptionalSelect
                label="How much visible wear can you accept?"
                onChange={(cosmeticTolerance) =>
                  setRefinement((current) => ({
                    ...current,
                    cosmeticTolerance,
                  }))
                }
                options={COSMETIC_TOLERANCES}
                value={refinement.cosmeticTolerance}
              />
              <OptionalSelect
                label="Do you have a contact-metal allergy?"
                onChange={(allergyConstraint) =>
                  setRefinement((current) => ({
                    ...current,
                    allergyConstraint,
                  }))
                }
                options={ALLERGY_CONSTRAINTS}
                value={refinement.allergyConstraint}
              />
              <label className="input-stack">
                <span>Must straps change without tools?</span>
                <select
                  onChange={(event) =>
                    setRefinement((current) => ({
                      ...current,
                      quickReleaseRequired: event.target.value as
                        "" | "yes" | "no",
                    }))
                  }
                  value={refinement.quickReleaseRequired}
                >
                  <option value="">No preference</option>
                  <option value="yes">Required</option>
                  <option value="no">Not required</option>
                </select>
              </label>
            </div>
          </div>
        ) : null}

        {step === 11 ? (
          <div className="question-block">
            <h1 id="question-heading">How do you want to acquire it?</h1>
            <p>
              Set seven optional boundaries for availability, condition, and
              market behavior.
            </p>
            <div className="select-grid">
              <OptionalSelect
                label="How should the watch behave in the market?"
                onChange={(marketStance) =>
                  setRefinement((current) => ({ ...current, marketStance }))
                }
                options={MARKET_STANCES}
                value={refinement.marketStance}
              />
              <OptionalSelect
                label="Will you accept speculative demand?"
                onChange={(speculativeRiskTolerance) =>
                  setRefinement((current) => ({
                    ...current,
                    speculativeRiskTolerance,
                  }))
                }
                options={SPECULATIVE_RISK_TOLERANCES}
                value={refinement.speculativeRiskTolerance}
              />
              <OptionalSelect
                label="How long are you willing to wait?"
                onChange={(availabilityTolerance) =>
                  setRefinement((current) => ({
                    ...current,
                    availabilityTolerance,
                  }))
                }
                options={AVAILABILITY_TOLERANCES}
                value={refinement.availabilityTolerance}
              />
              <OptionalSelect
                label="How important is resale liquidity?"
                onChange={(liquidityPreference) =>
                  setRefinement((current) => ({
                    ...current,
                    liquidityPreference,
                  }))
                }
                options={LIQUIDITY_PREFERENCES}
                value={refinement.liquidityPreference}
              />
              <label className="input-stack">
                <span>
                  How far above your ceiling can an exceptional option go?
                  (0–100%)
                </span>
                <input
                  max="100"
                  min="0"
                  onChange={(event) =>
                    setRefinement((current) => ({
                      ...current,
                      premiumAllowancePercent: event.target.value,
                    }))
                  }
                  type="number"
                  value={refinement.premiumAllowancePercent}
                />
              </label>
            </div>
            <CheckboxGroup
              legend="Where are you willing to buy?"
              onChange={(acquisitionChannels) =>
                setRefinement((current) => ({
                  ...current,
                  acquisitionChannels,
                }))
              }
              options={ACQUISITION_CHANNELS}
              values={refinement.acquisitionChannels}
            />
            <CheckboxGroup
              legend="Which conditions will you consider?"
              onChange={(acceptedConditions) =>
                setRefinement((current) => ({
                  ...current,
                  acceptedConditions,
                }))
              }
              options={CONDITIONS}
              values={refinement.acceptedConditions}
            />
          </div>
        ) : null}

        {step === 12 ? (
          <div className="question-block">
            <h1 id="question-heading">Where and how will you use it?</h1>
            <p>
              Keep purchase and service needs separate. For countries, use
              familiar two-letter abbreviations such as PL, US, GB, or CH.
            </p>
            <div className="select-grid">
              <OptionalSelect
                label="How important is low-light visibility?"
                onChange={(lumePreference) =>
                  setRefinement((current) => ({ ...current, lumePreference }))
                }
                options={LUME_PREFERENCES}
                value={refinement.lumePreference}
              />
              <OptionalSelect
                label="Where should the crown sit?"
                onChange={(crownPosition) =>
                  setRefinement((current) => ({ ...current, crownPosition }))
                }
                options={CROWN_POSITIONS}
                value={refinement.crownPosition}
              />
              <label className="input-stack">
                <span>Where will you buy?</span>
                <input
                  maxLength={2}
                  onChange={(event) =>
                    setRefinement((current) => ({
                      ...current,
                      purchaseCountry: event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="PL"
                  value={refinement.purchaseCountry}
                />
              </label>
              <label className="input-stack">
                <span>Where must service be available?</span>
                <input
                  maxLength={2}
                  onChange={(event) =>
                    setRefinement((current) => ({
                      ...current,
                      serviceCountry: event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="PL"
                  value={refinement.serviceCountry}
                />
              </label>
            </div>
          </div>
        ) : null}

        {actionData && !actionData.ok ? (
          <div className="form-error" role="alert">
            <strong>Check the profile:</strong>
            <ul>
              {actionData.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="quiz-actions">
          <button
            className="button button--quiet"
            disabled={step === 0}
            onClick={goBack}
            type="button"
          >
            Back
          </button>

          {step !== CORE_STEP_COUNT - 1 && step !== SUMMARY_STEP - 1 ? (
            <button
              className="button button--primary"
              disabled={!stepIsComplete}
              onClick={() => {
                recordStart();
                setStep((current) => current + 1);
              }}
              type="button"
            >
              Next
            </button>
          ) : (
            <Form method="post" onSubmit={recordStart}>
              <input
                name="intent"
                type="hidden"
                value={step < CORE_STEP_COUNT ? "core" : "refine"}
              />
              <input name="profile" type="hidden" value={profilePayload} />
              <button
                className="button button--primary"
                disabled={!stepIsComplete || isSubmitting}
                type="submit"
              >
                {isSubmitting
                  ? "Validating…"
                  : step < CORE_STEP_COUNT
                    ? "Continue to personal profile"
                    : "View matches"}
              </button>
            </Form>
          )}
        </div>
      </section>
    </main>
  );
}
