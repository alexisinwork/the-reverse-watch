import { vi } from "vitest";

const redisMock = vi.hoisted(() => ({
  del: vi.fn(),
  set: vi.fn(),
}));

vi.mock("@upstash/redis", () => ({
  Redis: class MockRedis {
    del = redisMock.del;
    set = redisMock.set;
  },
}));

import {
  EMAIL_DELIVERY_DEDUPLICATION_TTL_SECONDS,
  createEmailDeliveryDeduplicationClient,
  emailDeliveryDeduplicationKey,
} from "./email-deduplication.server";

describe("email delivery deduplication", () => {
  it("creates a stable opaque key per channel and request", () => {
    const input = {
      channel: "newsletter" as const,
      email: "reader@example.com",
      intent: "core" as const,
      profile: { core: { budgetMax: 10_000, wristCircumferenceMm: 170 } },
    };
    const key = emailDeliveryDeduplicationKey(input);

    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(key).not.toContain(input.email);
    expect(emailDeliveryDeduplicationKey(input)).toBe(key);
    expect(
      emailDeliveryDeduplicationKey({
        ...input,
        profile: {
          core: { wristCircumferenceMm: 170, budgetMax: 10_000 },
        },
      }),
    ).toBe(key);
    expect(
      emailDeliveryDeduplicationKey({ ...input, channel: "dossier" }),
    ).not.toBe(key);
    expect(EMAIL_DELIVERY_DEDUPLICATION_TTL_SECONDS).toBe(900);
  });

  it("uses an atomic expiring claim and can release a failed claim", async () => {
    redisMock.set.mockResolvedValueOnce("OK").mockResolvedValueOnce(null);
    const client = createEmailDeliveryDeduplicationClient({
      configured: true,
      token: "token",
      url: "https://redis.example",
    });

    await expect(client.claim("request-key")).resolves.toBe(true);
    await expect(client.claim("request-key")).resolves.toBe(false);
    await client.release("request-key");

    expect(redisMock.set).toHaveBeenCalledWith(
      "the-reserve:quiz:email-delivery:request-key",
      "1",
      { ex: 900, nx: true },
    );
    expect(redisMock.del).toHaveBeenCalledWith(
      "the-reserve:quiz:email-delivery:request-key",
    );
  });
});
