import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiSearchView, FoundWatch } from "./ai-watch-types";
const mocks = vi.hoisted(() => ({ read: vi.fn(), snapshot: vi.fn() }));
vi.mock("./ai-watch-store.server", async (original) => ({
  ...(await original<typeof import("./ai-watch-store.server")>()),
  loadStoredSearch: mocks.read,
}));
vi.mock("./validated-cache.server", () => ({
  loadValidatedSnapshot: mocks.snapshot,
}));
import { aiSearchCacheKey } from "./ai-watch-store.server";
import { searchWithCoverage } from "./coverage-search.server";

const input = { kind: "actor", query: "daniel craig" };
const request = { kind: "film" as const, cacheInput: input };
const store = {
  supabaseUrl: "https://db.example",
  serviceKey: "sb_secret_test",
};
const card = (i: number): FoundWatch => ({
  brand: "Omega",
  model: `Model ${i}`,
  referenceCode: `REF${i}`,
  sourceUrl: `https://example.com/${i}`,
  imageUrl: null,
  priceNote: null,
  rationale: "Old claim",
  details: { person: "Daniel Craig" },
});
const found = (watches = [card(1)], fromCache = true): AiSearchView => ({
  status: "found",
  summary: "Checked",
  watches,
  fromCache,
});
const enrich = async (watches: FoundWatch[]) => watches;

describe("coverage around checked snapshots", () => {
  beforeEach(() => {
    mocks.read.mockReset().mockResolvedValue(null);
    mocks.snapshot.mockReset().mockResolvedValue(null);
  });
  it("continues from six saved options to ten and excludes the existing identities", async () => {
    const search = vi
      .fn()
      .mockResolvedValueOnce(
        found(Array.from({ length: 6 }, (_, i) => card(i + 1))),
      )
      .mockResolvedValueOnce(
        found(
          Array.from({ length: 4 }, (_, i) => card(i + 7)),
          false,
        ),
      );
    const result = await searchWithCoverage(
      request,
      {
        store,
        validateMissingFilm: vi.fn(),
        fetchImpl: vi.fn().mockResolvedValue(Response.json(true)),
      },
      { search, enrich },
    );
    expect(search).toHaveBeenCalledTimes(2);
    expect(
      search.mock.calls[1]![0] as Parameters<typeof searchWithCoverage>[0],
    ).toMatchObject({
      discoveryExclusions: expect.arrayContaining([
        expect.objectContaining({ referenceCode: "REF1" }),
      ]),
    });
    expect(result).toMatchObject({
      coverage: { total: 10, status: "target_met" },
      fromCache: false,
    });
  });
  it("reuses ten saved final options without starting provider validation again", async () => {
    mocks.read.mockImplementation(async (_store, key) =>
      key ===
      aiSearchCacheKey("film", {
        constraints: input,
        completeResponsePolicy: 1,
      })
        ? { watches: Array.from({ length: 10 }, (_, i) => card(i + 1)) }
        : null,
    );
    const search = vi.fn();
    const result = await searchWithCoverage(
      request,
      { store, validateMissingFilm: vi.fn() },
      { search, enrich },
    );
    expect(search).not.toHaveBeenCalled();
    expect(result).toMatchObject({ fromCache: true, coverage: { total: 10 } });
  });
  it("uses typed and legacy drafts bound to the subject, then keeps searching below ten", async () => {
    mocks.read.mockImplementation(async (_store, key) => ({
      watches:
        key === aiSearchCacheKey("film", { query: input.query })
          ? [
              card(3),
              card(4),
              card(5),
              { ...card(6), details: { person: "Someone else" } },
            ]
          : [card(1), card(2)],
    }));
    const search = vi.fn().mockResolvedValue(found());
    const result = await searchWithCoverage(
      request,
      { store, validateMissingFilm: vi.fn() },
      { search, enrich },
    );
    expect(search).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      coverage: { total: 5, additionalCandidates: 4 },
    });
    if (result.status !== "found") throw new Error("Expected result");
    expect(result.watches[0]!.details.verificationStatus).toBeUndefined();
    expect(
      result.watches
        .slice(1)
        .every((w) => w.details.verificationStatus === "unverified"),
    ).toBe(true);
    expect(result.watches.some((w) => w.referenceCode === "REF6")).toBe(false);
  });
  it("clears legacy prices, images and assertions before using exact current local facts", async () => {
    mocks.read.mockResolvedValue({
      watches: [
        {
          ...card(2),
          priceNote: "USD 1",
          imageUrl: "https://old.example/photo",
          details: {
            person: "Daniel Craig",
            price: { amount: 1, currency: "USD" },
          },
        },
      ],
    });
    const hydrate = vi.fn(enrich);
    const result = await searchWithCoverage(
      request,
      { store },
      { search: vi.fn().mockResolvedValue(found()), enrich: hydrate },
    );
    expect(hydrate.mock.calls[0]![0][0]).toMatchObject({
      imageUrl: null,
      priceNote: null,
      details: { person: "Daniel Craig" },
    });
    if (result.status !== "found") throw new Error("Expected result");
    expect(result.watches[1]!.details.price).toBeUndefined();
    expect(result.watches[1]!.rationale).not.toBe("Old claim");
  });
  it("allows one metered top-up only after a free checked-cache hit", async () => {
    const search = vi
      .fn()
      .mockResolvedValueOnce(found())
      .mockResolvedValueOnce(
        found([card(2), card(3), card(4), card(5)], false),
      );
    const result = await searchWithCoverage(
      request,
      { store, validateMissingFilm: vi.fn() },
      { search, enrich },
    );
    expect(search).toHaveBeenCalledTimes(2);
    expect(search).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        cacheInput: {
          ...input,
          coveragePolicy: 2,
          excluding: [
            { brand: "Omega", model: "Model 1", referenceCode: "REF1" },
          ],
        },
      }),
      expect.any(Object),
    );
    expect(result).toMatchObject({ fromCache: false, coverage: { total: 5 } });
  });
  it.each([found([card(1)], false), { status: "unavailable" }])(
    "never chains a second paid validation after the first attempt",
    async (view) => {
      const search = vi.fn().mockResolvedValue(view);
      await searchWithCoverage(
        request,
        { store, validateMissingFilm: vi.fn() },
        { search, enrich },
      );
      expect(search).toHaveBeenCalledTimes(1);
    },
  );
  it("does not let a scarce saved supplementary draft stop discovery below ten", async () => {
    mocks.read.mockImplementation(async (_store, key) =>
      key === aiSearchCacheKey("film", { ...input, coveragePolicy: 1 })
        ? { watches: [card(2)] }
        : null,
    );
    const search = vi.fn().mockResolvedValue(found());
    const result = await searchWithCoverage(
      request,
      { store, validateMissingFilm: vi.fn() },
      { search, enrich },
    );
    expect(search).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ coverage: { total: 2, status: "partial" } });
    expect(result).toMatchObject({ fromCache: false });
  });
  it("filters obsolete selections before filling ten current eligible options", async () => {
    const current = Array.from({ length: 10 }, (_, i) => ({
      ...card(i + 10),
      details: {},
    }));
    const result = await searchWithCoverage(
      {
        kind: "find",
        cacheInput: { feature: "archetype" },
        candidates: current.slice(0, 8),
      },
      { store: null },
      {
        search: vi.fn().mockResolvedValue(found()),
        enrich,
        localCandidates: current,
      },
    );
    expect(result).toMatchObject({ coverage: { total: 10 } });
    if (result.status === "found")
      expect(result.watches.map((w) => w.referenceCode)).toEqual(
        current.map((w) => w.referenceCode),
      );
  });
  it("fails closed on a failed catalogue/rejection check", async () => {
    mocks.read.mockResolvedValue({ watches: [card(2)] });
    const result = await searchWithCoverage(
      request,
      { store },
      { search: vi.fn().mockResolvedValue(found()), enrich: async () => [] },
    );
    expect(result).toMatchObject({ coverage: { total: 1, status: "partial" } });
  });
});
