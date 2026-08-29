import {
  proposedFactSchema,
  researchJobSchema,
  researchManifestSchema,
  researchReviewSchema,
  researchTargetSchema,
} from "./research";

const plannedTarget = {
  id: "casio-gshock-digital-tool",
  referenceLabel: "Current compact solar G-Shock",
  state: "planned" as const,
  coverageIntent: {
    priceBands: ["under_300" as const],
    deploymentEnvironments: ["field_water_abuse" as const],
    ownershipFrictionLevels: ["zero_maintenance" as const],
  },
  coverageRationale: "Fill a low-cost precision tool gap.",
};

describe("research and review contracts", () => {
  it("accepts a coverage-first planned target", () => {
    expect(researchTargetSchema.parse(plannedTarget)).toEqual(plannedTarget);
  });

  it("requires accepted targets to link to canonical catalogue rows", () => {
    expect(
      researchTargetSchema.safeParse({
        ...plannedTarget,
        state: "accepted",
        coverageIntent: undefined,
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate target ids across brands", () => {
    const target = {
      ...plannedTarget,
      state: "accepted" as const,
      coverageIntent: undefined,
      catalogueVariantId: "catalogue-row",
    };
    const result = researchManifestSchema.safeParse({
      manifestVersion: 1,
      strategy: "coverage_first",
      targetBrandCount: 200,
      updatedAt: "2026-08-28T20:00:00Z",
      brands: [
        {
          slug: "casio",
          name: "Casio",
          priority: "P0",
          manifestRationale: "Precision tool coverage.",
          dossierState: "not_started",
          targets: [target],
        },
        {
          slug: "timex",
          name: "Timex",
          priority: "P1",
          manifestRationale: "Value coverage.",
          dossierState: "not_started",
          targets: [target],
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          /Duplicate target/.test(issue.message),
        ),
      ).toBe(true);
    }
  });

  it("keeps extracted facts provisional until a separate review accepts them", () => {
    const fact = {
      subjectType: "reference_variant",
      subjectKey: "casio-target",
      fieldName: "lugToLugMm",
      value: 42.8,
      sourceUrl: "https://example.com/manufacturer-product",
      sourceType: "manufacturer_product" as const,
      evidenceKind: "observed" as const,
      note: null,
      observedAt: "2026-08-28T20:00:00Z",
      retrievedAt: "2026-08-28T20:01:00Z",
      reviewStatus: "accepted",
      extractor: {
        provider: "manual",
        modelOrPreset: "human-source-review",
        jobId: "5fa1e3f0-7713-4a90-bbb8-c073c25b7139",
      },
    };

    expect(proposedFactSchema.safeParse(fact).success).toBe(false);
    expect(
      proposedFactSchema.safeParse({
        ...fact,
        reviewStatus: "provisional",
      }).success,
    ).toBe(true);
  });

  it("requires successful and failed jobs to retain their audit state", () => {
    const base = {
      jobId: "5fa1e3f0-7713-4a90-bbb8-c073c25b7139",
      targetId: "casio-gshock-digital-tool",
      attempt: 1,
      requestFingerprint: "a".repeat(64),
      provider: "perplexity" as const,
      preset: "pro-search",
      queuedAt: "2026-08-28T20:00:00Z",
      startedAt: "2026-08-28T20:00:01Z",
      completedAt: "2026-08-28T20:01:00Z",
      rawArtifactPath: "data/research/raw/job.json",
      normalizedArtifactPath: "data/research/normalized/job.json",
      sourceUrls: [],
      costUsd: null,
      inputTokens: null,
      outputTokens: null,
      error: null,
    };

    expect(
      researchJobSchema.safeParse({
        ...base,
        status: "succeeded",
        rawArtifactPath: null,
      }).success,
    ).toBe(false);
    expect(
      researchJobSchema.safeParse({
        ...base,
        status: "failed",
        normalizedArtifactPath: null,
        error: "Provider timeout.",
      }).success,
    ).toBe(true);
  });

  it("does not allow a review with M1 gaps to become migration-ready", () => {
    const review = {
      reviewVersion: 1,
      targetId: "casio-gshock-digital-tool",
      jobId: "5fa1e3f0-7713-4a90-bbb8-c073c25b7139",
      reviewedAt: "2026-08-29T06:32:35Z",
      reviewer: "source-review",
      outcome: "ready_for_migration",
      candidateIdentity: {
        brand: "Casio",
        model: "G-5600",
        referenceCode: "G-5600UE-1",
        variantName: "Black resin band",
      },
      sourceChecks: [
        {
          url: "https://example.com/product",
          status: "validated_primary",
          note: "Exact product page.",
        },
      ],
      verifiedProvisionalFields: ["identity"],
      additionalVerifiedFacts: [],
      rejectedProvisionalFields: [],
      missingM1Fields: ["price"],
      note: "Price still needs a source.",
    };

    expect(researchReviewSchema.safeParse(review).success).toBe(false);
    expect(
      researchReviewSchema.safeParse({
        ...review,
        outcome: "needs_more_evidence",
      }).success,
    ).toBe(true);
  });
});
