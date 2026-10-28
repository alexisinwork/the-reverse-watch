import { z } from "zod";

import type { DesignTraits } from "./design-traits";
import { safeHttpUrl } from "./source-pages.server";
import {
  catalogueWatchSchema,
  type CatalogueStyle,
  type CatalogueWatch,
  type PreownedPrice,
} from "./watch-catalogue";

export type StoreConfig = { supabaseUrl: string; serviceKey: string };

function loadStoreConfig(
  env: NodeJS.ProcessEnv = process.env,
): StoreConfig | null {
  const supabaseUrl = env.SUPABASE_URL?.trim();
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return supabaseUrl && serviceKey ? { supabaseUrl, serviceKey } : null;
}

// New sb_secret_ keys go in apikey only; legacy service-role JWTs also
// need the Authorization header.
function rpcHeaders(config: StoreConfig) {
  return {
    apikey: config.serviceKey,
    ...(config.serviceKey.startsWith("eyJ")
      ? { authorization: `Bearer ${config.serviceKey}` }
      : {}),
    "content-type": "application/json",
  };
}

export type CatalogueClient = {
  config: StoreConfig;
  fetchImpl: typeof fetch;
};

export function catalogueClient(
  overrides: Partial<CatalogueClient> = {},
): CatalogueClient | null {
  const config = overrides.config ?? loadStoreConfig();
  return config ? { config, fetchImpl: overrides.fetchImpl ?? fetch } : null;
}

class CatalogueRpcError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CatalogueRpcError";
  }
}

export async function rpc(
  client: CatalogueClient,
  name: string,
  body: unknown,
  timeoutMs = 10_000,
  signal?: AbortSignal,
) {
  const response = await client.fetchImpl(
    new URL(`/rest/v1/rpc/${name}`, client.config.supabaseUrl),
    {
      method: "POST",
      headers: rpcHeaders(client.config),
      body: JSON.stringify(body),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
        : AbortSignal.timeout(timeoutMs),
    },
  );
  if (!response.ok) {
    throw new CatalogueRpcError(
      `${name} returned ${response.status}: ${(await response.text()).slice(0, 200)}`,
      response.status,
    );
  }
  const responseText = await response.text();
  return responseText.trim() ? (JSON.parse(responseText) as unknown) : null;
}

const listSchema = z.array(catalogueWatchSchema);

export async function listCatalogue(
  client: CatalogueClient,
  includeRejected = false,
) {
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 45_000);
  try {
    return await readCataloguePages(client, includeRejected, controller.signal);
  } finally {
    clearTimeout(deadline);
    controller.abort();
  }
}

async function readCataloguePages(
  client: CatalogueClient,
  includeRejected: boolean,
  signal: AbortSignal,
) {
  const rows: z.infer<typeof catalogueWatchSchema>[] = [];
  const readPage = async (page: number) => {
    for (let attempt = 0; ; attempt++) {
      try {
        return listSchema.parse(
          await rpc(
            client,
            "watch_catalogue_recommendation_page_v1",
            { p_include_rejected: includeRejected, p_page: page },
            15_000,
            signal,
          ),
        );
      } catch (error) {
        const retryable =
          error instanceof CatalogueRpcError
            ? error.status === 429 || error.status >= 500
            : error instanceof TypeError ||
              (error instanceof Error &&
                ["AbortError", "TimeoutError"].includes(error.name));
        if (attempt || signal.aborted || !retryable) throw error;
      }
    }
  };
  const first = await readPage(1);
  rows.push(...first);
  if (first.length < 500) return rows;
  // Four bounded page reads amortize network latency without an unbounded
  // fan-out. Keep page order and stop at the first partial page.
  for (let page = 2; page <= 1_000; page += 4) {
    const pages = await Promise.all(
      Array.from({ length: Math.min(4, 1001 - page) }, (_, index) =>
        readPage(page + index),
      ),
    );
    for (const batch of pages) {
      rows.push(...batch);
      if (batch.length < 500) return rows;
    }
  }
  throw new Error("Catalogue pagination exceeded its safety bound");
}

// The quiz reads the whole catalogue (a few thousand small rows) and
// filters it in code; a short in-memory cache keeps that off the hot path.
const CACHE_MS = 5 * 60 * 1_000;
let cached: { watches: CatalogueWatch[]; expiresAt: number } | null = null;
let loading: Promise<CatalogueWatch[]> | null = null;
let cacheGeneration = 0;

export async function loadCatalogueCached(
  client: CatalogueClient,
  now = Date.now(),
) {
  if (cached && cached.expiresAt > now) return cached.watches;
  if (loading) return loading;
  const generation = cacheGeneration;
  const pending = listCatalogue(client).then((watches) => {
    if (generation === cacheGeneration)
      cached = { watches, expiresAt: now + CACHE_MS };
    return watches;
  });
  loading = pending;
  try {
    return await pending;
  } finally {
    if (loading === pending) loading = null;
  }
}

export function clearCatalogueCache() {
  cached = null;
  loading = null;
  cacheGeneration++;
}

export async function catalogueIdentityKeys(client: CatalogueClient) {
  return new Set(
    z
      .array(z.string())
      .parse(await rpc(client, "watch_catalogue_identity_keys_v1", {})),
  );
}

export type CatalogueEntry = {
  identityKey: string;
  brand: string;
  model: string;
  referenceCode: string | null;
  referenceConfirmed: boolean;
  styles: CatalogueStyle[];
  caseDiameterMm?: number | null;
  caseThicknessMm?: number | null;
  caseShape?: string | null;
  waterResistanceM?: number | null;
  movement?: string | null;
  inHouseCalibre?: boolean | null;
  crystal?: string | null;
  displayCaseback?: boolean | null;
  complications?: string[];
  caseMaterial?: string | null;
  casebackMaterial?: string | null;
  strapMaterial?: string | null;
  priceStatus?: "confirmed" | "unconfirmed";
  priceAmount?: number | null;
  priceCurrency?: string | null;
  priceCheckedAt?: string | null;
  priceEvidence?: Record<string, unknown>;
  sourceUrl?: string | null;
  sourceKind?: "manufacturer" | "retailer" | "catalogue" | null;
  sourceDetails?: Record<string, Record<string, string | number>>;
  imageUrl?: string | null;
  rationale?: string | null;
  foundIn?: unknown[];
};

/** Adds a watch as pending, or merges a repeat find into the stored row. */
export async function upsertCatalogueWatch(
  client: CatalogueClient,
  entry: CatalogueEntry,
) {
  const id = await rpc(client, "watch_catalogue_upsert_v1", { p_watch: entry });
  return z.string().parse(id);
}

export type ReviewPatch = Partial<{
  brand: string;
  model: string;
  referenceCode: string;
  referenceConfirmed: boolean;
  styles: CatalogueStyle[];
  caseDiameterMm: string;
  caseThicknessMm: string;
  waterResistanceM: string;
  movement: string;
  caseMaterial: string;
  casebackMaterial: string;
  strapMaterial: string;
  sourceUrl: string;
  imageUrl: string;
  rationale: string;
  priceAmount: string;
  priceCurrency: string;
}>;

export async function reviewCatalogueWatch(
  client: CatalogueClient,
  id: string,
  status: "pending" | "approved" | "rejected" | null,
  patch: ReviewPatch = {},
) {
  const ok = z.boolean().parse(
    await rpc(client, "watch_catalogue_review_v1", {
      p_id: id,
      p_status: status,
      p_patch: patch,
    }),
  );
  clearCatalogueCache();
  return ok;
}

export type PriceRecord =
  | { kind: "same"; evidence: Record<string, unknown> }
  | {
      kind: "changed" | "confirmed" | "approximate";
      amount: number;
      currency: string;
      evidence: Record<string, unknown>;
    }
  | { kind: "unconfirmed" | "accept" | "dismiss" };

export async function recordCataloguePrice(
  client: CatalogueClient,
  id: string,
  result: PriceRecord,
) {
  const ok = z.boolean().parse(
    await rpc(client, "watch_catalogue_price_v1", {
      p_id: id,
      p_result: result,
    }),
  );
  clearCatalogueCache();
  return ok;
}

export async function cataloguePricesDue(
  client: CatalogueClient,
  before: Date,
  limit: number,
) {
  return listSchema.parse(
    await rpc(client, "watch_catalogue_price_due_v1", {
      p_before: before.toISOString(),
      p_limit: limit,
    }),
  );
}

function foldText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Give a sighting a photo only for one confirmed exact brand/reference match.
 * A similar model name is not enough to identify the correct variant.
 */
export async function fillPhotosFromCatalogue<
  T extends {
    brand: string;
    model: string;
    referenceCode: string | null;
    imageUrl: string | null;
  },
>(
  watches: T[],
  client: CatalogueClient | null = catalogueClient(),
): Promise<T[]> {
  if (
    !client ||
    watches.every((watch) => watch.imageUrl || !watch.referenceCode)
  )
    return watches;
  let catalogue: CatalogueWatch[];
  try {
    const keys = watches
      .filter((watch) => !watch.imageUrl && watch.referenceCode)
      .map((watch) => ({
        brand: watch.brand,
        referenceCode: watch.referenceCode,
      }));
    // Query the complete catalogue: the recommendation pool excludes some
    // unpriced rows and therefore cannot establish an unambiguous identity.
    catalogue = listSchema.parse(
      await rpc(
        client,
        "watch_catalogue_lookup_v1",
        {
          p_keys: keys.slice(0, 100),
        },
        6_000,
      ),
    );
  } catch {
    return watches;
  }
  const brandKey = (brand: string) => foldText(brand);
  const byReference = new Map<string, CatalogueWatch[]>();
  for (const watch of catalogue) {
    if (!watch.referenceCode || watch.reviewStatus === "rejected") continue;
    const reference = foldText(watch.referenceCode);
    const brand = brandKey(watch.brand);
    if (!brand || reference.length < 3) continue;
    const key = `${brand}|${reference}`;
    byReference.set(key, [...(byReference.get(key) ?? []), watch]);
  }
  return watches.map((watch) => {
    if (watch.imageUrl || !watch.referenceCode) return watch;
    const brand = brandKey(watch.brand);
    const reference = foldText(watch.referenceCode);
    if (!brand || reference.length < 3) return watch;
    const matches = byReference.get(`${brand}|${reference}`) ?? [];
    const image =
      matches.length === 1 && matches[0]?.referenceConfirmed
        ? safeHttpUrl(matches[0].imageUrl)
        : null;
    return image ? { ...watch, imageUrl: image } : watch;
  });
}

/** Stores how a watch looks, read from its photo. */
export async function recordDesignTraits(
  client: CatalogueClient,
  id: string,
  traits: DesignTraits,
) {
  const ok = z
    .boolean()
    .nullable()
    .parse(
      await rpc(client, "watch_catalogue_traits_v1", {
        p_id: id,
        p_traits: traits,
      }),
    );
  clearCatalogueCache();
  return ok === true;
}

/** Stores established-dealer pre-owned prices for a watch. */
export async function recordPreownedPrice(
  client: CatalogueClient,
  id: string,
  price: PreownedPrice,
) {
  const ok = z
    .boolean()
    .nullable()
    .parse(
      await rpc(client, "watch_catalogue_preowned_v1", {
        p_id: id,
        p_price: price,
      }),
    );
  clearCatalogueCache();
  return ok === true;
}
