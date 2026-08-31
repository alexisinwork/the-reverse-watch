import { describe, expect, it } from "vitest";

import {
  sentryEnvelopeOrigin,
  sentrySourceMapConfiguration,
} from "./sentry-config";

describe("Sentry configuration", () => {
  it("keeps source-map upload disabled when no build credentials exist", () => {
    expect(sentrySourceMapConfiguration({})).toBeNull();
  });

  it("requires a complete source-map upload configuration", () => {
    expect(() =>
      sentrySourceMapConfiguration({ SENTRY_AUTH_TOKEN: "configured" }),
    ).toThrow(
      "Sentry source-map upload is partially configured; missing SENTRY_ORG, SENTRY_PROJECT.",
    );
  });

  it("returns trimmed source-map upload configuration", () => {
    expect(
      sentrySourceMapConfiguration({
        SENTRY_AUTH_TOKEN: " token ",
        SENTRY_ORG: " reserve ",
        SENTRY_PROJECT: " web ",
      }),
    ).toEqual({ authToken: "token", org: "reserve", project: "web" });
  });

  it("derives only an HTTPS envelope origin from a DSN", () => {
    expect(
      sentryEnvelopeOrigin("https://public@example.ingest.sentry.io/123456"),
    ).toBe("https://example.ingest.sentry.io");
    expect(sentryEnvelopeOrigin("http://example.test/123")).toBeNull();
    expect(sentryEnvelopeOrigin("not-a-dsn")).toBeNull();
  });
});
