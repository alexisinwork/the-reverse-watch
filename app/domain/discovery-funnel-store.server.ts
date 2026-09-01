import { z } from "zod";

import {
  discoveryAnalyticsEventSchema,
  type DiscoveryAnalyticsEvent,
} from "./discovery-analytics";

export const DISCOVERY_FUNNEL_EVENT_RPC =
  "record_discovery_funnel_event_v1" as const;
export const DISCOVERY_FUNNEL_SUMMARY_RPC =
  "discovery_funnel_summary_v1" as const;
const STORE_TIMEOUT_MS = 2_000;

type StoreOptions = {
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
    pageViews: z.number().int().nonnegative(),
    pageViewsBySurface: z.record(z.string(), z.number().int().nonnegative()),
    archetypeStarts: z.number().int().nonnegative(),
    archetypeCompletions: z.number().int().nonnegative(),
    shares: z.number().int().nonnegative(),
    coreHandoffs: z.number().int().nonnegative(),
    qualifiedRecommendations: z.number().int().nonnegative(),
    optIns: z.number().int().nonnegative(),
    outboundMarketClicks: z.number().int().nonnegative(),
    archetypeCompletionsByType: z.record(
      z.string(),
      z.number().int().nonnegative(),
    ),
  })
  .strict();

export type DiscoveryFunnelSummary = z.infer<typeof summarySchema>;

function configuration(env: StoreOptions["env"], requireProduction: boolean) {
  const supabaseUrl = env?.SUPABASE_URL?.trim();
  const publishableKey = env?.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (requireProduction && env?.VERCEL_ENV !== "production") return null;
  if (!supabaseUrl || !publishableKey) return null;
  return { supabaseUrl, publishableKey };
}

export async function persistDiscoveryFunnelEvent(
  event: DiscoveryAnalyticsEvent,
  {
    env = process.env,
    fetchImpl = fetch,
    timeoutMs = STORE_TIMEOUT_MS,
    requireProduction = true,
  }: StoreOptions = {},
) {
  const configured = configuration(env, requireProduction);
  if (!configured) return false;
  const parsed = discoveryAnalyticsEventSchema.parse(event);

  const response = await fetchImpl(
    new URL(
      `/rest/v1/rpc/${DISCOVERY_FUNNEL_EVENT_RPC}`,
      configured.supabaseUrl,
    ),
    {
      method: "POST",
      headers: {
        apikey: configured.publishableKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        p_event_name: parsed.name,
        p_surface: "surface" in parsed ? parsed.surface : null,
        p_archetype_id: "archetypeId" in parsed ? parsed.archetypeId : null,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    },
  );
  if (!response.ok) {
    throw new Error(`Discovery funnel event RPC returned ${response.status}.`);
  }
  return true;
}

export async function loadDiscoveryFunnelSummary(
  since: string,
  until: string,
  {
    env = process.env,
    fetchImpl = fetch,
    timeoutMs = STORE_TIMEOUT_MS,
  }: StoreOptions = {},
) {
  const configured = configuration(env, false);
  if (!configured) return null;

  const response = await fetchImpl(
    new URL(
      `/rest/v1/rpc/${DISCOVERY_FUNNEL_SUMMARY_RPC}`,
      configured.supabaseUrl,
    ),
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
    throw new Error(
      `Discovery funnel summary RPC returned ${response.status}.`,
    );
  }
  return summarySchema.parse(await response.json());
}
