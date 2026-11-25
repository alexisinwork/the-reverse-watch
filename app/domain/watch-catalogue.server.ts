import { z } from "zod";

import type { DesignTraits } from "./design-traits";
import { safeHttpUrl } from "./source-pages.server";
import {
  ALTERNATIVE_WINDOW_COLUMNS,
  alternativeFactsSchema,
  ARCHETYPE_WINDOW_COLUMNS,
  archetypeFactsSchema,
  NAME_INDEX_COLUMNS,
  nameFactsSchema,
  type AlternativeFacts,
  type NameFacts,
  catalogueMatchFactsSchema,
  catalogueWatchSchema,
  QUIZ_WINDOW_COLUMNS,
  type ArchetypeFacts,
  type CatalogueMatchFacts,
  type CatalogueStyle as WindowStyle,
  type PriceBound,
  type CatalogueStyle,
  type CatalogueWatch,
  type PreownedPrice,
  type QuizCatalogueWindow,
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
export function rpcHeaders(config: StoreConfig) {
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

// The whole recommendation pool (25,014 rows, 61 MB on 2026-11-25). Visitor
// searches no longer read it: the quiz, archetype and alternatives read
// bounded database windows (migrations 0115–0117). Only the paused legacy
// pre-owned lookup and reporting scripts still use this cache.
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
  poolKeys = null;
  nameIndex = null;
}

const columnWindowSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.array(z.unknown())),
});

/** Reads a columns-plus-rows window: columns travel once instead of on every
 * row. A changed column list is a deployment mismatch, so it fails loudly
 * rather than misreading every row. */
export function decodeColumnWindow<T extends z.ZodType>(
  name: string,
  payload: unknown,
  columns: readonly string[],
  rowSchema: T,
): z.infer<T>[] {
  const window = columnWindowSchema.parse(payload);
  if (
    window.columns.length !== columns.length ||
    window.columns.some((column, index) => column !== columns[index])
  ) {
    throw new Error(`${name} returned unexpected columns`);
  }
  return z
    .array(rowSchema)
    .parse(
      window.rows.map((row) =>
        Object.fromEntries(
          columns.map((column, index) => [column, row[index]]),
        ),
      ),
    );
}

/** The rows one quiz answer could select, with only the facts its rules read
 * (migration 0115). The quiz rules still run on them in code. */
export async function loadQuizWindow(
  client: CatalogueClient,
  window: QuizCatalogueWindow,
): Promise<CatalogueMatchFacts[]> {
  return decodeColumnWindow(
    "watch_catalogue_quiz_window_v1",
    await rpc(
      client,
      "watch_catalogue_quiz_window_v1",
      {
        p_price_bounds: window.priceBounds,
        p_min_diameter: window.minDiameterMm,
        p_max_diameter: window.maxDiameterMm,
        p_require_nickel_facts: window.requireNickelFacts,
      },
      15_000,
    ),
    QUIZ_WINDOW_COLUMNS,
    catalogueMatchFactsSchema,
  );
}

/** Every row the archetype ranking could keep (migration 0116). */
export async function loadArchetypeWindow(
  client: CatalogueClient,
  window: {
    priceBounds: PriceBound[];
    styles: readonly WindowStyle[];
    movements: readonly string[];
    shapes: readonly string[];
  },
): Promise<ArchetypeFacts[]> {
  return decodeColumnWindow(
    "watch_catalogue_archetype_window_v1",
    await rpc(
      client,
      "watch_catalogue_archetype_window_v1",
      {
        p_price_bounds: window.priceBounds,
        p_styles: window.styles,
        p_movements: window.movements,
        p_shapes: window.shapes,
      },
      15_000,
    ),
    ARCHETYPE_WINDOW_COLUMNS,
    archetypeFactsSchema,
  );
}

/** Every row rankAlternatives could keep for one target and budget
 * (migration 0117). */
export async function loadAlternativesWindow(
  client: CatalogueClient,
  window: {
    priceBounds: PriceBound[];
    styles: readonly WindowStyle[];
    minDiameterMm: number | null;
    maxDiameterMm: number | null;
    minWaterResistanceM: number | null;
    mechanicalOnly: boolean;
  },
): Promise<AlternativeFacts[]> {
  return decodeColumnWindow(
    "watch_catalogue_alternatives_window_v1",
    await rpc(
      client,
      "watch_catalogue_alternatives_window_v1",
      {
        p_price_bounds: window.priceBounds,
        p_styles: window.styles,
        p_min_diameter: window.minDiameterMm,
        p_max_diameter: window.maxDiameterMm,
        p_min_water_resistance: window.minWaterResistanceM,
        p_mechanical_only: window.mechanicalOnly,
      },
      15_000,
    ),
    ALTERNATIVE_WINDOW_COLUMNS,
    alternativeFactsSchema,
  );
}

// The few facts name resolution reads, for every pool row (a few MB instead
// of the 61 MB whole read), cached like the pool identity keys.
let nameIndex: { rows: NameFacts[]; expiresAt: number } | null = null;

export async function loadNameIndexCached(
  client: CatalogueClient,
  now = Date.now(),
): Promise<NameFacts[]> {
  if (nameIndex && nameIndex.expiresAt > now) return nameIndex.rows;
  const rows = decodeColumnWindow(
    "watch_catalogue_name_index_v1",
    await rpc(client, "watch_catalogue_name_index_v1", {}, 20_000),
    NAME_INDEX_COLUMNS,
    nameFactsSchema,
  );
  nameIndex = { rows, expiresAt: now + CACHE_MS };
  return rows;
}

const ROWS_BY_ID_LIMIT = 200;

/** Full rows, with evidence, for the watches a result shows. A row that left
 * the recommendation pool meanwhile is simply absent. */
export async function loadCatalogueRowsById(
  client: CatalogueClient,
  ids: readonly string[],
): Promise<CatalogueWatch[]> {
  const unique = [...new Set(ids)];
  const rows: CatalogueWatch[] = [];
  for (let start = 0; start < unique.length; start += ROWS_BY_ID_LIMIT) {
    rows.push(
      ...listSchema.parse(
        await rpc(
          client,
          "watch_catalogue_rows_by_id_v1",
          { p_ids: unique.slice(start, start + ROWS_BY_ID_LIMIT) },
          10_000,
        ),
      ),
    );
  }
  return rows;
}

const POOL_LOOKUP_LIMIT = 100;

/** Recommendation-pool rows for specific watches: by identity key, or by
 * brand and reference normalized like the exact-reference index. Callers
 * still apply their own exact matching to what comes back. */
export async function lookupPoolRows(
  client: CatalogueClient,
  keys: {
    identityKeys: readonly string[];
    references: readonly { brand: string; referenceCode: string }[];
  },
): Promise<CatalogueWatch[]> {
  const identityKeys = [...new Set(keys.identityKeys)];
  const references = keys.references;
  const byId = new Map<string, CatalogueWatch>();
  const batches = Math.max(
    Math.ceil(identityKeys.length / POOL_LOOKUP_LIMIT),
    Math.ceil(references.length / POOL_LOOKUP_LIMIT),
  );
  for (let batch = 0; batch < batches; batch++) {
    const start = batch * POOL_LOOKUP_LIMIT;
    const found = listSchema.parse(
      await rpc(
        client,
        "watch_catalogue_pool_lookup_v1",
        {
          p_identity_keys: identityKeys.slice(start, start + POOL_LOOKUP_LIMIT),
          p_references: references.slice(start, start + POOL_LOOKUP_LIMIT),
        },
        10_000,
      ),
    );
    for (const row of found) {
      byId.set(row.id, row);
    }
  }
  // Callers match by key and count matches, so order carries no meaning.
  return [...byId.values()];
}

// Every identity in the recommendation pool (about 0.6 MB): lets saved
// research tell a watch the catalogue already holds from a new suggestion.
let poolKeys: { keys: ReadonlySet<string>; expiresAt: number } | null = null;

export async function loadPoolIdentityKeysCached(
  client: CatalogueClient,
  now = Date.now(),
): Promise<ReadonlySet<string>> {
  if (poolKeys && poolKeys.expiresAt > now) return poolKeys.keys;
  const keys = new Set(
    z
      .array(z.string())
      .parse(
        await rpc(client, "watch_catalogue_pool_identity_keys_v1", {}, 15_000),
      ),
  );
  poolKeys = { keys, expiresAt: now + CACHE_MS };
  return keys;
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
    await rpc(
      client,
      result.kind === "accept" || result.kind === "dismiss"
        ? "watch_catalogue_price_review_v2"
        : "watch_catalogue_price_v1",
      {
        p_id: id,
        p_result: result,
      },
    ),
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
