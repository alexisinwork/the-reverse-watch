import type { MiddlewareFunction } from "react-router";

const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "default-src 'self'; frame-src https://subscribe-forms.beehiiv.com https://challenges.cloudflare.com; script-src 'self' 'unsafe-inline' https://subscribe-forms.beehiiv.com https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https://subscribe-forms.beehiiv.com https://challenges.cloudflare.com; connect-src 'self' https://subscribe-forms.beehiiv.com https://challenges.cloudflare.com",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

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

  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
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
