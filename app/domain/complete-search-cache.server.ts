import type { AiSearchView } from "./ai-watch-types";
import {
  aiSearchCacheKey,
  storeSearch,
  type AiSearchKind,
} from "./ai-watch-store.server";
import { SEARCH_RESULT_TARGET, coverSearchResults } from "./search-coverage";
import {
  catalogueClient,
  type CatalogueClient,
} from "./watch-catalogue.server";

export const completeSearchInput = (constraints: unknown) => ({
  constraints,
  completeResponsePolicy: 1,
});

/** Completed response cache only. Partial source checks/drafts remain research
 * evidence, never a complete ten-option answer or a reason to stop searching.
 * Film and people search stores a finished answer: a short list of
 * confirmed sightings is complete (owner decision, 2026-11-25). An answer of
 * possible sightings only is not finished: it stays out of this cache, so a
 * later search checks it again once the backoff allows. */
export async function cacheCompleteSearch(
  kind: AiSearchKind,
  constraints: unknown,
  view: AiSearchView,
  client: CatalogueClient | null = catalogueClient(),
  minimumCards = SEARCH_RESULT_TARGET,
) {
  const result = coverSearchResults(view, [], minimumCards);
  if (
    !client ||
    result.status !== "found" ||
    (result.coverage?.total ?? 0) < minimumCards ||
    (kind === "film" &&
      !result.watches.some(
        (watch) => watch.details.verificationStatus !== "unverified",
      ))
  )
    return result;
  const input = completeSearchInput(constraints);
  try {
    await storeSearch(
      client.config,
      {
        kind,
        cacheKey: aiSearchCacheKey(kind, input),
        cacheInput: input,
        summary: result.summary,
        watches: [...result.watches, ...(result.alsoWorth ?? [])],
      },
      client.fetchImpl,
    );
  } catch {
    // A cache outage never discards an otherwise useful completed answer.
  }
  return result;
}
