import {
  auditCoverage,
  coverageCandidateListSchema,
  coverageCellCount,
} from "./coverage";

const CANDIDATE = {
  referenceVariantId: "variant-1",
  brandId: "brand-1",
  priceBands: ["5000_10000"],
  wristBands: ["6_25_6_75"],
  deploymentEnvironments: ["studio_desk_daily"],
  ownershipFrictionLevels: ["workhorse_mechanical"],
  accuracyTolerances: ["within_15_seconds_per_day"],
  weightLimits: ["under_160_g"],
  functionProfiles: ["simple_date"],
  activeHardFactsComplete: true,
} as const;

describe("pre-collection coverage audit", () => {
  it("enumerates every configured core-axis combination", () => {
    expect(coverageCellCount()).toBe(28_800);
  });

  it("reports an empty catalogue without hiding the gaps", () => {
    const audit = auditCoverage([]);

    expect(audit).toMatchObject({
      candidateCount: 0,
      totalCells: 28_800,
      coveredCells: 0,
      emptyCells: 28_800,
      coverageRatio: 0,
    });
  });

  it("distinguishes coverage, diversity, and evidence", () => {
    const candidates = coverageCandidateListSchema.parse([CANDIDATE]);
    const audit = auditCoverage(candidates);

    expect(audit.coveredCells).toBe(1);
    expect(audit.singleCandidateCells).toBe(1);
    expect(audit.underDiversifiedCells).toBe(1);
    expect(audit.underEvidencedCells).toBe(0);
  });

  it("rejects an invalid coverage projection", () => {
    expect(
      coverageCandidateListSchema.safeParse([
        { ...CANDIDATE, priceBands: ["not_a_band"] },
      ]).success,
    ).toBe(false);
  });
});
