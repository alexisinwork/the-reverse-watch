import { z } from "zod";

import type { QuizAnalyticsEvent } from "./analytics.server";

export const FUNNEL_EVENT_RPC = "record_quiz_funnel_event_v1";
export const FUNNEL_SUMMARY_RPC = "quiz_funnel_summary_v1";
export const FUNNEL_STORE_TIMEOUT_MS = 2_000;

type FunnelStoreEvent = { name: "start" } | QuizAnalyticsEvent;

type FunnelStoreOptions = {
  env?: Partial<
    Pick<
      NodeJS.ProcessEnv,
      "SUPABASE_URL" | "SUPABASE_PUBLISHABLE_KEY" | "VERCEL_ENV"
    >
  >;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  requireProduction?: boolean;
};

const summarySchema = z
  .object({
    since: z.iso.datetime({ offset: true }),
    until: z.iso.datetime({ offset: true }),
    starts: z.number().int().nonnegative(),
    coreEvaluations: z.number().int().nonnegative(),
    refineEvaluations: z.number().int().nonnegative(),
    hardFilterViolations: z.number().int().nonnegative(),
    averageEvaluationDurationMs: z.number().nonnegative().nullable(),
    providerCostUsd: z.number().nonnegative(),
    averageTopRecommendationScore: z.number().nonnegative().nullable(),
    averageMeanRecommendationScore: z.number().nonnegative().nullable(),
    subscriptionStatuses: z.record(z.string(), z.number().int().nonnegative()),
  })
  .strict();

export type FunnelSummary = z.infer<typeof summarySchema>;

function configuration(
  env: FunnelStoreOptions["env"],
  requireProduction: boolean,
) {
  const supabaseUrl = env?.SUPABASE_URL?.trim();
  const publishableKey = env?.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (requireProduction && env?.VERCEL_ENV !== "production") return null;
  if (!supabaseUrl || !publishableKey) return null;
  return { supabaseUrl, publishableKey };
}

function rpcBody(event: FunnelStoreEvent) {
  if (event.name === "start") return { p_event_name: "start" };

  return {
    p_event_name: event.name,
    p_intent: event.intent,
    p_catalogue_origin: event.catalogueOrigin,
    p_recommendation_count: event.recommendationCount ?? null,
    p_verification_count: event.verificationCount ?? null,
    p_why_not_count: event.whyNotCount ?? null,
    p_hard_filter_violation_count: event.hardFilterViolationCount ?? null,
    p_evaluation_duration_ms: event.evaluationDurationMs ?? null,
    p_provider_cost_usd: event.providerCostUsd ?? null,
    p_top_recommendation_score: event.topRecommendationScore ?? null,
    p_mean_recommendation_score: event.meanRecommendationScore ?? null,
    p_subscription_status: event.status ?? null,
  };
}

export async function persistFunnelEvent(
  event: FunnelStoreEvent,
  {
    env = process.env,
    fetchImpl = fetch,
    timeoutMs = FUNNEL_STORE_TIMEOUT_MS,
    requireProduction = true,
  }: FunnelStoreOptions = {},
) {
  const configured = configuration(env, requireProduction);
  if (!configured) return false;

  const response = await fetchImpl(
    new URL(`/rest/v1/rpc/${FUNNEL_EVENT_RPC}`, configured.supabaseUrl),
    {
      method: "POST",
      headers: {
        apikey: configured.publishableKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(rpcBody(event)),
      signal: AbortSignal.timeout(timeoutMs),
    },
  );
  if (!response.ok) {
    throw new Error(`Funnel event RPC returned ${response.status}.`);
  }
  return true;
}

export async function loadFunnelSummary(
  since: string,
  until: string,
  {
    env = process.env,
    fetchImpl = fetch,
    timeoutMs = FUNNEL_STORE_TIMEOUT_MS,
  }: FunnelStoreOptions = {},
) {
  const configured = configuration(env, false);
  if (!configured) return null;

  const response = await fetchImpl(
    new URL(`/rest/v1/rpc/${FUNNEL_SUMMARY_RPC}`, configured.supabaseUrl),
    {
      method: "POST",
      headers: {
        apikey: configured.publishableKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({ p_since: since, p_until: until }),
      signal: AbortSignal.timeout(timeoutMs),
    },
  );
  if (!response.ok) {
    throw new Error(`Funnel summary RPC returned ${response.status}.`);
  }
  return summarySchema.parse(await response.json());
}
