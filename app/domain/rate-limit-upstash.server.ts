import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import {
  consumeRateLimit,
  type RateLimitDecision,
  type RateLimitPolicy,
} from "./rate-limit.server";

type Environment = Record<string, string | undefined>;

export type UpstashRateLimitConfiguration =
  | { configured: true; url: string; token: string }
  | { configured: false; reason: "missing" | "invalid" };

export function parseUpstashRateLimitConfiguration(
  environment: Environment = process.env,
): UpstashRateLimitConfiguration {
  const url = environment.UPSTASH_REDIS_REST_URL?.trim();
  const token = environment.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url && !token) return { configured: false, reason: "missing" };
  if (!url || !token) return { configured: false, reason: "invalid" };

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return { configured: false, reason: "invalid" };
    }
  } catch {
    return { configured: false, reason: "invalid" };
  }

  return { configured: true, url, token };
}

type UpstashRateLimitResponse = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  reason?: string;
};

export type UpstashRateLimitClient = {
  limit: (identifier: string) => Promise<UpstashRateLimitResponse>;
};

export function createUpstashRateLimitClient(
  policy: Extract<RateLimitPolicy, { configured: true }>,
  configuration: Extract<UpstashRateLimitConfiguration, { configured: true }>,
): UpstashRateLimitClient {
  const redis = new Redis({
    url: configuration.url,
    token: configuration.token,
  });
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      policy.maxRequests,
      `${policy.windowMs / 1_000} s`,
    ),
    prefix: "the-reserve:quiz",
    // A process-local cache would duplicate the distributed decision state.
    ephemeralCache: false,
    analytics: false,
  });
}

export async function consumeUpstashRateLimit(
  client: UpstashRateLimitClient,
  key: string,
): Promise<RateLimitDecision> {
  const result = await client.limit(key);
  if (result.reason === "timeout") {
    throw new Error("Upstash rate-limit request timed out");
  }
  return {
    allowed: result.success,
    limit: result.limit,
    remaining: Math.max(result.remaining, 0),
    resetAt: result.reset,
    retryAfterSeconds: result.success
      ? null
      : Math.max(Math.ceil((result.reset - Date.now()) / 1_000), 1),
  };
}

/**
 * A limit shared by every server instance (Upstash) when configured,
 * otherwise this instance's own memory. An Upstash outage falls back to the
 * in-memory limit instead of either blocking or waving everyone through.
 */
export async function consumeSharedRateLimit(
  key: string,
  policy: RateLimitPolicy,
  environment: Environment = process.env,
): Promise<RateLimitDecision> {
  const configuration = parseUpstashRateLimitConfiguration(environment);
  if (policy.configured && configuration.configured) {
    try {
      return await consumeUpstashRateLimit(
        createUpstashRateLimitClient(policy, configuration),
        key,
      );
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "shared_rate_limit_error",
          message: error instanceof Error ? error.message : "unknown error",
        }),
      );
    }
  }
  return consumeRateLimit(key, policy);
}
