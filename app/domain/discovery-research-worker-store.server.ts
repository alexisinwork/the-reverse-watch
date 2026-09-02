import { z } from "zod";

import { discoveryAnchorSchema } from "./discovery-selection";
import type { DiscoveryResearchCandidate } from "./discovery-research";

export const DISCOVERY_RESEARCH_CLAIM_RPC =
  "claim_discovery_research_runs_v1" as const;
export const DISCOVERY_RESEARCH_COMPLETE_RPC =
  "complete_discovery_research_run_v1" as const;
export const DISCOVERY_RESEARCH_FAIL_RPC =
  "fail_discovery_research_run_v1" as const;
export const DISCOVERY_RESEARCH_SOURCES_RPC =
  "list_discovery_candidate_sources_v1" as const;
export const DISCOVERY_RESEARCH_REVIEW_RPC =
  "review_discovery_candidate_v1" as const;
export const DISCOVERY_RESEARCH_CAST_RPC =
  "review_discovery_cast_credit_v1" as const;

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
const sourceFetchResultSchema = z
  .object({
    status: z.enum(["verified", "failed"]),
    sourceId: z.number().int().positive(),
  })
  .strict();
const candidateSourcesSchema = z.array(
  z.object({ id: z.number().int().positive(), url: z.url() }).strict(),
);

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
  listCandidateSources(
    candidateId: number,
  ): Promise<Array<{ id: number; url: string }>>;
  reviewCandidate(input: {
    candidateId: number;
    decision: "accepted" | "rejected";
    publish: boolean;
    reviewerNote: string | null;
    referenceVariantId: string | null;
    rights: unknown;
  }): Promise<unknown>;
  recordCandidateSourceFetch(input: {
    candidateId: number;
    sourceId: number;
    status: "verified" | "failed";
    fetchedAt: string;
    contentHash: string | null;
    failureCategory: string | null;
  }): Promise<void>;
  reviewCastCredit(input: {
    publicFigureEntityId: number;
    fictionalCharacterEntityId: number;
    workId: number;
    decision: "accepted" | "rejected";
  }): Promise<unknown>;
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
    async listCandidateSources(candidateId) {
      const body = await rpc(
        DISCOVERY_RESEARCH_SOURCES_RPC,
        { p_candidate_id: candidateId },
        options,
      );
      return candidateSourcesSchema.parse(body);
    },
    async reviewCandidate(input) {
      return rpc(
        DISCOVERY_RESEARCH_REVIEW_RPC,
        {
          p_candidate_id: input.candidateId,
          p_decision: input.decision,
          p_publish: input.publish,
          p_reviewer_note: input.reviewerNote,
          p_reference_variant_id: input.referenceVariantId,
          p_rights: input.rights,
        },
        options,
      );
    },
    async recordCandidateSourceFetch(input) {
      const body = await rpc(
        "record_discovery_candidate_source_fetch_v1",
        {
          p_candidate_id: input.candidateId,
          p_source_id: input.sourceId,
          p_status: input.status,
          p_fetched_at: input.fetchedAt,
          p_content_hash: input.contentHash,
          p_failure_category: input.failureCategory,
        },
        options,
      );
      sourceFetchResultSchema.parse(body);
    },
    async reviewCastCredit(input) {
      return rpc(
        DISCOVERY_RESEARCH_CAST_RPC,
        {
          p_public_figure_entity_id: input.publicFigureEntityId,
          p_fictional_character_entity_id: input.fictionalCharacterEntityId,
          p_work_id: input.workId,
          p_decision: input.decision,
        },
        options,
      );
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
    work_kind: candidate.work?.kind ?? null,
    work_release_year: candidate.work?.releaseYear ?? null,
    work_season: candidate.work?.season ?? null,
    work_episode: candidate.work?.episode ?? null,
    work_scene: candidate.work?.scene ?? null,
    work_timecode: candidate.work?.timecode ?? null,
    claim_summary: candidate.claimSummary,
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
