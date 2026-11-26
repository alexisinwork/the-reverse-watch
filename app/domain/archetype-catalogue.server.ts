import {
  archetypeWatches,
  ARCHETYPE_BANDS,
  type PriceComfort,
} from "./archetype-picks";
import type { ArchetypeId } from "./discovery-archetype";
import type {
  ArchetypeFacts,
  CatalogueStyle,
  CatalogueWatch,
} from "./watch-catalogue";
import {
  budgetPriceBounds,
  catalogueToFoundWatch,
  priceIn,
} from "./watch-catalogue";
import {
  catalogueClient,
  loadArchetypeWindow,
  loadCatalogueRowsById,
} from "./watch-catalogue.server";
import type { FoundWatch } from "./ai-watch-types";
import { enrichResultWatches } from "./catalogue-result-enrichment.server";
import { convert } from "./fx";
import { loadFxTable, type FxTable } from "./fx.server";
import { uniqueWatchResults } from "./watch-result-dedup";
import { validateSelectedResults } from "./validate-selected-results.server";
import { loadUnpricedCandidates } from "./coverage-catalogue.server";
import { SEARCH_RESULT_TARGET, unverifiedCandidate } from "./search-coverage";

const roles: Record<ArchetypeId, CatalogueStyle[]> = {
  field_rationalist: ["field", "dive", "sport", "travel"],
  quiet_custodian: ["dress", "everyday"],
  architectural_modernist: ["dress", "everyday", "sport"],
  expressive_collector: ["dress", "everyday", "sport"],
  mechanical_connoisseur: ["dress", "everyday", "travel"],
  recognised_standard_bearer: [
    "dress",
    "everyday",
    "sport",
    "dive",
    "field",
    "travel",
  ],
};
const MECHANICAL_MOVEMENTS = ["automatic", "manual", "spring_drive"];
const NON_ROUND_SHAPES = ["square", "rectangular", "tonneau", "cushion"];

/** The database window for one archetype and price band (migration 0116):
 * every row rankEnrichedArchetype could keep, and usually some more. */
export function archetypeCatalogueWindow(
  archetype: ArchetypeId,
  band: PriceComfort,
  fx: FxTable | null,
) {
  const bounds = ARCHETYPE_BANDS[band];
  return {
    priceBounds: budgetPriceBounds(
      { minimum: bounds.minimumUsd, maximum: bounds.maximumUsd },
      "USD",
      fx,
    ),
    styles: roles[archetype],
    movements:
      archetype === "mechanical_connoisseur" ? MECHANICAL_MOVEMENTS : [],
    shapes: ["architectural_modernist", "expressive_collector"].includes(
      archetype,
    )
      ? NON_ROUND_SHAPES
      : [],
  };
}

/** Version 1: technical-role supplements; never invent brand prestige/history. */
export function rankEnrichedArchetype<T extends ArchetypeFacts>(
  catalogue: readonly T[],
  archetype: ArchetypeId,
  band: PriceComfort,
  fx: FxTable | null,
) {
  const bounds = ARCHETYPE_BANDS[band];
  return catalogue
    .filter((watch) => {
      if (
        watch.reviewStatus === "rejected" ||
        !watch.referenceConfirmed ||
        !["confirmed", "approximate"].includes(watch.priceStatus)
      )
        return false;
      if (
        !watch.foundIn.some(
          (value) =>
            typeof value === "object" &&
            value !== null &&
            "source" in value &&
            typeof value.source === "string" &&
            ["catalogue_enrichment", "dials", "spacecity"].includes(
              value.source,
            ),
        )
      )
        return false;
      const usd = priceIn(watch, "USD", fx);
      if (
        usd === null ||
        usd < bounds.minimumUsd ||
        (bounds.maximumUsd !== null && usd >= bounds.maximumUsd)
      )
        return false;
      if (!watch.styles.some((style) => roles[archetype].includes(style)))
        return false;
      if (archetype === "recognised_standard_bearer") return false; // recognition needs editorial/brand evidence
      if (
        archetype === "mechanical_connoisseur" &&
        !MECHANICAL_MOVEMENTS.includes(watch.movement ?? "")
      )
        return false;
      if (
        ["architectural_modernist", "expressive_collector"].includes(
          archetype,
        ) &&
        !NON_ROUND_SHAPES.includes(watch.caseShape ?? "")
      )
        return false;
      return true;
    })
    .sort((a, b) => {
      const score = (w: T) =>
        w.styles.filter((style) => roles[archetype].includes(style)).length *
          10 +
        (w.reviewStatus === "approved" ? 5 : 0) +
        (w.caseDiameterMm !== null ? 1 : 0);
      return (
        score(b) - score(a) ||
        b.updatedAt.localeCompare(a.updatedAt) ||
        a.id.localeCompare(b.id)
      );
    });
}

/**
 * The editorial picks whose known price sits in the band at today's rates,
 * the same rule the catalogue window applies (`archetypeCatalogueWindow`).
 * A pick priced outside the band breaks the visitor's price answer, so it
 * is left out (the paid round of 2026-11-26 found an EUR 8,900 pick in the
 * USD 10,000+ band). A pick without a price, or with no rate to convert it,
 * stays; validation labels a card that ends without a price.
 */
export function curatedInBand(
  picks: readonly FoundWatch[],
  band: PriceComfort,
  fx: FxTable | null,
) {
  const bounds = ARCHETYPE_BANDS[band];
  return picks.filter((watch) => {
    const price = watch.details.price;
    if (!price) return true;
    const usd =
      price.currency === "USD"
        ? price.amount
        : fx
          ? convert(price.amount, price.currency, "USD", fx)
          : null;
    if (usd === null) return true;
    return (
      usd >= bounds.minimumUsd &&
      (bounds.maximumUsd === null || usd < bounds.maximumUsd)
    );
  });
}

async function selectArchetypeWatches(
  archetype: ArchetypeId,
  band: PriceComfort,
) {
  const fx = await loadFxTable().catch(() => null);
  const curated = curatedInBand(
    await enrichResultWatches(archetypeWatches(archetype, band)),
    band,
    fx,
  );
  const client = catalogueClient();
  if (!client) return curated;
  try {
    // No catalogue row can show recognition, so that archetype reads nothing.
    const window =
      archetype === "recognised_standard_bearer"
        ? []
        : await loadArchetypeWindow(
            client,
            archetypeCatalogueWindow(archetype, band, fx),
          );
    // Only rows with a source become cards, and only the first twenty are
    // shown: read just those in full.
    const shown = rankEnrichedArchetype(window, archetype, band, fx)
      .filter((watch) => watch.sourceUrl)
      .slice(0, 20);
    const full = new Map(
      (
        await loadCatalogueRowsById(
          client,
          shown.map((watch) => watch.id),
        )
      ).map((row): [string, CatalogueWatch] => [row.id, row]),
    );
    const supplements = shown.flatMap((facts) => {
      const watch = full.get(facts.id);
      if (!watch) return [];
      const card = catalogueToFoundWatch(watch);
      return card
        ? [
            {
              ...card,
              rationale: `A ${watch.styles.filter((style) => roles[archetype].includes(style)).join(" / ")} option with source-checked reference specifications.`,
              details: {
                ...card.details,
                catalogueId: watch.id,
                catalogueUpdatedAt: watch.updatedAt,
              },
            },
          ]
        : [];
    });
    // Keep the editorial core; select ten distinct options after deduplication.
    const selected = uniqueWatchResults([
      ...curated.slice(0, 5),
      ...supplements.slice(0, 20),
      ...curated.slice(5),
    ]);
    if (
      selected.length >= SEARCH_RESULT_TARGET ||
      archetype === "recognised_standard_bearer"
    )
      return selected;
    const unpriced = await loadUnpricedCandidates(
      roles[archetype],
      null,
      null,
      archetype === "mechanical_connoisseur"
        ? ["automatic", "manual", "spring_drive"]
        : [],
      client,
    );
    return uniqueWatchResults([
      ...selected,
      ...unpriced.flatMap((row) => {
        if (
          ["architectural_modernist", "expressive_collector"].includes(
            archetype,
          ) &&
          !["square", "rectangular", "tonneau", "cushion"].includes(
            row.caseShape ?? "",
          )
        )
          return [];
        const card = catalogueToFoundWatch(row);
        return card
          ? [
              unverifiedCandidate(
                {
                  ...card,
                  rationale: `A ${row.styles.filter((style) => roles[archetype].includes(style)).join(" / ")} option; price unavailable, so the selected price band is not confirmed.`,
                },
                "Price unavailable — selected price band not confirmed",
              ),
            ]
          : [];
      }),
    ]);
  } catch {
    return curated;
  }
}

/** Catalogue reporting only; visitor routes use archetypeCatalogueResult. */
export async function archetypeCatalogueWatches(
  archetype: ArchetypeId,
  band: PriceComfort,
) {
  return (await selectArchetypeWatches(archetype, band)).slice(0, 10);
}

export async function archetypeCatalogueResult(
  archetype: ArchetypeId,
  band: PriceComfort,
) {
  const candidates = await selectArchetypeWatches(archetype, band);
  const bounds = ARCHETYPE_BANDS[band];
  return validateSelectedResults(
    "archetype",
    { archetype, band },
    candidates,
    undefined,
    {
      feature: "archetype",
      styles: roles[archetype],
      diameter: null,
      price: {
        minimum: bounds.minimumUsd,
        maximum: bounds.maximumUsd,
        currency: "USD",
      },
      movements:
        archetype === "mechanical_connoisseur"
          ? ["automatic", "manual", "spring_drive"]
          : [],
    },
  );
}
