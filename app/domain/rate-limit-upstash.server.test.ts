import { vi } from "vitest";

import {
  consumeUpstashRateLimit,
  parseUpstashRateLimitConfiguration,
} from "./rate-limit-upstash.server";

describe("Upstash rate-limit adapter", () => {
  it("requires both Redis REST credentials and HTTPS", () => {
    expect(parseUpstashRateLimitConfiguration({})).toEqual({
      configured: false,
      reason: "missing",
    });
    expect(
      parseUpstashRateLimitConfiguration({
        UPSTASH_REDIS_REST_URL: "https://redis.example",
      }),
    ).toEqual({ configured: false, reason: "invalid" });
    expect(
      parseUpstashRateLimitConfiguration({
        UPSTASH_REDIS_REST_URL: "http://redis.example",
        UPSTASH_REDIS_REST_TOKEN: "token",
      }),
    ).toEqual({ configured: false, reason: "invalid" });
    expect(
      parseUpstashRateLimitConfiguration({
        UPSTASH_REDIS_REST_URL: "https://redis.example",
        UPSTASH_REDIS_REST_TOKEN: "token",
      }),
    ).toEqual({
      configured: true,
      url: "https://redis.example",
      token: "token",
    });
  });

  it("maps a distributed denial to the shared decision contract", async () => {
    const client = {
      limit: vi.fn().mockResolvedValue({
        success: false,
        limit: 2,
        remaining: 0,
        reset: Date.now() + 30_000,
      }),
    };

    await expect(
      consumeUpstashRateLimit(client, "quiz:ip:one"),
    ).resolves.toMatchObject({
      allowed: false,
      limit: 2,
      remaining: 0,
      retryAfterSeconds: 30,
    });
    expect(client.limit).toHaveBeenCalledWith("quiz:ip:one");
  });

  it("does not turn an Upstash timeout into an allowed request", async () => {
    const client = {
      limit: vi.fn().mockResolvedValue({
        success: true,
        limit: 0,
        remaining: 0,
        reset: 0,
        reason: "timeout",
      }),
    };

    await expect(
      consumeUpstashRateLimit(client, "quiz:ip:one"),
    ).rejects.toThrow("timed out");
  });
});
