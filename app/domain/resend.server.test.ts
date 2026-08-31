import { vi } from "vitest";

import {
  parseResendConfiguration,
  sendDossierWithResend,
} from "./resend.server";
import { EMAIL_PROVIDER_TIMEOUT_MS } from "./email-provider.server";

const dossier = {
  subject: "Subject",
  html: "<p>HTML</p>",
  text: "TEXT",
};

describe("Resend dossier adapter", () => {
  it("requires the API key and sender together", () => {
    expect(parseResendConfiguration({})).toEqual({
      configured: false,
      reason: "missing",
    });
    expect(parseResendConfiguration({ RESEND_API_KEY: "key" })).toEqual({
      configured: false,
      reason: "invalid",
    });
    expect(
      parseResendConfiguration({
        RESEND_API_KEY: " key ",
        EMAIL_FROM: " The Reserve <hello@example.com> ",
      }),
    ).toEqual({
      configured: true,
      apiKey: "key",
      emailFrom: "The Reserve <hello@example.com>",
    });
  });

  it("posts the deterministic dossier without exposing credentials", async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "email_123" }), { status: 200 }),
      );

    await expect(
      sendDossierWithResend(
        "reader@example.com",
        dossier,
        {
          configured: true,
          apiKey: "secret-key",
          emailFrom: "The Reserve <hello@example.com>",
        },
        fetchImplementation,
      ),
    ).resolves.toBeUndefined();

    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer secret-key",
          "Content-Type": "application/json",
          "User-Agent": "the-reserve-diagnostic",
        },
      }),
    );
    const [, requestInit] = fetchImplementation.mock.calls[0] as [
      RequestInfo | URL,
      RequestInit,
    ];
    expect(requestInit.signal).toBeInstanceOf(AbortSignal);
    expect(EMAIL_PROVIDER_TIMEOUT_MS).toBe(10_000);
    expect(JSON.parse(requestInit.body as string)).toEqual({
      from: "The Reserve <hello@example.com>",
      to: ["reader@example.com"],
      subject: "Subject",
      html: "<p>HTML</p>",
      text: "TEXT",
    });
  });

  it("surfaces a non-success provider response", async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 422 }));

    await expect(
      sendDossierWithResend(
        "reader@example.com",
        dossier,
        { configured: true, apiKey: "key", emailFrom: "hello@example.com" },
        fetchImplementation,
      ),
    ).rejects.toThrow("HTTP 422");
  });
});
