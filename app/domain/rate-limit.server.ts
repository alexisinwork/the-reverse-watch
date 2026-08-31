export type RateLimitPolicy =
  | {
      configured: true;
      maxRequests: number;
      windowMs: number;
    }
  | { configured: false; reason: "missing" | "invalid" };

export type RateLimitDecision = {
  allowed: boolean;
  limit: number | null;
  remaining: number | null;
  resetAt: number | null;
  retryAfterSeconds: number | null;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function positiveInteger(value: string | undefined) {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseRateLimitPolicy(
  environment: Record<string, string | undefined> = process.env,
): RateLimitPolicy {
  const maxRequests = positiveInteger(environment.QUIZ_RATE_LIMIT_MAX_REQUESTS);
  const windowSeconds = positiveInteger(
    environment.QUIZ_RATE_LIMIT_WINDOW_SECONDS,
  );
  if (maxRequests === null && windowSeconds === null) {
    return { configured: false, reason: "missing" };
  }
  if (maxRequests === null || windowSeconds === null) {
    return { configured: false, reason: "invalid" };
  }
  const windowMs = windowSeconds * 1_000;
  if (!Number.isSafeInteger(windowMs)) {
    return { configured: false, reason: "invalid" };
  }
  return {
    configured: true,
    maxRequests,
    windowMs,
  };
}

export function consumeRateLimit(
  key: string,
  policy: RateLimitPolicy,
  now = Date.now(),
): RateLimitDecision {
  if (!policy.configured) {
    return {
      allowed: true,
      limit: null,
      remaining: null,
      resetAt: null,
      retryAfterSeconds: null,
    };
  }

  const current = buckets.get(key);
  const bucket =
    current && current.resetAt > now
      ? current
      : { count: 0, resetAt: now + policy.windowMs };
  bucket.count += 1;
  buckets.set(key, bucket);
  const allowed = bucket.count <= policy.maxRequests;
  const remaining = Math.max(policy.maxRequests - bucket.count, 0);
  return {
    allowed,
    limit: policy.maxRequests,
    remaining,
    resetAt: bucket.resetAt,
    retryAfterSeconds: allowed
      ? null
      : Math.max(Math.ceil((bucket.resetAt - now) / 1_000), 1),
  };
}

export function clearRateLimitBuckets() {
  buckets.clear();
}
