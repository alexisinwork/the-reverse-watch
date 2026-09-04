import {
  derivePriceBand,
  effectiveBudgetCeiling,
  WEIGHT_LIMIT_GRAMS,
  WEIGHT_LIMITS,
  WRIST_BANDS,
} from "./questionnaire";

describe("shared questionnaire constants", () => {
  it("derives one price band at every shared boundary", () => {
    expect(derivePriceBand(299.99)).toBe("under_300");
    expect(derivePriceBand(300)).toBe("300_500");
    expect(derivePriceBand(500)).toBe("500_1000");
    expect(derivePriceBand(1_000)).toBe("1000_2000");
    expect(derivePriceBand(2_000)).toBe("2000_5000");
    expect(derivePriceBand(5_000)).toBe("5000_10000");
    expect(derivePriceBand(10_000)).toBe("10000_15000");
    expect(derivePriceBand(15_000)).toBe("15000_plus");
  });

  it("rejects a non-positive or non-finite price", () => {
    expect(() => derivePriceBand(0)).toThrow(RangeError);
    expect(() => derivePriceBand(Number.NaN)).toThrow(RangeError);
  });

  it("expands a budget ceiling only by an explicit whole-percent allowance", () => {
    expect(effectiveBudgetCeiling(10_000)).toBe(10_000);
    expect(effectiveBudgetCeiling(10_000, 30)).toBe(13_000);
    expect(() => effectiveBudgetCeiling(10_000, 101)).toThrow(RangeError);
    expect(() => effectiveBudgetCeiling(0)).toThrow(RangeError);
  });

  it("keeps the coverage-grid bands contiguous and closed at the top", () => {
    for (const [index, band] of WRIST_BANDS.entries()) {
      const next = WRIST_BANDS[index + 1];
      if (!next) {
        expect(band.maximumExclusiveMm).toBeNull();
        continue;
      }
      expect(band.maximumExclusiveMm).toBe(next.minimumMm);
    }
  });

  it("maps every weight limit to a gram ceiling or an explicit absence", () => {
    for (const limit of WEIGHT_LIMITS) {
      const grams = WEIGHT_LIMIT_GRAMS[limit];
      expect(grams === null || grams > 0).toBe(true);
    }
    expect(WEIGHT_LIMIT_GRAMS.no_limit).toBeNull();
  });
});
