import { vi } from "vitest";

const finderMock = { runAiWatchSearch: vi.fn() };

import { aiSearchCacheKey, searchWithStore } from "./ai-watch-store.server";

const store = { supabaseUrl: "https://db.test", serviceKey: "sb_secret_test" };
const foundWatch = {
  brand: "Seiko",
  model: "Prospex",
  referenceCode: "SPB143",
  sourceUrl: "https://www.seikowatches.com/spb143",
  imageUrl: "https://img.example/spb143.jpg",
  priceNote: null,
  rationale: "Fits.",
  details: { waterResistanceM: 200 },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("searchWithStore", () => {
  beforeEach(() => {
    finderMock.runAiWatchSearch.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("serves a stored search without searching again", async () => {
    const fetchImpl = vi.fn(async () =>
      json({ summary: "Stored.", watches: [foundWatch] }),
    );

    const result = await searchWithStore(
      { kind: "quiz", cacheInput: { a: 1 }, run: finderMock.runAiWatchSearch },
      { store, fetchImpl: fetchImpl as unknown as typeof fetch },
    );

    expect(result).toEqual({
      status: "found",
      summary: "Stored.",
      watches: [foundWatch],
      fromCache: true,
    });
    expect(finderMock.runAiWatchSearch).not.toHaveBeenCalled();
    const [, init] = fetchImpl.mock.calls[0] as unknown as [URL, RequestInit];
    expect((init.headers as Record<string, string>).apikey).toBe(
      "sb_secret_test",
    );
    expect(init.headers).not.toHaveProperty("authorization");
  });

  it("searches on a miss and stores what it found", async () => {
    finderMock.runAiWatchSearch.mockResolvedValue({
      status: "found",
      summary: "Fresh.",
      watches: [foundWatch],
    });
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes("get_v1") ? json(null) : json(true),
    );

    const result = await searchWithStore(
      { kind: "quiz", cacheInput: { a: 1 }, run: finderMock.runAiWatchSearch },
      { store, fetchImpl: fetchImpl as unknown as typeof fetch },
    );

    expect(result).toMatchObject({ status: "found", fromCache: false });
    const storeCall = fetchImpl.mock.calls.find(([input]) =>
      String(input).includes("store_v1"),
    ) as unknown as [URL, RequestInit];
    expect(JSON.parse(String(storeCall[1].body))).toMatchObject({
      p_kind: "quiz",
      p_cache_key: aiSearchCacheKey("quiz", { a: 1 }),
      p_watches: [foundWatch],
    });
  });

  it("does not store a no_match or unavailable result", async () => {
    finderMock.runAiWatchSearch.mockResolvedValue({
      status: "no_match",
      summary: "None.",
    });
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL) => json(null));

    await searchWithStore(
      { kind: "quiz", cacheInput: { a: 1 }, run: finderMock.runAiWatchSearch },
      { store, fetchImpl: fetchImpl as unknown as typeof fetch },
    );

    expect(
      fetchImpl.mock.calls.some(([input]) =>
        String(input).includes("store_v1"),
      ),
    ).toBe(false);
  });

  it("still answers when the database is down", async () => {
    finderMock.runAiWatchSearch.mockResolvedValue({
      status: "found",
      summary: "Fresh.",
      watches: [foundWatch],
    });
    const fetchImpl = vi.fn(async () => json({ message: "down" }, 503));

    const result = await searchWithStore(
      { kind: "quiz", cacheInput: { a: 1 }, run: finderMock.runAiWatchSearch },
      { store, fetchImpl: fetchImpl as unknown as typeof fetch },
    );

    expect(result).toMatchObject({ status: "found", fromCache: false });
  });

  it("drops a stored watch whose source is no longer a safe URL", async () => {
    const fetchImpl = vi.fn(async () =>
      json({
        summary: "Stored.",
        watches: [
          { ...foundWatch, sourceUrl: "javascript:alert(1)" },
          foundWatch,
        ],
      }),
    );

    const result = await searchWithStore(
      { kind: "quiz", cacheInput: { a: 1 }, run: finderMock.runAiWatchSearch },
      { store, fetchImpl: fetchImpl as unknown as typeof fetch },
    );

    expect(result.status === "found" && result.watches).toEqual([foundWatch]);
  });
});

describe("aiSearchCacheKey", () => {
  it("ignores key order and undefined fields but not values or kind", () => {
    const key = aiSearchCacheKey("quiz", { a: 1, b: [1, 2], c: undefined });
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(aiSearchCacheKey("quiz", { b: [1, 2], a: 1 })).toBe(key);
    expect(aiSearchCacheKey("quiz", { a: 2, b: [1, 2] })).not.toBe(key);
    expect(aiSearchCacheKey("film", { a: 1, b: [1, 2] })).not.toBe(key);
  });
});
