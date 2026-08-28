import { z } from "zod";

import {
  ACCURACY_TOLERANCES,
  DEPLOYMENT_ENVIRONMENTS,
  OWNERSHIP_FRICTION_LEVELS,
  PRICE_BANDS,
  WEIGHT_LIMITS,
  WRIST_BANDS,
} from "./questionnaire";

export const FUNCTION_PROFILES = [
  "time_only_no_date",
  "simple_date",
  "gmt",
  "chronograph",
  "high_complication",
] as const;

const PRICE_BAND_IDS = PRICE_BANDS.map((band) => band.id);
const WRIST_BAND_IDS = WRIST_BANDS.map((band) => band.id);

export const coverageCandidateSchema = z
  .object({
    referenceVariantId: z.string().min(1),
    brandId: z.string().min(1),
    priceBands: z.array(z.enum(PRICE_BAND_IDS)).min(1),
    wristBands: z.array(z.enum(WRIST_BAND_IDS)).min(1),
    deploymentEnvironments: z.array(z.enum(DEPLOYMENT_ENVIRONMENTS)).min(1),
    ownershipFrictionLevels: z.array(z.enum(OWNERSHIP_FRICTION_LEVELS)).min(1),
    accuracyTolerances: z.array(z.enum(ACCURACY_TOLERANCES)).min(1),
    weightLimits: z.array(z.enum(WEIGHT_LIMITS)).min(1),
    functionProfiles: z.array(z.enum(FUNCTION_PROFILES)).min(1),
    activeHardFactsComplete: z.boolean(),
  })
  .strict();

export const coverageCandidateListSchema = z.array(coverageCandidateSchema);

export type CoverageCandidate = z.infer<typeof coverageCandidateSchema>;
export type FunctionProfile = (typeof FUNCTION_PROFILES)[number];

export type CoverageCell = {
  priceBand: (typeof PRICE_BAND_IDS)[number];
  wristBand: (typeof WRIST_BAND_IDS)[number];
  deploymentEnvironment: (typeof DEPLOYMENT_ENVIRONMENTS)[number];
  ownershipFriction: (typeof OWNERSHIP_FRICTION_LEVELS)[number];
  accuracyTolerance: (typeof ACCURACY_TOLERANCES)[number];
  weightLimit: (typeof WEIGHT_LIMITS)[number];
  functionProfile: FunctionProfile;
};

export type CoverageGap = CoverageCell & {
  candidateCount: number;
  brandCount: number;
  completeCandidateCount: number;
};

export type CoverageAudit = {
  generatedAt: string;
  candidateCount: number;
  totalCells: number;
  coveredCells: number;
  emptyCells: number;
  singleCandidateCells: number;
  underDiversifiedCells: number;
  underEvidencedCells: number;
  coverageRatio: number;
  samples: {
    empty: CoverageGap[];
    singleCandidate: CoverageGap[];
    underDiversified: CoverageGap[];
    underEvidenced: CoverageGap[];
  };
};

export function coverageCellCount() {
  return (
    PRICE_BAND_IDS.length *
    WRIST_BAND_IDS.length *
    DEPLOYMENT_ENVIRONMENTS.length *
    OWNERSHIP_FRICTION_LEVELS.length *
    ACCURACY_TOLERANCES.length *
    WEIGHT_LIMITS.length *
    FUNCTION_PROFILES.length
  );
}

export function* coverageCells(): Generator<CoverageCell> {
  for (const priceBand of PRICE_BAND_IDS) {
    for (const wristBand of WRIST_BAND_IDS) {
      for (const deploymentEnvironment of DEPLOYMENT_ENVIRONMENTS) {
        for (const ownershipFriction of OWNERSHIP_FRICTION_LEVELS) {
          for (const accuracyTolerance of ACCURACY_TOLERANCES) {
            for (const weightLimit of WEIGHT_LIMITS) {
              for (const functionProfile of FUNCTION_PROFILES) {
                yield {
                  priceBand,
                  wristBand,
                  deploymentEnvironment,
                  ownershipFriction,
                  accuracyTolerance,
                  weightLimit,
                  functionProfile,
                };
              }
            }
          }
        }
      }
    }
  }
}

function candidateMatchesCell(
  candidate: CoverageCandidate,
  cell: CoverageCell,
) {
  return (
    candidate.priceBands.includes(cell.priceBand) &&
    candidate.wristBands.includes(cell.wristBand) &&
    candidate.deploymentEnvironments.includes(cell.deploymentEnvironment) &&
    candidate.ownershipFrictionLevels.includes(cell.ownershipFriction) &&
    candidate.accuracyTolerances.includes(cell.accuracyTolerance) &&
    candidate.weightLimits.includes(cell.weightLimit) &&
    candidate.functionProfiles.includes(cell.functionProfile)
  );
}

function toGap(cell: CoverageCell, matches: CoverageCandidate[]): CoverageGap {
  return {
    ...cell,
    candidateCount: matches.length,
    brandCount: new Set(matches.map((candidate) => candidate.brandId)).size,
    completeCandidateCount: matches.filter(
      (candidate) => candidate.activeHardFactsComplete,
    ).length,
  };
}

function pushSample(
  samples: CoverageGap[],
  gap: CoverageGap,
  sampleLimit: number,
) {
  if (samples.length < sampleLimit) samples.push(gap);
}

export function auditCoverage(
  candidates: CoverageCandidate[],
  { sampleLimit = 25 }: { sampleLimit?: number } = {},
): CoverageAudit {
  let coveredCells = 0;
  let emptyCells = 0;
  let singleCandidateCells = 0;
  let underDiversifiedCells = 0;
  let underEvidencedCells = 0;
  const samples: CoverageAudit["samples"] = {
    empty: [],
    singleCandidate: [],
    underDiversified: [],
    underEvidenced: [],
  };

  for (const cell of coverageCells()) {
    const matches = candidates.filter((candidate) =>
      candidateMatchesCell(candidate, cell),
    );
    const gap = toGap(cell, matches);

    if (matches.length === 0) {
      emptyCells += 1;
      pushSample(samples.empty, gap, sampleLimit);
      continue;
    }

    coveredCells += 1;
    if (matches.length === 1) {
      singleCandidateCells += 1;
      pushSample(samples.singleCandidate, gap, sampleLimit);
    }
    if (gap.brandCount < 3) {
      underDiversifiedCells += 1;
      pushSample(samples.underDiversified, gap, sampleLimit);
    }
    if (gap.completeCandidateCount === 0) {
      underEvidencedCells += 1;
      pushSample(samples.underEvidenced, gap, sampleLimit);
    }
  }

  const totalCells = coverageCellCount();
  return {
    generatedAt: new Date().toISOString(),
    candidateCount: candidates.length,
    totalCells,
    coveredCells,
    emptyCells,
    singleCandidateCells,
    underDiversifiedCells,
    underEvidencedCells,
    coverageRatio: totalCells === 0 ? 0 : coveredCells / totalCells,
    samples,
  };
}
