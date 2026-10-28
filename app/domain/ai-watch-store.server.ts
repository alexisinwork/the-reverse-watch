import { createHash } from "node:crypto";

import { z } from "zod";

import { safeHttpUrl } from "./source-pages.server";
import { loadValidatedSnapshot } from "./validated-cache.server";
import type { ValidationRun } from "./validate-cached-search.server";
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

const filmSubjectSchema = z.object({
  query: z.string().trim().min(1).max(120),
  kind: z.enum(["movie", "series", "actor", "character", "celebrity"]),
});
const foldSubject = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** A watch appearing in an actor's cache must actually be attributed to that
 * actor; a source about someone else is not evidence for this search. */
function bindFilmSubject(
  watches: FoundWatch[],
  input: unknown,
  allowMissing: boolean,
) {
  const parsed = filmSubjectSchema.safeParse(input);
  if (!parsed.success) return [];
  const { query, kind } = parsed.data;
  const subject = foldSubject(query);
  if (!subject) return [];
  const field = kind === "movie" || kind === "series" ? "work" : "person";
  return watches.flatMap((watch) => {
    const current = watch.details[field];
    if (typeof current === "string" && foldSubject(current) === subject)
      return [watch];
    if (!current && allowMissing)
      return [{ ...watch, details: { ...watch.details, [field]: query } }];
    return [];
  });
}

/** Serve already valid results; pause new AI searches until the validator
 * and its shared cost ledger are ready. Catalogue-only paths remain separate. */
export async function searchWithStore(
  {
    kind,
    cacheInput,
  }: {
    kind: AiSearchKind;
    cacheInput: unknown;
    run: () => Promise<AiSearchOutcome>;
  },
  {
    store = loadAiWatchStoreConfig(),
    fetchImpl = fetch,
    validateDraft,
    waitForValidation = () =>
      new Promise<void>((resolve) => setTimeout(resolve, 1_000)),
    now = Date.now,
  }: {
    store?: StoreConfig | null;
    fetchImpl?: typeof fetch;
    /** Only injected by a metered validator; production stays disabled until
     * provider-side limits and real responses have been verified. */
    validateDraft?: (
      cacheKey: string,
      watches: FoundWatch[],
    ) => Promise<ValidationRun>;
    /** A bounded delay used only while another request owns this key. */
    waitForValidation?: () => Promise<void>;
    now?: () => number;
  } = {},
): Promise<AiSearchView> {
  const cacheKey = aiSearchCacheKey(kind, cacheInput);

  if (store) {
    try {
      const stored = await loadValidatedSnapshot(
        { config: store, fetchImpl },
        cacheKey,
      );
      if (
        stored &&
        (kind !== "film" ||
          bindFilmSubject(stored.watches, cacheInput, false).length ===
            stored.watches.length)
      )
        return {
          status: "found",
          summary: stored.summary,
          watches: stored.watches,
          fromCache: true,
        };
      if (validateDraft) {
        const draft = await loadStoredSearch(store, cacheKey, fetchImpl);
        if (!draft) return { status: "unavailable" };
        const candidates =
          kind === "film"
            ? bindFilmSubject(draft.watches, cacheInput, true)
            : draft.watches;
        if (!candidates.length) return { status: "unavailable" };
        const result = await validateDraft(cacheKey, candidates);
        if (
          result.status === "unavailable" &&
          result.reason === "in_progress"
        ) {
          // Share the first request's result without starting more research.
          // Stop after 20 seconds if it fails, stalls, or outlives this request.
          const deadline = now() + 20_000;
          for (let i = 0; i < 20 && now() < deadline; i++) {
            await waitForValidation();
            if (now() >= deadline) break;
            const published = await loadValidatedSnapshot(
              { config: store, fetchImpl },
              cacheKey,
            );
            if (
              published &&
              (kind !== "film" ||
                bindFilmSubject(published.watches, cacheInput, false).length ===
                  published.watches.length)
            )
              return {
                status: "found",
                summary: published.summary,
                watches: published.watches,
                fromCache: true,
              };
          }
          return { status: "unavailable" };
        }
        if (result.status !== "verified" && result.reason !== "valid")
          return { status: "unavailable" };
        // The validator publishes atomically. Read the committed snapshot so a
        // lost/failed publication can never be reported as a verified result.
        const published = await loadValidatedSnapshot(
          { config: store, fetchImpl },
          cacheKey,
        );
        if (
          !published ||
          (kind === "film" &&
            bindFilmSubject(published.watches, cacheInput, false).length !==
              published.watches.length)
        )
          return { status: "unavailable" };
        return {
          status: "found",
          summary: published.summary,
          watches: published.watches,
          fromCache: result.status !== "verified",
        };
      }
      // The validation and cost ledger are not ready yet. Until they are,
      // never start an unmetered research call or certify a draft cache.
      return { status: "unavailable" };
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

  return { status: "unavailable" };
}
