import { z } from "zod";

import { discoveryAnchorSchema } from "./discovery-selection";
import type { DiscoveryResearchCandidate } from "./discovery-research";

export const DISCOVERY_RESEARCH_CLAIM_RPC =
  "claim_discovery_research_runs_v1" as const;
export const DISCOVERY_RESEARCH_COMPLETE_RPC =
  "complete_discovery_research_run_v1" as const;
export const DISCOVERY_RESEARCH_FAIL_RPC =
  "fail_discovery_research_run_v1" as const;

const workerItemSchema = z
  .object({
    runId: z.number().int().positive(),
    topicId: z.number().int().positive(),
    leaseToken: z.uuid(),
    anchor: discoveryAnchorSchema,
    displayText: z.string().min(2).max(160),
    normalizedText: z.string().min(2).max(160),
    releaseYear: z.number().int().min(1888).max(2100).nullable(),
    attempt: z.number().int().min(1).max(3),
  })
  .strict();
const workerItemsSchema = z.array(workerItemSchema).max(10);
const workerResultSchema = z
  .object({
    status: z.enum([
      "review_pending",
      "needs_clarification",
      "no_evidence",
      "queued",
      "failed",
    ]),
    retryable: z.boolean().optional(),
  })
  .strict();

type WorkerEnvironment = Pick<
  NodeJS.ProcessEnv,
  "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY"
>;
type StoreOptions = {
  env?: Partial<WorkerEnvironment>;
  fetchImpl?: typeof fetch;
};

function configuration(env: Partial<WorkerEnvironment> = process.env) {
  const url = env.SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return url && key ? { url, key } : null;
}

export type DiscoveryResearchWorkerItem = z.infer<typeof workerItemSchema>;

export type DiscoveryResearchWorkerStore = {
  claim(
    limit: number,
    leaseSeconds: number,
    model: string,
    contractVersion: string,
    dailyCostCapUsd: number,
  ): Promise<DiscoveryResearchWorkerItem[]>;
  complete(input: {
    runId: number;
    leaseToken: string;
    providerRequestId: string;
    model: string;
    contractVersion: string;
    outcome: "review_pending" | "needs_clarification" | "no_evidence";
    normalizedArtifact: unknown;
    rawResponse: unknown;
    candidates: unknown[];
    inputTokens: number | null;
    outputTokens: number | null;
    costUsd: number | null;
  }): Promise<void>;
  fail(input: {
    runId: number;
    leaseToken: string;
    category: string;
    retryable: boolean;
  }): Promise<void>;
};

async function rpc(
  name: string,
  body: Record<string, unknown>,
  { env = process.env, fetchImpl = fetch }: StoreOptions,
): Promise<unknown> {
  const configured = configuration(env);
  if (!configured)
    throw new Error("Discovery research worker store is not configured.");
  const response = await fetchImpl(
    new URL(`/rest/v1/rpc/${name}`, configured.url),
    {
      method: "POST",
      headers: {
        apikey: configured.key,
        Authorization: `Bearer ${configured.key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5_000),
    },
  );
  if (!response.ok)
    throw new Error(
      `Discovery research worker RPC returned ${response.status}.`,
    );
  return (await response.json()) as unknown;
}

export function createDiscoveryResearchWorkerStore(
  options: StoreOptions = {},
): DiscoveryResearchWorkerStore {
  return {
    async claim(limit, leaseSeconds, model, contractVersion, dailyCostCapUsd) {
      const body = await rpc(
        DISCOVERY_RESEARCH_CLAIM_RPC,
        {
          p_limit: limit,
          p_lease_seconds: leaseSeconds,
          p_model: model,
          p_contract_version: contractVersion,
          p_daily_cost_cap_usd: dailyCostCapUsd,
        },
        options,
      );
      return workerItemsSchema.parse(body);
    },
    async complete(input) {
      const body = await rpc(
        DISCOVERY_RESEARCH_COMPLETE_RPC,
        {
          p_run_id: input.runId,
          p_lease_token: input.leaseToken,
          p_provider_request_id: input.providerRequestId,
          p_model: input.model,
          p_contract_version: input.contractVersion,
          p_outcome: input.outcome,
          p_normalized_artifact: input.normalizedArtifact,
          p_raw_response: input.rawResponse,
          p_candidates: input.candidates,
          p_input_tokens: input.inputTokens,
          p_output_tokens: input.outputTokens,
          p_cost_usd: input.costUsd,
        },
        options,
      );
      workerResultSchema.parse(body);
    },
    async fail(input) {
      const body = await rpc(
        DISCOVERY_RESEARCH_FAIL_RPC,
        {
          p_run_id: input.runId,
          p_lease_token: input.leaseToken,
          p_failure_category: input.category,
          p_retryable: input.retryable,
        },
        options,
      );
      workerResultSchema.parse(body);
    },
  };
}

export function candidatePersistenceShape(
  candidate: DiscoveryResearchCandidate,
  retrievedAt: string,
) {
  return {
    entity_name: candidate.publicFigureName,
    work_title: candidate.work?.title ?? null,
    character_name: candidate.characterName,
    claim_type: candidate.claimType,
    identification_precision: candidate.identificationPrecision,
    identified_brand: candidate.brand,
    identified_model_family: candidate.modelFamily,
    identified_reference_code: candidate.exactReference,
    custom_prop_possible: candidate.customPropPossible,
    contradiction_state: candidate.contradictionState,
    normalization_status: "normalized",
    review_status: "draft",
    sources: candidate.sources.map((source) => ({
      canonical_url: source.url,
      source_role: source.role,
      stance: source.stance,
      locator: source.locator,
      retrieved_at: retrievedAt,
    })),
  };
}
