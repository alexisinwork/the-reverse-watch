import { createHash } from "node:crypto";

import { Redis } from "@upstash/redis";

import type { UpstashRateLimitConfiguration } from "./rate-limit-upstash.server";

export const EMAIL_DELIVERY_DEDUPLICATION_TTL_SECONDS = 15 * 60;

export type EmailDeliveryChannel = "newsletter" | "dossier";

export type EmailDeliveryDeduplicationClient = {
  claim: (key: string) => Promise<boolean>;
  release: (key: string) => Promise<void>;
};

function redisKey(key: string) {
  return `the-reserve:quiz:email-delivery:${key}`;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, canonicalize(nestedValue)]),
    );
  }
  return value;
}

export function createEmailDeliveryDeduplicationClient(
  configuration: Extract<UpstashRateLimitConfiguration, { configured: true }>,
): EmailDeliveryDeduplicationClient {
  const redis = new Redis({
    url: configuration.url,
    token: configuration.token,
  });

  return {
    async claim(key) {
      const result = await redis.set(redisKey(key), "1", {
        nx: true,
        ex: EMAIL_DELIVERY_DEDUPLICATION_TTL_SECONDS,
      });
      return result === "OK";
    },
    async release(key) {
      await redis.del(redisKey(key));
    },
  };
}

export function emailDeliveryDeduplicationKey({
  channel,
  email,
  intent,
  profile,
}: {
  channel: EmailDeliveryChannel;
  email: string;
  intent: "core" | "refine";
  profile: unknown;
}) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        channel,
        email,
        intent,
        profile: canonicalize(profile),
      }),
    )
    .digest("hex");
}
