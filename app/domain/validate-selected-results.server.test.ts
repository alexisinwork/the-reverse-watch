import { describe, expect, it, vi } from "vitest";
import type { FoundWatch } from "./ai-watch-types";
const mocks = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock("./ai-watch-store.server", () => ({
  searchWithStore: mocks.search,
  loadAiWatchStoreConfig: () => null,
}));
vi.mock("./coverage-catalogue.server", () => ({
  hydrateCoverageCandidates: async (watches: FoundWatch[]) => watches,
  withCompleteCatalogueChecks: async (watches: FoundWatch[]) => watches,
}));
vi.mock("./validation-runtime.server", () => ({
  meteredSearchOptions: () => ({}),
}));
import {
  validateSelectedResults,
  withSelectedFacts,
} from "./validate-selected-results.server";
const card = (referenceCode: string): FoundWatch => ({
  brand: "Omega",
  model: referenceCode,
  referenceCode,
  sourceUrl: "https://example.com/watch",
  imageUrl: null,
  priceNote: null,
  rationale: "",
  details: {},
});

describe("checked catalogue selections", () => {
  it("uses the current deterministic explanation with the checked facts", async () => {
    mocks.search.mockResolvedValue({
      status: "found",
      watches: [
        {
          ...card("REF123"),
          rationale: "Old AI explanation",
          details: { caseDiameterMm: 40 },
        },
      ],
      summary: "Checked",
      fromCache: true,
    });
    expect(
      await validateSelectedResults("alternatives", { budget: 1000 }, [
        {
          ...card("REF123"),
          rationale: "Shares: dive bezel. Differs: quartz.",
        },
      ]),
    ).toMatchObject({
      status: "found",
      watches: [
        {
          rationale: "Shares: dive bezel. Differs: quartz.",
          details: { caseDiameterMm: 40 },
        },
      ],
    });
  });
  it("does not reuse a cached card excluded by the current selection", async () => {
    mocks.search.mockResolvedValue({
      status: "found",
      watches: [card("OLD123")],
      summary: "Old",
      fromCache: true,
    });
    expect(
      await validateSelectedResults("archetype", { band: "entry" }, [
        card("NEW123"),
      ]),
    ).toMatchObject({
      status: "found",
      watches: [
        {
          referenceCode: "NEW123",
          details: { verificationStatus: "unverified" },
        },
      ],
    });
  });
  it("reserves at most eight candidates for a single selection", async () => {
    mocks.search.mockResolvedValue({
      status: "found",
      watches: [card("REF123")],
      summary: "Checked",
      fromCache: true,
    });
    const candidates = Array.from({ length: 10 }, (_, index) =>
      card(`REF${index + 123}`),
    );
    const result = await validateSelectedResults(
      "alternatives",
      { budget: 1000 },
      candidates,
    );
    expect(result.status).toBe("found");
    if (result.status === "found") expect(result.watches).toHaveLength(10);
    const request = mocks.search.mock.calls.at(-1)?.[0] as {
      candidates: FoundWatch[];
    };
    expect(request.candidates).toHaveLength(8);
  });
});

describe("withSelectedFacts", () => {
  const editorial: FoundWatch = {
    brand: "Maurice Lacroix",
    model: "Aikon Master Grand Date Technicolour",
    referenceCode: "AI6118-SS00E-430-C",
    sourceUrl: "",
    imageUrl: null,
    priceNote: null,
    rationale: "Editorial reason",
    details: {
      price: { amount: 8_900, currency: "EUR" },
      caseDiameterMm: 45,
      movement: "automatic",
    },
  };
  const checked: FoundWatch = {
    ...card("AI6118-SS00E-430-C"),
    brand: "Maurice Lacroix",
    sourceUrl: "https://www.mauricelacroix.com/AI6118-SS00E-430-C.html",
    details: { referenceVerified: true },
  };

  it("brings back the title and price a check without a catalogue record dropped", () => {
    const card = withSelectedFacts(checked, editorial);
    expect(card).toMatchObject({
      model: "Aikon Master Grand Date Technicolour",
      referenceCode: "AI6118-SS00E-430-C",
      sourceUrl: "https://www.mauricelacroix.com/AI6118-SS00E-430-C.html",
      rationale: "Editorial reason",
      details: {
        price: { amount: 8_900, currency: "EUR" },
        priceConfirmed: false,
        caseDiameterMm: 45,
        referenceVerified: true,
      },
    });
    expect(card.details.verificationStatus).toBeUndefined();
  });

  it("labels a checked card that still has no price", () => {
    const card = withSelectedFacts(checked, {
      ...editorial,
      details: { caseDiameterMm: 45 },
    });
    expect(card.details).toMatchObject({
      verificationStatus: "unverified",
      verificationNote: "Price unavailable — budget fit not confirmed",
    });
  });

  it("keeps the note of a card that was already labelled", () => {
    const card = withSelectedFacts(
      {
        ...checked,
        details: {
          verificationStatus: "unverified",
          verificationNote:
            "Price unavailable — selected price band not confirmed",
        },
      },
      { ...editorial, details: {} },
    );
    expect(card.details.verificationNote).toBe(
      "Price unavailable — selected price band not confirmed",
    );
  });
});

describe("withSelectedFacts and the repaired catalogue", () => {
  it("shows the page-checked facts the local record was selected with", () => {
    const checked: FoundWatch = {
      brand: "Seiko",
      model: "Prospex 1965 Heritage Diver’s Watch",
      referenceCode: "SPB451",
      sourceUrl: "https://www.seikowatches.com/us-en/products/prospex/spb451j1",
      imageUrl: null,
      priceNote: "USD 1,300",
      rationale: "Saved check",
      details: {
        price: { amount: 1_300, currency: "USD" },
        priceConfirmed: true,
        caseDiameterMm: 41.7,
        waterResistanceM: 200,
        movement: "automatic",
      },
    };
    const local: FoundWatch = {
      ...checked,
      rationale: "Current ranking",
      details: {
        price: { amount: 1_300, currency: "USD" },
        caseDiameterMm: 40,
        waterResistanceM: 300,
        movement: "automatic",
        pageCheckedFacts: ["caseDiameterMm", "waterResistanceM"],
      },
    };
    const card = withSelectedFacts(checked, local);
    expect(card.details).toMatchObject({
      caseDiameterMm: 40,
      waterResistanceM: 300,
      price: { amount: 1_300, currency: "USD" },
      priceConfirmed: true,
    });
    expect(card.rationale).toBe("Current ranking");
  });
});
