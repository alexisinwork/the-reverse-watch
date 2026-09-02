import { z } from "zod";

import {
  DISCOVERY_RESEARCH_CONTRACT_VERSION,
  type DiscoveryResearchResponse,
} from "./discovery-research";
import {
  createDiscoveryResearchWorkerStore,
  candidatePersistenceShape,
  type DiscoveryResearchWorkerItem,
  type DiscoveryResearchWorkerStore,
} from "./discovery-research-worker-store.server";
import {
  PerplexityDiscoveryError,
  requestPerplexityDiscoveryResearch,
} from "./perplexity-discovery-research.server";

const positiveInteger = (value: string | undefined, max: number) => {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return parsed > 0 && parsed <= max ? parsed : null;
};

export type DiscoveryResearchWorkerConfig = {
  supabaseUrl: string;
  serviceRoleKey: string;
  perplexityApiKey: string;
  workerSecret: string;
  preset: "pro-search";
  maxJobs: number;
  dailyCostCapUsd: number;
  maxOutputTokens: number;
  leaseSeconds: number;
};

export function parseDiscoveryResearchWorkerConfiguration(
  env: NodeJS.ProcessEnv = process.env,
) {
  const missing: string[] = [];
  const required = (name: string, value: string | undefined) => {
    if (!value?.trim()) missing.push(name);
    return value?.trim() ?? "";
  };
  const maxJobs = positiveInteger(env.DISCOVERY_RESEARCH_MAX_JOBS_PER_RUN, 10);
  if (maxJobs === null) missing.push("DISCOVERY_RESEARCH_MAX_JOBS_PER_RUN");
  const maxOutputTokens = positiveInteger(
    env.DISCOVERY_RESEARCH_MAX_OUTPUT_TOKENS,
    12_000,
  );
  if (maxOutputTokens === null)
    missing.push("DISCOVERY_RESEARCH_MAX_OUTPUT_TOKENS");
  const dailyCostCap = env.DISCOVERY_RESEARCH_DAILY_COST_USD?.trim();
  const dailyCostCapUsd = dailyCostCap ? Number(dailyCostCap) : NaN;
  if (
    !Number.isFinite(dailyCostCapUsd) ||
    dailyCostCapUsd <= 0 ||
    dailyCostCapUsd > 100
  ) {
    missing.push("DISCOVERY_RESEARCH_DAILY_COST_USD");
  }
  const preset = env.PERPLEXITY_DISCOVERY_PRESET?.trim() || "pro-search";
  if (preset !== "pro-search")
    missing.push("PERPLEXITY_DISCOVERY_PRESET=pro-search");
  const config = {
    supabaseUrl: required("SUPABASE_URL", env.SUPABASE_URL),
    serviceRoleKey: required(
      "SUPABASE_SERVICE_ROLE_KEY",
      env.SUPABASE_SERVICE_ROLE_KEY,
    ),
    perplexityApiKey: required("PERPLEXITY_API_KEY", env.PERPLEXITY_API_KEY),
    workerSecret: required(
      "DISCOVERY_RESEARCH_WORKER_SECRET",
      env.DISCOVERY_RESEARCH_WORKER_SECRET,
    ),
    preset: "pro-search" as const,
    maxJobs: maxJobs ?? 0,
    dailyCostCapUsd: Number.isFinite(dailyCostCapUsd) ? dailyCostCapUsd : 0,
    maxOutputTokens: maxOutputTokens ?? 0,
    leaseSeconds: 900,
  } satisfies DiscoveryResearchWorkerConfig;
  return missing.length > 0
    ? { configured: false as const, missing }
    : { configured: true as const, config };
}

type Provider = (
  topic: Pick<
    DiscoveryResearchWorkerItem,
    "anchor" | "displayText" | "releaseYear"
  >,
  config: DiscoveryResearchWorkerConfig,
) => Promise<{
  responseId: string;
  model: string;
  result: DiscoveryResearchResponse;
  sourceUrls: string[];
  rawResponse: unknown;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
}>;

function outcome(result: DiscoveryResearchResponse) {
  if (result.targetMismatch || result.ambiguous)
    return "needs_clarification" as const;
  if (result.insufficientEvidence || result.candidates.length === 0)
    return "no_evidence" as const;
  return "review_pending" as const;
}

function failure(error: unknown) {
  if (error instanceof PerplexityDiscoveryError) {
    return { category: error.category, retryable: error.retryable };
  }
  return { category: "provider_unavailable", retryable: true } as const;
}

export async function runDiscoveryResearchBatch({
  config,
  store,
  provider = (topic, workerConfig) =>
    requestPerplexityDiscoveryResearch(topic, {
      apiKey: workerConfig.perplexityApiKey,
      preset: workerConfig.preset,
      maxOutputTokens: workerConfig.maxOutputTokens,
    }),
  now = () => new Date().toISOString(),
}: {
  config: DiscoveryResearchWorkerConfig;
  store: DiscoveryResearchWorkerStore;
  provider?: Provider;
  now?: () => string;
}) {
  const claimed = await store.claim(
    config.maxJobs,
    config.leaseSeconds,
    config.preset,
    DISCOVERY_RESEARCH_CONTRACT_VERSION,
    config.dailyCostCapUsd,
  );
  let succeeded = 0;
  let failed = 0;
  for (const item of claimed) {
    try {
      const research = await provider(item, config);
      const status = outcome(research.result);
      const retrievedAt = now();
      await store.complete({
        runId: item.runId,
        leaseToken: item.leaseToken,
        providerRequestId: research.responseId,
        model: research.model,
        contractVersion: DISCOVERY_RESEARCH_CONTRACT_VERSION,
        outcome: status,
        normalizedArtifact: {
          contractVersion: DISCOVERY_RESEARCH_CONTRACT_VERSION,
          target: {
            anchor: item.anchor,
            displayText: item.displayText,
            releaseYear: item.releaseYear,
          },
          result: research.result,
          sourceUrls: research.sourceUrls,
          retrievedAt,
        },
        rawResponse: research.rawResponse,
        candidates: research.result.candidates.map((candidate) =>
          candidatePersistenceShape(candidate, retrievedAt),
        ),
        inputTokens: research.inputTokens,
        outputTokens: research.outputTokens,
        costUsd: research.costUsd,
      });
      succeeded += 1;
    } catch (error) {
      const classified = failure(error);
      await store.fail({
        runId: item.runId,
        leaseToken: item.leaseToken,
        category: classified.category,
        retryable: classified.retryable,
      });
      failed += 1;
    }
  }
  return { claimed: claimed.length, succeeded, failed };
}

export async function runConfiguredDiscoveryResearchBatch(
  env: NodeJS.ProcessEnv = process.env,
) {
  const parsed = parseDiscoveryResearchWorkerConfiguration(env);
  if (!parsed.configured)
    return { configured: false as const, missing: parsed.missing };
  const result = await runDiscoveryResearchBatch({
    config: parsed.config,
    store: createDiscoveryResearchWorkerStore({ env }),
  });
  return { configured: true as const, ...result };
}

export function workerSecretMatches(supplied: string | null, expected: string) {
  if (!supplied || !expected) return false;
  return supplied === `Bearer ${expected}`;
}

export const discoveryResearchWorkerResultSchema = z
  .object({
    configured: z.boolean(),
    claimed: z.number().int().nonnegative().optional(),
    succeeded: z.number().int().nonnegative().optional(),
    failed: z.number().int().nonnegative().optional(),
    missing: z.array(z.string()).optional(),
  })
  .strict();
