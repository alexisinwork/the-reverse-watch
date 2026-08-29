import { coverageCells, evaluateCoverageCell } from "./coverage";
import type { CoverageCandidate, CoverageCell } from "./coverage";
import type {
  CoverageIntent,
  ResearchManifest,
  ResearchTarget,
} from "./research";

export const RESEARCH_INTENT_FIELDS = [
  ["priceBands", "priceBand"],
  ["wristBands", "wristBand"],
  ["deploymentEnvironments", "deploymentEnvironment"],
  ["ownershipFrictionLevels", "ownershipFriction"],
  ["accuracyTolerances", "accuracyTolerance"],
  ["weightLimits", "weightLimit"],
  ["functionProfiles", "functionProfile"],
] as const;

export type CoverageResearchPlanItem = {
  targetId: string;
  brand: string;
  priority: "P0" | "P1" | "P2" | "P3";
  state: ResearchTarget["state"];
  score: number;
  specifiedAxes: number;
  targetedCells: number;
  emptyCells: number;
  underDiversifiedCells: number;
  underEvidencedCells: number;
  rationale: string;
};

const PRIORITY_WEIGHT = { P0: 400, P1: 300, P2: 200, P3: 100 } as const;

function intentMatchesCell(intent: CoverageIntent, cell: CoverageCell) {
  return RESEARCH_INTENT_FIELDS.every(([intentField, cellField]) => {
    const accepted = intent[intentField] as readonly string[] | undefined;
    return accepted === undefined || accepted.includes(cell[cellField]);
  });
}

export function planCoverageResearch(
  manifest: ResearchManifest,
  candidates: CoverageCandidate[],
): CoverageResearchPlanItem[] {
  const cells = [...coverageCells()];

  return manifest.brands
    .flatMap((brand) =>
      brand.targets.flatMap((target) => {
        const intent = target.coverageIntent;
        if (!intent || target.state !== "planned") return [];

        const targeted = cells.filter((cell) =>
          intentMatchesCell(intent, cell),
        );
        const gaps = targeted.map((cell) =>
          evaluateCoverageCell(candidates, cell),
        );
        const emptyCells = gaps.filter(
          (gap) => gap.candidateCount === 0,
        ).length;
        const underDiversifiedCells = gaps.filter(
          (gap) => gap.brandCount < 3,
        ).length;
        const underEvidencedCells = gaps.filter(
          (gap) => gap.completeCandidateCount === 0,
        ).length;
        const denominator = Math.max(1, targeted.length);
        const specifiedAxes = RESEARCH_INTENT_FIELDS.filter(
          ([intentField]) => intent[intentField] !== undefined,
        ).length;
        const score = Math.round(
          PRIORITY_WEIGHT[brand.priority] +
            (emptyCells / denominator) * 300 +
            (underDiversifiedCells / denominator) * 200 +
            (underEvidencedCells / denominator) * 100 +
            specifiedAxes * 10,
        );

        return [
          {
            targetId: target.id,
            brand: brand.name,
            priority: brand.priority,
            state: target.state,
            score,
            specifiedAxes,
            targetedCells: targeted.length,
            emptyCells,
            underDiversifiedCells,
            underEvidencedCells,
            rationale: target.coverageRationale,
          },
        ];
      }),
    )
    .sort(
      (left, right) =>
        right.score - left.score || left.targetId.localeCompare(right.targetId),
    );
}
