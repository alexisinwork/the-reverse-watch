import { useEffect, useMemo, useRef, useState } from "react";
import {
  data,
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useLocation,
  useNavigation,
} from "react-router";
import { z } from "zod";

import type { Route } from "./+types/quiz";
import { recordQuizAnalyticsEvent } from "../domain/analytics.server";
import { hasDiagnosticAccess } from "../domain/diagnostic-access.server";
import { loadRecommendationCatalogue } from "../domain/catalogue.server";
import type { VocabularyKind } from "../domain/catalogue-vocabulary";
import { loadCatalogueVocabulary } from "../domain/catalogue-vocabulary.server";
import { PositioningFacet } from "../components/positioning-facet";
import { parseCoreQuizHandoff } from "../domain/discovery-archetype";
import {
  explainStoryConstraint,
  parseDiscoveryStorySlug,
} from "../domain/discovery-context.server";
import { loadPublishedDiscoveryStoryContext } from "../domain/discovery-store.server";
import { persistDiscoveryFunnelEvent } from "../domain/discovery-funnel-store.server";
import {
  createEmailDeliveryDeduplicationClient,
  emailDeliveryDeduplicationKey,
} from "../domain/email-deduplication.server";
import { CURRENCIES } from "../domain/questionnaire";
import {
  ALLERGY_CONSTRAINTS_V3,
  CRYSTAL_CHOICES,
  MOVEMENT_CONSTRUCTIONS,
  MOVEMENT_TYPE_CHOICES,
  normalizeProfileV3,
  profileV3Schema,
  QUESTIONNAIRE_V3_STORAGE_KEY,
  QUESTIONNAIRE_V3_VERSION,
  WATER_RESISTANCE_MINIMUMS,
} from "../domain/questionnaire-v3";
import { CASE_SHAPES } from "../domain/sheet-intake";
import type { CaseShape } from "../domain/sheet-intake";
import type {
  EvaluatedCandidateV3,
  RecommendationResultV3,
} from "../domain/recommendation";
import { recommendWatchesV3 } from "../domain/recommendation";
import {
  parseBeehiivConfiguration,
  subscribeToBeehiiv,
} from "../domain/beehiiv.server";
import { renderDossierEmailV3 } from "../domain/dossier-email";
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

const SCREEN_COUNT = 6;
const SUMMARY_STEP = SCREEN_COUNT;

/**
 * The version-3 flow submits one complete profile, so every submission is a
 * qualified recommendation for the funnel counters.
 */
const SUBMISSION_INTENT = "core" as const;

type ActionResult =
  | {
      ok: true;
      intent: typeof SUBMISSION_INTENT;
      profile: ReturnType<typeof normalizeProfileV3>;
      recommendation: RecommendationResultV3;
      subscription: SubscriptionResult;
      storyContext?: {
        storySlug: string;
        headline: string;
        entityName: string;
        workTitle: string | null;
        explanation: ReturnType<typeof explainStoryConstraint>;
      };
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

type VocabularyOption = { slug: string; labelEn: string };

type QuizLoaderData = {
  scenarios: VocabularyOption[];
  complications: VocabularyOption[];
  positioningGroups: VocabularyOption[];
};

const emailSchema = z.string().trim().email().max(320);

const LABELS: Record<string, string> = {
  automatic: "Automatic",
  manual: "Hand-wound",
  quartz: "Quartz",
  solar: "Solar",
  spring_drive: "Spring drive",
  hybrid: "Hybrid",
  mass_produced: "Widely produced calibre",
  manufacture: "In-house calibre",
  sapphire: "Sapphire",
  mineral: "Mineral",
  acrylic: "Acrylic",
  other: "Other",
  round: "Round",
  tonneau: "Tonneau",
  rectangular: "Rectangular",
  cushion: "Cushion",
  square: "Square",
  oval: "Oval",
  none: "No allergy constraint",
  nickel_contact: "Avoid skin-contact nickel",
  under_300: "Under 300",
  "300_500": "300–500",
  "500_1000": "500–1,000",
  "1000_2000": "1,000–2,000",
  "2000_5000": "2,000–5,000",
  "5000_10000": "5,000–10,000",
  "10000_15000": "10,000–15,000",
  "15000_plus": "15,000+",
};

function labelFor(value: string) {
  return LABELS[value] ?? value.replaceAll("_", " ");
}

function waterResistanceLabel(metres: number) {
  return metres === 0 ? "No requirement" : `${metres} m or deeper`;
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

/**
 * The version-3 questionnaire posts flat form fields rather than a serialised
 * blob, so an unchecked box is simply an absent field and an unset optional
 * preference is an empty string.
 */
function parseProfileForm(formData: FormData) {
  const single = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value.trim() : "";
  };
  const multiple = (name: string) =>
    formData
      .getAll(name)
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  const optionalNumber = (raw: string) =>
    raw === "" ? undefined : Number(raw);
  const optionalBoolean = (raw: string) =>
    raw === "" ? undefined : raw === "yes";
  const optionalText = (raw: string) => (raw === "" ? undefined : raw);

  return {
    version: Number(single("version")),
    budgetCurrency: single("budgetCurrency"),
    budgetMax: Number(single("budgetMax")),
    wearingScenarios: multiple("wearingScenarios"),
    minimumWaterResistanceM: Number(single("minimumWaterResistanceM")),
    caseDiameterMinMm: Number(single("caseDiameterMinMm")),
    caseDiameterMaxMm: Number(single("caseDiameterMaxMm")),
    movementTypes: multiple("movementTypes"),
    requiredComplications: multiple("requiredComplications"),
    allergyConstraint: single("allergyConstraint"),
    maxCaseThicknessMm: optionalNumber(single("maxCaseThicknessMm")),
    caseShape: optionalText(single("caseShape")),
    movementConstruction: optionalText(single("movementConstruction")),
    displayCaseback: optionalBoolean(single("displayCaseback")),
    crystal: optionalText(single("crystal")),
    microAdjustmentRequired: optionalBoolean(single("microAdjustmentRequired")),
  };
}
export async function action({ request }: Route.ActionArgs) {
  if (!(await hasDiagnosticAccess(request))) {
    return data<ActionResult>(
      {
        ok: false,
        errors: ["Subscribe to The Reserve before starting the diagnostic."],
      },
      { status: 403 },
    );
  }

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
  const storySlugResult = parseDiscoveryStorySlug(
    new URL(request.url).searchParams.get("story"),
  );
  if (storySlugResult.status === "invalid") {
    return data<ActionResult>(
      { ok: false, errors: ["The discovery story context is invalid."] },
      { status: 400 },
    );
  }
  const emailOptIn = parseEmailOptIn(formData);
  const intent = SUBMISSION_INTENT;
  const funnelSource = formData.get("funnelSource");

  if (funnelSource !== null && funnelSource !== "archetype") {
    return data<ActionResult>(
      { ok: false, errors: ["The diagnostic source is invalid."] },
      { status: 400 },
    );
  }

  const parsed = profileV3Schema.safeParse(parseProfileForm(formData));
  if (!parsed.success) {
    return data<ActionResult>(
      { ok: false, errors: issueMessages(parsed.error) },
      { status: 400 },
    );
  }

  const profile = normalizeProfileV3(parsed.data);
  const discoveryContext = storySlugResult.slug
    ? await loadPublishedDiscoveryStoryContext(storySlugResult.slug)
    : null;
  if (storySlugResult.slug && !discoveryContext) {
    return data<ActionResult>(
      { ok: false, errors: ["The discovery story context is unavailable."] },
      { status: 400 },
    );
  }
  const evaluatedAt = new Date().toISOString();
  const evaluationStartedAt = performance.now();
  const catalogueLoad = await loadRecommendationCatalogue();
  const recommendation = recommendWatchesV3(
    parsed.data,
    catalogueLoad.catalogue,
    { asOf: evaluatedAt },
  );
  // Version 4 of the hard-filter RPC lands with the parity work; until then the
  // TypeScript predicate is the only evaluator, so a violation can only appear
  // as a reason or missing fact carried on the candidate itself.
  const hardFilterViolationCount = recommendation.recommendations.filter(
    (candidate) =>
      candidate.hardReasons.length > 0 || candidate.missingFacts.length > 0,
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
    const dossier = renderDossierEmailV3({
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
      send: () => Promise<unknown>,
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

  if (funnelSource === "archetype") {
    const discoveryEvents = [
      { name: "qualified_recommendation" as const },
      ...(emailOptIn.email ? [{ name: "opt_in" as const }] : []),
    ];
    for (const event of discoveryEvents) {
      try {
        await persistDiscoveryFunnelEvent(event);
      } catch (error) {
        console.error(
          JSON.stringify({
            event: "discovery_funnel_persistence_error",
            message: error instanceof Error ? error.message : "unknown error",
          }),
        );
      }
    }
  }

  const result: Extract<ActionResult, { ok: true }> = {
    ok: true,
    intent,
    profile,
    recommendation,
    subscription,
    ...(discoveryContext && storySlugResult.slug
      ? {
          storyContext: {
            storySlug: storySlugResult.slug,
            headline: discoveryContext.story.headline,
            entityName: discoveryContext.story.entity.name,
            workTitle: discoveryContext.story.work?.title ?? null,
            explanation: explainStoryConstraint(
              discoveryContext.story,
              recommendation,
            ),
          },
        }
      : {}),
  };
  return data<ActionResult>(
    result,
    "error" in emailOptIn ? { status: 400 } : undefined,
  );
}

export async function loader({ request }: Route.LoaderArgs) {
  if (!(await hasDiagnosticAccess(request))) {
    const storyContext = parseDiscoveryStorySlug(
      new URL(request.url).searchParams.get("story"),
    );
    const storyQuery =
      storyContext.status === "valid"
        ? `&story=${encodeURIComponent(storyContext.slug)}`
        : "";
    return redirect(`/?diagnostic=subscription${storyQuery}#newsletter-signup`);
  }

  const vocabulary = await loadCatalogueVocabulary();
  const options = (kind: VocabularyKind) =>
    vocabulary
      .filter((row) => row.kind === kind && row.active)
      .map((row) => ({ slug: row.slug, labelEn: row.labelEn }));

  return {
    scenarios: options("wearing_scenario"),
    complications: options("complication"),
    positioningGroups: options("positioning_group"),
  } satisfies QuizLoaderData;
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

type QuizDraft = {
  budgetCurrency: (typeof CURRENCIES)[number];
  budgetMax: string;
  wearingScenarios: string[];
  minimumWaterResistanceM: string;
  caseDiameterMinMm: string;
  caseDiameterMaxMm: string;
  movementTypes: string[];
  requiredComplications: string[];
  allergyConstraint: (typeof ALLERGY_CONSTRAINTS_V3)[number];
  maxCaseThicknessMm: string;
  caseShape: CaseShape | "";
  movementConstruction: (typeof MOVEMENT_CONSTRUCTIONS)[number] | "";
  displayCaseback: "" | "yes" | "no";
  crystal: (typeof CRYSTAL_CHOICES)[number] | "";
  microAdjustmentRequired: "" | "yes" | "no";
};

const INITIAL_DRAFT: QuizDraft = {
  budgetCurrency: "USD",
  budgetMax: "",
  wearingScenarios: [],
  minimumWaterResistanceM: "0",
  caseDiameterMinMm: "36",
  caseDiameterMaxMm: "42",
  movementTypes: [],
  requiredComplications: [],
  allergyConstraint: "none",
  maxCaseThicknessMm: "",
  caseShape: "",
  movementConstruction: "",
  displayCaseback: "",
  crystal: "",
  microAdjustmentRequired: "",
};

type SavedDraft = {
  version: typeof QUESTIONNAIRE_V3_VERSION;
  step: number;
  draft: QuizDraft;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function hydrateDraft(value: unknown): QuizDraft {
  if (!isRecord(value)) return INITIAL_DRAFT;
  const text = (key: keyof QuizDraft) => {
    const raw = value[key];
    return typeof raw === "string" ? raw : "";
  };
  return {
    ...INITIAL_DRAFT,
    budgetCurrency:
      (CURRENCIES as readonly string[]).indexOf(text("budgetCurrency")) >= 0
        ? (text("budgetCurrency") as QuizDraft["budgetCurrency"])
        : INITIAL_DRAFT.budgetCurrency,
    budgetMax: text("budgetMax"),
    wearingScenarios: stringArray(value.wearingScenarios),
    minimumWaterResistanceM:
      text("minimumWaterResistanceM") || INITIAL_DRAFT.minimumWaterResistanceM,
    caseDiameterMinMm:
      text("caseDiameterMinMm") || INITIAL_DRAFT.caseDiameterMinMm,
    caseDiameterMaxMm:
      text("caseDiameterMaxMm") || INITIAL_DRAFT.caseDiameterMaxMm,
    movementTypes: stringArray(value.movementTypes),
    requiredComplications: stringArray(value.requiredComplications),
    allergyConstraint:
      text("allergyConstraint") === "nickel_contact"
        ? "nickel_contact"
        : "none",
    maxCaseThicknessMm: text("maxCaseThicknessMm"),
    caseShape: text("caseShape") as QuizDraft["caseShape"],
    movementConstruction: text(
      "movementConstruction",
    ) as QuizDraft["movementConstruction"],
    displayCaseback: text("displayCaseback") as QuizDraft["displayCaseback"],
    crystal: text("crystal") as QuizDraft["crystal"],
    microAdjustmentRequired: text(
      "microAdjustmentRequired",
    ) as QuizDraft["microAdjustmentRequired"],
  };
}

function readSavedDraft(): SavedDraft | null {
  try {
    const raw = window.sessionStorage.getItem(QUESTIONNAIRE_V3_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    if (parsed.version !== QUESTIONNAIRE_V3_VERSION) return null;
    return {
      version: QUESTIONNAIRE_V3_VERSION,
      step: typeof parsed.step === "number" ? parsed.step : 0,
      draft: hydrateDraft(parsed.draft),
    };
  } catch {
    return null;
  }
}

/** The exact field set the action parses, so a draft posts unchanged. */
function profileFormFields(draft: QuizDraft) {
  const fields: { name: string; value: string }[] = [
    { name: "version", value: String(QUESTIONNAIRE_V3_VERSION) },
    { name: "budgetCurrency", value: draft.budgetCurrency },
    { name: "budgetMax", value: draft.budgetMax },
    {
      name: "minimumWaterResistanceM",
      value: draft.minimumWaterResistanceM,
    },
    { name: "caseDiameterMinMm", value: draft.caseDiameterMinMm },
    { name: "caseDiameterMaxMm", value: draft.caseDiameterMaxMm },
    { name: "allergyConstraint", value: draft.allergyConstraint },
    { name: "maxCaseThicknessMm", value: draft.maxCaseThicknessMm },
    { name: "caseShape", value: draft.caseShape },
    { name: "movementConstruction", value: draft.movementConstruction },
    { name: "displayCaseback", value: draft.displayCaseback },
    { name: "crystal", value: draft.crystal },
    {
      name: "microAdjustmentRequired",
      value: draft.microAdjustmentRequired,
    },
  ];
  for (const scenario of draft.wearingScenarios) {
    fields.push({ name: "wearingScenarios", value: scenario });
  }
  for (const movement of draft.movementTypes) {
    fields.push({ name: "movementTypes", value: movement });
  }
  for (const complication of draft.requiredComplications) {
    fields.push({ name: "requiredComplications", value: complication });
  }
  return fields;
}

function ProfileFields({ draft }: { draft: QuizDraft }) {
  return (
    <>
      {profileFormFields(draft).map((field, index) => (
        <input
          key={`${field.name}-${index}`}
          name={field.name}
          type="hidden"
          value={field.value}
        />
      ))}
    </>
  );
}

function draftToProfileInput(draft: QuizDraft) {
  const optionalNumber = (raw: string) =>
    raw.trim() === "" ? undefined : Number(raw);
  const optionalBoolean = (raw: string) =>
    raw === "" ? undefined : raw === "yes";
  const optionalText = (raw: string) => (raw === "" ? undefined : raw);
  return {
    version: QUESTIONNAIRE_V3_VERSION,
    budgetCurrency: draft.budgetCurrency,
    budgetMax: Number(draft.budgetMax),
    wearingScenarios: draft.wearingScenarios,
    minimumWaterResistanceM: Number(draft.minimumWaterResistanceM),
    caseDiameterMinMm: Number(draft.caseDiameterMinMm),
    caseDiameterMaxMm: Number(draft.caseDiameterMaxMm),
    movementTypes: draft.movementTypes,
    requiredComplications: draft.requiredComplications,
    allergyConstraint: draft.allergyConstraint,
    maxCaseThicknessMm: optionalNumber(draft.maxCaseThicknessMm),
    caseShape: optionalText(draft.caseShape),
    movementConstruction: optionalText(draft.movementConstruction),
    displayCaseback: optionalBoolean(draft.displayCaseback),
    crystal: optionalText(draft.crystal),
    microAdjustmentRequired: optionalBoolean(draft.microAdjustmentRequired),
  };
}

function ChoiceGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  renderLabel = labelFor,
}: {
  legend: string;
  name: string;
  options: readonly T[];
  value: T | "";
  onChange: (value: T) => void;
  renderLabel?: (value: T) => string;
}) {
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
            <span>{renderLabel(option)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function OptionCheckboxGroup({
  legend,
  options,
  values,
  onChange,
}: {
  legend: string;
  options: readonly VocabularyOption[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const toggle = (slug: string) => {
    onChange(
      values.includes(slug)
        ? values.filter((value) => value !== slug)
        : [...values, slug],
    );
  };

  return (
    <fieldset className="quiz-fieldset">
      <legend>{legend}</legend>
      <div className="choice-list choice-list--compact">
        {options.map((option) => (
          <label
            className={`choice-card ${values.includes(option.slug) ? "is-selected" : ""}`}
            key={option.slug}
          >
            <input
              checked={values.includes(option.slug)}
              onChange={() => toggle(option.slug)}
              type="checkbox"
              value={option.slug}
            />
            <span>{option.labelEn}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function OptionalSelect<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T | "";
  onChange: (value: T | "") => void;
}) {
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

function OptionalYesNo({
  label,
  yesLabel,
  noLabel,
  value,
  onChange,
}: {
  label: string;
  yesLabel: string;
  noLabel: string;
  value: "" | "yes" | "no";
  onChange: (value: "" | "yes" | "no") => void;
}) {
  return (
    <label className="input-stack">
      <span>{label}</span>
      <select
        onChange={(event) => onChange(event.target.value as "" | "yes" | "no")}
        value={value}
      >
        <option value="">No preference</option>
        <option value="yes">{yesLabel}</option>
        <option value="no">{noLabel}</option>
      </select>
    </label>
  );
}

function formatCandidatePrice(price: EvaluatedCandidateV3["price"]) {
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
  candidate: EvaluatedCandidateV3;
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
            {candidate.geometry.caseThicknessMm !== null
              ? ` · ${candidate.geometry.caseThicknessMm} mm thick`
              : ""}
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
          <dt>Water resistance</dt>
          <dd>
            {candidate.operation.waterResistanceM === null
              ? "Not published"
              : `${candidate.operation.waterResistanceM} m`}
          </dd>
        </div>
        <div>
          <dt>Score</dt>
          <dd>{candidate.score.toFixed(1)}</dd>
        </div>
      </dl>

      {candidate.positioningLine ? (
        <p className="candidate-positioning">{candidate.positioningLine}</p>
      ) : null}

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
  positioningGroups,
}: {
  recommendation: RecommendationResultV3;
  positioningGroups: readonly VocabularyOption[];
}) {
  const [positioning, setPositioning] = useState<string | null>(null);
  // Only groups a returned candidate actually carries are offered, so the
  // facet can never empty the list it sits above.
  const availableGroups = useMemo(() => {
    const present = new Set(
      recommendation.recommendations
        .map((candidate) => candidate.positioningGroup)
        .filter((group): group is string => group !== null),
    );
    return positioningGroups.filter((group) => present.has(group.slug));
  }, [positioningGroups, recommendation.recommendations]);
  const visible = recommendation.recommendations.filter(
    (candidate) =>
      positioning === null || candidate.positioningGroup === positioning,
  );

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
        <PositioningFacet
          groups={availableGroups}
          onSelect={setPositioning}
          selected={positioning}
        />
        {visible.length > 0 ? (
          <div className="candidate-list">
            {visible.map((candidate) => (
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

function DossierDelivery({
  draft,
  funnelSource,
  subscription,
}: {
  draft: QuizDraft;
  funnelSource: "archetype" | null;
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
          {funnelSource ? (
            <input name="funnelSource" type="hidden" value={funnelSource} />
          ) : null}
          <ProfileFields draft={draft} />
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

function ProfileSummary({
  draft,
  profile,
  recommendation,
  subscription,
  funnelSource,
  storyContext,
  scenarioLabels,
  complicationLabels,
  positioningGroups,
  onEdit,
  onRestart,
}: {
  draft: QuizDraft;
  profile: ReturnType<typeof normalizeProfileV3>;
  recommendation: RecommendationResultV3;
  subscription: SubscriptionResult;
  funnelSource: "archetype" | null;
  storyContext?: {
    storySlug: string;
    headline: string;
    entityName: string;
    workTitle: string | null;
    explanation: ReturnType<typeof explainStoryConstraint>;
  };
  scenarioLabels: Map<string, string>;
  complicationLabels: Map<string, string>;
  positioningGroups: readonly VocabularyOption[];
  onEdit: () => void;
  onRestart: () => void;
}) {
  const named = (slugs: readonly string[], labels: Map<string, string>) =>
    slugs.map((slug) => labels.get(slug) ?? labelFor(slug)).join(", ");

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
            {profile.budgetCurrency} {profile.budgetMax.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt>Derived price band</dt>
          <dd>{labelFor(profile.derived.priceBand)}</dd>
        </div>
        <div>
          <dt>Wearing scenarios</dt>
          <dd>{named(profile.wearingScenarios, scenarioLabels)}</dd>
        </div>
        <div>
          <dt>Water resistance</dt>
          <dd>{waterResistanceLabel(profile.minimumWaterResistanceM)}</dd>
        </div>
        <div>
          <dt>Case diameter</dt>
          <dd>
            {profile.caseDiameterMinMm}–{profile.caseDiameterMaxMm} mm
          </dd>
        </div>
        <div>
          <dt>Movement</dt>
          <dd>{profile.movementTypes.map(labelFor).join(", ")}</dd>
        </div>
        <div>
          <dt>Required functions</dt>
          <dd>
            {profile.requiredComplications.length === 0
              ? "No required function"
              : named(profile.requiredComplications, complicationLabels)}
          </dd>
        </div>
        <div>
          <dt>Allergy constraint</dt>
          <dd>{labelFor(profile.allergyConstraint)}</dd>
        </div>
        {profile.maxCaseThicknessMm !== undefined ? (
          <div>
            <dt>Thickness limit</dt>
            <dd>{profile.maxCaseThicknessMm} mm</dd>
          </div>
        ) : null}
        {profile.caseShape !== undefined ? (
          <div>
            <dt>Case shape</dt>
            <dd>{labelFor(profile.caseShape)}</dd>
          </div>
        ) : null}
        {profile.movementConstruction !== undefined ? (
          <div>
            <dt>Calibre</dt>
            <dd>{labelFor(profile.movementConstruction)}</dd>
          </div>
        ) : null}
        {profile.displayCaseback !== undefined ? (
          <div>
            <dt>Caseback</dt>
            <dd>{profile.displayCaseback ? "Display" : "Solid"}</dd>
          </div>
        ) : null}
        {profile.crystal !== undefined ? (
          <div>
            <dt>Crystal</dt>
            <dd>{labelFor(profile.crystal)}</dd>
          </div>
        ) : null}
        {profile.microAdjustmentRequired !== undefined ? (
          <div>
            <dt>Clasp micro-adjustment</dt>
            <dd>
              {profile.microAdjustmentRequired ? "Required" : "Not wanted"}
            </dd>
          </div>
        ) : null}
      </dl>
      <RecommendationSummary
        positioningGroups={positioningGroups}
        recommendation={recommendation}
      />
      {storyContext ? (
        <section
          className="delivery-panel"
          aria-labelledby="story-context-heading"
        >
          <span className="eyebrow">Reviewed story context</span>
          <h2 id="story-context-heading">
            {storyContext.entityName}
            {storyContext.workTitle ? ` · ${storyContext.workTitle}` : ""}
          </h2>
          <p>{storyContext.explanation.message}</p>
        </section>
      ) : null}
      <DossierDelivery
        draft={draft}
        funnelSource={funnelSource}
        subscription={subscription}
      />
      <div className="summary-actions">
        <button
          className="button button--primary"
          onClick={onEdit}
          type="button"
        >
          Edit answers
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

const SCREEN_TITLES = [
  "What is the actual purchase ceiling?",
  "Where will this watch actually be worn?",
  "What case size works on your wrist?",
  "Which movements are acceptable?",
  "Any preferences on the details?",
  "What must this watch do?",
] as const;

export default function Quiz() {
  const actionData = useActionData<typeof action>();
  const loaderData = useLoaderData<typeof loader>();
  const location = useLocation();
  const navigation = useNavigation();
  const [draft, setDraft] = useState<QuizDraft>(INITIAL_DRAFT);
  const [step, setStep] = useState(0);
  const [storageReady, setStorageReady] = useState(false);
  const startTracked = useRef(false);
  const archetypeHandoff = useMemo(
    () => parseCoreQuizHandoff(new URLSearchParams(location.search)),
    [location.search],
  );
  const funnelSource = archetypeHandoff ? "archetype" : null;

  const scenarios = loaderData.scenarios;
  const complications = loaderData.complications;
  const scenarioLabels = useMemo(
    () => new Map(scenarios.map((option) => [option.slug, option.labelEn])),
    [scenarios],
  );
  const complicationLabels = useMemo(
    () => new Map(complications.map((option) => [option.slug, option.labelEn])),
    [complications],
  );

  const update = (patch: Partial<QuizDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));

  useEffect(() => {
    const saved = readSavedDraft();
    const timer = window.setTimeout(() => {
      if (saved) {
        setDraft(saved.draft);
        if (saved.step >= 0 && saved.step < SUMMARY_STEP) setStep(saved.step);
      }
      setStorageReady(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    const saved: SavedDraft = {
      version: QUESTIONNAIRE_V3_VERSION,
      step: step === SUMMARY_STEP ? SCREEN_COUNT - 1 : step,
      draft,
    };
    window.sessionStorage.setItem(
      QUESTIONNAIRE_V3_STORAGE_KEY,
      JSON.stringify(saved),
    );
  }, [draft, step, storageReady]);

  useEffect(() => {
    if (!actionData?.ok) return;
    const timer = window.setTimeout(() => setStep(SUMMARY_STEP), 0);
    return () => window.clearTimeout(timer);
  }, [actionData]);

  const resultData = actionData?.ok ? actionData : null;

  const profileParse = useMemo(
    () => profileV3Schema.safeParse(draftToProfileInput(draft)),
    [draft],
  );

  const diameterMin = Number(draft.caseDiameterMinMm);
  const diameterMax = Number(draft.caseDiameterMaxMm);
  const stepIsComplete =
    step === 0
      ? Number(draft.budgetMax) > 0
      : step === 1
        ? draft.wearingScenarios.length > 0
        : step === 2
          ? Number.isFinite(diameterMin) &&
            Number.isFinite(diameterMax) &&
            diameterMin > 0 &&
            diameterMax >= diameterMin
          : step === 3
            ? draft.movementTypes.length > 0
            : step === 4
              ? true
              : profileParse.success;

  const isSubmitting = navigation.state === "submitting";
  const visibleStep = Math.min(step, SCREEN_COUNT - 1) + 1;

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
    window.sessionStorage.removeItem(QUESTIONNAIRE_V3_STORAGE_KEY);
    setDraft(INITIAL_DRAFT);
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
          complicationLabels={complicationLabels}
          draft={draft}
          funnelSource={funnelSource}
          onEdit={() => setStep(0)}
          onRestart={restartQuiz}
          positioningGroups={loaderData.positioningGroups}
          profile={resultData.profile}
          recommendation={resultData.recommendation}
          scenarioLabels={scenarioLabels}
          storyContext={resultData.storyContext}
          subscription={resultData.subscription}
        />
      </main>
    );
  }

  return (
    <main className="quiz-shell">
      <nav className="quiz-nav" aria-label="Diagnostic navigation">
        <Link to="/">The Reserve</Link>
        <span>Reference diagnostic</span>
      </nav>

      <section className="quiz-panel" aria-labelledby="question-heading">
        <div className="progress-copy">
          <span className="eyebrow">
            Step {visibleStep} of {SCREEN_COUNT}
          </span>
          <span>{Math.round((visibleStep / SCREEN_COUNT) * 100)}%</span>
        </div>
        <div className="progress-track" aria-hidden="true">
          <span style={{ width: `${(visibleStep / SCREEN_COUNT) * 100}%` }} />
        </div>

        {step === 0 ? (
          <div className="question-block">
            <h1 id="question-heading">{SCREEN_TITLES[0]}</h1>
            <p>
              Enter the maximum outlay. The exact number sets your purchase
              boundary; nothing above it is offered.
            </p>
            <div className="split-inputs">
              <label className="input-stack input-stack--currency">
                <span>Currency</span>
                <select
                  onChange={(event) =>
                    update({
                      budgetCurrency: event.target
                        .value as QuizDraft["budgetCurrency"],
                    })
                  }
                  value={draft.budgetCurrency}
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
                  onChange={(event) => {
                    recordStart();
                    update({ budgetMax: event.target.value });
                  }}
                  type="number"
                  value={draft.budgetMax}
                />
              </label>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="question-block">
            <h1 id="question-heading">{SCREEN_TITLES[1]}</h1>
            <p>
              Pick every situation this watch has to cover. A watch qualifies
              when it is reviewed for at least one of them.
            </p>
            <OptionCheckboxGroup
              legend="Wearing scenarios"
              onChange={(values) => update({ wearingScenarios: values })}
              options={scenarios}
              values={draft.wearingScenarios}
            />
            <ChoiceGroup
              legend="Minimum water resistance"
              name="minimumWaterResistanceM"
              onChange={(value) => update({ minimumWaterResistanceM: value })}
              options={WATER_RESISTANCE_MINIMUMS.map(String)}
              renderLabel={(value) => waterResistanceLabel(Number(value))}
              value={draft.minimumWaterResistanceM}
            />
          </div>
        ) : null}

        {step === 2 ? (
          <div className="question-block">
            <h1 id="question-heading">{SCREEN_TITLES[2]}</h1>
            <p>
              Set the diameter range you will actually wear. Thickness and shape
              stay open unless you constrain them.
            </p>
            <div className="split-inputs">
              <label className="input-stack">
                <span>Smallest diameter (mm)</span>
                <input
                  inputMode="decimal"
                  max="60"
                  min="20"
                  onChange={(event) =>
                    update({ caseDiameterMinMm: event.target.value })
                  }
                  type="number"
                  value={draft.caseDiameterMinMm}
                />
              </label>
              <label className="input-stack">
                <span>Largest diameter (mm)</span>
                <input
                  inputMode="decimal"
                  max="60"
                  min="20"
                  onChange={(event) =>
                    update({ caseDiameterMaxMm: event.target.value })
                  }
                  type="number"
                  value={draft.caseDiameterMaxMm}
                />
              </label>
            </div>
            <div className="split-inputs">
              <label className="input-stack">
                <span>Thickness limit (mm, optional)</span>
                <input
                  inputMode="decimal"
                  max="30"
                  min="3"
                  onChange={(event) =>
                    update({ maxCaseThicknessMm: event.target.value })
                  }
                  placeholder="No preference"
                  type="number"
                  value={draft.maxCaseThicknessMm}
                />
              </label>
              <OptionalSelect
                label="Case shape"
                onChange={(value) => update({ caseShape: value })}
                options={CASE_SHAPES}
                value={draft.caseShape}
              />
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="question-block">
            <h1 id="question-heading">{SCREEN_TITLES[3]}</h1>
            <p>
              Select every movement type you would own. Anything unselected is
              excluded outright.
            </p>
            <fieldset className="quiz-fieldset">
              <legend>Movement types</legend>
              <div className="choice-list choice-list--compact">
                {MOVEMENT_TYPE_CHOICES.map((option) => (
                  <label
                    className={`choice-card ${draft.movementTypes.includes(option) ? "is-selected" : ""}`}
                    key={option}
                  >
                    <input
                      checked={draft.movementTypes.includes(option)}
                      onChange={() =>
                        update({
                          movementTypes: draft.movementTypes.includes(option)
                            ? draft.movementTypes.filter(
                                (value) => value !== option,
                              )
                            : [...draft.movementTypes, option],
                        })
                      }
                      type="checkbox"
                      value={option}
                    />
                    <span>{labelFor(option)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <OptionalSelect
              label="Calibre construction"
              onChange={(value) => update({ movementConstruction: value })}
              options={MOVEMENT_CONSTRUCTIONS}
              value={draft.movementConstruction}
            />
          </div>
        ) : null}

        {step === 4 ? (
          <div className="question-block">
            <h1 id="question-heading">{SCREEN_TITLES[4]}</h1>
            <p>
              Every answer here is optional. A preference with no reviewed data
              behind it is reported as unscored rather than applied silently.
            </p>
            <OptionalYesNo
              label="Caseback"
              noLabel="Solid"
              onChange={(value) => update({ displayCaseback: value })}
              value={draft.displayCaseback}
              yesLabel="Display"
            />
            <OptionalSelect
              label="Crystal"
              onChange={(value) => update({ crystal: value })}
              options={CRYSTAL_CHOICES}
              value={draft.crystal}
            />
            <OptionalYesNo
              label="Clasp micro-adjustment"
              noLabel="Not wanted"
              onChange={(value) => update({ microAdjustmentRequired: value })}
              value={draft.microAdjustmentRequired}
              yesLabel="Required"
            />
          </div>
        ) : null}

        {step === 5 ? (
          <div className="question-block">
            <h1 id="question-heading">{SCREEN_TITLES[5]}</h1>
            <p>
              A required function excludes every watch without it. Leave the
              list empty if nothing is mandatory.
            </p>
            <OptionCheckboxGroup
              legend="Required functions"
              onChange={(values) => update({ requiredComplications: values })}
              options={complications}
              values={draft.requiredComplications}
            />
            <ChoiceGroup
              legend="Skin contact"
              name="allergyConstraint"
              onChange={(value) => update({ allergyConstraint: value })}
              options={ALLERGY_CONSTRAINTS_V3}
              value={draft.allergyConstraint}
            />
          </div>
        ) : null}

        {actionData && !actionData.ok ? (
          <ul className="error-list" role="alert">
            {actionData.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ) : null}

        <div className="quiz-actions">
          {step > 0 ? (
            <button
              className="button button--quiet"
              onClick={goBack}
              type="button"
            >
              Back
            </button>
          ) : null}
          {step < SCREEN_COUNT - 1 ? (
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
              {funnelSource ? (
                <input name="funnelSource" type="hidden" value={funnelSource} />
              ) : null}
              <ProfileFields draft={draft} />
              <button
                className="button button--primary"
                disabled={!stepIsComplete || isSubmitting}
                type="submit"
              >
                {isSubmitting ? "Evaluating…" : "See the shortlist"}
              </button>
            </Form>
          )}
        </div>
      </section>
    </main>
  );
}
