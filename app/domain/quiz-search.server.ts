/**
 * Quiz answers are filtered from the catalogue in code, so they are
 * code-filtered. Above 10k, or where the catalogue has fewer than ten
 * confirmed fits, the stored or live search can supplement them only after
 * the current catalogue facts satisfy the same constraints.
 */
import { quizCacheInput } from "./quiz-live-search.server";
import { normalizeReference } from "./ai-watch-guardrails";
import { searchWithCoverage } from "./coverage-search.server";
import {
  coverSearchResults,
  SEARCH_RESULT_TARGET,
  unverifiedCandidate,
} from "./search-coverage";
import { loadUnpricedCandidates } from "./coverage-catalogue.server";
import { meteredSearchOptions } from "./validation-runtime.server";
import { uniqueSearchView } from "./watch-result-dedup";
import type { AiSearchView, FoundWatch, ProgressEvent } from "./ai-watch-types";
import { loadFxTable, type FxTable } from "./fx.server";
import {
  diameterRangeFor,
  findPriceRange,
  type ProfileV4,
} from "./questionnaire-v4";
import {
  catalogueCoversRange,
  catalogueIdentityKey,
  catalogueRuleFailures,
  catalogueToFoundWatch,
  broaderNearFits,
  matchCatalogue,
  nearFits,
  quizMissLabels,
  QUIZ_RESULT_LIMIT,
  stylesForScenarios,
  type CatalogueWatch,
} from "./watch-catalogue";
import {
  catalogueClient,
  loadCatalogueCached,
  type CatalogueClient,
} from "./watch-catalogue.server";
import { cacheCompleteSearch } from "./complete-search-cache.server";
import { safeHttpUrl } from "./source-pages.server";
import { convert } from "./fx";

/** Fewer confirmed catalogue fits than this and the live search fills in. */
export const CATALOGUE_ENOUGH = SEARCH_RESULT_TARGET;

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

function sourcedQuizSuggestion(
  watch: FoundWatch,
  profile: ProfileV4,
  fx: FxTable | null,
): FoundWatch | null {
  if (
    profile.allergyConstraint !== "none" ||
    !safeHttpUrl(watch.sourceUrl) ||
    watch.details.reviewStatus === "rejected"
  )
    return null;
  const range = findPriceRange(profile.priceRange)!;
  const price = watch.details.price;
  const amount =
    price?.currency === profile.budgetCurrency
      ? price.amount
      : price && fx
        ? convert(price.amount, price.currency, profile.budgetCurrency, fx)
        : null;
  if (price && amount === null) return null;
  if (
    amount !== null &&
    (amount < range.minimum ||
      (range.maximum !== null && amount > range.maximum))
  )
    return null;
  if (
    watch.details.movement &&
    !profile.movementTypes.includes(
      watch.details.movement as ProfileV4["movementTypes"][number],
    )
  )
    return null;
  const diameter = diameterRangeFor(profile);
  const size = watch.details.caseDiameterMm;
  if (
    size != null &&
    (size < diameter.minimumMm - 3 || size > diameter.maximumMm + 3)
  )
    return null;
  const misses = [
    "Wearing style not confirmed",
    ...(profile.minimumWaterResistanceM > 0 &&
    (watch.details.waterResistanceM == null ||
      watch.details.waterResistanceM < profile.minimumWaterResistanceM)
      ? [
          watch.details.waterResistanceM == null
            ? "Water resistance not confirmed"
            : "Less water resistance than you asked for",
        ]
      : []),
    ...(!watch.details.movement ? ["Movement not confirmed"] : []),
    ...(size == null
      ? ["Case size not confirmed"]
      : size < diameter.minimumMm || size > diameter.maximumMm
        ? ["Case size outside your range"]
        : []),
    ...(amount === null ? ["Price unavailable — budget fit unknown"] : []),
    ...profile.requiredComplications.map(
      (slug) => `${slug.replaceAll("_", " ")} missing or not confirmed`,
    ),
    ...(profile.crystal ? ["Crystal not confirmed"] : []),
    ...(profile.caseShape ? ["Case shape not confirmed"] : []),
    ...(profile.displayCaseback !== undefined
      ? ["Caseback type not confirmed"]
      : []),
    ...(profile.maxCaseThicknessMm !== undefined
      ? ["Case thickness not confirmed"]
      : []),
    ...(profile.movementConstruction
      ? ["Calibre construction not confirmed"]
      : []),
    ...(profile.microAdjustmentRequired !== undefined
      ? ["Clasp adjustment not confirmed"]
      : []),
  ];
  return unverifiedCandidate(
    { ...watch, details: { ...watch.details, misses } },
    "Sourced suggestion — specifications and fit need checking",
  );
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
    if (!matches.length && watch.details.verificationStatus === "unverified") {
      const suggestion = sourcedQuizSuggestion(watch, profile, fx);
      return suggestion ? [suggestion] : [];
    }
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
    runLive,
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
    const close = nearFits(
      catalogue,
      profile,
      fx,
      QUIZ_RESULT_LIMIT * 3 - watches.length - alsoWorth.length,
      taken,
    );
    const broader = broaderNearFits(
      catalogue,
      profile,
      fx,
      QUIZ_RESULT_LIMIT * 3 - watches.length - alsoWorth.length - close.length,
      new Set([...taken, ...close.map(({ watch }) => watch.identityKey)]),
    );
    const extra = [...close, ...broader].flatMap(({ watch, misses }) => {
      const found = catalogueToFoundWatch(watch);
      return found
        ? [
            {
              ...found,
              details: {
                ...found.details,
                misses: quizMissLabels(watch, profile, misses),
              },
            },
          ]
        : [];
    });
    return { watches: [...watches, ...extra], nearFitCount: extra.length };
  };
  const nearFitNote = (count: number) =>
    count > 0
      ? ` ${count} close ${count === 1 ? "fit is" : "fits are"} in your price range; every missed or unconfirmed answer is marked on the card.`
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
      summary: `${main.length} watches from The Reserve's checked catalogue meet every answer. Each card shows its reference source.${nearFitNote(filled.nearFitCount)}`,
    };
  }

  report?.({
    text: !catalogueCoversRange(range)
      ? "Checking saved research for your price range…"
      : main.length > 0
        ? `The catalogue has ${main.length} confirmed ${main.length === 1 ? "fit" : "fits"}; checking saved research for more…`
        : "No catalogue watch fits every answer yet; checking saved research…",
  });
  const knownIdentities = new Set(catalogue.map(watchKey));
  const fetched = await (runLive
    ? runLive()
    : searchWithCoverage(
        {
          kind: "quiz",
          cacheInput: quizCacheInput(profile),
        },
        meteredSearchOptions({ client, report, quizProfile: profile }),
        {
          localCandidates: [...withNearFits(main).watches, ...alsoWorth],
          additionalCandidate: (watch) =>
            knownIdentities.has(watchKey(watch))
              ? null
              : sourcedQuizSuggestion(watch, profile, fx),
        },
      ));
  // Atomic publication can fill facts in master. Re-read before applying the
  // hard filters, including on valid-cache hits, so newly saved data participates.
  if (fetched.status === "found" && client) {
    try {
      catalogue = await loadCatalogueCached(client);
    } catch (error) {
      logError("catalogue_refresh_error", error);
      return { status: "unavailable" };
    }
  }
  const screened =
    fetched.status === "found"
      ? qualifyingLiveWatches(fetched.watches, catalogue, profile, fx)
      : [];
  if (!client && fetched.status === "found") return { status: "unavailable" };
  const live: AiSearchView =
    fetched.status === "found"
      ? screened.length
        ? { ...fetched, watches: screened }
        : {
            status: "no_match",
            summary: "No additional exact matches were found.",
          }
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
      fromCache: fetched.status === "found" && fetched.fromCache,
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
      fromCache: live.fromCache,
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
        ? `${main.length} from the checked catalogue and ${liveWatches.length} additional ${liveWatches.length === 1 ? "option" : "options"}; differences and unconfirmed details are labelled.`
        : `${liveWatches.length} ${liveWatches.length === 1 ? "option" : "options"} from checked and cited research; differences and unconfirmed details are labelled.`
    }${nearFitNote(filled.nearFitCount)}`,
  };
}

/** The shared page, widget and API all receive the same unique result. */
export async function searchQuiz(
  ...args: Parameters<typeof searchQuizBeforeDeduplication>
): Promise<AiSearchView> {
  const finish = (view: AiSearchView, client: CatalogueClient | null) => {
    const covered = coverSearchResults(view);
    if (covered.status !== "found") return Promise.resolve(covered);
    const cards = [...covered.watches, ...(covered.alsoWorth ?? [])];
    const close = cards.filter((watch) => watch.details.misses?.length).length;
    const exact = cards.length - close;
    const summary = `${exact} ${exact === 1 ? "watch meets" : "watches meet"} every answer. ${close ? `${close} close ${close === 1 ? "fit is" : "fits are"} in your price range or explicitly labelled price-unknown; every compromise and missing fact is marked on the card.` : "Each card shows its reference source."}${covered.summary.includes("live search is unavailable") ? " Our live search is unavailable right now; these options come from the catalogue." : ""}`;
    return cacheCompleteSearch(
      "quiz",
      quizCacheInput(args[0]),
      { ...covered, summary },
      client,
    );
  };
  const result = coverSearchResults(
    uniqueSearchView(await searchQuizBeforeDeduplication(...args)),
  );
  if (
    result.status === "found" &&
    (result.coverage?.total ?? 0) >= SEARCH_RESULT_TARGET
  )
    return finish(
      result,
      args[1]?.client === undefined ? catalogueClient() : args[1].client,
    );
  const [profile, options] = args;
  const client =
    options?.client === undefined ? catalogueClient() : options.client;
  if (!client) return result;
  const diameter = diameterRangeFor(profile);
  const [unpriced, fx] = await Promise.all([
    loadUnpricedCandidates(
      stylesForScenarios(profile.wearingScenarios),
      diameter.minimumMm,
      diameter.maximumMm,
      profile.movementTypes,
      client,
    ),
    options?.loadFx ? options.loadFx() : loadFxTable(),
  ]);
  const candidates = unpriced.flatMap((row) => {
    // These are explicitly outside the budget-qualified matches. Every other
    // active constraint must still pass; unknown dimensions/functions never do.
    if (
      catalogueRuleFailures(row, profile, fx).some((rule) => rule !== "price")
    )
      return [];
    const card = catalogueToFoundWatch(row);
    if (!card) return [];
    return [
      unverifiedCandidate(
        {
          ...card,
          details: {
            ...card.details,
            misses: ["Price unavailable — budget fit unknown"],
          },
        },
        "Price unavailable — budget fit unknown",
      ),
    ];
  });
  return finish(coverSearchResults(result, candidates), client);
}
