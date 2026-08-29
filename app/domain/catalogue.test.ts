import {
  convertMinorCurrency,
  evidenceFields,
  seedCatalogueSchema,
  supportedAccuracyTolerances,
} from "./catalogue";
import { seedCatalogue } from "./seed-catalogue";

describe("source-backed seed catalogue", () => {
  it("passes the strict catalogue contract with unique reference variants", () => {
    expect(seedCatalogueSchema.parse(seedCatalogue).variants).toHaveLength(17);
    expect(
      new Set(seedCatalogue.variants.map((variant) => variant.id)).size,
    ).toBe(17);
  });

  it("retains evidence for every seed identity and price", () => {
    for (const variant of seedCatalogue.variants) {
      expect(evidenceFields(variant).has("identity")).toBe(true);
      expect(evidenceFields(variant).has("price")).toBe(true);
      expect(variant.price.marketCountry).toMatch(/^[A-Z]{2}$/);
      expect(variant.brand.serviceCountries).toBeNull();
    }
  });

  it("converts prices through the dated EUR reference-rate cross", () => {
    expect(convertMinorCurrency(116_430, "USD", "EUR", seedCatalogue.fx)).toBe(
      100_000,
    );
    expect(convertMinorCurrency(100_000, "EUR", "PLN", seedCatalogue.fx)).toBe(
      433_650,
    );
  });

  it("normalizes daily, monthly, and annual accuracy without string tags", () => {
    const citizen = seedCatalogue.variants.find(
      (variant) => variant.id === "citizen-bn0150-28e",
    );
    const grandSeiko = seedCatalogue.variants.find(
      (variant) => variant.id === "grand-seiko-sbgn029",
    );
    expect(citizen).toBeDefined();
    expect(grandSeiko).toBeDefined();
    expect(supportedAccuracyTolerances(citizen!.movement)).toContain(
      "seconds_per_month",
    );
    expect(supportedAccuracyTolerances(grandSeiko!.movement)).toContain(
      "within_5_seconds_per_day",
    );
  });
});
