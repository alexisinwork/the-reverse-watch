import {
  convertMinorCurrency,
  evidenceFields,
  isFieldNotApplicable,
  seedCatalogueSchema,
  supportedAccuracyTolerances,
  verifiedCaseWearingSpanMm,
} from "./catalogue";
import { seedCatalogue } from "./seed-catalogue";

describe("source-backed seed catalogue", () => {
  it("passes the strict catalogue contract with unique reference variants", () => {
    expect(seedCatalogue.catalogueVersion).toBe(2);
    expect(seedCatalogueSchema.parse(seedCatalogue).variants).toHaveLength(18);
    expect(
      new Set(seedCatalogue.variants.map((variant) => variant.id)).size,
    ).toBe(18);
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

  it("supports evidenced rectangular dimensions without inventing a diameter", () => {
    const rectangular = structuredClone(seedCatalogue);
    const variant = rectangular.variants[0]!;
    variant.geometry.caseDiameterMm = null;
    variant.geometry.caseWidthMm = 22;
    variant.geometry.caseLengthMm = 29.5;
    variant.geometry.lugToLugMm = null;
    variant.evidence = variant.evidence.map((entry) => ({
      ...entry,
      fields: entry.fields.filter((field) => field !== "lugToLugMm"),
    }));
    variant.evidence[0]!.fields.push("caseWidthMm", "caseLengthMm");

    const parsed = seedCatalogueSchema.parse(rectangular);
    expect(verifiedCaseWearingSpanMm(parsed.variants[0]!)).toBe(29.5);
  });

  it("stores the Reverso's manufacturer dimensions as length and width", () => {
    const reverso = seedCatalogue.variants.find(
      (variant) => variant.id === "jlc-q3988481",
    );

    expect(reverso).toBeDefined();
    expect(reverso!.geometry).toMatchObject({
      caseDiameterMm: null,
      caseWidthMm: 28.3,
      caseLengthMm: 47,
      lugToLugMm: 47,
    });
    expect(evidenceFields(reverso!).has("caseDiameterMm")).toBe(false);
    expect(evidenceFields(reverso!).has("caseWidthMm")).toBe(true);
    expect(evidenceFields(reverso!).has("caseLengthMm")).toBe(true);
    expect(verifiedCaseWearingSpanMm(reverso!)).toBe(47);
  });

  it("retains the reviewed Black Bay 54 bracelet configuration", () => {
    const tudor = seedCatalogue.variants.find(
      (variant) => variant.id === "tudor-m79000n-0001",
    );

    expect(tudor).toBeDefined();
    expect(tudor!.referenceCode).toBe("M79000N-0001");
    expect(tudor!.geometry).toMatchObject({
      caseDiameterMm: 37,
      caseThicknessMm: 11.2,
      lugToLugMm: 45.8,
      lugWidthMm: 20,
      weightFullG: 139,
    });
    expect(tudor!.movement).toMatchObject({
      accuracyLowerSeconds: -2,
      accuracyUpperSeconds: 4,
      accuracyPeriodDays: 1,
    });
    expect(tudor!.operation.attachmentType).toBe("spring_bar");
    expect(evidenceFields(tudor!).has("attachmentType")).toBe(true);
    expect(evidenceFields(tudor!).has("weightFullG")).toBe(true);
  });

  it("rejects a partial non-round dimension pair", () => {
    const rectangular = structuredClone(seedCatalogue);
    rectangular.variants[0]!.geometry.caseDiameterMm = null;
    rectangular.variants[0]!.geometry.caseWidthMm = 22;
    rectangular.variants[0]!.geometry.caseLengthMm = null;

    expect(seedCatalogueSchema.safeParse(rectangular).success).toBe(false);
  });

  it("distinguishes an evidenced non-applicable lug width from missing data", () => {
    const catalogue = structuredClone(seedCatalogue);
    const variant = catalogue.variants.find(
      (candidate) => candidate.id === "grand-seiko-sbgn029",
    )!;
    variant.geometry.lugWidthMm = null;
    variant.fieldApplicability.lugWidthMm = "not_applicable";

    const parsed = seedCatalogueSchema.parse(catalogue);
    const parsedVariant = parsed.variants.find(
      (candidate) => candidate.id === variant.id,
    )!;
    expect(isFieldNotApplicable(parsedVariant, "lugWidthMm")).toBe(true);
  });

  it("rejects ambiguous or contradictory lug-width applicability", () => {
    const evidencedNull = structuredClone(seedCatalogue);
    const missingState = evidencedNull.variants.find(
      (candidate) => candidate.id === "grand-seiko-sbgn029",
    )!;
    missingState.geometry.lugWidthMm = null;
    expect(seedCatalogueSchema.safeParse(evidencedNull).success).toBe(false);

    const contradictory = structuredClone(seedCatalogue);
    const numericNotApplicable = contradictory.variants.find(
      (candidate) => candidate.id === "grand-seiko-sbgn029",
    )!;
    numericNotApplicable.fieldApplicability.lugWidthMm = "not_applicable";
    expect(seedCatalogueSchema.safeParse(contradictory).success).toBe(false);
  });
});
