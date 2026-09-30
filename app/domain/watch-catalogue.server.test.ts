import { describe, expect, it } from "vitest";

import {
  clearCatalogueCache,
  fillPhotosFromCatalogue,
  type CatalogueClient,
} from "./watch-catalogue.server";

function row(overrides: Record<string, unknown>) {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    identityKey: "x",
    brand: "Omega",
    model: "Seamaster Diver 300M",
    referenceCode: "210.30.42.20.01.001",
    referenceConfirmed: true,
    styles: ["dive"],
    caseDiameterMm: 42,
    caseThicknessMm: null,
    caseShape: null,
    waterResistanceM: 300,
    movement: "automatic",
    inHouseCalibre: null,
    crystal: null,
    displayCaseback: null,
    complications: [],
    caseMaterial: null,
    casebackMaterial: null,
    strapMaterial: null,
    priceAmount: 6_100,
    priceCurrency: "USD",
    priceStatus: "confirmed",
    priceCheckedAt: null,
    priceEvidence: {},
    priceChange: null,
    sourceUrl: "https://www.omegawatches.com/x",
    sourceKind: "manufacturer",
    imageUrl: "https://img.test/seamaster.jpg",
    rationale: null,
    foundIn: [],
    reviewStatus: "approved",
    reviewedAt: null,
    createdAt: "2026-09-30T00:00:00Z",
    updatedAt: "2026-09-30T00:00:00Z",
    ...overrides,
  };
}

function client(rows: unknown[]): CatalogueClient {
  return {
    config: { supabaseUrl: "https://db.test", serviceKey: "sb_secret_x" },
    fetchImpl: async () => Response.json(rows),
  };
}

const sighting = (overrides: Record<string, unknown>) => ({
  brand: "Omega",
  model: "Seamaster",
  referenceCode: null as string | null,
  imageUrl: null as string | null,
  ...overrides,
});

describe("fillPhotosFromCatalogue", () => {
  it("borrows the catalogue photo by reference, model, or a longer model name", async () => {
    clearCatalogueCache();
    const filled = await fillPhotosFromCatalogue(
      [
        sighting({ referenceCode: "210.30.42.20.01.001", model: "Bond watch" }),
        sighting({ model: "Seamaster Diver 300M Co-Axial Chronometer" }),
        sighting({ brand: "Rolex", model: "Submariner" }),
        sighting({ imageUrl: "https://img.test/own.jpg" }),
      ],
      client([row({})]),
    );
    expect(filled.map((watch) => watch.imageUrl)).toEqual([
      "https://img.test/seamaster.jpg",
      "https://img.test/seamaster.jpg",
      null,
      "https://img.test/own.jpg",
    ]);
  });
});
