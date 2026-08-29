import { planCoverageResearch } from "./research-planning";
import { researchManifestSchema } from "./research";

describe("coverage-first research planning", () => {
  it("orders planned targets by coverage score and excludes review work", () => {
    const manifest = researchManifestSchema.parse({
      manifestVersion: 1,
      strategy: "coverage_first",
      targetBrandCount: 3,
      updatedAt: "2026-08-28T20:00:00Z",
      brands: [
        {
          slug: "lower-priority",
          name: "Lower Priority",
          priority: "P1",
          manifestRationale: "Test priority behavior.",
          dossierState: "not_started",
          targets: [
            {
              id: "lower-priority-target",
              referenceLabel: "A lower-priority candidate",
              state: "planned",
              coverageIntent: { priceBands: ["under_300"] },
              coverageRationale: "Test priority behavior.",
            },
          ],
        },
        {
          slug: "higher-priority",
          name: "Higher Priority",
          priority: "P0",
          manifestRationale: "Test priority behavior.",
          dossierState: "not_started",
          targets: [
            {
              id: "higher-priority-target",
              referenceLabel: "A higher-priority candidate",
              state: "planned",
              coverageIntent: { priceBands: ["under_300"] },
              coverageRationale: "Test priority behavior.",
            },
          ],
        },
        {
          slug: "review-only",
          name: "Review Only",
          priority: "P0",
          manifestRationale: "Test review exclusion.",
          dossierState: "not_started",
          targets: [
            {
              id: "review-only-target",
              referenceLabel: "Already researched",
              state: "needs_review",
              coverageIntent: { priceBands: ["under_300"] },
              coverageRationale: "Test review exclusion.",
            },
          ],
        },
      ],
    });

    expect(
      planCoverageResearch(manifest, []).map((item) => item.targetId),
    ).toEqual(["higher-priority-target", "lower-priority-target"]);
  });
});
