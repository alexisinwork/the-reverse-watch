import { describe, expect, it } from "vitest";

import { normalizeProfileV3, profileV3Schema } from "./questionnaire-v3";

const valid = {
  version: 3 as const,
  budgetCurrency: "USD" as const,
  budgetMax: 15_000,
  wearingScenarios: ["office", "sport"],
  minimumWaterResistanceM: 100,
  caseDiameterMinMm: 36,
  caseDiameterMaxMm: 41,
  movementTypes: ["automatic" as const],
  requiredComplications: ["date"],
  allergyConstraint: "none" as const,
};

describe("profileV3Schema", () => {
  it("accepts a minimal valid profile", () => {
    expect(() => profileV3Schema.parse(valid)).not.toThrow();
  });

  it("accepts optional soft preferences", () => {
    expect(() =>
      profileV3Schema.parse({
        ...valid,
        maxCaseThicknessMm: 12,
        caseShape: "round",
        movementConstruction: "manufacture",
        displayCaseback: true,
        crystal: "sapphire",
        microAdjustmentRequired: true,
      }),
    ).not.toThrow();
  });

  it("rejects an inverted diameter range", () => {
    expect(() =>
      profileV3Schema.parse({
        ...valid,
        caseDiameterMinMm: 42,
        caseDiameterMaxMm: 38,
      }),
    ).toThrow();
  });

  it("rejects an empty movement-type selection", () => {
    expect(() =>
      profileV3Schema.parse({ ...valid, movementTypes: [] }),
    ).toThrow();
  });

  it("rejects a duplicated movement type", () => {
    expect(() =>
      profileV3Schema.parse({
        ...valid,
        movementTypes: ["automatic", "automatic"],
      }),
    ).toThrow();
  });

  it("rejects an empty wearing-scenario selection", () => {
    expect(() =>
      profileV3Schema.parse({ ...valid, wearingScenarios: [] }),
    ).toThrow();
  });

  it("accepts an empty complication requirement", () => {
    expect(() =>
      profileV3Schema.parse({ ...valid, requiredComplications: [] }),
    ).not.toThrow();
  });

  it("rejects an unknown key", () => {
    expect(() =>
      profileV3Schema.parse({ ...valid, socialSignal: "quiet_continuity" }),
    ).toThrow();
  });

  it("rejects a non-positive budget", () => {
    expect(() => profileV3Schema.parse({ ...valid, budgetMax: 0 })).toThrow();
  });
});

describe("normalizeProfileV3", () => {
  it("derives the price band and ceiling", () => {
    const normalized = normalizeProfileV3(profileV3Schema.parse(valid));
    // 15,000 is the exclusive upper edge of the 10,000-15,000 band in the
    // shared PRICE_BANDS constant, so it lands in the band above.
    expect(normalized.derived.priceBand).toBe("15000_plus");
    expect(normalized.derived.effectiveBudgetCeiling).toBe(15_000);
  });
});
