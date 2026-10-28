/**
 * Quiz answers are filtered from the catalogue in code, so they are
 * instant. Above 10k, or where the catalogue has fewer than three
 * confirmed fits, the stored or live search can supplement them only after
 * the current catalogue facts satisfy the same constraints.
 */
import { quizCacheInput, searchQuizWatches } from "./quiz-live-search.server";
import { normalizeReference } from "./ai-watch-guardrails";
import { searchWithStore } from "./ai-watch-store.server";
import { uniqueSearchView } from "./watch-result-dedup";
import type { AiSearchView, FoundWatch, ProgressEvent } from "./ai-watch-types";
import { loadFxTable, type FxTable } from "./fx.server";
import { findPriceRange, type ProfileV4 } from "./questionnaire-v4";
import {
  catalogueCoversRange,
  catalogueIdentityKey,
  catalogueRuleFailures,
  catalogueToFoundWatch,
  matchCatalogue,
  MISS_LABELS,
  nearFits,
  QUIZ_RESULT_LIMIT,
  type CatalogueWatch,
} from "./watch-catalogue";
import {
  catalogueClient,
  loadCatalogueCached,
  type CatalogueClient,
} from "./watch-catalogue.server";

/** Fewer confirmed catalogue fits than this and the live search fills in. */
export const CATALOGUE_ENOUGH = 3;

function logError(event: string, error: unknown) {
  console.error(
    JSON.stringify({
      event,
      message: error instanceof Error ? error.message : "unknown error",
    }),
  );
}

function watchKey(watch: {
  brand: string;
  model: string;
  referenceCode: string | null;
}) {
  return catalogueIdentityKey(watch.brand, watch.model, watch.referenceCode);
}

/** Source-checked identity alone does not prove the watch meets a quiz.
 * Require one exact current catalogue record with all active facts. */
function qualifyingLiveWatches(
  watches: FoundWatch[],
  catalogue: CatalogueWatch[],
  profile: ProfileV4,
  fx: FxTable | null,
) {
  const fold = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return watches.flatMap((watch) => {
    const reference = normalizeReference(watch.referenceCode);
    const brand = fold(watch.brand);
    if (!reference || !brand) return [];
    const matches = catalogue.filter(
      (row) =>
        row.reviewStatus !== "rejected" &&
        fold(row.brand) === brand &&
        normalizeReference(row.referenceCode) === reference,
    );
    if (
      matches.length !== 1 ||
      !matches[0]!.referenceConfirmed ||
      catalogueRuleFailures(matches[0]!, profile, fx).length
    )
      return [];
    const found = catalogueToFoundWatch(matches[0]!);
    return found ? [found] : [];
  });
}

async function searchQuizBeforeDeduplication(
  profile: ProfileV4,
  {
    client = catalogueClient(),
    loadFx = () => loadFxTable(),
    report,
    runLive = () =>
      searchWithStore({
        kind: "quiz",
        cacheInput: quizCacheInput(profile),
        // Candidate previews have not passed the catalogue constraints yet.
        run: () =>
          searchQuizWatches(
            profile,
            report ? { report: (event) => report({ text: event.text }) } : {},
          ),
      }),
  }: {
    client?: CatalogueClient | null;
    loadFx?: () => Promise<FxTable | null>;
    /** Tells the visitor what the search is doing (optional). */
    report?: (event: ProgressEvent) => void;
    runLive?: () => Promise<AiSearchView>;
  } = {},
): Promise<AiSearchView> {
  report?.({ text: "Checking The Reserve's catalogue of confirmed watches…" });
  const range = findPriceRange(profile.priceRange)!;
  let catalogue: CatalogueWatch[] = [];
  let fx: FxTable | null = null;
  if (client) {
    try {
      [catalogue, fx] = await Promise.all([
        loadCatalogueCached(client),
        loadFx(),
      ]);
    } catch (error) {
      logError("catalogue_read_error", error);
    }
  }
  const matched = matchCatalogue(catalogue, profile, fx);
  const main = matched.main
    .map(catalogueToFoundWatch)
    .filter((watch): watch is FoundWatch => watch !== null);
  const alsoWorth = matched.alsoWorth
    .map(catalogueToFoundWatch)
    .filter((watch): watch is FoundWatch => watch !== null);

  // Free places on the shortlist go to watches in the visitor's price range
  // that miss a softer answer (such as water resistance), each marked
  // with what it misses (owner decision, 2026-09-30).
  const withNearFits = (watches: FoundWatch[]) => {
    const taken = new Set([...watches, ...alsoWorth].map(watchKey));
    const extra = nearFits(
      catalogue,
      profile,
      fx,
      QUIZ_RESULT_LIMIT - watches.length,
      taken,
    ).flatMap(({ watch, misses }) => {
      const found = catalogueToFoundWatch(watch);
      return found
        ? [
            {
              ...found,
              details: {
                ...found.details,
                misses: misses.map((miss) => MISS_LABELS[miss] ?? miss),
              },
            },
          ]
        : [];
    });
    return { watches: [...watches, ...extra], nearFitCount: extra.length };
  };
  const nearFitNote = (count: number) =>
    count > 0
      ? ` ${count} more ${count === 1 ? "is" : "are"} in your price range but ${count === 1 ? "misses" : "miss"} an answer, marked on the card.`
      : "";

  if (catalogueCoversRange(range) && main.length >= CATALOGUE_ENOUGH) {
    report?.({
      text: `Found ${main.length} catalogue watches that meet every answer.`,
    });
    const filled = withNearFits(main);
    return {
      status: "found",
      watches: filled.watches,
      alsoWorth,
      fromCache: true,
      origin: "catalogue",
      summary: `${main.length} watches from The Reserve's checked catalogue meet every answer, each with its reference confirmed on the manufacturer's or an authorised retailer's page.${nearFitNote(filled.nearFitCount)}`,
    };
  }

  report?.({
    text: !catalogueCoversRange(range)
      ? "Above 10k the catalogue is not complete yet, so we search live."
      : main.length > 0
        ? `The catalogue has ${main.length} confirmed ${main.length === 1 ? "fit" : "fits"}; searching live for more…`
        : "No catalogue watch fits every answer yet; searching live…",
  });
  const fetched = await runLive();
  const screened =
    fetched.status === "found"
      ? qualifyingLiveWatches(fetched.watches, catalogue, profile, fx)
      : [];
  const live: AiSearchView =
    fetched.status === "found"
      ? screened.length
        ? { ...fetched, watches: screened }
        : { status: "unavailable" }
      : fetched;
  if (live.status === "found" && live.fromCache) {
    report?.({
      text: "These answers were searched before: loading the saved result.",
    });
  }
  if (live.status !== "found") {
    // The live search found nothing or is down (for example both AI
    // providers failing): the catalogue still answers, never an empty page.
    const filled = withNearFits(main);
    if (filled.watches.length === 0 && alsoWorth.length === 0) return live;
    const lead =
      main.length > 0
        ? `${main.length} ${main.length === 1 ? "watch" : "watches"} from the checked catalogue meet every answer.`
        : alsoWorth.length > 0
          ? 'No watch with a confirmed reference meets every answer yet; those under "Also worth a look" do, but their reference is not confirmed.'
          : live.status === "unavailable"
            ? "Our live search is unavailable right now, so these are the closest watches in our catalogue."
            : "No watch we could find meets every answer. These are the closest in our catalogue.";
    return {
      status: "found",
      watches: filled.watches,
      alsoWorth,
      fromCache: true,
      origin: "catalogue",
      summary: `${lead}${nearFitNote(filled.nearFitCount)}`,
    };
  }

  const known = new Map(catalogue.map((watch) => [watch.identityKey, watch]));
  const seen = new Set(main.map(watchKey));
  const liveWatches = live.watches
    .filter((watch) => !seen.has(watchKey(watch)))
    .map((watch) => ({
      ...watch,
      details: {
        ...watch.details,
        reviewStatus:
          known.get(watchKey(watch))?.reviewStatus ?? ("pending" as const),
      },
    }));
  const filled = withNearFits(
    [...main, ...liveWatches].slice(0, QUIZ_RESULT_LIMIT),
  );
  if (!liveWatches.length && main.length) {
    return {
      status: "found",
      watches: filled.watches,
      alsoWorth,
      fromCache: true,
      origin: "catalogue",
      summary: `${main.length} ${main.length === 1 ? "watch" : "watches"} from the checked catalogue meet every answer.${nearFitNote(filled.nearFitCount)}`,
    };
  }
  return {
    status: "found",
    watches: filled.watches,
    alsoWorth,
    fromCache: live.fromCache,
    origin: main.length > 0 ? "mixed" : "live",
    summary: `${
      main.length > 0
        ? `${main.length} from the checked catalogue and ${liveWatches.length} additional checked ${liveWatches.length === 1 ? "watch" : "watches"}.`
        : `${liveWatches.length} checked ${liveWatches.length === 1 ? "watch meets" : "watches meet"} your answers.`
    }${nearFitNote(filled.nearFitCount)}`,
  };
}

/** The shared page, widget and API all receive the same unique result. */
export async function searchQuiz(
  ...args: Parameters<typeof searchQuizBeforeDeduplication>
): Promise<AiSearchView> {
  return uniqueSearchView(await searchQuizBeforeDeduplication(...args));
}
