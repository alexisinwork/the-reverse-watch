/** GET /api/v1/openapi.json — the partner API description (no key needed). */
import type { Route } from "./+types/api-v1-openapi";
import { partnerOpenApi } from "../domain/partner-openapi";
import { publicOrigin } from "../domain/public-origin";

export function loader({ request }: Route.LoaderArgs) {
  const origin = publicOrigin(request);
  return new Response(JSON.stringify(partnerOpenApi(origin), null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      // A public document: any website may read it.
      "Access-Control-Allow-Origin": "*",
    },
  });
}
