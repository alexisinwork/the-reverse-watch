import { z } from "zod";

import {
  catalogueWatchSchema,
  type CatalogueStyle,
  type CatalogueWatch,
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

async function rpc(
  client: CatalogueClient,
  name: string,
  body: unknown,
  timeoutMs = 10_000,
) {
  const response = await client.fetchImpl(
    new URL(`/rest/v1/rpc/${name}`, client.config.supabaseUrl),
    {
      method: "POST",
      headers: rpcHeaders(client.config),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    },
  );
  if (!response.ok) {
    throw new Error(
      `${name} returned ${response.status}: ${(await response.text()).slice(0, 200)}`,
    );
  }
  return (await response.json()) as unknown;
}

const listSchema = z.array(catalogueWatchSchema);

export async function listCatalogue(
  client: CatalogueClient,
  includeRejected = false,
) {
  return listSchema.parse(
    await rpc(
      client,
      "watch_catalogue_list_v1",
      { p_include_rejected: includeRejected },
      15_000,
    ),
  );
}

// The quiz reads the whole catalogue (a few thousand small rows) and
// filters it in code; a short in-memory cache keeps that off the hot path.
const CACHE_MS = 5 * 60 * 1_000;
let cached: { watches: CatalogueWatch[]; expiresAt: number } | null = null;

export async function loadCatalogueCached(
  client: CatalogueClient,
  now = Date.now(),
) {
  if (cached && cached.expiresAt > now) return cached.watches;
  const watches = await listCatalogue(client);
  cached = { watches, expiresAt: now + CACHE_MS };
  return watches;
}

export function clearCatalogueCache() {
  cached = null;
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
  sourceKind?: "manufacturer" | "retailer" | null;
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
 * Gives watches without a photo the catalogue's photo of the same watch:
 * matched by brand and reference, or by brand and model when there is no
 * reference. Film sightings often cite pages without a product photo.
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
  if (!client || watches.every((watch) => watch.imageUrl)) return watches;
  let catalogue: CatalogueWatch[];
  try {
    catalogue = await loadCatalogueCached(client);
  } catch {
    return watches;
  }
  const brandKey = (brand: string) => foldText(brand.split(/\s+/)[0] ?? brand);
  const byReference = new Map<string, string>();
  const byModel = new Map<string, string>();
  for (const watch of catalogue) {
    if (!watch.imageUrl || watch.reviewStatus === "rejected") continue;
    if (watch.referenceCode) {
      byReference.set(
        `${brandKey(watch.brand)}|${foldText(watch.referenceCode)}`,
        watch.imageUrl,
      );
    }
    byModel.set(
      `${brandKey(watch.brand)}|${foldText(watch.model)}`,
      watch.imageUrl,
    );
  }
  // Film sightings name models loosely ("Seamaster Diver 300M Co-Axial
  // Chronometer"): failing an exact match, the longest catalogue model of the
  // same brand that one name contains wins, if it is specific enough.
  const modelsByBrand = new Map<string, { model: string; image: string }[]>();
  for (const [key, image] of byModel) {
    const [brand = "", model = ""] = key.split("|");
    if (model.length < 6) continue;
    modelsByBrand.set(brand, [
      ...(modelsByBrand.get(brand) ?? []),
      { model, image },
    ]);
  }
  const looseMatch = (brand: string, model: string) =>
    (modelsByBrand.get(brand) ?? [])
      .filter(
        (entry) => model.includes(entry.model) || entry.model.includes(model),
      )
      .sort((a, b) => b.model.length - a.model.length)[0]?.image;
  return watches.map((watch) => {
    if (watch.imageUrl) return watch;
    const brand = brandKey(watch.brand);
    const model = foldText(watch.model);
    const image =
      (watch.referenceCode
        ? byReference.get(`${brand}|${foldText(watch.referenceCode)}`)
        : undefined) ??
      byModel.get(`${brand}|${model}`) ??
      (model.length >= 6 ? looseMatch(brand, model) : undefined);
    return image ? { ...watch, imageUrl: image } : watch;
  });
}
