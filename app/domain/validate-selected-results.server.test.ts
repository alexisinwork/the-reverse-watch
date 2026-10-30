import { describe, expect, it, vi } from "vitest";
import type { FoundWatch } from "./ai-watch-types";
const mocks = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock("./ai-watch-store.server", () => ({
  searchWithStore: mocks.search,
  loadAiWatchStoreConfig: () => null,
}));
vi.mock("./coverage-catalogue.server", () => ({
  hydrateCoverageCandidates: async (watches: FoundWatch[]) => watches,
}));
vi.mock("./validation-runtime.server", () => ({
  meteredSearchOptions: () => ({}),
}));
import { validateSelectedResults } from "./validate-selected-results.server";
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
