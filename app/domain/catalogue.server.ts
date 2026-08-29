import { z } from "zod";

import { seedCatalogue } from "./seed-catalogue";
import { seedCatalogueSchema } from "./catalogue";
import type { SeedCatalogue } from "./catalogue";
import type { QuestionnaireProfile } from "./questionnaire";
import { HARD_REASON_CODES, MISSING_FACT_CODES } from "./recommendation";
import type { HardFilterEvaluation } from "./recommendation";

export const SUPABASE_CATALOGUE_RPC = "recommendation_catalogue_v2";
export const SUPABASE_HARD_FILTER_RPC = "recommendation_hard_filter_v2";
export const CATALOGUE_CACHE_TTL_MS = 60_000;
export const CATALOGUE_REQUEST_TIMEOUT_MS = 3_500;

export type CatalogueOrigin = "supabase" | "bundled_seed";

export type CatalogueLoadResult = {
  catalogue: SeedCatalogue;
  origin: CatalogueOrigin;
  notice: string;
};

export type RecommendationDataLoadResult = CatalogueLoadResult & {
  hardFilterEvaluation?: HardFilterEvaluation;
};

export const hardFilterEvaluationSchema = z.record(
  z.string().min(1),
  z
    .object({
      hardReasons: z.array(z.enum(HARD_REASON_CODES)),
      missingFacts: z.array(z.enum(MISSING_FACT_CODES)),
    })
    .strict(),
);

type CatalogueLoaderOptions = {
  env?: Partial<
    Pick<NodeJS.ProcessEnv, "SUPABASE_URL" | "SUPABASE_PUBLISHABLE_KEY">
  >;
  fetchImpl?: typeof fetch;
  now?: () => number;
  cacheTtlMs?: number;
  requestTimeoutMs?: number;
};

function configuredValue(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function createCatalogueLoader({
  env = process.env,
  fetchImpl = fetch,
  now = Date.now,
  cacheTtlMs = CATALOGUE_CACHE_TTL_MS,
  requestTimeoutMs = CATALOGUE_REQUEST_TIMEOUT_MS,
}: CatalogueLoaderOptions = {}) {
  let cached: { catalogue: SeedCatalogue; expiresAt: number } | undefined;

  return async function loadRecommendationCatalogue(): Promise<CatalogueLoadResult> {
    const supabaseUrl = configuredValue(env.SUPABASE_URL);
    const publishableKey = configuredValue(env.SUPABASE_PUBLISHABLE_KEY);

    if (!supabaseUrl || !publishableKey) {
      return {
        catalogue: seedCatalogue,
        origin: "bundled_seed",
        notice:
          "Live catalogue connection is not configured; using the reviewed bundled snapshot.",
      };
    }

    if (cached && cached.expiresAt > now()) {
      return {
        catalogue: cached.catalogue,
        origin: "supabase",
        notice: "Accepted catalogue facts loaded from Supabase.",
      };
    }

    try {
      const endpoint = new URL(
        `/rest/v1/rpc/${SUPABASE_CATALOGUE_RPC}`,
        supabaseUrl,
      );
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          apikey: publishableKey,
          "content-type": "application/json",
        },
        body: "{}",
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
      if (!response.ok) {
        throw new Error(`Catalogue RPC returned ${response.status}.`);
      }
      const catalogue = seedCatalogueSchema.parse(await response.json());
      cached = { catalogue, expiresAt: now() + cacheTtlMs };
      return {
        catalogue,
        origin: "supabase",
        notice: "Accepted catalogue facts loaded from Supabase.",
      };
    } catch {
      return {
        catalogue: seedCatalogue,
        origin: "bundled_seed",
        notice:
          "Live catalogue validation failed; using the reviewed bundled snapshot.",
      };
    }
  };
}

export const loadRecommendationCatalogue = createCatalogueLoader();

function hasExactVariantCoverage(
  catalogue: SeedCatalogue,
  evaluation: HardFilterEvaluation,
) {
  const expected = new Set(catalogue.variants.map((variant) => variant.id));
  const actual = Object.keys(evaluation);
  return (
    expected.size === actual.length && actual.every((id) => expected.has(id))
  );
}

export function createRecommendationDataLoader(
  options: CatalogueLoaderOptions = {},
) {
  const loadCatalogue = createCatalogueLoader(options);
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const requestTimeoutMs =
    options.requestTimeoutMs ?? CATALOGUE_REQUEST_TIMEOUT_MS;

  return async function loadRecommendationData(
    profile: QuestionnaireProfile,
    asOf: string,
  ): Promise<RecommendationDataLoadResult> {
    const catalogueLoad = await loadCatalogue();
    if (catalogueLoad.origin !== "supabase") return catalogueLoad;

    const supabaseUrl = configuredValue(env.SUPABASE_URL);
    const publishableKey = configuredValue(env.SUPABASE_PUBLISHABLE_KEY);
    if (!supabaseUrl || !publishableKey) return catalogueLoad;

    try {
      const endpoint = new URL(
        `/rest/v1/rpc/${SUPABASE_HARD_FILTER_RPC}`,
        supabaseUrl,
      );
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          apikey: publishableKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({ p_profile: profile, p_as_of: asOf }),
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
      if (!response.ok) {
        throw new Error(`Hard-filter RPC returned ${response.status}.`);
      }
      const hardFilterEvaluation = hardFilterEvaluationSchema.parse(
        await response.json(),
      );
      if (
        !hasExactVariantCoverage(catalogueLoad.catalogue, hardFilterEvaluation)
      ) {
        throw new Error(
          "Hard-filter RPC coverage does not match the catalogue.",
        );
      }
      return {
        ...catalogueLoad,
        hardFilterEvaluation,
        notice:
          "Accepted catalogue facts and hard-filter decisions loaded from Supabase.",
      };
    } catch {
      return {
        catalogue: seedCatalogue,
        origin: "bundled_seed",
        notice:
          "Live hard-filter validation failed; using the reviewed bundled snapshot and deterministic local filters.",
      };
    }
  };
}

export const loadRecommendationData = createRecommendationDataLoader();
