import type { FoundWatch } from "./ai-watch-types";
import { mergeSightings } from "./film-sightings";

const sighting = (
  model: string,
  referenceCode: string | null,
  work: string,
  year: number,
): FoundWatch => ({
  brand: "Omega",
  model,
  referenceCode,
  sourceUrl: "https://www.omegawatches.com/",
  imageUrl: null,
  priceNote: null,
  rationale: `Worn in ${work}.`,
  details: { person: "Daniel Craig", work, year },
});

describe("mergeSightings", () => {
  it("shows one card per watch, naming every film it appears in", () => {
    const merged = mergeSightings([
      sighting("Planet Ocean", "2201.50.00", "Casino Royale", 2006),
      sighting("Seamaster 300M", "2220.80.00", "Casino Royale", 2006),
      sighting("Planet Ocean 600M", "2201-50-00", "Quantum of Solace", 2008),
      sighting("Aqua Terra", "231.10.39.21.03.001", "Skyfall", 2012),
      sighting("Aqua Terra", "231.10.30.20.06.001", "Skyfall", 2012),
    ]);
    expect(merged.map((watch) => watch.referenceCode)).toEqual([
      "2201.50.00",
      "2220.80.00",
      "231.10.39.21.03.001",
      "231.10.30.20.06.001",
    ]);
    expect(merged[0]!.details).toMatchObject({
      work: "Casino Royale (2006), Quantum of Solace (2008)",
      year: null,
    });
    expect(merged[0]!.rationale).toBe(
      "Worn in Casino Royale. Also worn in Quantum of Solace (2008).",
    );
    // A watch seen once keeps its own film and year.
    expect(merged[1]!.details).toMatchObject({
      work: "Casino Royale",
      year: 2006,
    });
  });
});
