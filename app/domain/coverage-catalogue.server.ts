import { z } from "zod";
import type { FoundWatch } from "./ai-watch-types";
import { mergeCatalogueFacts } from "./catalogue-result-enrichment.server";
import { catalogueWatchSchema, type CatalogueStyle } from "./watch-catalogue";
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
    return mergeCatalogueFacts(
      watches.filter((watch) => !blocked.has(key(watch))),
      rows,
    );
  } catch {
    return [];
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
