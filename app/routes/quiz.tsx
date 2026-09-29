import { useEffect, useId, useMemo, useRef, useState } from "react";
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
import {
  quizBrief,
  quizCacheInput,
  type AiSearchView,
  type FoundWatch,
} from "../domain/ai-watch-finder.server";
import { searchWithStore } from "../domain/ai-watch-store.server";
import { recordQuizAnalyticsEvent } from "../domain/analytics.server";
import { hasDiagnosticAccess } from "../domain/diagnostic-access.server";
import type { VocabularyKind } from "../domain/catalogue-vocabulary";
import { loadCatalogueVocabulary } from "../domain/catalogue-vocabulary.server";
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
      aiSearch: AiSearchView;
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

type VocabularyOption = { slug: string; labelEn: string };

type QuizLoaderData = {
  scenarios: VocabularyOption[];
  complications: VocabularyOption[];
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
  const evaluationStartedAt = performance.now();
  // Only the validated constraint profile goes to the AI search; the email
  // field and every request header stay on this server.
  const aiSearch = await searchWithStore({
    kind: "quiz",
    cacheInput: quizCacheInput(parsed.data),
    brief: quizBrief(parsed.data),
  });
  const evaluationDurationMs = Number(
    (performance.now() - evaluationStartedAt).toFixed(2),
  );
  const foundWatches = aiSearch.status === "found" ? aiSearch.watches : [];
  const resultOrigin =
    aiSearch.status === "found" && aiSearch.fromCache ? "supabase" : "ai_search";
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
    const dossier = renderDossierEmail({ profile, aiSearch });
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

  if (subscription.status === "not_requested") {
    await recordQuizAnalyticsEvent({
      name: "evaluation",
      intent,
      catalogueOrigin: resultOrigin,
      recommendationCount: foundWatches.length,
      verificationCount: 0,
      whyNotCount: 0,
      hardFilterViolationCount: 0,
      evaluationDurationMs,
      providerCostUsd: 0,
      topRecommendationScore: null,
      meanRecommendationScore: null,
    });
  } else {
    await recordQuizAnalyticsEvent({
      name: "subscription",
      intent,
      catalogueOrigin: resultOrigin,
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
    aiSearch,
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
              foundWatches,
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

/**
 * The form state lives in React and is submitted through ProfileFields, so
 * these radio names only group the pills; they are never posted.
 */
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
      <div className="chip-list">
        {options.map((option) => (
          <label
            className={`chip chip--radio ${value === option ? "is-selected" : ""}`}
            key={option}
          >
            <input
              checked={value === option}
              className="chip__input"
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
  hint,
  options,
  values,
  onChange,
}: {
  legend: string;
  hint?: string;
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
      <legend>
        {legend}
        {values.length > 0 ? (
          <span className="legend-count"> · {values.length} selected</span>
        ) : null}
      </legend>
      {hint ? <p className="field-hint">{hint}</p> : null}
      <div className="chip-list">
        {options.map((option) => (
          <label
            className={`chip ${values.includes(option.slug) ? "is-selected" : ""}`}
            key={option.slug}
          >
            <input
              checked={values.includes(option.slug)}
              className="chip__input"
              onChange={() => toggle(option.slug)}
              type="checkbox"
              value={option.slug}
            />
            <span aria-hidden="true" className="chip__mark" />
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
  const name = useId();
  return (
    <ChoiceGroup<T | "none-selected">
      legend={label}
      name={name}
      onChange={(next) => onChange(next === "none-selected" ? "" : next)}
      options={["none-selected", ...options]}
      renderLabel={(option) =>
        option === "none-selected" ? "No preference" : labelFor(option)
      }
      value={value === "" ? "none-selected" : value}
    />
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
  const name = useId();
  return (
    <ChoiceGroup<"" | "yes" | "no">
      legend={label}
      name={name}
      onChange={onChange}
      options={["", "yes", "no"]}
      renderLabel={(option) =>
        option === "yes" ? yesLabel : option === "no" ? noLabel : "No preference"
      }
      value={value}
    />
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  prefix,
  unit,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  prefix?: string;
  unit?: string;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className="field__control">
        {prefix ? <span className="field__affix">{prefix}</span> : null}
        <input
          id={id}
          inputMode="decimal"
          max={max}
          min={min}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type="number"
          value={value}
        />
        {unit ? <span className="field__affix">{unit}</span> : null}
      </div>
    </div>
  );
}

function WatchImage({ watch }: { watch: FoundWatch }) {
  const [failed, setFailed] = useState(false);
  const title = `${watch.brand} ${watch.model}`;
  if (!watch.imageUrl || failed) {
    return (
      <div aria-hidden="true" className="watch-card__image watch-card__image--empty">
        <span>{watch.brand}</span>
      </div>
    );
  }
  return (
    <img
      alt={title}
      className="watch-card__image"
      decoding="async"
      loading="lazy"
      onError={() => setFailed(true)}
      referrerPolicy="no-referrer"
      src={watch.imageUrl}
    />
  );
}

function WatchCard({ watch, rank }: { watch: FoundWatch; rank: number }) {
  return (
    <article className="watch-card">
      <WatchImage watch={watch} />
      <div className="watch-card__body">
        <span className="eyebrow">
          {rank === 1 ? "Best fit" : `Option ${rank}`}
        </span>
        <h3>
          {watch.brand} {watch.model}
        </h3>
        {watch.referenceCode || watch.priceNote ? (
          <p className="watch-card__meta">
            {[
              watch.referenceCode ? `Ref. ${watch.referenceCode}` : null,
              watch.priceNote,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
        <p className="watch-card__rationale">{watch.rationale}</p>
        <a
          className="candidate-link"
          href={watch.sourceUrl}
          rel="noreferrer nofollow"
          target="_blank"
        >
          Open the source
        </a>
      </div>
    </article>
  );
}

function AiRecommendation({ aiSearch }: { aiSearch: AiSearchView }) {
  return (
    <section className="ai-results" aria-labelledby="ai-pick-heading">
      <div className="result-section-heading">
        <div>
          <span className="eyebrow">AI search · live web</span>
          <h2 id="ai-pick-heading">The watches we found for you</h2>
        </div>
        {aiSearch.status === "found" ? (
          <span>
            {aiSearch.watches.length}{" "}
            {aiSearch.watches.length === 1 ? "watch" : "watches"}
          </span>
        ) : null}
      </div>
      {aiSearch.status === "found" ? (
        <>
          <p className="result-summary">{aiSearch.summary}</p>
          <div className="watch-list">
            {aiSearch.watches.map((watch, index) => (
              <WatchCard
                key={`${watch.brand}-${watch.model}-${watch.referenceCode ?? index}`}
                rank={index + 1}
                watch={watch}
              />
            ))}
          </div>
        </>
      ) : aiSearch.status === "no_match" ? (
        <p className="empty-result">
          The live search found no watch that meets every requirement.{" "}
          {aiSearch.summary}
        </p>
      ) : (
        <p className="empty-result">
          The AI search is unavailable right now. Please try again in a few
          minutes.
        </p>
      )}
      <p className="result-footnote">
        Found by an AI search of the live web using only your constraints
        above; no email or personal data is sent. Images and prices come from
        the linked sources, so check them with the seller before buying.
      </p>
    </section>
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
  aiSearch,
  subscription,
  funnelSource,
  storyContext,
  scenarioLabels,
  complicationLabels,
  onEdit,
  onRestart,
}: {
  draft: QuizDraft;
  profile: ReturnType<typeof normalizeProfileV3>;
  aiSearch: AiSearchView;
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
        An AI search of the live web looked for watches that meet every
        requirement below. Each one links to the source it came from.
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
      <AiRecommendation aiSearch={aiSearch} />
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
          profile={resultData.profile}
          aiSearch={resultData.aiSearch}
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
            <ChoiceGroup
              legend="Currency"
              name="budgetCurrencyChoice"
              onChange={(value) => update({ budgetCurrency: value })}
              options={CURRENCIES}
              renderLabel={(value) => value}
              value={draft.budgetCurrency}
            />
            <div className="field-row field-row--single">
              <NumberField
                label="Maximum amount"
                min={1}
                onChange={(value) => {
                  recordStart();
                  update({ budgetMax: value });
                }}
                placeholder="e.g. 5000"
                prefix={draft.budgetCurrency}
                value={draft.budgetMax}
              />
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
              hint="Tap every one that applies."
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
              renderLabel={(value) =>
                value === "0" ? "No requirement" : `${value} m+`
              }
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
            <div className="field-row">
              <NumberField
                label="Smallest diameter"
                max={60}
                min={20}
                onChange={(value) => update({ caseDiameterMinMm: value })}
                unit="mm"
                value={draft.caseDiameterMinMm}
              />
              <NumberField
                label="Largest diameter"
                max={60}
                min={20}
                onChange={(value) => update({ caseDiameterMaxMm: value })}
                unit="mm"
                value={draft.caseDiameterMaxMm}
              />
              <NumberField
                label="Max thickness"
                max={30}
                min={3}
                onChange={(value) => update({ maxCaseThicknessMm: value })}
                placeholder="Any"
                unit="mm"
                value={draft.maxCaseThicknessMm}
              />
            </div>
            <OptionalSelect
              label="Case shape"
              onChange={(value) => update({ caseShape: value })}
              options={CASE_SHAPES}
              value={draft.caseShape}
            />
          </div>
        ) : null}

        {step === 3 ? (
          <div className="question-block">
            <h1 id="question-heading">{SCREEN_TITLES[3]}</h1>
            <p>
              Select every movement type you would own. Anything unselected is
              excluded outright.
            </p>
            <OptionCheckboxGroup
              legend="Movement types"
              onChange={(values) =>
                update({
                  movementTypes: MOVEMENT_TYPE_CHOICES.filter((option) =>
                    values.includes(option),
                  ),
                })
              }
              options={MOVEMENT_TYPE_CHOICES.map((option) => ({
                slug: option,
                labelEn: labelFor(option),
              }))}
              values={draft.movementTypes}
            />
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
                {isSubmitting ? "Searching…" : "See the shortlist"}
              </button>
              {isSubmitting ? (
                <p aria-live="polite">
                  The AI is searching the live web for your watches. A new
                  combination of answers can take up to two minutes; answers
                  searched before load straight away.
                </p>
              ) : null}
            </Form>
          )}
        </div>
      </section>
    </main>
  );
}
