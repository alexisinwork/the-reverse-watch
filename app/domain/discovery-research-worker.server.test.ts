import {
  parseDiscoveryResearchWorkerConfiguration,
  runDiscoveryResearchBatch,
} from "./discovery-research-worker.server";
import type {
  DiscoveryResearchWorkerItem,
  DiscoveryResearchWorkerStore,
} from "./discovery-research-worker-store.server";
import { PerplexityDiscoveryError } from "./perplexity-discovery-research.server";

const config = {
  supabaseUrl: "https://example.supabase.co",
  serviceRoleKey: "service-role",
  perplexityApiKey: "provider-key",
  workerSecret: "worker-secret",
  preset: "pro-search" as const,
  maxJobs: 2,
  dailyCostCapUsd: 1,
  maxOutputTokens: 2_000,
  leaseSeconds: 900,
};
const item: DiscoveryResearchWorkerItem = {
  runId: 7,
  topicId: 8,
  leaseToken: "00000000-0000-4000-8000-000000000007",
  anchor: "character",
  displayText: "Don Draper",
  normalizedText: "don draper",
  releaseYear: null,
  attempt: 1,
};

function store() {
  const complete = vi.fn<DiscoveryResearchWorkerStore["complete"]>();
  const fail = vi.fn<DiscoveryResearchWorkerStore["fail"]>();
  const implementation: DiscoveryResearchWorkerStore = {
    claim: vi.fn().mockResolvedValue([item]),
    complete,
    fail,
    listCandidateSources: vi.fn(),
    reviewCandidate: vi.fn(),
    recordCandidateSourceFetch: vi.fn(),
    reviewCastCredit: vi.fn(),
  };
  return { implementation, complete, fail };
}

const providerResult = {
  responseId: "resp_7",
  model: "perplexity/sonar",
  result: {
    targetKind: "character" as const,
    targetName: "Don Draper",
    releaseYear: null,
    aliases: [],
    ambiguous: false,
    targetMismatch: false,
    insufficientEvidence: false,
    candidates: [],
    contradictions: [],
  },
  sourceUrls: [],
  rawResponse: { id: "resp_7", status: "completed" },
  inputTokens: 1,
  outputTokens: 2,
  costUsd: 0.01,
};

describe("discovery research worker", () => {
  it("claims a bounded batch and records no-evidence without publishing", async () => {
    const dependencies = store();
    await expect(
      runDiscoveryResearchBatch({
        config,
        store: dependencies.implementation,
        provider: vi.fn().mockResolvedValue(providerResult),
        now: () => "2026-09-02T00:00:00.000Z",
      }),
    ).resolves.toEqual({ claimed: 1, succeeded: 1, failed: 0 });
    expect(dependencies.complete).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "no_evidence", candidates: [] }),
    );
    expect(dependencies.fail).not.toHaveBeenCalled();
  });

  it("releases a retryable provider outage as a redacted category", async () => {
    const dependencies = store();
    await expect(
      runDiscoveryResearchBatch({
        config,
        store: dependencies.implementation,
        provider: vi
          .fn()
          .mockRejectedValue(
            new PerplexityDiscoveryError("provider_timeout", true),
          ),
      }),
    ).resolves.toEqual({ claimed: 1, succeeded: 0, failed: 1 });
    expect(dependencies.fail).toHaveBeenCalledWith({
      runId: item.runId,
      leaseToken: item.leaseToken,
      category: "provider_timeout",
      retryable: true,
    });
  });

  it("keeps the worker disabled until all operational caps and secrets exist", () => {
    const parsed = parseDiscoveryResearchWorkerConfiguration({
      SUPABASE_URL: "https://example.supabase.co",
      PERPLEXITY_API_KEY: "provider-key",
    });
    expect(parsed.configured).toBe(false);
    if (parsed.configured) throw new Error("Expected incomplete configuration");
    expect(parsed.missing).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(parsed.missing).toContain("DISCOVERY_RESEARCH_WORKER_SECRET");
    expect(parsed.missing).toContain("DISCOVERY_RESEARCH_DAILY_COST_USD");
  });
});
