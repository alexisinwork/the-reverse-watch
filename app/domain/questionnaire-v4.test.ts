import {
  caseDiameterForWrist,
  PRICE_RANGES,
  priceRangeLabel,
  profileV4Schema,
} from "./questionnaire-v4";

describe("price ranges", () => {
  it("follows the owner's steps from 0 to 1M+", () => {
    const labels = PRICE_RANGES.map((range) => priceRangeLabel(range));
    expect(labels.slice(0, 4)).toEqual(["0–500", "500–1k", "1k–2k", "2k–3k"]);
    expect(labels).toContain("9k–10k");
    expect(labels).toContain("10k–15k");
    expect(labels).toContain("45k–50k");
    expect(labels).toContain("50k–75k");
    expect(labels).toContain("75k–100k");
    expect(labels).toContain("100k–200k");
    expect(labels).toContain("900k–1M");
    expect(labels.at(-1)).toBe("1M+");
  });

  it("is contiguous with no gaps or overlaps", () => {
    for (let index = 1; index < PRICE_RANGES.length; index += 1) {
      expect(PRICE_RANGES[index]!.minimum).toBe(
        PRICE_RANGES[index - 1]!.maximum,
      );
    }
    expect(new Set(PRICE_RANGES.map((range) => range.id)).size).toBe(
      PRICE_RANGES.length,
    );
  });
});

describe("wrist sizing", () => {
  it("maps wrist circumference to a proportionate diameter range", () => {
    expect(caseDiameterForWrist(14)).toEqual({ minimumMm: 34, maximumMm: 38 });
    expect(caseDiameterForWrist(17.5)).toEqual({
      minimumMm: 38,
      maximumMm: 42,
    });
    expect(caseDiameterForWrist(21)).toEqual({ minimumMm: 42, maximumMm: 46 });
  });
});

describe("profileV4Schema", () => {
  const valid = {
    version: 4,
    budgetCurrency: "EUR",
    priceRange: "3000_4000",
    wristCm: 17.5,
    wearingScenarios: ["office"],
    minimumWaterResistanceM: 100,
    movementTypes: ["automatic"],
    requiredComplications: [],
    allergyConstraint: "none",
  };

  it("accepts a complete profile", () => {
    expect(profileV4Schema.safeParse(valid).success).toBe(true);
  });

  it("rejects removed currencies, unknown ranges, and implausible wrists", () => {
    expect(
      profileV4Schema.safeParse({ ...valid, budgetCurrency: "PLN" }).success,
    ).toBe(false);
    expect(
      profileV4Schema.safeParse({ ...valid, priceRange: "3000_3500" }).success,
    ).toBe(false);
    expect(profileV4Schema.safeParse({ ...valid, wristCm: 40 }).success).toBe(
      false,
    );
  });
});
