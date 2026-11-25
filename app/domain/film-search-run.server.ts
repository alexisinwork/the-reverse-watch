/**
 * One film, series or people search as /watches/find, its partner widget
 * and the public API run it: stored answers first, a fresh live search
 * within the visitor's limit, and catalogue photos for sightings without
 * one. The search itself is film-search.server.ts.
 */
import { searchWithCoverage } from "./coverage-search.server";
import type { AiSearchView, ProgressEvent } from "./ai-watch-types";
import { mergeSightings } from "./film-sightings";
import { normalizeFilmQuery } from "./film-search.server";
import { meteredSearchOptions } from "./validation-runtime.server";
import { FILM_QUERY_MAX, type FilmSubjectKind } from "./film-subject";
import { meterPartnerUse } from "./partner-embed.server";
import type { PartnerSite } from "./partner-sites.server";
import type { RateLimitPolicy } from "./rate-limit.server";
import { consumeSharedRateLimit } from "./rate-limit-upstash.server";
import { fillPhotosFromCatalogue } from "./watch-catalogue.server";
import { enrichResultWatches } from "./catalogue-result-enrichment.server";
import { uniqueSearchView } from "./watch-result-dedup";
import { coverSearchResults } from "./search-coverage";

// Stored answers are free; only fresh searches spend provider credit.
export const FILM_NEW_SEARCH_POLICY: RateLimitPolicy = {
  configured: true,
  maxRequests: 12,
  windowMs: 10 * 60 * 1_000,
};

export function readFilmQuery(value: string | null) {
  return (value ?? "").trim().replace(/\s+/g, " ").slice(0, FILM_QUERY_MAX);
}

export async function runFilmSearch({
  query,
  kind,
  rateKey,
  policy = FILM_NEW_SEARCH_POLICY,
  site = null,
  report,
}: {
  query: string;
  kind: FilmSubjectKind;
  rateKey: string;
  policy?: RateLimitPolicy;
  /** A partner site: each search is counted, within its monthly limit. */
  site?: PartnerSite | null;
  report?: (event: ProgressEvent) => void;
}): Promise<AiSearchView> {
  const limitMessage = await meterPartnerUse(site, "find");
  if (limitMessage) return { status: "no_match", summary: limitMessage };
  const view = await searchWithCoverage(
    {
      kind: "film",
      cacheInput: { query: normalizeFilmQuery(query), kind },
    },
    meteredSearchOptions({
      allowPaid: async () =>
        (await consumeSharedRateLimit(rateKey, policy)).allowed,
      report,
    }),
  );
  // Sightings without a photo borrow the catalogue's photo of that watch.
  if (view.status !== "found") return view;
  const covered = coverSearchResults(
    uniqueSearchView({
      ...view,
      watches: mergeSightings(
        await enrichResultWatches(await fillPhotosFromCatalogue(view.watches)),
      ),
    }),
  );
  return covered.status === "found"
    ? { ...covered, summary: filmSummary(covered.watches) }
    : covered;
}

/** Confirmed sightings lead; possible ones are counted separately, so the
 * summary never presents a lead as a fact (owner decision, 2026-11-25). */
export function filmSummary(
  watches: readonly { details: { verificationStatus?: string } }[],
) {
  const possible = watches.filter(
    (watch) => watch.details.verificationStatus === "unverified",
  ).length;
  const confirmed = watches.length - possible;
  const lead =
    confirmed > 0
      ? `${confirmed} confirmed ${confirmed === 1 ? "sighting" : "sightings"}, each with its sources.`
      : "No sighting is confirmed yet.";
  const rest =
    possible > 0
      ? ` ${possible} possible ${possible === 1 ? "sighting is" : "sightings are"} listed separately and still ${possible === 1 ? "needs" : "need"} checking.`
      : "";
  return lead + rest;
}
