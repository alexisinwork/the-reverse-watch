import { describe, expect, it } from "vitest";

import {
  indexResearchJobHistory,
  nextResearchAttempt,
  researchRetryDelayMilliseconds,
  retryAfterMilliseconds,
} from "./research-jobs";
import { researchJobSchema } from "./research";
import type { ResearchJob } from "./research";

const fingerprint = "a".repeat(64);

function job(attempt: number, status: ResearchJob["status"]): ResearchJob {
  const terminal = status === "succeeded" || status === "failed";
  return researchJobSchema.parse({
    jobId: `00000000-0000-4000-8000-${String(attempt).padStart(12, "0")}`,
    targetId: "owner-managed-target",
    status,
    attempt,
    requestFingerprint: fingerprint,
    provider: "perplexity",
    preset: "pro-search",
    queuedAt: "2026-08-31T10:00:00.000Z",
    startedAt: status === "queued" ? null : "2026-08-31T10:00:01.000Z",
    completedAt: terminal ? "2026-08-31T10:00:02.000Z" : null,
    rawArtifactPath:
      status === "succeeded" ? `data/research/raw/${attempt}.json` : null,
    normalizedArtifactPath:
      status === "succeeded"
        ? `data/research/normalized/${attempt}.json`
        : null,
    sourceUrls: [],
    costUsd: null,
    inputTokens: null,
    outputTokens: null,
    error: status === "failed" ? "provider unavailable" : null,
  });
}

describe("research job resumption", () => {
  it("continues after the greatest retained attempt", () => {
    const history = indexResearchJobHistory([
      job(3, "failed"),
      job(1, "failed"),
      job(2, "failed"),
    ]);

    expect(
      nextResearchAttempt(history.maximumAttemptByFingerprint, fingerprint),
    ).toBe(4);
  });

  it("reuses the latest successful fingerprint without duplicating work", () => {
    const earlier = job(2, "succeeded");
    const latest = job(4, "succeeded");
    const history = indexResearchJobHistory([
      latest,
      job(3, "failed"),
      earlier,
    ]);

    expect(history.successfulFingerprints.size).toBe(1);
    expect(history.successfulFingerprints.get(fingerprint)).toEqual(latest);
    expect(
      nextResearchAttempt(history.maximumAttemptByFingerprint, fingerprint),
    ).toBe(5);
  });

  it("honors Retry-After while bounding waits", () => {
    expect(retryAfterMilliseconds("7")).toBe(7_000);
    expect(
      retryAfterMilliseconds(
        "Sun, 31 Aug 2026 10:00:10 GMT",
        Date.parse("2026-08-31T10:00:00Z"),
      ),
    ).toBe(10_000);
    expect(researchRetryDelayMilliseconds(1, null)).toBe(500);
    expect(researchRetryDelayMilliseconds(2, 10_000)).toBe(10_000);
    expect(researchRetryDelayMilliseconds(9, 120_000)).toBe(60_000);
  });
});
