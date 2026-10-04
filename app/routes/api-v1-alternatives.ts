/**
 * GET /api/v1/alternatives?name=Rolex+Submariner&mode=exact&amount=2000
 *   &currency=USD&quartz=no — watches that look and work like a named one,
 * within a budget, new or pre-owned. Same parameters as the
 * /watches/alternatives page. Add Accept: text/event-stream for live steps.
 */
import type { Route } from "./+types/api-v1-alternatives";
import {
  ALTERNATIVES_SEARCH_POLICY,
  readAlternativesForm,
  startAlternativesSearch,
} from "../domain/alternatives-search.server";
import {
  apiError,
  apiJson,
  apiPreflight,
  apiRateLimit,
  apiStream,
  authenticateApiRequest,
  wantsStream,
} from "../domain/partner-api.server";

export async function loader({ request }: Route.LoaderArgs) {
  if (request.method === "OPTIONS") return apiPreflight(request);
  const caller = await authenticateApiRequest(request);
  if (caller instanceof Response) return caller;
  const { origin } = caller;

  const form = readAlternativesForm(new URL(request.url).searchParams);
  const search = await startAlternativesSearch(form, {
    ...apiRateLimit(
      caller,
      "alternatives",
      request,
      ALTERNATIVES_SEARCH_POLICY,
    ),
    site: caller.site,
  });
  switch (search.kind) {
    case "idle":
      return apiError(
        400,
        "invalid_request",
        "Send name (or ref), a budget (mode=exact&amount=… or mode=range&range=…), currency and quartz=yes|no.",
        origin,
      );
    case "error":
      return apiError(
        {
          invalid_request: 400,
          monthly_limit: 429,
          rate_limited: 429,
          unavailable: 503,
        }[search.code],
        search.code,
        search.error,
        origin,
      );
    case "options":
      // Several watches share the name: ask again with one of these.
      return apiJson(
        { result: { status: "ambiguous", options: search.options } },
        200,
        origin,
      );
    case "search":
      if (wantsStream(request)) {
        return apiStream(search.progress, search.page, origin);
      }
      return apiJson(await search.page, 200, origin);
  }
}
