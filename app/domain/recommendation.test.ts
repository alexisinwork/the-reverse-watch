import { profileV3Schema } from "./questionnaire-v3";
import {
  evaluateHardFiltersV3,
  recommendWatchesV3,
  scoreVariantV3,
} from "./recommendation";
import { seedCatalogue } from "./seed-catalogue";

const asOfMs = Date.parse("2026-09-03T00:00:00.000Z");

function v3Profile(overrides: Record<string, unknown> = {}) {
  return profileV3Schema.parse({
    version: 3,
    budgetCurrency: "USD",
    budgetMax: 1_000_000,
    wearingScenarios: [
      "office",
      "everyday",
      "sport",
      "diving",
      "field",
      "smart_casual",
      "suit",
      "evening",
      "reception",
    ],
    minimumWaterResistanceM: 0,
    caseDiameterMinMm: 20,
    caseDiameterMaxMm: 60,
    movementTypes: [
      "automatic",
      "manual",
      "quartz",
      "solar",
      "spring_drive",
      "hybrid",
    ],
    requiredComplications: [],
    allergyConstraint: "none",
    ...overrides,
  });
}

describe("evaluateHardFiltersV3", () => {
  const variant = seedCatalogue.variants[0]!;

  it("passes a permissive profile", () => {
    const result = evaluateHardFiltersV3(variant, v3Profile(), asOfMs);
    expect(result.hardReasons).toEqual([]);
  });

  it("rejects a variant above the budget ceiling", () => {
    const result = evaluateHardFiltersV3(
      variant,
      v3Profile({ budgetMax: 1 }),
      asOfMs,
    );
    expect(result.hardReasons).toContain("over_budget");
  });

  it("rejects a diameter outside the requested range", () => {
    const result = evaluateHardFiltersV3(
      variant,
      v3Profile({ caseDiameterMinMm: 59, caseDiameterMaxMm: 60 }),
      asOfMs,
    );
    expect(result.hardReasons).toContain("case_diameter_out_of_range");
  });

  it("rejects insufficient water resistance", () => {
    const result = evaluateHardFiltersV3(
      variant,
      v3Profile({ minimumWaterResistanceM: 12_000 }),
      asOfMs,
    );
    expect(result.hardReasons).toContain("water_resistance_below_minimum");
  });

  it("rejects a movement type outside the accepted set", () => {
    const other = variant.movement.type === "quartz" ? "manual" : "quartz";
    const result = evaluateHardFiltersV3(
      variant,
      v3Profile({ movementTypes: [other] }),
      asOfMs,
    );
    expect(result.hardReasons).toContain("movement_type_mismatch");
  });

  it("rejects a variant with no overlapping wearing scenario", () => {
    const result = evaluateHardFiltersV3(
      variant,
      v3Profile({ wearingScenarios: ["caving"] }),
      asOfMs,
    );
    expect(result.hardReasons).toContain("scenario_mismatch");
  });

  it("rejects a missing required complication", () => {
    const result = evaluateHardFiltersV3(
      variant,
      v3Profile({ requiredComplications: ["regatta_timer"] }),
      asOfMs,
    );
    expect(result.hardReasons).toContain("missing_complication");
  });

  it("reports an unverified diameter as a missing fact, not a pass", () => {
    const unverified = structuredClone(variant);
    unverified.geometry.caseDiameterMm = null;
    const result = evaluateHardFiltersV3(
      unverified,
      v3Profile({ caseDiameterMinMm: 36, caseDiameterMaxMm: 40 }),
      asOfMs,
    );
    expect(result.missingFacts).toContain("case_diameter");
    expect(result.hardReasons).not.toContain("case_diameter_out_of_range");
  });

  it("reports an unverified nickel risk when an allergy is declared", () => {
    const unverified = structuredClone(variant);
    unverified.operation.nickelContactRisk = null;
    const result = evaluateHardFiltersV3(
      unverified,
      v3Profile({ allergyConstraint: "nickel_contact" }),
      asOfMs,
    );
    expect(result.missingFacts).toContain("nickel_contact_risk");
  });

  it("rejects a confirmed nickel risk under an allergy constraint", () => {
    const risky = structuredClone(variant);
    risky.operation.nickelContactRisk = "confirmed";
    risky.evidence.push({
      sourceId: variant.evidence[0]!.sourceId,
      fields: ["nickelContactRisk"],
    });
    const result = evaluateHardFiltersV3(
      risky,
      v3Profile({ allergyConstraint: "nickel_contact" }),
      asOfMs,
    );
    expect(result.hardReasons).toContain("allergy_risk");
  });
});

describe("scoreVariantV3", () => {
  const variant = seedCatalogue.variants[0]!;

  it("rewards a diameter at the centre of the requested range", () => {
    const diameter = variant.geometry.caseDiameterMm!;
    const centred = scoreVariantV3(
      variant,
      v3Profile({
        caseDiameterMinMm: diameter - 2,
        caseDiameterMaxMm: diameter + 2,
      }),
    );
    const offset = scoreVariantV3(
      variant,
      v3Profile({
        caseDiameterMinMm: diameter,
        caseDiameterMaxMm: diameter + 10,
      }),
    );
    expect(centred.score).toBeGreaterThan(offset.score);
  });

  it("rewards a crystal match", () => {
    const matched = scoreVariantV3(
      variant,
      v3Profile({ crystal: variant.operation.crystal ?? undefined }),
    );
    expect(
      matched.scoreTrace.some((factor) => factor.factor === "crystal_match"),
    ).toBe(true);
  });

  it("contributes nothing when a soft preference is unset", () => {
    const trace = scoreVariantV3(variant, v3Profile()).scoreTrace;
    expect(trace.some((factor) => factor.factor === "crystal_match")).toBe(
      false,
    );
  });
});

describe("recommendWatchesV3", () => {
  it("returns at most three recommendations with distinct brands", () => {
    const result = recommendWatchesV3(v3Profile(), seedCatalogue, {
      asOf: "2026-09-03T00:00:00.000Z",
    });
    expect(result.recommendations.length).toBeLessThanOrEqual(3);
    const brands = result.recommendations.map(
      (candidate) => candidate.brandSlug,
    );
    expect(new Set(brands).size).toBe(brands.length);
  });

  it("is deterministic across repeated evaluation", () => {
    const run = () =>
      recommendWatchesV3(v3Profile(), seedCatalogue, {
        asOf: "2026-09-03T00:00:00.000Z",
      });
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });

  it("never recommends a candidate carrying a hard reason", () => {
    const result = recommendWatchesV3(v3Profile(), seedCatalogue, {
      asOf: "2026-09-03T00:00:00.000Z",
    });
    for (const candidate of result.recommendations) {
      expect(candidate.hardReasons).toEqual([]);
      expect(candidate.missingFacts).toEqual([]);
    }
  });

  it("reports unpopulated soft dimensions as unscored", () => {
    const result = recommendWatchesV3(
      v3Profile({ caseShape: "round" }),
      seedCatalogue,
      { asOf: "2026-09-03T00:00:00.000Z" },
    );
    expect(
      result.unscoredPreferences.some((entry) => entry.field === "caseShape"),
    ).toBe(true);
  });

  it("carries the positioning line onto each candidate", () => {
    const result = recommendWatchesV3(v3Profile(), seedCatalogue, {
      asOf: "2026-09-03T00:00:00.000Z",
    });
    for (const candidate of result.recommendations) {
      expect(candidate).toHaveProperty("positioningLine");
      expect(candidate).toHaveProperty("positioningGroup");
    }
  });
});
