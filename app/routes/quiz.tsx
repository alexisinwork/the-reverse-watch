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
import {
  ChoiceGroup,
  NumberField,
  OptionalChoice,
  OptionCheckboxGroup,
} from "../components/quiz-fields";
import { WatchResults } from "../components/watch-results";
import type { AiSearchView } from "../domain/ai-watch-types";
import { recordQuizAnalyticsEvent } from "../domain/analytics.server";
import type { VocabularyKind } from "../domain/catalogue-vocabulary";
import { loadCatalogueVocabulary } from "../domain/catalogue-vocabulary.server";
import { hasDiagnosticAccess } from "../domain/diagnostic-access.server";
import { parseCoreQuizHandoff } from "../domain/discovery-archetype";
import {
  explainStoryConstraint,
  parseDiscoveryStorySlug,
} from "../domain/discovery-context.server";
import { persistDiscoveryFunnelEvent } from "../domain/discovery-funnel-store.server";
import { searchQuiz } from "../domain/quiz-search.server";
import { loadPublishedDiscoveryStoryContext } from "../domain/discovery-store.server";
import { renderDossierEmail } from "../domain/dossier-email";
import {
  createEmailDeliveryDeduplicationClient,
  emailDeliveryDeduplicationKey,
} from "../domain/email-deduplication.server";
import { summarizeEmailDelivery, type DeliveryChannelStatus } from "../domain/email-delivery";
import { loadFxTable } from "../domain/fx.server";
import { parseBeehiivConfiguration, subscribeToBeehiiv } from "../domain/beehiiv.server";
import {
  ALLERGY_CONSTRAINTS_V3,
  CRYSTAL_CHOICES,
  MOVEMENT_CONSTRUCTIONS,
  MOVEMENT_TYPE_CHOICES,
  WATER_RESISTANCE_MINIMUMS,
} from "../domain/questionnaire-v3";
import {
  BUDGET_CURRENCIES,
  CASE_DIAMETER_MM_MAX,
  CASE_DIAMETER_MM_MIN,
  caseDiameterForWrist,
  diameterRangeFor,
  findPriceRange,
  PRICE_RANGES,
  priceRangeLabel,
  profileV4Schema,
  QUESTIONNAIRE_V4_STORAGE_KEY,
  QUESTIONNAIRE_V4_VERSION,
  WRIST_CM_MAX,
  WRIST_CM_MIN,
  type BudgetCurrency,
  type ProfileV4,
} from "../domain/questionnaire-v4";
import { parseResendConfiguration, sendDossierWithResend } from "../domain/resend.server";
import {
  consumeRateLimit,
  parseRateLimitPolicy,
  type RateLimitDecision,
} from "../domain/rate-limit.server";
import {
  consumeUpstashRateLimit,
  createUpstashRateLimitClient,
  parseUpstashRateLimitConfiguration,
} from "../domain/rate-limit-upstash.server";
import { CASE_SHAPES, type CaseShape } from "../domain/sheet-intake";
import "../styles/quiz.css";

const SCREEN_COUNT = 6;
const SUMMARY_STEP = SCREEN_COUNT;

/** Every submission is one complete profile: a qualified evaluation. */
const SUBMISSION_INTENT = "core" as const;

type StoryExplanation = ReturnType<typeof explainStoryConstraint>;

type ActionResult =
  | {
      ok: true;
      profile: ProfileV4;
      /** Streamed: the page renders before the search has finished. */
      aiSearch: Promise<AiSearchView> | AiSearchView;
      subscription: SubscriptionResult;
      storyContext?: {
        storySlug: string;
        headline: string;
        entityName: string;
        workTitle: string | null;
        explanation: Promise<StoryExplanation> | StoryExplanation;
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
      status: "sent" | "partial" | "unavailable" | "failed" | "already_requested";
      message: string;
      newsletterStatus: DeliveryChannelStatus;
      dossierStatus: DeliveryChannelStatus;
    };

type VocabularyOption = { slug: string; labelEn: string };

const emailSchema = z.string().trim().email().max(320);

const LABELS: Record<string, string> = {
  automatic: "Automatic",
  manual: "Hand-wound",
  quartz: "Quartz",
  solar: "Solar",
  spring_drive: "Spring Drive",
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
  none: "No allergy",
  nickel_contact: "Nickel allergy: no steel on skin",
};

function labelFor(value: string) {
  return LABELS[value] ?? value.replaceAll("_", " ");
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
    forwarded?.split(",", 1)[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "unknown";
  return `quiz:${address}`;
}

function rateLimitHeaders(decision: RateLimitDecision) {
  const headers = new Headers();
  if (decision.limit !== null) {
    headers.set("X-RateLimit-Limit", String(decision.limit));
    headers.set("X-RateLimit-Remaining", String(decision.remaining));
    headers.set("X-RateLimit-Reset", String(Math.ceil((decision.resetAt ?? Date.now()) / 1_000)));
  }
  if (decision.retryAfterSeconds !== null) {
    headers.set("Retry-After", String(decision.retryAfterSeconds));
  }
  return headers;
}

/** Flat form fields: an unchecked box is an absent field, an unset preference "". */
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
  const optionalNumber = (raw: string) => (raw === "" ? undefined : Number(raw));
  const optionalBoolean = (raw: string) => (raw === "" ? undefined : raw === "yes");
  const optionalText = (raw: string) => (raw === "" ? undefined : raw);

  return {
    version: Number(single("version")),
    budgetCurrency: single("budgetCurrency"),
    priceRange: single("priceRange"),
    wristCm: Number(single("wristCm")),
    caseDiameterMinMm: optionalNumber(single("caseDiameterMinMm")),
    caseDiameterMaxMm: optionalNumber(single("caseDiameterMaxMm")),
    wearingScenarios: multiple("wearingScenarios"),
    minimumWaterResistanceM: Number(single("minimumWaterResistanceM")),
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

function logError(event: string, error: unknown) {
  console.error(
    JSON.stringify({ event, message: error instanceof Error ? error.message : "unknown error" }),
  );
}

async function deliverEmail(
  email: string,
  profile: ProfileV4,
  aiSearch: AiSearchView,
): Promise<SubscriptionResult> {
  const beehiivConfiguration = parseBeehiivConfiguration();
  const resendConfiguration = parseResendConfiguration();
  const upstashConfiguration = parseUpstashRateLimitConfiguration();
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
      ? emailDeliveryDeduplicationKey({ channel, email, intent: SUBMISSION_INTENT, profile })
      : null;
    if (!deduplicationClient || !key) {
      await send();
      return "sent";
    }
    let claimed: boolean;
    try {
      claimed = await deduplicationClient.claim(key);
    } catch (error) {
      logError("email_deduplication_error", error);
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
        logError("email_deduplication_error", releaseError);
      }
      throw error;
    }
  };

  let newsletterStatus: DeliveryChannelStatus = beehiivConfiguration.configured
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
        subscribeToBeehiiv(email, beehiivConfiguration),
      );
    } catch (error) {
      logError("beehiiv_subscription_error", error);
    }
  }
  if (resendConfiguration.configured) {
    try {
      dossierStatus = await deliver("dossier", () =>
        sendDossierWithResend(email, dossier, resendConfiguration),
      );
    } catch (error) {
      logError("resend_dossier_error", error);
    }
  }
  return summarizeEmailDelivery(newsletterStatus, dossierStatus);
}

export async function action({ request }: Route.ActionArgs) {
  if (!(await hasDiagnosticAccess(request))) {
    return data<ActionResult>(
      { ok: false, errors: ["Subscribe to The Reserve before starting the diagnostic."] },
      { status: 403 },
    );
  }

  const rateLimitPolicy = parseRateLimitPolicy();
  const upstashConfiguration = parseUpstashRateLimitConfiguration();
  const unavailable = () =>
    data<ActionResult>(
      { ok: false, errors: ["The diagnostic is temporarily unavailable. Try again later."] },
      { status: 503 },
    );
  if (!rateLimitPolicy.configured && rateLimitPolicy.reason === "invalid") return unavailable();
  if (!upstashConfiguration.configured && upstashConfiguration.reason === "invalid") {
    return unavailable();
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
      logError("rate_limit_error", error);
      return unavailable();
    }
  } else {
    rateLimitDecision = consumeRateLimit(key, rateLimitPolicy);
  }
  if (!rateLimitDecision.allowed) {
    return data<ActionResult>(
      { ok: false, errors: ["Too many diagnostic attempts. Please try again shortly."] },
      { status: 429, headers: rateLimitHeaders(rateLimitDecision) },
    );
  }

  const formData = await request.formData();
  const storySlugResult = parseDiscoveryStorySlug(new URL(request.url).searchParams.get("story"));
  if (storySlugResult.status === "invalid") {
    return data<ActionResult>(
      { ok: false, errors: ["The discovery story context is invalid."] },
      { status: 400 },
    );
  }
  const emailOptIn = parseEmailOptIn(formData);
  const funnelSource = formData.get("funnelSource");
  if (funnelSource !== null && funnelSource !== "archetype") {
    return data<ActionResult>(
      { ok: false, errors: ["The diagnostic source is invalid."] },
      { status: 400 },
    );
  }

  const parsed = profileV4Schema.safeParse(parseProfileForm(formData));
  if (!parsed.success) {
    return data<ActionResult>({ ok: false, errors: issueMessages(parsed.error) }, { status: 400 });
  }
  const profile = parsed.data;

  const discoveryContext = storySlugResult.slug
    ? await loadPublishedDiscoveryStoryContext(storySlugResult.slug)
    : null;
  if (storySlugResult.slug && !discoveryContext) {
    return data<ActionResult>(
      { ok: false, errors: ["The discovery story context is unavailable."] },
      { status: 400 },
    );
  }

  const startedAt = performance.now();
  // Only the validated constraint profile reaches the AI search; the email
  // field and every request header stay on this server.
  const search = searchQuiz(profile);

  if (funnelSource === "archetype") {
    const events = [
      { name: "qualified_recommendation" as const },
      ...(emailOptIn.email ? [{ name: "opt_in" as const }] : []),
    ];
    for (const event of events) {
      try {
        await persistDiscoveryFunnelEvent(event);
      } catch (error) {
        logError("discovery_funnel_persistence_error", error);
      }
    }
  }

  let subscription: SubscriptionResult = {
    status: "not_requested",
    message: "Results are available without email.",
    newsletterStatus: "not_requested",
    dossierStatus: "not_requested",
  };

  let aiSearch: Promise<AiSearchView> | AiSearchView;
  if ("error" in emailOptIn) {
    subscription = {
      status: "failed",
      message: emailOptIn.error ?? "Email delivery request was rejected.",
      newsletterStatus: "failed",
      dossierStatus: "failed",
    };
    aiSearch = search;
  } else if (emailOptIn.email !== null) {
    // The dossier needs the finished shortlist; by now it is normally stored.
    aiSearch = await search;
    subscription = await deliverEmail(emailOptIn.email, profile, aiSearch);
    await recordQuizAnalyticsEvent({
      name: "subscription",
      intent: SUBMISSION_INTENT,
      catalogueOrigin: aiSearch.status === "found" && aiSearch.fromCache ? "supabase" : "ai_search",
      status: subscription.status,
    });
  } else {
    aiSearch = search.then(async (result) => {
      await recordQuizAnalyticsEvent({
        name: "evaluation",
        intent: SUBMISSION_INTENT,
        catalogueOrigin: result.status === "found" && result.fromCache ? "supabase" : "ai_search",
        recommendationCount: result.status === "found" ? result.watches.length : 0,
        verificationCount: 0,
        whyNotCount: 0,
        hardFilterViolationCount: 0,
        evaluationDurationMs: Number((performance.now() - startedAt).toFixed(2)),
        providerCostUsd: 0,
        topRecommendationScore: null,
        meanRecommendationScore: null,
      });
      return result;
    });
  }

  const result: Extract<ActionResult, { ok: true }> = {
    ok: true,
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
            explanation: Promise.resolve(aiSearch).then((resolved) =>
              explainStoryConstraint(
                discoveryContext.story,
                resolved.status === "found" ? resolved.watches : [],
              ),
            ),
          },
        }
      : {}),
  };
  return data<ActionResult>(result, "error" in emailOptIn ? { status: 400 } : undefined);
}

export async function loader({ request }: Route.LoaderArgs) {
  if (!(await hasDiagnosticAccess(request))) {
    const storyContext = parseDiscoveryStorySlug(new URL(request.url).searchParams.get("story"));
    const storyQuery =
      storyContext.status === "valid" ? `&story=${encodeURIComponent(storyContext.slug)}` : "";
    return redirect(`/?diagnostic=subscription${storyQuery}#newsletter-signup`);
  }

  const [vocabulary, fx] = await Promise.all([loadCatalogueVocabulary(), loadFxTable()]);
  const options = (kind: VocabularyKind): VocabularyOption[] =>
    vocabulary
      .filter((row) => row.kind === kind && row.active)
      .map((row) => ({ slug: row.slug, labelEn: row.labelEn }));

  return {
    scenarios: options("wearing_scenario"),
    complications: options("complication"),
    fx,
  };
}

export function meta(): ReturnType<Route.MetaFunction> {
  return [
    { title: "Watch Diagnostic · The Reserve" },
    {
      name: "description",
      content: "Six quick answers, then a shortlist of watches confirmed on their makers' own pages.",
    },
  ];
}

type QuizDraft = {
  budgetCurrency: BudgetCurrency;
  priceRange: string;
  wristValue: string;
  wristUnit: "cm" | "in";
  diameterMin: string;
  diameterMax: string;
  wearingScenarios: string[];
  minimumWaterResistanceM: string;
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
  priceRange: "",
  wristValue: "",
  wristUnit: "cm",
  diameterMin: "",
  diameterMax: "",
  wearingScenarios: [],
  minimumWaterResistanceM: "0",
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

function wristCm(draft: QuizDraft) {
  const value = Number(draft.wristValue);
  if (!draft.wristValue.trim() || !Number.isFinite(value)) return null;
  return Math.round((draft.wristUnit === "in" ? value * 2.54 : value) * 10) / 10;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readSavedDraft(): { step: number; draft: QuizDraft } | null {
  try {
    const raw = window.sessionStorage.getItem(QUESTIONNAIRE_V4_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== QUESTIONNAIRE_V4_VERSION || !isRecord(parsed.draft)) {
      return null;
    }
    const saved = parsed.draft;
    const text = (key: keyof QuizDraft) =>
      typeof saved[key] === "string" ? (saved[key]) : "";
    const list = (key: keyof QuizDraft) =>
      Array.isArray(saved[key])
        ? (saved[key] as unknown[]).filter((entry): entry is string => typeof entry === "string")
        : [];
    return {
      step: typeof parsed.step === "number" ? parsed.step : 0,
      draft: {
        ...INITIAL_DRAFT,
        budgetCurrency: (BUDGET_CURRENCIES as readonly string[]).includes(text("budgetCurrency"))
          ? (text("budgetCurrency") as BudgetCurrency)
          : INITIAL_DRAFT.budgetCurrency,
        priceRange: findPriceRange(text("priceRange")) ? text("priceRange") : "",
        wristValue: text("wristValue"),
        wristUnit: text("wristUnit") === "in" ? "in" : "cm",
        diameterMin: text("diameterMin"),
        diameterMax: text("diameterMax"),
        wearingScenarios: list("wearingScenarios"),
        minimumWaterResistanceM: text("minimumWaterResistanceM") || "0",
        movementTypes: list("movementTypes"),
        requiredComplications: list("requiredComplications"),
        allergyConstraint: text("allergyConstraint") === "nickel_contact" ? "nickel_contact" : "none",
        maxCaseThicknessMm: text("maxCaseThicknessMm"),
        caseShape: text("caseShape") as QuizDraft["caseShape"],
        movementConstruction: text("movementConstruction") as QuizDraft["movementConstruction"],
        displayCaseback: text("displayCaseback") as QuizDraft["displayCaseback"],
        crystal: text("crystal") as QuizDraft["crystal"],
        microAdjustmentRequired: text("microAdjustmentRequired") as QuizDraft["microAdjustmentRequired"],
      },
    };
  } catch {
    return null;
  }
}

/** The exact field set the action parses, so a draft posts unchanged. */
function profileFormFields(draft: QuizDraft) {
  const fields: { name: string; value: string }[] = [
    { name: "version", value: String(QUESTIONNAIRE_V4_VERSION) },
    { name: "budgetCurrency", value: draft.budgetCurrency },
    { name: "priceRange", value: draft.priceRange },
    { name: "wristCm", value: String(wristCm(draft) ?? "") },
    { name: "caseDiameterMinMm", value: draft.diameterMin },
    { name: "caseDiameterMaxMm", value: draft.diameterMax },
    { name: "minimumWaterResistanceM", value: draft.minimumWaterResistanceM },
    { name: "allergyConstraint", value: draft.allergyConstraint },
    { name: "maxCaseThicknessMm", value: draft.maxCaseThicknessMm },
    { name: "caseShape", value: draft.caseShape },
    { name: "movementConstruction", value: draft.movementConstruction },
    { name: "displayCaseback", value: draft.displayCaseback },
    { name: "crystal", value: draft.crystal },
    { name: "microAdjustmentRequired", value: draft.microAdjustmentRequired },
  ];
  for (const value of draft.wearingScenarios) fields.push({ name: "wearingScenarios", value });
  for (const value of draft.movementTypes) fields.push({ name: "movementTypes", value });
  for (const value of draft.requiredComplications) {
    fields.push({ name: "requiredComplications", value });
  }
  return fields;
}

function ProfileFields({ draft }: { draft: QuizDraft }) {
  return (
    <>
      {profileFormFields(draft).map((field, index) => (
        <input key={`${field.name}-${index}`} name={field.name} type="hidden" value={field.value} />
      ))}
    </>
  );
}

function draftToProfileInput(draft: QuizDraft) {
  const optionalNumber = (raw: string) => (raw.trim() === "" ? undefined : Number(raw));
  const optionalBoolean = (raw: string) => (raw === "" ? undefined : raw === "yes");
  const optionalText = (raw: string) => (raw === "" ? undefined : raw);
  return {
    version: QUESTIONNAIRE_V4_VERSION,
    budgetCurrency: draft.budgetCurrency,
    priceRange: draft.priceRange,
    wristCm: wristCm(draft) ?? Number.NaN,
    caseDiameterMinMm: optionalNumber(draft.diameterMin),
    caseDiameterMaxMm: optionalNumber(draft.diameterMax),
    wearingScenarios: draft.wearingScenarios,
    minimumWaterResistanceM: Number(draft.minimumWaterResistanceM),
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

const RANGE_TIERS = [
  { label: "Under 10k", test: (minimum: number) => minimum < 10_000 },
  { label: "10k to 100k", test: (minimum: number) => minimum >= 10_000 && minimum < 100_000 },
  { label: "100k and above", test: (minimum: number) => minimum >= 100_000 },
];

function PriceRangePicker({
  currency,
  value,
  onChange,
}: {
  currency: string;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <fieldset className="quiz-fieldset">
      <legend>Price range</legend>
      {RANGE_TIERS.map((tier) => (
        <div className="range-tier" key={tier.label}>
          <span className="range-tier__label">{tier.label}</span>
          <div className="chip-list">
            {PRICE_RANGES.filter((range) => tier.test(range.minimum)).map((range) => (
              <label
                className={`chip chip--radio chip--range ${value === range.id ? "is-selected" : ""}`}
                key={range.id}
              >
                <input
                  checked={value === range.id}
                  className="chip__input"
                  name="priceRangeChoice"
                  onChange={() => onChange(range.id)}
                  type="radio"
                  value={range.id}
                />
                <span>{priceRangeLabel(range, currency)}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </fieldset>
  );
}

/** A wrist change pre-fills the case range; the visitor can then edit it. */
function wristPatch(draft: QuizDraft, patch: Pick<QuizDraft, "wristValue"> & Partial<QuizDraft>) {
  const next = { ...draft, ...patch };
  const cm = wristCm(next);
  if (cm === null || cm < WRIST_CM_MIN || cm > WRIST_CM_MAX) return patch;
  const suggested = caseDiameterForWrist(cm);
  return {
    ...patch,
    diameterMin: String(suggested.minimumMm),
    diameterMax: String(suggested.maximumMm),
  };
}

/** The edited range when it is complete and sensible, else null. */
function draftDiameter(draft: QuizDraft) {
  if (draft.diameterMin.trim() === "" && draft.diameterMax.trim() === "") return null;
  const minimumMm = Number(draft.diameterMin);
  const maximumMm = Number(draft.diameterMax);
  const inBounds = (value: number) =>
    Number.isFinite(value) && value >= CASE_DIAMETER_MM_MIN && value <= CASE_DIAMETER_MM_MAX;
  if (draft.diameterMin.trim() === "" || draft.diameterMax.trim() === "") return "invalid" as const;
  return inBounds(minimumMm) && inBounds(maximumMm) && minimumMm <= maximumMm
    ? { minimumMm, maximumMm }
    : ("invalid" as const);
}

const QUICK_WRISTS_CM = [15, 16, 17, 18, 19, 20];

function WristStep({
  draft,
  update,
}: {
  draft: QuizDraft;
  update: (patch: Partial<QuizDraft>) => void;
}) {
  const cm = wristCm(draft);
  const valid = cm !== null && cm >= WRIST_CM_MIN && cm <= WRIST_CM_MAX;
  const edited = draftDiameter(draft);
  const diameter = !valid
    ? null
    : edited && edited !== "invalid"
      ? edited
      : caseDiameterForWrist(cm);
  return (
    <>
      <ChoiceGroup
        legend="Measure in"
        name="wristUnit"
        onChange={(unit) => {
          const current = wristCm(draft);
          update({
            wristUnit: unit,
            wristValue:
              current === null
                ? draft.wristValue
                : String(unit === "in" ? Math.round((current / 2.54) * 10) / 10 : current),
          });
        }}
        options={["cm", "in"] as const}
        renderLabel={(unit) => (unit === "cm" ? "Centimetres" : "Inches")}
        value={draft.wristUnit}
      />
      <div className="field-row field-row--single">
        <NumberField
          label="Wrist circumference"
          max={draft.wristUnit === "in" ? 10 : WRIST_CM_MAX}
          min={draft.wristUnit === "in" ? 4.5 : WRIST_CM_MIN}
          onChange={(value) => update(wristPatch(draft, { wristValue: value }))}
          placeholder={draft.wristUnit === "in" ? "e.g. 6.9" : "e.g. 17.5"}
          step={0.1}
          unit={draft.wristUnit}
          value={draft.wristValue}
        />
      </div>
      <div className="chip-list quick-picks" aria-label="Common wrist sizes">
        {QUICK_WRISTS_CM.map((size) => (
          <button
            className="chip"
            key={size}
            onClick={() =>
              update(
                wristPatch(draft, {
                  wristValue:
                    draft.wristUnit === "in" ? String(Math.round((size / 2.54) * 10) / 10) : String(size),
                }),
              )
            }
            type="button"
          >
            {draft.wristUnit === "in" ? `${Math.round((size / 2.54) * 10) / 10} in` : `${size} cm`}
          </button>
        ))}
      </div>
      <p className="wrist-note" aria-live="polite">
        {diameter
          ? `We'll look for cases of ${diameter.minimumMm}–${diameter.maximumMm} mm, which sit well on a ${cm} cm wrist. Adjust the range below if you prefer.`
          : "Wrap a soft tape or a strip of paper around your wrist just above the bone."}
      </p>
      {valid ? (
        <fieldset className="quiz-fieldset">
          <legend>Case diameter range</legend>
          <p className="field-hint">Only watches inside this range are suggested.</p>
          <div className="field-row">
            <NumberField
              label="Smallest case"
              max={CASE_DIAMETER_MM_MAX}
              min={CASE_DIAMETER_MM_MIN}
              onChange={(value) => update({ diameterMin: value })}
              placeholder={String(caseDiameterForWrist(cm).minimumMm)}
              step={0.5}
              unit="mm"
              value={draft.diameterMin}
            />
            <NumberField
              label="Largest case"
              max={CASE_DIAMETER_MM_MAX}
              min={CASE_DIAMETER_MM_MIN}
              onChange={(value) => update({ diameterMax: value })}
              placeholder={String(caseDiameterForWrist(cm).maximumMm)}
              step={0.5}
              unit="mm"
              value={draft.diameterMax}
            />
          </div>
          {edited === "invalid" ? (
            <p className="field-hint field-hint--error" role="alert">
              Enter both sizes between {CASE_DIAMETER_MM_MIN} and {CASE_DIAMETER_MM_MAX} mm, the
              smallest first.
            </p>
          ) : null}
        </fieldset>
      ) : null}
    </>
  );
}

function ProfileSummary({
  profile,
  scenarioLabels,
  complicationLabels,
}: {
  profile: ProfileV4;
  scenarioLabels: Map<string, string>;
  complicationLabels: Map<string, string>;
}) {
  const named = (slugs: readonly string[], labels: Map<string, string>) =>
    slugs.map((slug) => labels.get(slug) ?? labelFor(slug)).join(", ");
  const range = findPriceRange(profile.priceRange)!;
  const diameter = diameterRangeFor(profile);
  const optional = [
    profile.maxCaseThicknessMm !== undefined ? ["Thickness", `Up to ${profile.maxCaseThicknessMm} mm`] : null,
    profile.caseShape !== undefined ? ["Case shape", labelFor(profile.caseShape)] : null,
    profile.movementConstruction !== undefined ? ["Calibre", labelFor(profile.movementConstruction)] : null,
    profile.displayCaseback !== undefined ? ["Case back", profile.displayCaseback ? "Display" : "Solid"] : null,
    profile.crystal !== undefined ? ["Crystal", labelFor(profile.crystal)] : null,
    profile.microAdjustmentRequired !== undefined
      ? ["Clasp micro-adjustment", profile.microAdjustmentRequired ? "Required" : "Not wanted"]
      : null,
  ].filter((entry): entry is [string, string] => entry !== null);
  const rows: [string, string][] = [
    ["Price range", priceRangeLabel(range, profile.budgetCurrency)],
    ["Wrist", `${profile.wristCm} cm · cases ${diameter.minimumMm}–${diameter.maximumMm} mm`],
    ["Worn for", named(profile.wearingScenarios, scenarioLabels)],
    [
      "Water resistance",
      profile.minimumWaterResistanceM === 0 ? "No requirement" : `${profile.minimumWaterResistanceM} m or more`,
    ],
    ["Movement", profile.movementTypes.map(labelFor).join(", ")],
    [
      "Must have",
      profile.requiredComplications.length === 0
        ? "Nothing specific"
        : named(profile.requiredComplications, complicationLabels),
    ],
    ["Skin contact", labelFor(profile.allergyConstraint)],
    ...optional,
  ];
  return (
    <dl className="profile-grid">
      {rows.map(([term, value]) => (
        <div key={term}>
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
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
      <span className="eyebrow">Optional</span>
      <h2 id="delivery-heading">Email me this shortlist</h2>
      <p>
        Your results stay here either way. Opt in to receive the shortlist by email and The
        Reserve&apos;s newsletter.
      </p>
      {subscription.status !== "sent" && subscription.status !== "already_requested" ? (
        <Form className="delivery-form" method="post">
          {funnelSource ? <input name="funnelSource" type="hidden" value={funnelSource} /> : null}
          <ProfileFields draft={draft} />
          <label className="input-stack" htmlFor="delivery-email">
            <span>Email address</span>
            <input id="delivery-email" name="email" placeholder="you@example.com" type="email" />
          </label>
          <label className="delivery-opt-in">
            <input name="emailOptIn" type="checkbox" value="yes" />
            <span>
              I opt in to receive this shortlist by email and, where enabled, The Reserve&apos;s
              email publication.
            </span>
          </label>
          <button className="button button--primary" type="submit">
            Email my shortlist
          </button>
        </Form>
      ) : null}
      {subscription.status !== "not_requested" ? (
        <p
          className={`delivery-status delivery-status--${subscription.status}`}
          role={subscription.status === "failed" || subscription.status === "partial" ? "alert" : "status"}
        >
          {subscription.message}
        </p>
      ) : null}
    </section>
  );
}

const SCREEN_TITLES = [
  "What price range are you shopping in?",
  "What is your wrist size?",
  "Where will this watch actually be worn?",
  "Which movements are acceptable?",
  "Any preferences on the details?",
  "What must this watch do?",
] as const;

const SCREEN_INTROS = [
  "Pick the range for a new watch at list price. Everything we suggest sits inside it.",
  "It decides which case sizes will look proportionate on you.",
  "Pick every situation this watch has to cover.",
  "Anything you leave unselected is excluded.",
  "All optional. Leave a question on “No preference” to keep every option open.",
  "A required function excludes every watch without it. Leave the list empty if nothing is essential.",
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

  const scenarioLabels = useMemo(
    () => new Map(loaderData.scenarios.map((option) => [option.slug, option.labelEn])),
    [loaderData.scenarios],
  );
  const complicationLabels = useMemo(
    () => new Map(loaderData.complications.map((option) => [option.slug, option.labelEn])),
    [loaderData.complications],
  );

  const update = (patch: Partial<QuizDraft>) => setDraft((current) => ({ ...current, ...patch }));

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
    window.sessionStorage.setItem(
      QUESTIONNAIRE_V4_STORAGE_KEY,
      JSON.stringify({
        version: QUESTIONNAIRE_V4_VERSION,
        step: step === SUMMARY_STEP ? SCREEN_COUNT - 1 : step,
        draft,
      }),
    );
  }, [draft, step, storageReady]);

  useEffect(() => {
    if (!actionData?.ok) return;
    const timer = window.setTimeout(() => setStep(SUMMARY_STEP), 0);
    return () => window.clearTimeout(timer);
  }, [actionData]);

  const resultData = actionData?.ok ? actionData : null;
  const profileParse = useMemo(() => profileV4Schema.safeParse(draftToProfileInput(draft)), [draft]);
  const wrist = wristCm(draft);

  const stepIsComplete =
    step === 0
      ? draft.priceRange !== ""
      : step === 1
        ? wrist !== null &&
          wrist >= WRIST_CM_MIN &&
          wrist <= WRIST_CM_MAX &&
          draftDiameter(draft) !== "invalid"
        : step === 2
          ? draft.wearingScenarios.length > 0
          : step === 3
            ? draft.movementTypes.length > 0
            : step === 4
              ? true
              : profileParse.success;

  const isSubmitting = navigation.state === "submitting";
  const visibleStep = Math.min(step, SCREEN_COUNT - 1) + 1;

  const recordStart = () => {
    if (startTracked.current) return;
    startTracked.current = true;
    if (import.meta.env.PROD) {
      void fetch("/analytics/quiz-started", { method: "POST", keepalive: true }).catch(
        () => undefined,
      );
    }
  };

  const restartQuiz = () => {
    window.sessionStorage.removeItem(QUESTIONNAIRE_V4_STORAGE_KEY);
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
        <section className="profile-summary" aria-labelledby="profile-heading">
          <span className="eyebrow">Your answers</span>
          <h1 id="profile-heading">Your search boundary</h1>
          <ProfileSummary
            complicationLabels={complicationLabels}
            profile={resultData.profile}
            scenarioLabels={scenarioLabels}
          />
          <WatchResults
            defaultCurrency={resultData.profile.budgetCurrency}
            eyebrow="Checked catalogue · confirmed sources"
            footnote="Filtered from The Reserve's checked watch catalogue. Where it has gaps, or above 10k, a live Muse Spark and Perplexity search fills in using only your answers above; no email or personal data is sent. Check prices with the seller before buying."
            fx={loaderData.fx}
            heading="Watches that fit every answer"
            mode="quiz"
            result={resultData.aiSearch}
          />
          {resultData.storyContext ? (
            <StoryContextPanel storyContext={resultData.storyContext} />
          ) : null}
          <DossierDelivery
            draft={draft}
            funnelSource={funnelSource}
            subscription={resultData.subscription}
          />
          <div className="summary-actions">
            <button className="button button--primary" onClick={() => setStep(0)} type="button">
              Edit answers
            </button>
            <button className="button button--quiet" onClick={restartQuiz} type="button">
              Restart diagnostic
            </button>
          </div>
        </section>
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

        <div className="question-block">
          <h1 id="question-heading">{SCREEN_TITLES[Math.min(step, SCREEN_COUNT - 1)]}</h1>
          <p>{SCREEN_INTROS[Math.min(step, SCREEN_COUNT - 1)]}</p>

          {step === 0 ? (
            <>
              <ChoiceGroup
                legend="Currency"
                name="budgetCurrencyChoice"
                onChange={(value) => {
                  recordStart();
                  update({ budgetCurrency: value });
                }}
                options={BUDGET_CURRENCIES}
                renderLabel={(value) => value}
                value={draft.budgetCurrency}
              />
              <PriceRangePicker
                currency={draft.budgetCurrency}
                onChange={(id) => {
                  recordStart();
                  update({ priceRange: id });
                }}
                value={draft.priceRange}
              />
            </>
          ) : null}

          {step === 1 ? <WristStep draft={draft} update={update} /> : null}

          {step === 2 ? (
            <>
              <OptionCheckboxGroup
                hint="Tap every one that applies."
                legend="Wearing scenarios"
                onChange={(values) => update({ wearingScenarios: values })}
                options={loaderData.scenarios}
                values={draft.wearingScenarios}
              />
              <ChoiceGroup
                legend="Minimum water resistance"
                name="minimumWaterResistanceM"
                onChange={(value) => update({ minimumWaterResistanceM: value })}
                options={WATER_RESISTANCE_MINIMUMS.map(String)}
                renderLabel={(value) => (value === "0" ? "No requirement" : `${value} m+`)}
                value={draft.minimumWaterResistanceM}
              />
            </>
          ) : null}

          {step === 3 ? (
            <>
              <OptionCheckboxGroup
                legend="Movement types"
                onChange={(values) =>
                  update({
                    movementTypes: MOVEMENT_TYPE_CHOICES.filter((option) => values.includes(option)),
                  })
                }
                options={MOVEMENT_TYPE_CHOICES.map((option) => ({
                  slug: option,
                  labelEn: labelFor(option),
                }))}
                values={draft.movementTypes}
              />
              <OptionalChoice
                label="Calibre"
                onChange={(value) => update({ movementConstruction: value })}
                options={MOVEMENT_CONSTRUCTIONS}
                renderLabel={labelFor}
                value={draft.movementConstruction}
              />
            </>
          ) : null}

          {step === 4 ? (
            <>
              <OptionalChoice
                label="Case shape"
                onChange={(value) => update({ caseShape: value })}
                options={CASE_SHAPES}
                renderLabel={labelFor}
                value={draft.caseShape}
              />
              <div className="field-row field-row--single">
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
              <OptionalChoice
                label="Case back"
                onChange={(value) => update({ displayCaseback: value })}
                options={["yes", "no"] as const}
                renderLabel={(value) => (value === "yes" ? "Display" : "Solid")}
                value={draft.displayCaseback}
              />
              <OptionalChoice
                label="Crystal"
                onChange={(value) => update({ crystal: value })}
                options={CRYSTAL_CHOICES}
                renderLabel={labelFor}
                value={draft.crystal}
              />
              <OptionalChoice
                label="Clasp micro-adjustment"
                onChange={(value) => update({ microAdjustmentRequired: value })}
                options={["yes", "no"] as const}
                renderLabel={(value) => (value === "yes" ? "Required" : "Not wanted")}
                value={draft.microAdjustmentRequired}
              />
            </>
          ) : null}

          {step === 5 ? (
            <>
              <OptionCheckboxGroup
                legend="Required functions"
                onChange={(values) => update({ requiredComplications: values })}
                options={loaderData.complications}
                values={draft.requiredComplications}
              />
              <ChoiceGroup
                legend="Skin contact"
                name="allergyConstraint"
                onChange={(value) => update({ allergyConstraint: value })}
                options={ALLERGY_CONSTRAINTS_V3}
                renderLabel={labelFor}
                value={draft.allergyConstraint}
              />
            </>
          ) : null}
        </div>

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
              onClick={() => setStep((current) => Math.max(0, current - 1))}
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
              {funnelSource ? <input name="funnelSource" type="hidden" value={funnelSource} /> : null}
              <ProfileFields draft={draft} />
              <button
                className="button button--primary"
                disabled={!stepIsComplete || isSubmitting}
                type="submit"
              >
                {isSubmitting ? "Starting search…" : "See the shortlist"}
              </button>
            </Form>
          )}
        </div>
      </section>
    </main>
  );
}

function StoryContextPanel({
  storyContext,
}: {
  storyContext: NonNullable<Extract<ActionResult, { ok: true }>["storyContext"]>;
}) {
  const [explanation, setExplanation] = useState<StoryExplanation | null>(null);
  useEffect(() => {
    let active = true;
    void Promise.resolve(storyContext.explanation).then((value) => {
      if (active) setExplanation(value);
    });
    return () => {
      active = false;
    };
  }, [storyContext.explanation]);
  return (
    <section className="delivery-panel" aria-labelledby="story-context-heading">
      <span className="eyebrow">Story context</span>
      <h2 id="story-context-heading">
        {storyContext.entityName}
        {storyContext.workTitle ? ` · ${storyContext.workTitle}` : ""}
      </h2>
      <p>{explanation ? explanation.message : "Comparing with your shortlist…"}</p>
    </section>
  );
}
