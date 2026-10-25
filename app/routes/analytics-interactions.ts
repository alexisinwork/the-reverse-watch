import { interactionEventSchema } from "../domain/interaction-analytics";
import { catalogueClient, rpc } from "../domain/watch-catalogue.server";
import { findSiteByPublicKey } from "../domain/partner-sites.server";
import { isSameOrigin, visitorKey } from "../domain/visitor-key.server";
import { consumeSharedRateLimit } from "../domain/rate-limit-upstash.server";
import type { RateLimitPolicy } from "../domain/rate-limit.server";
const policy: RateLimitPolicy = {
  configured: true,
  maxRequests: 300,
  windowMs: 10 * 60 * 1000,
};
export function loader() {
  return new Response(null, { status: 405 });
}
export async function action({ request }: { request: Request }) {
  if (request.method !== "POST") return new Response(null, { status: 405 });
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  if (
    !(
      await consumeSharedRateLimit(
        visitorKey("interaction-analytics", request),
        policy,
      )
    ).allowed
  )
    return new Response(null, { status: 429 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = interactionEventSchema.safeParse(body);
  if (!parsed.success) return new Response(null, { status: 400 });
  const client = catalogueClient();
  if (!client) return new Response(null, { status: 503 });
  const { siteKey, ...event } = parsed.data;
  if (siteKey && !(await findSiteByPublicKey(siteKey, client)))
    return new Response(null, { status: 403 });
  try {
    await rpc(
      client,
      "record_partner_interaction_v1",
      {
        p_session_id: event.sessionId,
        p_site_key: siteKey ?? null,
        p_event_name: event.name,
        p_feature: event.feature,
        p_page_path: event.page,
        p_control: event.control ?? null,
        p_target: event.target ?? null,
        p_traffic_source: event.source ?? null,
        p_campaign: event.campaign ?? null,
        p_helpful: event.helpful ?? null,
      },
      2000,
    );
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "interaction_analytics_write_failed",
        message: error instanceof Error ? error.message : "unknown",
      }),
    );
    return new Response(null, { status: 503 });
  }
}
