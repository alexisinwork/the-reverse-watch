import { z } from "zod";
import type { FoundWatch } from "./ai-watch-types";
import { mergeCatalogueFacts } from "./catalogue-result-enrichment.server";
import { withPageCheckedFacts } from "./page-checked-facts";
import {
  catalogueWatchSchema,
  pageCheckedFacts,
  type CatalogueStyle,
  type CatalogueWatch,
} from "./watch-catalogue";
import {
  catalogueClient,
  rpc,
  type CatalogueClient,
} from "./watch-catalogue.server";

const key = (watch: { brand: string; referenceCode: string | null }) =>
  `${watch.brand}|${watch.referenceCode ?? ""}`
    .toLowerCase()
    .replace(/[^a-z0-9|]/g, "");

export async function hydrateCoverageCandidates(
  watches: FoundWatch[],
  client = catalogueClient(),
) {
  if (!client || !watches.length) return [];
  try {
    const rows = z.array(catalogueWatchSchema).parse(
      await rpc(
        client,
        "watch_catalogue_candidate_lookup_v1",
        {
          p_keys: watches.slice(0, 100).map((watch) => ({
            brand: watch.brand,
            referenceCode: watch.referenceCode,
          })),
        },
        6000,
      ),
    );
    const blocked = new Set(
      rows.filter((row) => row.reviewStatus === "rejected").map(key),
    );
    const merged = mergeCatalogueFacts(
      watches.filter((watch) => !blocked.has(key(watch))),
      rows,
    );
    return await withCompleteCatalogueChecks(merged, client);
  } catch {
    return [];
  }
}

/**
 * The candidate lookup leaves out records without a usable price, such as a
 * watch whose price the repair parked because its reference turned out to be
 * another model; a saved-research card for it kept its old name (2026-11-27:
 * Panerai PAM01320 still showed as "Submersible Bronzo"). Such cards look the
 * watch up in the whole catalogue: a rejected one is dropped, and the facts
 * the repair read on a page take the place of the card's own. Nothing else
 * changes, so which cards qualify stays the same. Fails open.
 */
async function withCompleteCatalogueChecks(
  watches: FoundWatch[],
  client: CatalogueClient,
) {
  const unmatched = watches.filter(
    (watch) => !watch.details.catalogueId && watch.referenceCode,
  );
  if (!unmatched.length) return watches;
  try {
    const rows = z.array(catalogueWatchSchema).parse(
      await rpc(
        client,
        "watch_catalogue_lookup_v1",
        {
          p_keys: unmatched.slice(0, 100).map((watch) => ({
            brand: watch.brand,
            referenceCode: watch.referenceCode,
          })),
        },
        6000,
      ),
    );
    const byKey = new Map<string, CatalogueWatch[]>();
    for (const row of rows)
      byKey.set(key(row), [...(byKey.get(key(row)) ?? []), row]);
    return watches.flatMap((watch) => {
      if (watch.details.catalogueId) return [watch];
      const matches = byKey.get(key(watch)) ?? [];
      if (matches.length !== 1) return [watch];
      const row = matches[0]!;
      if (row.reviewStatus === "rejected") return [];
      return [
        withPageCheckedFacts(
          watch,
          {
            model: row.model,
            caseDiameterMm: row.caseDiameterMm,
            waterResistanceM: row.waterResistanceM,
            movement: row.movement,
            materials: {
              case: row.caseMaterial,
              caseback: row.casebackMaterial,
              strap: row.strapMaterial,
            },
          },
          pageCheckedFacts(row),
        ),
      ];
    });
  } catch {
    return watches;
  }
}

/** Unknown prices are suggestions only; each caller still enforces its other
 * numeric, movement, allergy and functional constraints before showing them. */
export async function loadUnpricedCandidates(
  styles: CatalogueStyle[],
  minimum: number | null = null,
  maximum: number | null = null,
  movements: string[] = [],
  client: CatalogueClient | null = catalogueClient(),
) {
  if (!client) return [];
  try {
    return z.array(catalogueWatchSchema).parse(
      await rpc(
        client,
        "watch_catalogue_unpriced_candidates_v1",
        {
          p_styles: styles,
          p_min_diameter: minimum,
          p_max_diameter: maximum,
          p_movements: movements,
        },
        6000,
      ),
    );
  } catch {
    return [];
  }
}
