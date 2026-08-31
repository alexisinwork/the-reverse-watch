import { contentSecurityPolicy, requestMiddleware } from "./middleware.server";

describe("request middleware", () => {
  it("adds security, request identity, and timing headers to the real response", async () => {
    const request = new Request("https://example.test/quiz?secret=redacted", {
      method: "POST",
    });
    const response = (await requestMiddleware(
      {
        request,
        context: undefined as never,
        url: new URL(request.url),
        pattern: "/",
        params: {},
      },
      () => Promise.resolve(new Response("ok", { status: 200 })),
    )) as Response;

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(response.headers.get("Permissions-Policy")).toBe(
      "camera=(), geolocation=(), microphone=()",
    );
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "frame-src https://subscribe-forms.beehiiv.com",
    );
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "https://challenges.cloudflare.com",
    );
    expect(response.headers.get("X-Request-ID")).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers.get("Server-Timing")).toMatch(
      /^app;dur=\d+(\.\d+)?$/,
    );
  });

  it("allows only the configured HTTPS Sentry envelope origin", () => {
    expect(
      contentSecurityPolicy("https://public@example.ingest.sentry.io/123456"),
    ).toContain(
      "connect-src 'self' https://subscribe-forms.beehiiv.com https://challenges.cloudflare.com https://example.ingest.sentry.io",
    );
    expect(contentSecurityPolicy("not-a-dsn")).not.toContain("not-a-dsn");
    expect(contentSecurityPolicy("http://example.test/123")).not.toContain(
      "http://example.test",
    );
  });
});
