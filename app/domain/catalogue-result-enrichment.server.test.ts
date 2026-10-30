import { describe, it, expect } from "vitest";
import { catalogueWatchSchema } from "./watch-catalogue";
import {
  mergeCatalogueFacts,
  enrichResultWatches,
} from "./catalogue-result-enrichment.server";
import { quoteSupportsValue } from "./catalogue-enrichment.server";
import type { FoundWatch } from "./ai-watch-types";
import { rankEnrichedArchetype } from "./archetype-catalogue.server";
import { resolveNamedWatch } from "./alternatives.server";
import { rankAlternatives } from "./alternatives";

const catalogue = (patch: Record<string, unknown> = {}) =>
  catalogueWatchSchema.parse({
    id: "reference-id",
    identityKey: "seiko|skx007j",
    brand: "Seiko",
    model: "Diver",
    referenceCode: "SKX007J",
    referenceConfirmed: true,
    styles: ["dive"],
    caseDiameterMm: 42,
    caseThicknessMm: null,
    caseShape: null,
    waterResistanceM: 200,
    movement: "automatic",
    inHouseCalibre: null,
    crystal: null,
    displayCaseback: null,
    complications: [],
    caseMaterial: "steel",
    casebackMaterial: null,
    strapMaterial: null,
    priceAmount: 500,
    priceCurrency: "USD",
    priceStatus: "confirmed",
    priceCheckedAt: null,
    priceEvidence: {},
    priceChange: null,
    sourceUrl: "https://seikowatches.com/product",
    sourceKind: "manufacturer",
    imageUrl: "https://seikowatches.com/photo.jpg",
    rationale: null,
    foundIn: [],
    reviewStatus: "pending",
    reviewedAt: null,
    createdAt: "2026-10-25",
    updatedAt: "2026-10-25",
    ...patch,
  });
const sighting = (patch: Partial<FoundWatch> = {}): FoundWatch => ({
  brand: "Seiko",
  model: "Diver",
  referenceCode: "SKX007J",
  sourceUrl: "https://evidence.test/movie",
  imageUrl: null,
  priceNote: null,
  rationale: "A documented sighting",
  details: {
    person: "Actor",
    work: "Film",
    evidenceUrl: "https://evidence.test/movie",
  },
  ...patch,
});

describe("catalogue enrichment propagation", () => {
  it("fills exact-reference missing facts without inventing attribution", () => {
    const [watch] = mergeCatalogueFacts([sighting()], [catalogue()]);
    expect(watch?.imageUrl).toBe("https://seikowatches.com/photo.jpg");
    expect(watch?.details.caseDiameterMm).toBe(42);
    expect(watch?.details.person).toBe("Actor");
    expect(watch?.sourceUrl).toBe("https://evidence.test/movie");
    expect(watch?.details.catalogueId).toBe("reference-id");
  });
  it("never crosses reference suffixes or brands or fills family-only identifications", () => {
    for (const watch of [
      sighting({ referenceCode: "SKX007K1" }),
      sighting({ brand: "Other" }),
      sighting({ referenceCode: null }),
    ])
      expect(mergeCatalogueFacts([watch], [catalogue()])[0]).toEqual(watch);
  });
  it("does not use unconfirmed, rejected or ambiguous catalogue identities", () => {
    for (const rows of [
      [catalogue({ referenceConfirmed: false })],
      [catalogue({ reviewStatus: "rejected" })],
      [catalogue(), catalogue({ id: "other-id" })],
    ])
      expect(mergeCatalogueFacts([sighting()], rows)[0]).toEqual(sighting());
  });
  it("reflects an explicit failed variant recheck in a cached result", () => {
    const [watch] = mergeCatalogueFacts(
      [sighting({ details: { referenceVerified: true } })],
      [
        catalogue({
          referenceConfirmed: false,
          priceEvidence: { referenceRecheck: "exact_variant_not_confirmed" },
        }),
      ],
    );
    expect(watch?.details.referenceVerified).toBe(false);
  });
  it("preserves known evidence facts and a pre-owned price", () => {
    const watch = sighting({
      details: {
        caseDiameterMm: 41,
        price: { amount: 300, currency: "USD" },
        priceCondition: "pre-owned",
      },
    });
    const [result] = mergeCatalogueFacts([watch], [catalogue()]);
    expect(result?.details.price?.amount).toBe(300);
    expect(result?.details.caseDiameterMm).toBe(41);
    expect(watch.imageUrl).toBeNull();
  });
  it("fills a missing price from an approximate local price without marking it confirmed", () => {
    const [result] = mergeCatalogueFacts(
      [sighting()],
      [catalogue({ priceStatus: "approximate" })],
    );
    expect(result?.details.price).toEqual({ amount: 500, currency: "USD" });
    expect(result?.details.priceConfirmed).toBe(false);
    expect(result?.priceNote).toContain("500");
  });
  it("uses an exact catalogue title when rebuilding a verified result", () => {
    const [result] = mergeCatalogueFacts(
      [sighting({ model: "SKX007J" })],
      [catalogue()],
      { preferCatalogueTitle: true },
    );
    expect(result?.model).toBe("Diver");
    expect(result?.details.caseDiameterMm).toBe(42);
    expect(result?.details.price).toEqual({ amount: 500, currency: "USD" });
  });
  it("updates an older catalogue-derived cache title and adds Dials specifications with attribution", () => {
    const [result] = mergeCatalogueFacts(
      [sighting()],
      [
        catalogue({
          model: "Seiko Diver 200m",
          sourceKind: "catalogue",
          sourceUrl: "https://dials.co/watches/seiko/diver/diver-200m",
          sourceDetails: {
            dials: { "Case diameter (mm)": 42, "Power reserve (hours)": 72 },
          },
          foundIn: [
            {
              source: "dials",
              url: "https://dials.co/watches/seiko/diver/diver-200m",
            },
          ],
        }),
      ],
    );
    expect(result?.model).toBe("Seiko Diver 200m");
    expect(result?.details.previousModelTitle).toBe("Diver");
    expect(result?.details.referenceSourceLabel).toBe("Dials");
    expect(result?.details.referenceSourceUrl).toContain("dials.co/watches");
    expect(result?.details.sourceDetails?.["Power reserve (hours)"]).toBe(72);
  });
  it("fails open when the optional catalogue lookup is unavailable", async () => {
    expect(await enrichResultWatches([sighting()], null)).toEqual([sighting()]);
  });
});
describe("grounded field extraction", () => {
  const claim = {
    field: "caseDiameterMm" as const,
    value: 42,
    quote: "Case diameter 42 mm",
    sourceUrl: "https://seikowatches.com/product",
  };
  it("requires the field label and exact numeric value in the quote", () => {
    expect(quoteSupportsValue(claim)).toBe(true);
    expect(quoteSupportsValue({ ...claim, quote: "Lug to lug 42 mm" })).toBe(
      false,
    );
    expect(quoteSupportsValue({ ...claim, quote: "Case diameter 41 mm" })).toBe(
      false,
    );
    expect(
      quoteSupportsValue({ ...claim, quote: "Case size 42 x 30 mm" }),
    ).toBe(false);
    expect(
      quoteSupportsValue({
        ...claim,
        quote: "Case diameter 40 mm. Thickness 42 mm.",
      }),
    ).toBe(false);
    expect(
      quoteSupportsValue({
        ...claim,
        field: "waterResistanceM",
        value: 200,
        quote: "Water resistance: 20 bar",
      }),
    ).toBe(true);
  });
});

describe("new archetype catalogue membership", () => {
  it("compares a model using its documented reference instead of an incomplete import", () => {
    const imported = catalogue({
      id: "imported-submariner",
      brand: "Rolex",
      model: "Submariner",
      referenceCode: "93153",
      reviewStatus: "approved",
      styles: [],
      movement: null,
      waterResistanceM: null,
      sourceKind: "catalogue",
    });
    const documented = catalogue({
      id: "documented-submariner",
      brand: "Rolex",
      model: "Submariner",
      referenceCode: "124060",
      caseDiameterMm: 41,
      waterResistanceM: 300,
      complications: ["dive_bezel"],
      priceAmount: 10_000,
    });
    const diver = catalogue({
      id: "alternative-diver",
      priceAmount: 1_500,
      complications: ["dive_bezel"],
    });
    const rows = [imported, documented, diver];
    const resolved = resolveNamedWatch(rows, "Rolex Submariner", null);
    expect(resolved).toEqual({ status: "found", watch: documented });
    if (resolved.status !== "found") throw new Error("Target not resolved");
    expect(
      rankAlternatives(
        resolved.watch,
        rows,
        { kind: "range", rangeId: "1000_2000", currency: "USD" },
        false,
        null,
      ).map((entry) => entry.watch.id),
    ).toEqual([diver.id]);
    // An explicit reference keeps its own facts, even when incomplete.
    expect(resolveNamedWatch(rows, "Rolex Submariner", "93153")).toEqual({
      status: "found",
      watch: imported,
    });
    expect(imported.styles).toEqual([]);
    expect(imported.movement).toBeNull();
  });
  it("allows a sourced approximate price without a photo for a documented role fit", () => {
    const rows = [
      catalogue({
        imageUrl: null,
        priceStatus: "approximate",
        foundIn: [{ source: "spacecity" }],
      }),
    ];
    expect(
      rankEnrichedArchetype(
        rows,
        "field_rationalist",
        "first_good_watch",
        null,
      ),
    ).toHaveLength(1);
  });
  it("does not resolve a reference shared by different brands arbitrarily", () => {
    const rows = [catalogue(), catalogue({ brand: "Other", id: "other-id" })];
    const resolved = resolveNamedWatch(rows, "Seiko Diver", "SKX007J");
    expect(resolved.status === "found" && resolved.watch.brand).toBe("Seiko");
    expect(resolveNamedWatch(rows, "Diver", "SKX007J").status).toBe(
      "ambiguous",
    );
  });
  const enriched = () =>
    catalogue({ foundIn: [{ source: "catalogue_enrichment" }] });
  it("adds a price-bounded, documented role fit without inventing recognition", () => {
    expect(
      rankEnrichedArchetype(
        [enriched()],
        "field_rationalist",
        "first_good_watch",
        null,
      ),
    ).toHaveLength(1);
    expect(
      rankEnrichedArchetype(
        [enriched()],
        "field_rationalist",
        "established_collection",
        null,
      ),
    ).toHaveLength(0);
    expect(
      rankEnrichedArchetype(
        [enriched()],
        "recognised_standard_bearer",
        "first_good_watch",
        null,
      ),
    ).toHaveLength(0);
  });
  it("does not rank unverified or unpriced research records", () => {
    expect(
      rankEnrichedArchetype(
        [
          catalogue(),
          catalogue({
            referenceConfirmed: false,
            foundIn: [{ source: "catalogue_enrichment" }],
          }),
          catalogue({
            priceStatus: "unconfirmed",
            foundIn: [{ source: "catalogue_enrichment" }],
          }),
        ],
        "field_rationalist",
        "first_good_watch",
        null,
      ),
    ).toEqual([]);
  });
});
