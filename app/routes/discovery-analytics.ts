import { discoveryAnalyticsEventSchema } from "../domain/discovery-analytics";
import { persistDiscoveryFunnelEvent } from "../domain/discovery-funnel-store.server";
import type { RateLimitPolicy } from "../domain/rate-limit.server";
import { consumeSharedRateLimit } from "../domain/rate-limit-upstash.server";
import { isSameOrigin, visitorKey } from "../domain/visitor-key.server";

// Anonymous counters: accept only this site's own pages, and a sensible
// number per visitor, so nobody can flood the table or skew the numbers.
const ANALYTICS_POLICY: RateLimitPolicy = {
  configured: true,
  maxRequests: 60,
  windowMs: 10 * 60 * 1_000,
};

function errorResponse(status: number) {
  return Response.json({ ok: false }, { status });
}

export function loader() {
  return errorResponse(405);
}

export async function action({ request }: { request: Request }) {
  if (request.method !== "POST") {
    return errorResponse(405);
  }
  if (!isSameOrigin(request)) return errorResponse(403);
  if (
    !(
      await consumeSharedRateLimit(
        visitorKey("analytics", request),
        ANALYTICS_POLICY,
      )
    ).allowed
  ) {
    return errorResponse(429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400);
  }
  const parsed = discoveryAnalyticsEventSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400);

  try {
    await persistDiscoveryFunnelEvent(parsed.data);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "discovery_funnel_persistence_error",
        message: error instanceof Error ? error.message : "unknown error",
      }),
    );
    return errorResponse(503);
  }
}
