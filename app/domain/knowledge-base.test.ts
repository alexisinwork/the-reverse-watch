import {
  extractSourceUrls,
  parseCsvRows,
  requiresVariantSplit,
} from "./knowledge-base";

describe("knowledge-base intake helpers", () => {
  it("parses quoted CSV fields containing commas", () => {
    expect(
      parseCsvRows('brand,model,notes\nCartier,Tank,"10,7; 7,1"\n'),
    ).toEqual([
      ["brand", "model", "notes"],
      ["Cartier", "Tank", "10,7; 7,1"],
    ]);
  });

  it("deduplicates source URLs", () => {
    expect(
      extractSourceUrls(
        "[one](https://example.com/watch) https://example.com/watch.",
      ),
    ).toEqual(["https://example.com/watch"]);
  });

  it("flags family rollups while retaining a rectangular exact case", () => {
    expect(
      requiresVariantSplit({
        model: "Explorer 36 / 40",
        diameterRaw: "36/40",
        thicknessRaw: "11.6",
        lugToLugRaw: "43/47",
      }),
    ).toBe(true);
    expect(
      requiresVariantSplit({
        model: "Tank Must WSTA0042",
        diameterRaw: "29.5×22",
        thicknessRaw: "6.6",
        lugToLugRaw: "29.5",
      }),
    ).toBe(false);
  });
});
