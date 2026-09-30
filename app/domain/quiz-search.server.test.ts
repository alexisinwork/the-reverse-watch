import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AiSearchView } from "./ai-watch-types";
import type { ProfileV4 } from "./questionnaire-v4";
import { searchQuiz } from "./quiz-search.server";
import {
  clearCatalogueCache,
  type CatalogueClient,
} from "./watch-catalogue.server";

const fx = { date: "2026-09-29", perEur: { EUR: 1, USD: 1.1 } };

function row(index: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `00000000-0000-0000-0000-00000000000${index}`,
    identityKey: `brand${index}|r:ref${index}`,
    brand: `Brand${index}`,
    model: `Model ${index}`,
    referenceCode: `REF${index}`,
    referenceConfirmed: true,
    styles: ["everyday"],
    caseDiameterMm: 40,
    caseThicknessMm: null,
    caseShape: null,
    waterResistanceM: 100,
    movement: "automatic",
    inHouseCalibre: null,
    crystal: null,
    displayCaseback: null,
    complications: [],
    caseMaterial: "steel",
    casebackMaterial: "steel",
    strapMaterial: "steel",
    priceAmount: 3_500,
    priceCurrency: "USD",
    priceStatus: "confirmed",
    priceCheckedAt: "2026-09-30T00:00:00Z",
    priceEvidence: {},
    priceChange: null,
    sourceUrl: `https://brand${index}.example/ref${index}`,
    sourceKind: "manufacturer",
    imageUrl: null,
    rationale: null,
    foundIn: [],
    reviewStatus: "approved",
    reviewedAt: null,
    createdAt: "2026-09-30T00:00:00Z",
    updatedAt: "2026-09-30T00:00:00Z",
    ...overrides,
  };
}

function client(rows: unknown[]) {
  const upserts: unknown[] = [];
  const fetchImpl = vi.fn(
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("watch_catalogue_list_v1")) return Response.json(rows);
      if (url.endsWith("watch_catalogue_upsert_v1")) {
        upserts.push(JSON.parse(String(init?.body)));
        return Response.json("00000000-0000-0000-0000-000000000099");
      }
      return new Response("", { status: 404 });
    },
  );
  const value: CatalogueClient = {
    config: { supabaseUrl: "https://db.example", serviceKey: "sb_secret_test" },
    fetchImpl: fetchImpl,
  };
  return { value, upserts };
}

const profile: ProfileV4 = {
  version: 4,
  budgetCurrency: "USD",
  priceRange: "3000_4000",
  wristCm: 17.5,
  wearingScenarios: ["office"],
  minimumWaterResistanceM: 100,
  movementTypes: ["automatic"],
  requiredComplications: [],
  allergyConstraint: "none",
};

const liveResult: AiSearchView = {
  status: "found",
  fromCache: false,
  summary: "Live.",
  watches: [
    {
      brand: "Longines",
      model: "Spirit",
      referenceCode: "L3.810.4.53.0",
      sourceUrl: "https://www.longines.com/spirit",
      imageUrl: null,
      priceNote: "USD 2,950",
      rationale: "Fits.",
      details: {
        price: { amount: 3_050, currency: "USD" },
        caseDiameterMm: 40,
        referenceVerified: true,
        sourceKind: "manufacturer",
      },
    },
  ],
};

describe("searchQuiz", () => {
  beforeEach(() => clearCatalogueCache());

  it("answers from the catalogue without a live search when it has enough", async () => {
    const store = client([
      row(1),
      row(2),
      row(3),
      row(4, { referenceConfirmed: false }),
    ]);
    const runLive = vi.fn();
    const result = await searchQuiz(profile, {
      client: store.value,
      loadFx: async () => fx,
      runLive,
    });
    expect(runLive).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: "found",
      origin: "catalogue",
      fromCache: true,
    });
    if (result.status !== "found") throw new Error("expected found");
    expect(result.watches).toHaveLength(3);
    expect(result.alsoWorth?.map((watch) => watch.brand)).toEqual(["Brand4"]);
  });

  it("fills a gap with the live search and stores its finds as pending", async () => {
    const store = client([row(1)]);
    const result = await searchQuiz(profile, {
      client: store.value,
      loadFx: async () => fx,
      runLive: async () => liveResult,
    });
    expect(result).toMatchObject({ status: "found", origin: "mixed" });
    if (result.status !== "found") throw new Error("expected found");
    expect(result.watches.map((watch) => watch.brand)).toEqual([
      "Brand1",
      "Longines",
    ]);
    expect(result.watches[1]!.details.reviewStatus).toBe("pending");
    expect(store.upserts).toHaveLength(1);
    expect(store.upserts[0]).toMatchObject({
      p_watch: {
        brand: "Longines",
        priceStatus: "unconfirmed",
        styles: ["dress", "everyday"],
      },
    });
  });

  it("always searches live above 10k", async () => {
    const store = client([
      row(1, { priceAmount: 12_000 }),
      row(2, { priceAmount: 12_000 }),
      row(3, { priceAmount: 12_000 }),
    ]);
    const runLive = vi.fn(async () => liveResult);
    await searchQuiz(
      { ...profile, priceRange: "10000_15000" },
      { client: store.value, loadFx: async () => fx, runLive },
    );
    expect(runLive).toHaveBeenCalledTimes(1);
  });

  it("shows the closest in-budget catalogue watches when nothing fits and the live search is down", async () => {
    const store = client([
      // In budget, but only 50 m (the visitor asked for 100 m).
      row(1, { waterResistanceM: 50 }),
      // In budget, but misses water resistance and movement.
      row(2, { waterResistanceM: 50, movement: "quartz" }),
      // Out of budget: never shown, however well it fits otherwise.
      row(3, { priceAmount: 9_000 }),
    ]);
    const result = await searchQuiz(profile, {
      client: store.value,
      loadFx: async () => fx,
      runLive: async () => ({ status: "unavailable" }),
    });
    expect(result).toMatchObject({ status: "found", origin: "catalogue" });
    if (result.status !== "found") throw new Error("expected found");
    expect(result.summary).toContain("live search is unavailable");
    expect(result.watches.map((watch) => watch.brand)).toEqual([
      "Brand1",
      "Brand2",
    ]);
  });

  it("fills free places with in-budget near fits, marked with what they miss", async () => {
    const store = client([
      row(1),
      row(2),
      row(3),
      // In budget but 44 mm for a 17.5 cm wrist: a near fit.
      row(4, { caseDiameterMm: 44 }),
      // Misses case size and water resistance: a near fit, ranked after 4.
      row(5, { caseDiameterMm: 44, waterResistanceM: 30 }),
      // Out of budget, or unsafe for a nickel allergy: never offered.
      row(6, { priceAmount: 9_000 }),
      row(7, { caseMaterial: "stainless steel" }),
    ]);
    // With a nickel allergy every steel watch is ruled out: no near fit
    // may bend that rule, so nothing is offered.
    const allergic = await searchQuiz(
      { ...profile, allergyConstraint: "nickel_contact" },
      {
        client: store.value,
        loadFx: async () => fx,
        runLive: async () => ({ status: "no_match", summary: "None." }),
      },
    );
    expect(allergic).toEqual({ status: "no_match", summary: "None." });

    const plain = await searchQuiz(profile, {
      client: store.value,
      loadFx: async () => fx,
      runLive: vi.fn(),
    });
    if (plain.status !== "found") throw new Error("expected found");
    expect(plain.watches.map((watch) => watch.brand)).toEqual([
      "Brand1",
      "Brand2",
      "Brand3",
      "Brand7",
      "Brand4",
      "Brand5",
    ]);
    expect(plain.watches[4]!.details.misses).toEqual([
      "Case size outside your range",
    ]);
    expect(plain.watches[5]!.details.misses).toEqual([
      "Case size outside your range",
      "Less water resistance than you asked for",
    ]);
    expect(plain.summary).toContain("2 more are in your price range");
  });

  it("returns at most ten watches", async () => {
    const store = client(
      Array.from({ length: 14 }, (_, index) =>
        row(index + 1, {
          id: `00000000-0000-0000-0000-0000000000${String(index + 10)}`,
        }),
      ),
    );
    const result = await searchQuiz(profile, {
      client: store.value,
      loadFx: async () => fx,
      runLive: vi.fn(),
    });
    if (result.status !== "found") throw new Error("expected found");
    expect(result.watches).toHaveLength(10);
  });

  it("falls back to the live search when the catalogue cannot be read", async () => {
    const result = await searchQuiz(profile, {
      client: null,
      runLive: async () => liveResult,
    });
    expect(result).toMatchObject({ status: "found", origin: "live" });
  });
});
