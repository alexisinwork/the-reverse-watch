import { describe, expect, it, vi } from "vitest";
import { catalogueWatchSchema } from "./watch-catalogue";

const mocks = vi.hoisted(() => ({
  catalogue: vi.fn(),
  identify: vi.fn(),
  live: vi.fn(),
  preowned: vi.fn(),
}));
vi.mock("./watch-catalogue.server", () => ({
  catalogueClient: () => ({
    config: { supabaseUrl: "https://db.example", serviceKey: "test" },
    fetchImpl: fetch,
  }),
  clearCatalogueCache: vi.fn(),
  loadCatalogueCached: mocks.catalogue,
  recordPreownedPrice: vi.fn(),
}));
vi.mock("./fx.server", () => ({ loadFxTable: async () => null }));
vi.mock("./alternatives-live.server", () => ({
  identifyWatchLive: mocks.identify,
  findAlternativesLive: mocks.live,
}));
vi.mock("./preowned-price.server", () => ({
  lookupPreownedPrice: mocks.preowned,
}));
import { findAlternatives } from "./alternatives.server";

const watch = catalogueWatchSchema.parse({
  id: "00000000-0000-0000-0000-000000000001",
  identityKey: "omega|ref1",
  brand: "Omega",
  model: "Diver",
  referenceCode: "REF123",
  referenceConfirmed: true,
  styles: ["dive"],
  caseDiameterMm: 40,
  caseThicknessMm: null,
  caseShape: "round",
  waterResistanceM: 200,
  movement: "automatic",
  inHouseCalibre: null,
  crystal: null,
  displayCaseback: null,
  complications: [],
  caseMaterial: "steel",
  casebackMaterial: "steel",
  strapMaterial: "steel",
  priceAmount: 1500,
  priceCurrency: "USD",
  priceStatus: "approximate",
  priceCheckedAt: null,
  priceEvidence: {},
  priceChange: null,
  sourceUrl: "https://example.com/watch",
  sourceKind: "manufacturer",
  imageUrl: null,
  rationale: null,
  foundIn: [],
  reviewStatus: "approved",
  reviewedAt: null,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
  designTraits: null,
  preownedPrice: null,
});
const budget = { kind: "exact" as const, amount: 2000, currency: "USD" };

describe("alternatives shared budget guard", () => {
  it("keeps catalogue matching available without starting legacy paid searches", async () => {
    mocks.catalogue.mockResolvedValue([watch]);
    const result = await findAlternatives({
      target: watch,
      name: "Omega Diver",
      reference: "REF123",
      budget,
      allowQuartz: true,
    });
    expect(result).toMatchObject({
      status: "found",
      target: { id: watch.id },
      searchedLive: false,
    });
    expect(mocks.identify).not.toHaveBeenCalled();
    expect(mocks.live).not.toHaveBeenCalled();
    expect(mocks.preowned).not.toHaveBeenCalled();
  });
  it("does not start paid identification for a missing catalogue watch", async () => {
    expect(
      await findAlternatives({
        target: null,
        name: "Unknown",
        reference: null,
        budget,
        allowQuartz: true,
      }),
    ).toEqual({ status: "not_found" });
    expect(mocks.identify).not.toHaveBeenCalled();
  });
});
