/**
 * GET /api/v1/find?type=actor&q=Daniel+Craig — watches seen in a film,
 * series, or on an actor, character or public figure, each with its
 * source. Add Accept: text/event-stream (or &stream=1) for live steps.
 */
import type { Route } from "./+types/api-v1-find";
import {
  FILM_NEW_SEARCH_POLICY,
  readFilmQuery,
  runFilmSearch,
} from "../domain/film-search-run.server";
import {
  FILM_SUBJECT_KINDS,
  parseFilmSubjectKind,
} from "../domain/film-subject";
import {
  apiError,
  apiJson,
  apiPreflight,
  apiRateLimit,
  apiStream,
  authenticateApiRequest,
  wantsStream,
} from "../domain/partner-api.server";
import { createProgressFeed } from "../domain/progress-feed";

export async function loader({ request }: Route.LoaderArgs) {
  if (request.method === "OPTIONS") return apiPreflight(request);
  const caller = await authenticateApiRequest(request);
  if (caller instanceof Response) return caller;
  const { origin } = caller;

  const params = new URL(request.url).searchParams;
  const query = readFilmQuery(params.get("q"));
  const kind = parseFilmSubjectKind(params.get("type"));
  if (query.length < 2 || !kind) {
    return apiError(
      400,
      "invalid_request",
      `Send q (at least 2 characters) and type (${FILM_SUBJECT_KINDS.join(", ")}).`,
      origin,
    );
  }

  const progress = createProgressFeed();
  const search = runFilmSearch({
    query,
    kind,
    ...apiRateLimit(caller, "find", request, FILM_NEW_SEARCH_POLICY),
    site: caller.site,
    report: progress.report,
  });
  void search.finally(progress.close);
  if (wantsStream(request)) {
    return apiStream(progress.feed, search, origin, (result) => ({ result }));
  }
  progress.close();
  return apiJson({ result: await search }, 200, origin);
}
