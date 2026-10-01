/**
 * /quiz: six questions, then the shortlist. The action validates the
 * answers, starts the catalogue-first search (quiz-search.server.ts) and
 * streams the result; the page walks the visitor through the steps.
 * Screen parts live in app/components/quiz/.
 */
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

import type { Route } from "./+types/quiz";
import {
  draftToProfileInput,
  draftDiameter,
  INITIAL_DRAFT,
  readSavedDraft,
  wristCm,
  type QuizDraft,
} from "../components/quiz/quiz-draft";
import {
  DossierDelivery,
  ExpertReportTeaser,
  ProfileSummary,
  StoryContextPanel,
} from "../components/quiz/quiz-results";
import { QuestionScreen } from "../components/quiz/question-screens";
import { ProfileFields } from "../components/quiz/quiz-steps";
import { WatchResults } from "../components/watch-results";
import type { AiSearchView, ProgressLink } from "../domain/ai-watch-types";
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
import { loadPublishedDiscoveryStoryContext } from "../domain/discovery-store.server";
import type { SubscriptionResult } from "../domain/email-delivery";
import { loadFxTable } from "../domain/fx.server";
import {
  profileV4Schema,
  QUESTIONNAIRE_V4_STORAGE_KEY,
  QUESTIONNAIRE_V4_VERSION,
  WRIST_CM_MAX,
  WRIST_CM_MIN,
  type ProfileV4,
} from "../domain/questionnaire-v4";
import {
  deliverEmail,
  logError,
  SUBMISSION_INTENT,
} from "../domain/quiz-email.server";
import {
  issueMessages,
  parseEmailOptIn,
  parseProfileForm,
} from "../domain/quiz-form";
import { createProgressFeed } from "../domain/progress-feed";
import { searchQuiz } from "../domain/quiz-search.server";
import {
  consumeRateLimit,
  parseRateLimitPolicy,
  rateLimitHeaders,
  rateLimitKey,
  type RateLimitDecision,
} from "../domain/rate-limit.server";
import {
  consumeUpstashRateLimit,
  createUpstashRateLimitClient,
  parseUpstashRateLimitConfiguration,
} from "../domain/rate-limit-upstash.server";
import "../styles/quiz.css";

const SCREEN_COUNT = 6;

const SUMMARY_STEP = SCREEN_COUNT;

type StoryExplanation = ReturnType<typeof explainStoryConstraint>;

type ActionResult =
  | {
      ok: true;
      profile: ProfileV4;
      /** Streamed: the page renders before the search has finished. */
      aiSearch: Promise<AiSearchView> | AiSearchView;
      /** Live steps of the search, streamed while it runs. */
      progress: Promise<ProgressLink | null>;
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

type VocabularyOption = { slug: string; labelEn: string };

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
  const unavailable = () =>
    data<ActionResult>(
      {
        ok: false,
        errors: ["The diagnostic is temporarily unavailable. Try again later."],
      },
      { status: 503 },
    );
  if (!rateLimitPolicy.configured && rateLimitPolicy.reason === "invalid")
    return unavailable();
  if (
    !upstashConfiguration.configured &&
    upstashConfiguration.reason === "invalid"
  ) {
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
  const funnelSource = formData.get("funnelSource");
  if (funnelSource !== null && funnelSource !== "archetype") {
    return data<ActionResult>(
      { ok: false, errors: ["The diagnostic source is invalid."] },
      { status: 400 },
    );
  }

  const parsed = profileV4Schema.safeParse(parseProfileForm(formData));
  if (!parsed.success) {
    return data<ActionResult>(
      { ok: false, errors: issueMessages(parsed.error) },
      { status: 400 },
    );
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
  const progress = createProgressFeed();
  const search = searchQuiz(profile, { report: progress.report });
  void search.finally(progress.close);

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
      catalogueOrigin:
        aiSearch.status === "found" && aiSearch.fromCache
          ? "supabase"
          : "ai_search",
      status: subscription.status,
    });
  } else {
    aiSearch = search.then(async (result) => {
      await recordQuizAnalyticsEvent({
        name: "evaluation",
        intent: SUBMISSION_INTENT,
        catalogueOrigin:
          result.status === "found" && result.fromCache
            ? "supabase"
            : "ai_search",
        recommendationCount:
          result.status === "found" ? result.watches.length : 0,
        verificationCount: 0,
        whyNotCount: 0,
        hardFilterViolationCount: 0,
        evaluationDurationMs: Number(
          (performance.now() - startedAt).toFixed(2),
        ),
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
    progress: progress.feed,
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
  return data<ActionResult>(
    result,
    "error" in emailOptIn ? { status: 400 } : undefined,
  );
}

const QUIZ_SCENARIOS: VocabularyOption[] = [
  { slug: "everyday", labelEn: "Everyday" },
  { slug: "office", labelEn: "Office & business" },
  { slug: "suit", labelEn: "Suit & formal evenings" },
  { slug: "sport", labelEn: "Sport & weekends" },
  { slug: "diving", labelEn: "Diving & water" },
  { slug: "field", labelEn: "Outdoors & expeditions" },
  { slug: "travel", labelEn: "Travel & flights" },
];

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

  const [vocabulary, fx] = await Promise.all([
    loadCatalogueVocabulary(),
    loadFxTable(),
  ]);
  const options = (kind: VocabularyKind): VocabularyOption[] =>
    vocabulary
      .filter((row) => row.kind === kind && row.active)
      .map((row) => ({ slug: row.slug, labelEn: row.labelEn }));

  // Seven plain choices instead of the vocabulary's 44: together they cover
  // every catalogue style (owner decision, 2026-10-01).
  const scenarioSlugs = new Set(
    options("wearing_scenario").map((option) => option.slug),
  );
  return {
    scenarios: QUIZ_SCENARIOS.filter((option) =>
      scenarioSlugs.has(option.slug),
    ),
    complications: options("complication"),
    fx,
  };
}

export function meta(): ReturnType<Route.MetaFunction> {
  return [
    { title: "Watch Diagnostic · The Reserve" },
    {
      name: "description",
      content:
        "Six quick answers, then a shortlist of watches confirmed on their makers' own pages.",
    },
  ];
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
    () =>
      new Map(
        loaderData.scenarios.map((option) => [option.slug, option.labelEn]),
      ),
    [loaderData.scenarios],
  );
  const complicationLabels = useMemo(
    () =>
      new Map(
        loaderData.complications.map((option) => [option.slug, option.labelEn]),
      ),
    [loaderData.complications],
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
  const profileParse = useMemo(
    () => profileV4Schema.safeParse(draftToProfileInput(draft)),
    [draft],
  );
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
      void fetch("/analytics/quiz-started", {
        method: "POST",
        keepalive: true,
      }).catch(() => undefined);
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
            eyebrow="Checked catalogue · confirmed sources"
            footnote="Filtered from The Reserve's checked watch catalogue. Where it has gaps, or above 10k, a live web search fills in using only your answers above; no email or personal data is sent. Check prices with the seller before buying."
            fx={loaderData.fx}
            heading="Watches that fit every answer"
            mode="quiz"
            progress={resultData.progress}
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
          <ExpertReportTeaser />
          <div className="summary-actions">
            <button
              className="button button--primary"
              onClick={() => setStep(0)}
              type="button"
            >
              Edit answers
            </button>
            <button
              className="button button--quiet"
              onClick={restartQuiz}
              type="button"
            >
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
          <h1 id="question-heading">
            {SCREEN_TITLES[Math.min(step, SCREEN_COUNT - 1)]}
          </h1>
          <p>{SCREEN_INTROS[Math.min(step, SCREEN_COUNT - 1)]}</p>

          <QuestionScreen
            complications={loaderData.complications}
            draft={draft}
            onStart={recordStart}
            scenarios={loaderData.scenarios}
            step={step}
            update={update}
          />
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
              {funnelSource ? (
                <input name="funnelSource" type="hidden" value={funnelSource} />
              ) : null}
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
