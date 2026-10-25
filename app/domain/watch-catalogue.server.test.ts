import { describe, expect, it, vi } from "vitest";

import {
  clearCatalogueCache,
  fillPhotosFromCatalogue,
  listCatalogue,
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

describe("paged recommendation catalogue", () => {
  it("loads bounded pages until the final partial page", async () => {
    const pageFetch = vi.fn(
      async (_input: string | URL | Request, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { p_page: number };
        return Response.json(
          body.p_page === 1
            ? Array.from({ length: 500 }, () => row({}))
            : [row({})],
        );
      },
    );
    const loaded = await listCatalogue({
      config: { supabaseUrl: "https://db.test", serviceKey: "sb_secret_x" },
      fetchImpl: pageFetch,
    });
    expect(loaded).toHaveLength(501);
    expect(pageFetch).toHaveBeenCalledTimes(2);
  });
});
