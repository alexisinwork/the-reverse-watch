/**
 * Quiz answers are filtered from the catalogue in code, so they are
 * instant. Above 10k, or where the catalogue has fewer than three
 * confirmed fits, the live Muse Spark -> Perplexity search runs and what it
 * finds is added to the catalogue as pending.
 */
import { quizCacheInput, searchQuizWatches } from "./ai-watch-finder.server";
import { normalizeReference } from "./ai-watch-guardrails";
import { searchWithStore } from "./ai-watch-store.server";
import type { AiSearchView, FoundWatch } from "./ai-watch-types";
import { loadFxTable, type FxTable } from "./fx.server";
import { findPriceRange, type ProfileV4 } from "./questionnaire-v4";
import {
  catalogueCoversRange,
  catalogueIdentityKey,
  catalogueToFoundWatch,
  CATALOGUE_MAIN_LIMIT,
  matchCatalogue,
  stylesForScenarios,
  type CatalogueWatch,
} from "./watch-catalogue";
import {
  catalogueClient,
  clearCatalogueCache,
  loadCatalogueCached,
  upsertCatalogueWatch,
  type CatalogueClient,
  type CatalogueEntry,
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

/** A live find, stored as pending with its price left for the recheck to confirm. */
export function liveFindToEntry(
  watch: FoundWatch,
  profile: ProfileV4,
): CatalogueEntry {
  const details = watch.details;
  return {
    identityKey: watchKey(watch),
    brand: watch.brand,
    model: watch.model,
    referenceCode: watch.referenceCode,
    referenceConfirmed:
      details.referenceVerified === true &&
      normalizeReference(watch.referenceCode) !== null,
    styles: stylesForScenarios(profile.wearingScenarios),
    caseDiameterMm: details.caseDiameterMm ?? null,
    waterResistanceM: details.waterResistanceM ?? null,
    movement: details.movement ?? null,
    complications: [...profile.requiredComplications],
    caseMaterial: details.materials?.case ?? null,
    casebackMaterial: details.materials?.caseback ?? null,
    strapMaterial: details.materials?.strap ?? null,
    priceStatus: "unconfirmed",
    priceEvidence: { method: "live_search", observed: details.price ?? null },
    sourceUrl: watch.sourceUrl,
    sourceKind: details.sourceKind ?? null,
    imageUrl: watch.imageUrl,
    rationale: watch.rationale,
    foundIn: [
      {
        live: true,
        priceRange: profile.priceRange,
        currency: profile.budgetCurrency,
      },
    ],
  };
}

async function addLiveFinds(
  client: CatalogueClient,
  watches: FoundWatch[],
  profile: ProfileV4,
) {
  const results = await Promise.allSettled(
    watches.map((watch) =>
      upsertCatalogueWatch(client, liveFindToEntry(watch, profile)),
    ),
  );
  for (const result of results) {
    if (result.status === "rejected")
      logError("catalogue_live_add_error", result.reason);
  }
  clearCatalogueCache();
}

export async function searchQuiz(
  profile: ProfileV4,
  {
    client = catalogueClient(),
    loadFx = () => loadFxTable(),
    runLive = () =>
      searchWithStore({
        kind: "quiz",
        cacheInput: quizCacheInput(profile),
        run: () => searchQuizWatches(profile),
      }),
  }: {
    client?: CatalogueClient | null;
    loadFx?: () => Promise<FxTable | null>;
    runLive?: () => Promise<AiSearchView>;
  } = {},
): Promise<AiSearchView> {
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

  if (catalogueCoversRange(range) && main.length >= CATALOGUE_ENOUGH) {
    return {
      status: "found",
      watches: main,
      alsoWorth,
      fromCache: true,
      origin: "catalogue",
      summary: `${main.length} watches from The Reserve's checked catalogue meet every answer, each with its reference confirmed on the manufacturer's or an authorised retailer's page.`,
    };
  }

  const live = await runLive();
  if (live.status !== "found") {
    if (main.length > 0 || alsoWorth.length > 0) {
      return {
        status: "found",
        watches: main,
        alsoWorth,
        fromCache: true,
        origin: "catalogue",
        summary:
          main.length > 0
            ? `${main.length} ${main.length === 1 ? "watch" : "watches"} from the checked catalogue meet every answer; the live search found nothing further.`
            : "No watch with a confirmed reference meets every answer yet. The watches below do, but the manufacturer's page did not confirm their reference.",
      };
    }
    return live;
  }

  if (client && !live.fromCache)
    await addLiveFinds(client, live.watches, profile);

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
  const watches = [...main, ...liveWatches].slice(0, CATALOGUE_MAIN_LIMIT);
  return {
    status: "found",
    watches,
    alsoWorth,
    fromCache: live.fromCache,
    origin: main.length > 0 ? "mixed" : "live",
    summary:
      main.length > 0
        ? `${main.length} from the checked catalogue, the rest from a live search. ${live.summary}`
        : live.summary,
  };
}
