import { useEffect, useMemo, useState } from "react";
import { data, Form, Link, useActionData, useNavigation } from "react-router";
import { z } from "zod";

import type { Route } from "./+types/quiz";
import { recordQuizAnalyticsEvent } from "../domain/analytics.server";
import { loadRecommendationData } from "../domain/catalogue.server";
import type { CatalogueOrigin } from "../domain/catalogue.server";
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
} from "../domain/questionnaire";
import type { CoreProfile, RefinementProfile } from "../domain/questionnaire";
import type {
  EvaluatedCandidate,
  RecommendationResult,
} from "../domain/recommendation";
import { recommendWatches } from "../domain/recommendation";
import {
  parseBeehiivConfiguration,
  subscribeToBeehiiv,
} from "../domain/beehiiv.server";
import { renderDossierEmail } from "../domain/dossier-email";
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
const REFINE_STEP_COUNT = 4;
const SUMMARY_STEP = CORE_STEP_COUNT + REFINE_STEP_COUNT;

type ActionResult =
  | {
      ok: true;
      intent: "core" | "refine";
      profile: ReturnType<typeof normalizeProfile>;
      recommendation: RecommendationResult;
      catalogueOrigin: CatalogueOrigin;
      catalogueNotice: string;
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
      status: "sent" | "partial" | "unavailable" | "failed";
      message: string;
      newsletterStatus: "sent" | "unavailable" | "failed";
      dossierStatus: "sent" | "unavailable" | "failed";
    };

const emailSchema = z.string().trim().email().max(320);

type CoreDraft = {
  budgetCurrency: CoreProfile["budgetCurrency"];
  budgetMax: string;
  wristCircumferenceMm: string;
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
  wristCircumferenceMm: "",
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

function labelFor(value: string) {
  return LABELS[value] ?? value.replaceAll("_", " ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readSavedDraft(): Partial<SavedDraft> | null {
  try {
    const raw = window.sessionStorage.getItem(QUESTIONNAIRE_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== QUESTIONNAIRE_VERSION) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function buildCoreDraft(draft: CoreDraft): unknown {
  return {
    version: QUESTIONNAIRE_VERSION,
    budgetCurrency: draft.budgetCurrency,
    budgetMax: Number(draft.budgetMax),
    wristCircumferenceMm: Number(draft.wristCircumferenceMm),
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
        errors: [
          "Quiz rate limiting is misconfigured; the diagnostic is temporarily unavailable.",
        ],
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
        errors: [
          "Quiz rate limiting storage is misconfigured; the diagnostic is temporarily unavailable.",
        ],
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
            "Quiz rate limiting is temporarily unavailable; please try again shortly.",
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
  const catalogueLoad = await loadRecommendationData(parsed.data, evaluatedAt);
  const recommendation = recommendWatches(
    parsed.data,
    catalogueLoad.catalogue,
    {
      asOf: evaluatedAt,
      hardFilterEvaluation: catalogueLoad.hardFilterEvaluation,
    },
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
      catalogueOrigin: catalogueLoad.origin,
      intent,
    });
    let newsletterStatus: SubscriptionResult["newsletterStatus"] =
      beehiivConfiguration.configured ? "failed" : "unavailable";
    let dossierStatus: SubscriptionResult["dossierStatus"] =
      resendConfiguration.configured ? "failed" : "unavailable";
    if (beehiivConfiguration.configured) {
      try {
        await subscribeToBeehiiv(emailOptIn.email, beehiivConfiguration);
        newsletterStatus = "sent";
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
        await sendDossierWithResend(
          emailOptIn.email,
          dossier,
          resendConfiguration,
        );
        dossierStatus = "sent";
      } catch (error) {
        console.error(
          JSON.stringify({
            event: "resend_dossier_error",
            message: error instanceof Error ? error.message : "unknown error",
          }),
        );
      }
    }
    const successfulChannels = [newsletterStatus, dossierStatus].filter(
      (status) => status === "sent",
    ).length;
    const failedChannels = [newsletterStatus, dossierStatus].filter(
      (status) => status === "failed",
    ).length;
    const status: Exclude<SubscriptionResult["status"], "not_requested"> =
      successfulChannels > 0
        ? failedChannels > 0
          ? "partial"
          : "sent"
        : failedChannels > 0
          ? "failed"
          : "unavailable";
    const channelMessages = [
      newsletterStatus === "sent"
        ? "newsletter opt-in recorded"
        : newsletterStatus === "failed"
          ? "newsletter opt-in failed"
          : "newsletter delivery unavailable",
      dossierStatus === "sent"
        ? "custom dossier sent"
        : dossierStatus === "failed"
          ? "custom dossier delivery failed"
          : "custom dossier delivery unavailable",
    ];
    subscription = {
      status,
      newsletterStatus,
      dossierStatus,
      message: `${channelMessages.join("; ")}. Your result remains available.`,
    };
  }

  recordQuizAnalyticsEvent({
    name: "evaluation",
    intent,
    catalogueOrigin: catalogueLoad.origin,
    recommendationCount: recommendation.recommendations.length,
    verificationCount: recommendation.verificationRequired.length,
    whyNotCount: recommendation.whyNot.length,
  });
  if (subscription.status !== "not_requested") {
    recordQuizAnalyticsEvent({
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
      catalogueOrigin: catalogueLoad.origin,
      catalogueNotice: catalogueLoad.notice,
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

function ProfileSummary({
  profile,
  recommendation,
  catalogueOrigin,
  catalogueNotice,
  profilePayload,
  intent,
  subscription,
  onEdit,
  onRefine,
}: {
  profile: ReturnType<typeof normalizeProfile>;
  recommendation: RecommendationResult;
  catalogueOrigin: CatalogueOrigin;
  catalogueNotice: string;
  profilePayload: string;
  intent: "core" | "refine";
  subscription: SubscriptionResult;
  onEdit: () => void;
  onRefine: () => void;
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
        The engine evaluated homogeneous reference variants only. Confirmed
        matches pass every active hard constraint; incomplete facts are kept in
        a separate verification queue.
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
            {profile.core.wristCircumferenceMm} mm ·{" "}
            {labelFor(profile.derived.wristBand)}
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
      </dl>
      <RecommendationSummary
        catalogueNotice={catalogueNotice}
        catalogueOrigin={catalogueOrigin}
        recommendation={recommendation}
      />
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
          Refine the ranking profile
        </button>
        <button className="button button--quiet" onClick={onEdit} type="button">
          Edit core answers
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
      {subscription.status !== "sent" ||
      subscription.dossierStatus !== "sent" ? (
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
              and, where enabled, subscribe to The Reserve&apos;s Beehiiv
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
  catalogueOrigin,
  catalogueNotice,
}: {
  recommendation: RecommendationResult;
  catalogueOrigin: CatalogueOrigin;
  catalogueNotice: string;
}) {
  return (
    <div className="recommendation-summary">
      <section aria-labelledby="confirmed-heading">
        <div className="result-section-heading">
          <div>
            <span className="eyebrow">Deterministic result</span>
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
            No catalogue variant passes every active hard constraint with
            complete evidence. Nothing was silently relaxed.
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
        <p className={`catalogue-origin catalogue-origin--${catalogueOrigin}`}>
          {catalogueNotice}
        </p>
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
          Engine v{recommendation.engineVersion} · catalogue v
          {recommendation.catalogueVersion} · evaluated{" "}
          {recommendation.evaluatedAt.slice(0, 10)}. Current seed coverage is
          limited; absence is not evidence that a watch does not exist.
        </p>
      </section>
    </div>
  );
}

export default function Quiz() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [core, setCore] = useState<CoreDraft>(INITIAL_CORE);
  const [refinement, setRefinement] =
    useState<RefinementDraft>(INITIAL_REFINEMENT);
  const [step, setStep] = useState(0);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    const saved = readSavedDraft();
    const timer = window.setTimeout(() => {
      if (saved?.core) setCore({ ...INITIAL_CORE, ...saved.core });
      if (saved?.refinement) {
        setRefinement({ ...INITIAL_REFINEMENT, ...saved.refinement });
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
  }, []);

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
    const timer = window.setTimeout(() => setStep(SUMMARY_STEP), 0);
    return () => window.clearTimeout(timer);
  }, [actionData]);

  const resultData = actionData?.ok ? actionData : null;
  const resultIntent = resultData?.intent;

  const coreParse = useMemo(
    () => coreProfileSchema.safeParse(buildCoreDraft(core)),
    [core],
  );
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
        ? Number(core.wristCircumferenceMm) >= 100 &&
          Number(core.wristCircumferenceMm) <= 300
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

  const goBack = () => {
    if (step === CORE_STEP_COUNT && actionData?.ok) {
      setStep(SUMMARY_STEP);
      return;
    }
    setStep((current) => Math.max(0, current - 1));
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
          catalogueNotice={resultData.catalogueNotice}
          catalogueOrigin={resultData.catalogueOrigin}
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
          {step < CORE_STEP_COUNT ? "Core screening" : "Optional refinement"}
        </span>
      </nav>

      <section className="quiz-panel" aria-labelledby="question-heading">
        <div className="progress-copy">
          <span className="eyebrow">
            {step < CORE_STEP_COUNT ? "Required" : "Optional"} · {visibleStep} /{" "}
            {totalVisibleSteps}
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
              Enter the maximum outlay. Bands are derived for analytics; the
              number is what the future SQL filter will enforce.
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
              Enter millimetres; 152.4 mm equals 6 inches.
            </p>
            <label className="input-stack input-stack--measure">
              <span>Wrist circumference (mm)</span>
              <input
                inputMode="decimal"
                max="300"
                min="100"
                onChange={(event) =>
                  setCore((current) => ({
                    ...current,
                    wristCircumferenceMm: event.target.value,
                  }))
                }
                placeholder="170"
                step="0.1"
                type="number"
                value={core.wristCircumferenceMm}
              />
            </label>
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
              Full-watch weight becomes a hard filter. A missing catalogue
              weight will require verification instead of passing silently.
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
            <h1 id="question-heading">Signal and identity</h1>
            <p>
              These answers rank viable references; they do not override hard
              facts.
            </p>
            <div className="select-grid">
              <OptionalSelect
                label="Social signal"
                onChange={(socialSignal) =>
                  setRefinement((current) => ({ ...current, socialSignal }))
                }
                options={SOCIAL_SIGNALS}
                value={refinement.socialSignal}
              />
              <OptionalSelect
                label="Aesthetic DNA"
                onChange={(aestheticDna) =>
                  setRefinement((current) => ({ ...current, aestheticDna }))
                }
                options={AESTHETIC_DNA}
                value={refinement.aestheticDna}
              />
              <OptionalSelect
                label="Ownership and lineage"
                onChange={(provenancePreference) =>
                  setRefinement((current) => ({
                    ...current,
                    provenancePreference,
                  }))
                }
                options={PROVENANCE_PREFERENCES}
                value={refinement.provenancePreference}
              />
              <OptionalSelect
                label="Emotional objective"
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
          </div>
        ) : null}

        {step === 7 ? (
          <div className="question-block">
            <h1 id="question-heading">Fit, attachment, and wear</h1>
            <p>
              Leave any field blank when it is a preference rather than a
              constraint.
            </p>
            <div className="select-grid">
              <OptionalSelect
                label="Required lug curvature"
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
                label="Attachment type"
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
                <span>Required lug width (mm)</span>
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
                label="Cosmetic tolerance"
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
                label="Contact allergy"
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
                <span>Quick release</span>
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

        {step === 8 ? (
          <div className="question-block">
            <h1 id="question-heading">Market and acquisition</h1>
            <p>
              Premium is added above the stated ceiling only when explicitly
              entered and paired with an eligible channel.
            </p>
            <div className="select-grid">
              <OptionalSelect
                label="Market stance"
                onChange={(marketStance) =>
                  setRefinement((current) => ({ ...current, marketStance }))
                }
                options={MARKET_STANCES}
                value={refinement.marketStance}
              />
              <OptionalSelect
                label="Speculative risk"
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
                label="Availability"
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
                label="Liquidity"
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
                <span>Premium allowance (0–100%)</span>
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
              legend="Accepted acquisition channels"
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
              legend="Accepted condition"
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

        {step === 9 ? (
          <div className="question-block">
            <h1 id="question-heading">Operation and geography</h1>
            <p>
              Country codes keep purchase and service constraints separate. Use
              ISO two-letter codes such as PL, US, GB, or CH.
            </p>
            <div className="select-grid">
              <OptionalSelect
                label="Lume"
                onChange={(lumePreference) =>
                  setRefinement((current) => ({ ...current, lumePreference }))
                }
                options={LUME_PREFERENCES}
                value={refinement.lumePreference}
              />
              <OptionalSelect
                label="Crown position"
                onChange={(crownPosition) =>
                  setRefinement((current) => ({ ...current, crownPosition }))
                }
                options={CROWN_POSITIONS}
                value={refinement.crownPosition}
              />
              <label className="input-stack">
                <span>Purchase country</span>
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
                <span>Service country</span>
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
              onClick={() => setStep((current) => current + 1)}
              type="button"
            >
              Next
            </button>
          ) : (
            <Form method="post">
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
                    ? "View profile"
                    : "Apply refinements"}
              </button>
            </Form>
          )}
        </div>
      </section>
    </main>
  );
}
