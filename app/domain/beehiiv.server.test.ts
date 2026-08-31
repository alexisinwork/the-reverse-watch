import { vi } from "vitest";

import {
  parseBeehiivConfiguration,
  subscribeToBeehiiv,
} from "./beehiiv.server";
import { EMAIL_PROVIDER_TIMEOUT_MS } from "./email-provider.server";

describe("Beehiiv subscription adapter", () => {
  it("requires the API key and publication ID together", () => {
    expect(parseBeehiivConfiguration({})).toEqual({
      configured: false,
      reason: "missing",
    });
    expect(parseBeehiivConfiguration({ BEEHIIV_API_KEY: "key" })).toEqual({
      configured: false,
      reason: "invalid",
    });
    expect(
      parseBeehiivConfiguration({
        BEEHIIV_API_KEY: " key ",
        BEEHIIV_PUBLICATION_ID: " pub_123 ",
      }),
    ).toEqual({
      configured: true,
      apiKey: "key",
      publicationId: "pub_123",
    });
  });

  it("sends an explicitly requested subscription without exposing credentials", async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 201 }));

    await expect(
      subscribeToBeehiiv(
        "collector@example.com",
        {
          configured: true,
          apiKey: "secret-key",
          publicationId: "pub/123",
        },
        fetchImplementation,
      ),
    ).resolves.toBeUndefined();

    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://api.beehiiv.com/v2/publications/pub%2F123/subscriptions",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer secret-key",
          "Content-Type": "application/json",
        },
      }),
    );
    const [, requestInit] = fetchImplementation.mock.calls[0] as [
      RequestInfo | URL,
      RequestInit,
    ];
    if (typeof requestInit.body !== "string") {
      throw new Error("Expected a JSON request body");
    }
    expect(requestInit.signal).toBeInstanceOf(AbortSignal);
    expect(EMAIL_PROVIDER_TIMEOUT_MS).toBe(10_000);
    expect(JSON.parse(requestInit.body)).toEqual({
      email: "collector@example.com",
      send_welcome_email: true,
      utm_source: "the_reserve_diagnostic",
    });
  });

  it("surfaces a non-success provider response", async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 429 }));

    await expect(
      subscribeToBeehiiv(
        "collector@example.com",
        { configured: true, apiKey: "key", publicationId: "pub_123" },
        fetchImplementation,
      ),
    ).rejects.toThrow("HTTP 429");
  });
});
