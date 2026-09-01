import { discoveryAnalyticsEventSchema } from "../domain/discovery-analytics";
import { persistDiscoveryFunnelEvent } from "../domain/discovery-funnel-store.server";

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
