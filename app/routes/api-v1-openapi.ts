/** GET /api/v1/openapi.json — the partner API description (no key needed). */
import type { Route } from "./+types/api-v1-openapi";
import { partnerOpenApi } from "../domain/partner-openapi";

export function loader({ request }: Route.LoaderArgs) {
  const origin = process.env.APP_URL?.trim() || new URL(request.url).origin;
  return new Response(JSON.stringify(partnerOpenApi(origin), null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      // A public document: any website may read it.
      "Access-Control-Allow-Origin": "*",
    },
  });
}
