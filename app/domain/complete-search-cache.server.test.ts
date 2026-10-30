import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FoundWatch } from "./ai-watch-types";
const mocks = vi.hoisted(() => ({ write: vi.fn() }));
vi.mock("./ai-watch-store.server", async (original) => ({
  ...(await original<typeof import("./ai-watch-store.server")>()),
  storeSearch: mocks.write,
}));
import { cacheCompleteSearch } from "./complete-search-cache.server";

const client = {
  config: { supabaseUrl: "https://db.example", serviceKey: "test" },
  fetchImpl: fetch,
};
const card = (i: number): FoundWatch => ({
  brand: `Brand ${i}`,
  model: `Model ${i}`,
  referenceCode: `REF${i}`,
  sourceUrl: `https://example.com/${i}`,
  imageUrl: null,
  priceNote: null,
  rationale: "Sourced option",
  details: {},
});

describe("completed ten-option cache", () => {
  beforeEach(() => mocks.write.mockReset().mockResolvedValue(undefined));
  it.each([0, 1, 3, 5, 9])(
    "never caches a %i-option list as completed",
    async (count) => {
      const view = await cacheCompleteSearch(
        "quiz",
        { priceRange: "0_500" },
        {
          status: "found",
          summary: "Options",
          fromCache: true,
          watches: Array.from({ length: count }, (_, i) => card(i)),
        },
        client,
      );
      expect(mocks.write).not.toHaveBeenCalled();
      if (view.status === "found" && count) expect(view.fromCache).toBe(false);
    },
  );
  it("counts distinct display cards, not raw ten-row duplicates", async () => {
    await cacheCompleteSearch(
      "find",
      {},
      {
        status: "found",
        summary: "Options",
        fromCache: true,
        watches: [card(1), ...Array.from({ length: 9 }, () => card(2))],
      },
      client,
    );
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("stores ten distinct final cards including labelled close fits", async () => {
    const watches = Array.from({ length: 10 }, (_, i) => card(i));
    watches[9]!.details.misses = ["Case size outside your range"];
    await cacheCompleteSearch(
      "quiz",
      { priceRange: "0_500" },
      { status: "found", summary: "Options", fromCache: false, watches },
      client,
    );
    expect(mocks.write).toHaveBeenCalledExactlyOnceWith(
      client.config,
      expect.objectContaining({
        cacheInput: {
          constraints: { priceRange: "0_500" },
          completeResponsePolicy: 1,
        },
        watches,
      }),
      client.fetchImpl,
    );
  });
});
