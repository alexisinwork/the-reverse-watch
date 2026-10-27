import { createHash } from "node:crypto";

import { z } from "zod";

import { runSafely } from "./ai-providers.server";
import { safeHttpUrl } from "./source-pages.server";
import {
  type AiSearchOutcome,
  type AiSearchView,
  type FoundWatch,
} from "./ai-watch-types";

export type AiSearchKind = "quiz" | "film" | "find";

export type StoreConfig = { supabaseUrl: string; serviceKey: string };

export function loadAiWatchStoreConfig(
  env: NodeJS.ProcessEnv = process.env,
): StoreConfig | null {
  const supabaseUrl = env.SUPABASE_URL?.trim();
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return supabaseUrl && serviceKey ? { supabaseUrl, serviceKey } : null;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Same kind and same (order-insensitive) inputs always give the same key. */
export function aiSearchCacheKey(kind: AiSearchKind, input: unknown) {
  return createHash("sha256")
    .update(stableJson({ kind, version: 2, input }))
    .digest("hex");
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

const storedWatchSchema = z.object({
  brand: z.string().min(1),
  model: z.string().min(1),
  referenceCode: z.string().nullable(),
  sourceUrl: z.string(),
  imageUrl: z.string().nullable(),
  priceNote: z.string().nullable(),
  rationale: z.string(),
  details: z.record(z.string(), z.unknown()).nullable().optional(),
});

const storedSearchSchema = z
  .object({
    validationStatus: z
      .enum(["unverified", "validating", "valid", "failed"])
      .default("unverified"),
    summary: z.string(),
    watches: z.array(storedWatchSchema).min(1),
  })
  .nullable();

export type StoredSearch = {
  validationStatus: "unverified" | "validating" | "valid" | "failed";
  summary: string;
  watches: FoundWatch[];
};

export async function loadStoredSearch(
  config: StoreConfig,
  cacheKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<StoredSearch | null> {
  const response = await fetchImpl(
    new URL("/rest/v1/rpc/ai_watch_search_get_v1", config.supabaseUrl),
    {
      method: "POST",
      headers: rpcHeaders(config),
      body: JSON.stringify({ p_cache_key: cacheKey }),
      signal: AbortSignal.timeout(6_000),
    },
  );
  if (!response.ok) {
    throw new Error(`Stored search lookup returned ${response.status}.`);
  }
  const stored = storedSearchSchema.parse(await response.json());
  if (!stored) return null;
  const watches = stored.watches.flatMap((watch): FoundWatch[] => {
    const sourceUrl = safeHttpUrl(watch.sourceUrl);
    return sourceUrl
      ? [
          {
            ...watch,
            sourceUrl,
            imageUrl: safeHttpUrl(watch.imageUrl),
            details: watch.details ?? {},
          },
        ]
      : [];
  });
  return watches.length > 0
    ? {
        validationStatus: stored.validationStatus,
        summary: stored.summary,
        watches,
      }
    : null;
}

async function cacheValidationRpc(
  config: StoreConfig,
  name:
    | "ai_watch_search_claim_validation_v1"
    | "ai_watch_search_finish_validation_v1"
    | "ai_watch_search_replace_validated_v1",
  body: unknown,
  fetchImpl: typeof fetch,
) {
  const response = await fetchImpl(
    new URL(`/rest/v1/rpc/${name}`, config.supabaseUrl),
    {
      method: "POST",
      headers: rpcHeaders(config),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    },
  );
  if (!response.ok) throw new Error(`${name} returned ${response.status}.`);
  return (await response.json()) as unknown;
}

export async function storeSearch(
  config: StoreConfig,
  entry: {
    kind: AiSearchKind;
    cacheKey: string;
    cacheInput: unknown;
    summary: string;
    watches: FoundWatch[];
  },
  fetchImpl: typeof fetch = fetch,
) {
  const response = await fetchImpl(
    new URL("/rest/v1/rpc/ai_watch_search_store_v1", config.supabaseUrl),
    {
      method: "POST",
      headers: rpcHeaders(config),
      body: JSON.stringify({
        p_kind: entry.kind,
        p_cache_key: entry.cacheKey,
        // Only the search constraints: never who asked.
        p_brief: entry.cacheInput,
        p_summary: entry.summary,
        p_watches: entry.watches,
      }),
      signal: AbortSignal.timeout(6_000),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Storing the search returned ${response.status}: ${(await response.text()).slice(0, 200)}`,
    );
  }
}

function logStoreError(event: string, error: unknown) {
  console.error(
    JSON.stringify({
      event,
      message: error instanceof Error ? error.message : "unknown error",
    }),
  );
}

/**
 * Serves a stored result when this exact search ran before; otherwise runs
 * it and stores what it found. Storage problems never block the visitor:
 * they are logged and the live result is still returned.
 */
export async function searchWithStore(
  {
    kind,
    cacheInput,
    run,
  }: {
    kind: AiSearchKind;
    cacheInput: unknown;
    run: () => Promise<AiSearchOutcome>;
  },
  {
    store = loadAiWatchStoreConfig(),
    fetchImpl = fetch,
  }: { store?: StoreConfig | null; fetchImpl?: typeof fetch } = {},
): Promise<AiSearchView> {
  const cacheKey = aiSearchCacheKey(kind, cacheInput);
  let claimedValidation = false;

  if (store) {
    try {
      const stored = await loadStoredSearch(store, cacheKey, fetchImpl);
      if (stored?.validationStatus === "valid")
        return {
          status: "found",
          summary: stored.summary,
          watches: stored.watches,
          fromCache: true,
        };
      if (stored) {
        const claim = z
          .object({ state: z.string() })
          .parse(
            await cacheValidationRpc(
              store,
              "ai_watch_search_claim_validation_v1",
              { p_cache_key: cacheKey, p_reserve_usd: 0.2 },
              fetchImpl,
            ),
          );
        if (claim.state === "in_progress") return { status: "unavailable" };
        if (claim.state === "monthly_limit") return { status: "unavailable" };
        claimedValidation = claim.state === "claimed";
      }
    } catch (error) {
      logStoreError("ai_watch_store_read_error", error);
    }
  } else {
    logStoreError(
      "ai_watch_store_unconfigured",
      new Error(
        "SUPABASE_SERVICE_ROLE_KEY is not set; results are not stored.",
      ),
    );
  }

  const outcome = await runSafely(run);
  if (outcome.status !== "found") {
    if (store)
      await cacheValidationRpc(
        store,
        "ai_watch_search_finish_validation_v1",
        {
          p_cache_key: cacheKey,
          p_status: "failed",
          p_cost_usd: 0,
          p_error: outcome.status,
        },
        fetchImpl,
      ).catch(() => undefined);
    return outcome;
  }

  if (store) {
    if (claimedValidation) {
      const replaced = await cacheValidationRpc(
        store,
        "ai_watch_search_replace_validated_v1",
        {
          p_cache_key: cacheKey,
          p_summary: outcome.summary,
          p_watches: outcome.watches,
          p_cost_usd: 0.2,
        },
        fetchImpl,
      )
        .then((value) => z.boolean().parse(value))
        .catch((error: unknown) => {
          logStoreError("ai_watch_store_validation_replace_error", error);
          return false;
        });
      if (replaced !== true) return { status: "unavailable" };
      return { ...outcome, fromCache: false };
    }
    try {
      await storeSearch(
        store,
        {
          kind,
          cacheKey,
          cacheInput,
          summary: outcome.summary,
          watches: outcome.watches,
        },
        fetchImpl,
      );
    } catch (error) {
      logStoreError("ai_watch_store_write_error", error);
    }
  }
  return { ...outcome, fromCache: false };
}
