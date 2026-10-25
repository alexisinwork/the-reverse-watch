import type { FoundWatch } from "./ai-watch-types";
import { uniqueSearchView, uniqueWatchResults } from "./watch-result-dedup";

function watch(
  model: string,
  referenceCode: string | null,
  brand = "Omega",
): FoundWatch {
  return {
    brand,
    model,
    referenceCode,
    sourceUrl: "https://example.com/evidence",
    imageUrl: null,
    priceNote: null,
    rationale: "Checked facts.",
    details: {},
  };
}

describe("last-mile watch deduplication", () => {
  it("shows Daniel Craig's repeated Planet Ocean and Aqua Terra titles once", () => {
    const planet = "Seamaster Planet Ocean 600M Co-Axial Chronometer";
    const aqua = "Seamaster Aqua Terra 150M Co-Axial Chronometer";
    const cards = [
      watch(planet, "2201.50.00"),
      watch(planet, "2201.50.00"),
      watch(planet, "232.30.42.21.01.001"),
      watch(aqua, "231.10.39.21.03.001"),
      watch(aqua, "231.10.30.20.06.001"),
      watch("Seamaster Diver 300M", "2220.80.00"),
    ];
    expect(uniqueWatchResults(cards)).toEqual([cards[0], cards[3], cards[5]]);
    expect(cards).toHaveLength(6);
  });

  it("matches normalized references even when model titles differ", () => {
    const first = watch("Planet Ocean", "2201.50.00");
    expect(
      uniqueWatchResults([
        first,
        watch("Seamaster Planet Ocean 600M", "2201-50-00"),
      ]),
    ).toEqual([first]);
  });

  it("normalizes case, accents, repeated brand prefixes and title punctuation", () => {
    const first = watch("Seamaster Co-Axial", null, "OMEGA");
    expect(
      uniqueWatchResults([first, watch("Omega Séamaster co axial", null)]),
    ).toEqual([first]);
  });

  it("keeps unrelated models, brands and unknown-reference watches", () => {
    const cards = [
      watch("Aqua Terra", "null"),
      watch("Planet Ocean", "null"),
      watch("Aqua Terra", "ref123", "Another brand"),
      watch("Planét", null),
      watch("Planet Ocean GMT", null),
      watch("Another model", "not provided"),
      watch("Different model", "not provided"),
    ];
    expect(uniqueWatchResults(cards)).toEqual(cards);
  });

  it("resolves title/reference aliases transitively without mixing variant facts", () => {
    const first = {
      ...watch("Planet Ocean", "ref123"),
      details: { caseDiameterMm: 39, price: { amount: 1000, currency: "USD" } },
    };
    const renamed = watch("Planet Ocean 600M", "REF-123");
    const variant = {
      ...watch("Planet Ocean 600M", "ref456"),
      details: { caseDiameterMm: 45, price: { amount: 6000, currency: "USD" } },
    };
    const result = uniqueWatchResults([first, variant, renamed]);
    expect(result).toEqual([first]);
    expect(result[0]).toBe(first);
    expect(first.details).toEqual({
      caseDiameterMm: 39,
      price: { amount: 1000, currency: "USD" },
    });
  });

  it("removes repeats across main and also-worth cards, including repeated object instances", () => {
    const first = watch("Aqua Terra", "ref123");
    const other = watch("Planet Ocean", "ref456");
    const result = uniqueSearchView({
      status: "found",
      fromCache: true,
      summary: "2 watches suit you.",
      watches: [first, first],
      alsoWorth: [watch("Aqua Terra", "ref789"), other, other],
    });
    expect(result).toMatchObject({
      watches: [first],
      alsoWorth: [other],
      summary: "1 watch suit you.",
    });
    expect(uniqueSearchView(result)).toEqual(result);
  });
});
