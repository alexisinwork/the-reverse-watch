import {
  clearRateLimitBuckets,
  consumeRateLimit,
  parseRateLimitPolicy,
} from "./rate-limit.server";

describe("rate-limit policy", () => {
  afterEach(() => clearRateLimitBuckets());

  it("requires both measured policy values and rejects partial configuration", () => {
    expect(parseRateLimitPolicy({})).toEqual({
      configured: false,
      reason: "missing",
    });
    expect(
      parseRateLimitPolicy({ QUIZ_RATE_LIMIT_MAX_REQUESTS: "10" }),
    ).toEqual({ configured: false, reason: "invalid" });
    expect(
      parseRateLimitPolicy({
        QUIZ_RATE_LIMIT_MAX_REQUESTS: "10",
        QUIZ_RATE_LIMIT_WINDOW_SECONDS: "60",
      }),
    ).toEqual({ configured: true, maxRequests: 10, windowMs: 60_000 });
    expect(
      parseRateLimitPolicy({
        QUIZ_RATE_LIMIT_MAX_REQUESTS: "10",
        QUIZ_RATE_LIMIT_WINDOW_SECONDS: String(Number.MAX_SAFE_INTEGER),
      }),
    ).toEqual({ configured: false, reason: "invalid" });
  });

  it("enforces a configured window and exposes reset metadata", () => {
    const policy = parseRateLimitPolicy({
      QUIZ_RATE_LIMIT_MAX_REQUESTS: "2",
      QUIZ_RATE_LIMIT_WINDOW_SECONDS: "60",
    });
    const first = consumeRateLimit("ip:one", policy, 1_000);
    const second = consumeRateLimit("ip:one", policy, 2_000);
    const third = consumeRateLimit("ip:one", policy, 3_000);

    expect(first).toMatchObject({
      allowed: true,
      limit: 2,
      remaining: 1,
      resetAt: 61_000,
      retryAfterSeconds: null,
    });
    expect(second.remaining).toBe(0);
    expect(third).toMatchObject({
      allowed: false,
      limit: 2,
      remaining: 0,
      resetAt: 61_000,
      retryAfterSeconds: 58,
    });
    expect(consumeRateLimit("ip:one", policy, 61_000).allowed).toBe(true);
  });

  it("does not pretend an unconfigured policy is enforced", () => {
    const decision = consumeRateLimit("ip:one", {
      configured: false,
      reason: "missing",
    });
    expect(decision).toEqual({
      allowed: true,
      limit: null,
      remaining: null,
      resetAt: null,
      retryAfterSeconds: null,
    });
  });
});
