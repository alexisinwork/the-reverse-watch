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
      kind: "changed" | "confirmed";
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
