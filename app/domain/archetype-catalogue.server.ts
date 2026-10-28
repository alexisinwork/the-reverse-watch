import {
  archetypeWatches,
  ARCHETYPE_BANDS,
  type PriceComfort,
} from "./archetype-picks";
import type { ArchetypeId } from "./discovery-archetype";
import type { CatalogueWatch, CatalogueStyle } from "./watch-catalogue";
import { catalogueToFoundWatch, priceIn } from "./watch-catalogue";
import { catalogueClient, loadCatalogueCached } from "./watch-catalogue.server";
import { enrichResultWatches } from "./catalogue-result-enrichment.server";
import { loadFxTable, type FxTable } from "./fx.server";
import { uniqueWatchResults } from "./watch-result-dedup";
import { validateSelectedResults } from "./validate-selected-results.server";

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
/** Version 1: technical-role supplements; never invent brand prestige/history. */
export function rankEnrichedArchetype(
  catalogue: CatalogueWatch[],
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
        !["automatic", "manual", "spring_drive"].includes(watch.movement ?? "")
      )
        return false;
      if (
        ["architectural_modernist", "expressive_collector"].includes(
          archetype,
        ) &&
        !["square", "rectangular", "tonneau", "cushion"].includes(
          watch.caseShape ?? "",
        )
      )
        return false;
      return true;
    })
    .sort((a, b) => {
      const score = (w: CatalogueWatch) =>
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

async function selectArchetypeWatches(
  archetype: ArchetypeId,
  band: PriceComfort,
) {
  const curated = await enrichResultWatches(archetypeWatches(archetype, band));
  const client = catalogueClient();
  if (!client) return curated;
  try {
    const [catalogue, fx] = await Promise.all([
      loadCatalogueCached(client),
      loadFxTable(),
    ]);
    const supplements = rankEnrichedArchetype(
      catalogue,
      archetype,
      band,
      fx,
    ).flatMap((watch) => {
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
    // Keep the editorial core and add up to five newly documented role fits.
    return uniqueWatchResults([
      ...curated.slice(0, 5),
      ...supplements.slice(0, 5),
      ...curated.slice(5),
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
  return validateSelectedResults("archetype", { archetype, band }, candidates);
}
