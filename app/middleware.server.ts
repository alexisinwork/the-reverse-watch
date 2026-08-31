import type { MiddlewareFunction } from "react-router";

import { sentryEnvelopeOrigin } from "./domain/sentry-config";

declare const __SENTRY_ENVELOPE_ORIGIN__: string | null;

const buildTimeSentryEnvelopeOrigin =
  typeof __SENTRY_ENVELOPE_ORIGIN__ === "undefined"
    ? null
    : __SENTRY_ENVELOPE_ORIGIN__;

export function contentSecurityPolicy(
  sentryDsn = process.env.SENTRY_DSN,
  builtSentryOrigin = buildTimeSentryEnvelopeOrigin,
) {
  const connectSources = [
    "'self'",
    "https://subscribe-forms.beehiiv.com",
    "https://challenges.cloudflare.com",
  ];
  const sentryOrigin =
    sentryEnvelopeOrigin(sentryDsn) ??
    sentryEnvelopeOrigin(builtSentryOrigin ?? undefined);
  if (sentryOrigin) connectSources.push(sentryOrigin);

  return [
    "default-src 'self'",
    "frame-src https://subscribe-forms.beehiiv.com https://challenges.cloudflare.com",
    "script-src 'self' 'unsafe-inline' https://subscribe-forms.beehiiv.com https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' data: https://subscribe-forms.beehiiv.com https://challenges.cloudflare.com",
    `connect-src ${connectSources.join(" ")}`,
  ].join("; ");
}

function securityHeaders() {
  return {
    "Content-Security-Policy": contentSecurityPolicy(),
    "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}

function requestPath(request: Request) {
  try {
    return new URL(request.url).pathname;
  } catch {
    return "<invalid-url>";
  }
}

export const requestMiddleware: MiddlewareFunction<Response> = async (
  { request },
  next,
) => {
  const requestId = crypto.randomUUID();
  const startedAt = performance.now();
  const response = await next();
  const durationMs = Number((performance.now() - startedAt).toFixed(2));

  for (const [name, value] of Object.entries(securityHeaders())) {
    response.headers.set(name, value);
  }
  response.headers.set("Server-Timing", `app;dur=${durationMs}`);
  response.headers.set("X-Request-ID", requestId);

  console.info(
    JSON.stringify({
      event: "http_request",
      method: request.method,
      path: requestPath(request),
      requestId,
      status: response.status,
      durationMs,
    }),
  );

  return response;
};
