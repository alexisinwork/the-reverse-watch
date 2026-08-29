import { catalogueParityMismatches } from "./catalogue-parity";
import { seedCatalogue } from "./seed-catalogue";

describe("catalogue parity projection", () => {
  it("ignores source IDs, array order, and equivalent ISO formatting", () => {
    const equivalent = structuredClone(seedCatalogue);
    equivalent.sources.reverse();
    equivalent.variants.reverse();
    equivalent.variants[0]!.eligibleEnvironments.reverse();
    equivalent.fx.observedAt = new Date(equivalent.fx.observedAt).toISOString();

    expect(catalogueParityMismatches(seedCatalogue, equivalent)).toEqual([]);
  });

  it("reports a decision-fact change", () => {
    const changed = structuredClone(seedCatalogue);
    changed.variants[0]!.geometry.lugToLugMm = 99;

    expect(catalogueParityMismatches(seedCatalogue, changed)).toEqual([
      `variant:${changed.variants[0]!.id}:facts`,
    ]);
  });

  it("treats field applicability as a parity-critical decision fact", () => {
    const changed = structuredClone(seedCatalogue);
    const variant = changed.variants.find(
      (candidate) => candidate.id === "grand-seiko-sbgn029",
    )!;
    variant.geometry.lugWidthMm = null;
    variant.fieldApplicability.lugWidthMm = "not_applicable";

    expect(catalogueParityMismatches(seedCatalogue, changed)).toEqual([
      `variant:${variant.id}:facts`,
    ]);
  });
});
