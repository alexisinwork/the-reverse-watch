import { data } from "react-router";

import type { Route } from "./+types/quiz-analytics-start";
import { persistFunnelEvent } from "../domain/funnel-store.server";
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

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return data({ ok: false }, { status: 405 });
  }
  if (!isSameOrigin(request)) return data({ ok: false }, { status: 403 });
  if (
    !(
      await consumeSharedRateLimit(
        visitorKey("analytics", request),
        ANALYTICS_POLICY,
      )
    ).allowed
  ) {
    return data({ ok: false }, { status: 429 });
  }

  try {
    await persistFunnelEvent({ name: "start" });
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "quiz_funnel_persistence_error",
        message: error instanceof Error ? error.message : "unknown error",
      }),
    );
    return data({ ok: false }, { status: 503 });
  }
}
