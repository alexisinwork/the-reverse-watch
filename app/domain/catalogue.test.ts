import {
  convertMinorCurrency,
  evidenceFields,
  isFieldNotApplicable,
  priceSnapshotKind,
  seedCatalogueSchema,
  supportedAccuracyTolerances,
  verifiedCaseWearingSpanMm,
} from "./catalogue";
import { seedCatalogue } from "./seed-catalogue";
import ownerReferenceIntake from "../../data/research/rolex-owner-reference-intake.json";

describe("source-backed seed catalogue", () => {
  it("passes the strict catalogue contract with unique reference variants", () => {
    expect(seedCatalogue.catalogueVersion).toBe(2);
    expect(seedCatalogueSchema.parse(seedCatalogue).variants).toHaveLength(71);
    expect(
      new Set(seedCatalogue.variants.map((variant) => variant.id)).size,
    ).toBe(71);
  });

  it("promotes every researched Rolex exact reference into the recommendation catalogue", () => {
    const rolex = seedCatalogue.variants.filter(
      (variant) => variant.brand.slug === "rolex",
    );

    expect(rolex).toHaveLength(45);
    expect(new Set(rolex.map((variant) => variant.referenceCode)).size).toBe(
      45,
    );
    for (const variant of rolex) {
      const fields = evidenceFields(variant);
      expect(variant.referenceCode).not.toBe("");
      expect(variant.price.amountMinor).toBeGreaterThan(0);
      expect(fields.has("price")).toBe(true);
      expect(variant.geometry.lugToLugMm).toBeGreaterThan(0);
      expect(fields.has("lugToLugMm")).toBe(true);
    }
  });

  it("includes every owner-approved Rolex reference in recommendation-ready form", () => {
    const rolex = seedCatalogue.variants.filter(
      (variant) => variant.brand.slug === "rolex",
    );

    expect(ownerReferenceIntake.targets).toHaveLength(34);
    for (const approved of ownerReferenceIntake.targets) {
      const requested = approved.referenceCode.toUpperCase();
      const variant = rolex.find((candidate) => {
        const reference = candidate.referenceCode.toUpperCase();
        return reference === requested || reference.startsWith(`${requested}-`);
      });

      expect(variant, approved.referenceCode).toBeDefined();
      expect(variant!.price.amountMinor).toBeGreaterThan(0);
      expect(evidenceFields(variant!).has("price")).toBe(true);
      expect(variant!.geometry.lugToLugMm).toBeGreaterThan(0);
      expect(evidenceFields(variant!).has("lugToLugMm")).toBe(true);
    }
  });

  it("retains the reviewed Rolex workbook variants as M1-complete exact configurations", () => {
    const submariner = seedCatalogue.variants.find(
      (variant) => variant.id === "rolex-124060",
    );
    const seaDweller = seedCatalogue.variants.find(
      (variant) => variant.id === "rolex-126600",
    );

    expect(submariner).toBeDefined();
    expect(submariner!.price.amountMinor).toBe(1_005_000);
    expect(submariner!.geometry).toMatchObject({
      caseDiameterMm: 41,
      caseThicknessMm: 12.5,
      lugToLugMm: 47.6,
      lugWidthMm: 21,
      weightFullG: 158.8,
    });
    expect(submariner!.operation).toMatchObject({
      waterResistanceM: 300,
      lumeGrade: "strong",
      attachmentType: "spring_bar",
    });
    expect(submariner!.dateStatus).toBe("absent");

    expect(seaDweller).toBeDefined();
    expect(seaDweller!.price.amountMinor).toBe(1_455_000);
    expect(seaDweller!.geometry).toMatchObject({
      caseDiameterMm: 43,
      caseThicknessMm: 15,
      lugToLugMm: 51,
      lugWidthMm: 22,
      weightFullG: 194,
    });
    expect(seaDweller!.operation).toMatchObject({
      waterResistanceM: 1220,
      lumeGrade: "strong",
      attachmentType: "spring_bar",
    });
    expect(seaDweller!.dateStatus).toBe("present");

    const requiredEvidenceFields = [
      "caseDiameterMm",
      "caseThicknessMm",
      "lugToLugMm",
      "lugWidthMm",
      "weightFullG",
      "movement",
      "accuracy",
      "waterResistanceM",
      "lumeGrade",
      "attachmentType",
      "dateStatus",
    ] as const;
    for (const variant of [submariner!, seaDweller!]) {
      const fields = evidenceFields(variant);
      for (const field of requiredEvidenceFields) {
        expect(fields.has(field)).toBe(true);
      }
    }
  });

  it("retains evidence for every seed identity and price", () => {
    for (const variant of seedCatalogue.variants) {
      expect(evidenceFields(variant).has("identity")).toBe(true);
      expect(evidenceFields(variant).has("price")).toBe(true);
      expect(variant.price.marketCountry).toMatch(/^[A-Z]{2}$/);
      expect(variant.brand.serviceCountries).toBeNull();
    }
  });

  it("maps acquisition channels to the relational price snapshot kind", () => {
    expect(priceSnapshotKind(["authorized_dealer"])).toBe("retail");
    expect(priceSnapshotKind(["grey_market"])).toBe("grey_market_ask");
    expect(priceSnapshotKind(["secondary_market"])).toBe("secondary_ask");
  });

  it("does not claim evidence for an unknown availability state", () => {
    const seiko = seedCatalogue.variants.find(
      (variant) => variant.id === "seiko-hcc004j1",
    );

    expect(seiko).toBeDefined();
    expect(seiko!.price.availability).toBe("unknown");
    expect(evidenceFields(seiko!).has("availability")).toBe(false);
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

  it("retains the reviewed Seiko solar-diver accuracy and attachment", () => {
    const seiko = seedCatalogue.variants.find(
      (variant) => variant.id === "seiko-sne599p1",
    );

    expect(seiko).toBeDefined();
    expect(seiko!.geometry).toMatchObject({
      caseDiameterMm: 41,
      caseThicknessMm: 11.3,
      lugToLugMm: 48.8,
      lugWidthMm: 20,
      weightFullG: 157,
    });
    expect(seiko!.movement).toMatchObject({
      type: "solar",
      caliber: "Seiko V157",
      powerReserveHours: 7300,
      accuracyLowerSeconds: -15,
      accuracyUpperSeconds: 15,
      accuracyPeriodDays: 30,
    });
    expect(seiko!.operation).toMatchObject({
      waterResistanceM: 200,
      lumeGrade: "strong",
      attachmentType: "spring_bar",
    });
    expect(evidenceFields(seiko!).has("attachmentType")).toBe(true);
  });

  it("retains the reviewed Mondaine no-date and no-lume configuration", () => {
    const mondaine = seedCatalogue.variants.find(
      (variant) => variant.id === "mondaine-classic-a660-30314-11sbbv",
    );

    expect(mondaine).toBeDefined();
    expect(mondaine!.referenceCode).toBe("A660.30314.11SBBV");
    expect(mondaine!.geometry).toMatchObject({
      caseDiameterMm: 36,
      caseWidthMm: 36,
      caseLengthMm: 43,
      caseThicknessMm: 7.5,
      lugWidthMm: 18,
      weightFullG: 37,
    });
    expect(mondaine!.movement).toMatchObject({
      type: "quartz",
      caliber: "Ronda 513 RL",
      accuracyLowerSeconds: -10,
      accuracyUpperSeconds: 20,
      accuracyPeriodDays: 30,
    });
    expect(mondaine!.operation).toMatchObject({
      waterResistanceM: 30,
      lumeGrade: "none",
      attachmentType: "quick_release",
    });
    expect(mondaine!.complications).toEqual([]);
    expect(mondaine!.dateStatus).toBe("absent");
    expect(evidenceFields(mondaine!).has("lumeGrade")).toBe(true);
    expect(evidenceFields(mondaine!).has("attachmentType")).toBe(true);
  });

  it("retains the reviewed Bertucci fixed-bar titanium configuration", () => {
    const bertucci = seedCatalogue.variants.find(
      (variant) => variant.id === "bertucci-a2t-original-classic-12022",
    );

    expect(bertucci).toBeDefined();
    expect(bertucci!.referenceCode).toBe("12022");
    expect(bertucci!.geometry).toMatchObject({
      caseDiameterMm: 40,
      caseThicknessMm: 11,
      lugToLugMm: 49.5,
      lugWidthMm: 22,
      weightFullG: 62,
      integratedBracelet: false,
    });
    expect(bertucci!.movement).toMatchObject({
      type: "quartz",
      caliber: null,
      powerReserveHours: null,
      accuracyLowerSeconds: -20,
      accuracyUpperSeconds: 20,
      accuracyPeriodDays: 30,
    });
    expect(bertucci!.operation).toMatchObject({
      waterResistanceM: 200,
      crownType: "screw_down",
      crownPosition: "4",
      lumeGrade: "moderate",
      attachmentType: "proprietary",
    });
    expect(bertucci!.complications).toEqual([]);
    expect(bertucci!.dateStatus).toBe("present");
    expect(evidenceFields(bertucci!).has("lumeGrade")).toBe(true);
    expect(evidenceFields(bertucci!).has("attachmentType")).toBe(true);
  });

  it("retains the reviewed Luminox tritium field configuration", () => {
    const luminox = seedCatalogue.variants.find(
      (variant) => variant.id === "luminox-leatherback-xs-0307-wo",
    );

    expect(luminox).toBeDefined();
    expect(luminox!.referenceCode).toBe("XS.0307.WO");
    expect(luminox!.geometry).toMatchObject({
      caseDiameterMm: 39,
      caseThicknessMm: 12,
      lugToLugMm: 46,
      lugWidthMm: 19,
      weightFullG: 48,
      integratedBracelet: false,
    });
    expect(luminox!.movement).toMatchObject({
      type: "quartz",
      caliber: "Ronda 515",
      accuracyLowerSeconds: -10,
      accuracyUpperSeconds: 20,
      accuracyPeriodDays: 30,
    });
    expect(luminox!.operation).toMatchObject({
      waterResistanceM: 100,
      crownType: "push_pull",
      crystal: "mineral",
      lumeGrade: "strong",
      attachmentType: "spring_bar",
    });
    expect(luminox!.complications).toEqual([]);
    expect(luminox!.dateStatus).toBe("present");
    expect(evidenceFields(luminox!).has("lumeGrade")).toBe(true);
    expect(evidenceFields(luminox!).has("attachmentType")).toBe(true);
  });

  it("retains the reviewed Laco compact pilot configuration", () => {
    const laco = seedCatalogue.variants.find(
      (variant) => variant.id === "laco-augsburg-39-861988",
    );

    expect(laco).toBeDefined();
    expect(laco!.referenceCode).toBe("861988");
    expect(laco!.geometry).toMatchObject({
      caseDiameterMm: 39,
      caseThicknessMm: 11.55,
      lugToLugMm: 46.5,
      lugWidthMm: 18,
      weightFullG: 81.5,
      integratedBracelet: false,
    });
    expect(laco!.movement).toMatchObject({
      type: "automatic",
      accuracyLowerSeconds: 0,
      accuracyUpperSeconds: 25,
      accuracyPeriodDays: 1,
    });
    expect(laco!.operation).toMatchObject({
      waterResistanceM: 50,
      crystal: "sapphire",
      lumeGrade: "strong",
      attachmentType: "spring_bar",
    });
    expect(laco!.dateStatus).toBe("absent");
    expect(evidenceFields(laco!).has("lumeGrade")).toBe(true);
  });

  it("retains the reviewed Vostok Europe leather-worn chronograph configuration", () => {
    const vostokEurope = seedCatalogue.variants.find(
      (variant) => variant.id === "vostok-europe-vk61-571h614",
    );

    expect(vostokEurope).toBeDefined();
    expect(vostokEurope!.referenceCode).toBe("VK61-571H614");
    expect(vostokEurope!.materials.strap).toBe(
      "black leather with petrol contrast stitching",
    );
    expect(vostokEurope!.geometry).toMatchObject({
      caseDiameterMm: 45.7,
      caseThicknessMm: 15.6,
      lugToLugMm: 56.2,
      lugWidthMm: 22,
      weightFullG: 135,
      integratedBracelet: false,
    });
    expect(vostokEurope!.movement).toMatchObject({
      type: "hybrid",
      caliber: "TMI VK61A",
      accuracyLowerSeconds: -20,
      accuracyUpperSeconds: 20,
      accuracyPeriodDays: 30,
    });
    expect(vostokEurope!.operation).toMatchObject({
      waterResistanceM: 300,
      crownType: "screw_down",
      crystal: "mineral",
      lumeGrade: "strong",
      attachmentType: "proprietary",
    });
    expect(vostokEurope!.complications).toEqual(["chronograph"]);
    expect(vostokEurope!.dateStatus).toBe("present");
    expect(evidenceFields(vostokEurope!).has("weightFullG")).toBe(true);
    expect(evidenceFields(vostokEurope!).has("attachmentType")).toBe(true);
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
