import { describe, expect, it, vi } from "vitest";
import type { FoundWatch } from "./ai-watch-types";
const mocks = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock("./ai-watch-store.server", () => ({ searchWithStore: mocks.search }));
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
    ).toMatchObject({ status: "unavailable" });
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
    const request = mocks.search.mock.calls.at(-1)?.[0] as {
      candidates: FoundWatch[];
    };
    expect(request.candidates).toHaveLength(8);
  });
});
