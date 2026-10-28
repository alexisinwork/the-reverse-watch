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
  details: { waterResistanceM: 200, person: "Daniel Craig" },
};
const validatedWatch = {
  ...foundWatch,
  details: {
    ...foundWatch.details,
    validationEvidence: [
      {
        provider: "perplexity",
        sourceUrl: "https://first.example/watch",
        checkedAt: "2026-10-27T00:00:00Z",
        sourceQuote: "Seiko SPB143 Daniel Craig",
        person: "Daniel Craig",
      },
      {
        provider: "muse",
        sourceUrl: "https://second.example/watch",
        checkedAt: "2026-10-27T00:00:00Z",
        sourceQuote: "Seiko SPB143 Daniel Craig",
        person: "Daniel Craig",
      },
    ],
  },
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
      json({
        validationStatus: "valid",
        summary: "Stored.",
        watches: [validatedWatch],
        validatedAt: "2026-10-27T00:00:00Z",
        policyVersion: "source-v1",
      }),
    );

    const result = await searchWithStore(
      { kind: "quiz", cacheInput: { a: 1 }, run: finderMock.runAiWatchSearch },
      { store, fetchImpl: fetchImpl as unknown as typeof fetch },
    );

    expect(result).toEqual({
      status: "found",
      summary: "Stored.",
      watches: [validatedWatch],
      fromCache: true,
    });
    expect(finderMock.runAiWatchSearch).not.toHaveBeenCalled();
    const [, init] = fetchImpl.mock.calls[0] as unknown as [URL, RequestInit];
    expect((init.headers as Record<string, string>).apikey).toBe(
      "sb_secret_test",
    );
    expect(init.headers).not.toHaveProperty("authorization");
  });

  it("does not mark a draft as valid or start a paid search", async () => {
    const fetchImpl = vi.fn(async () =>
      json({
        validationStatus: "unverified",
        summary: "Draft",
        watches: [foundWatch],
      }),
    );
    const result = await searchWithStore(
      {
        kind: "film",
        cacheInput: { query: "daniel craig", kind: "actor" },
        run: finderMock.runAiWatchSearch,
      },
      { store, fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(result).toEqual({ status: "unavailable" });
    expect(finderMock.runAiWatchSearch).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("validates a draft once, then serves only the committed snapshot", async () => {
    let published = false;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("ai_watch_search_get_v1"))
        return json({
          validationStatus: "unverified",
          summary: "Draft.",
          watches: [foundWatch],
        });
      return json(
        published
          ? {
              validationStatus: "valid",
              summary: "Checked.",
              watches: [validatedWatch],
              validatedAt: "2026-10-27T00:00:00Z",
              policyVersion: "source-v1",
            }
          : null,
      );
    });
    const validateDraft = vi.fn(async () => {
      published = true;
      return {
        status: "verified" as const,
        watches: [validatedWatch],
        rejected: 0,
      };
    });
    const request = {
      kind: "film" as const,
      cacheInput: { query: "daniel craig", kind: "actor" },
      run: finderMock.runAiWatchSearch,
    };
    const options = {
      store,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      validateDraft,
    };
    const first = await searchWithStore(request, options);
    expect(first).toMatchObject({
      status: "found",
      summary: "Checked.",
      fromCache: false,
      watches: [validatedWatch],
    });
    expect(validateDraft).toHaveBeenCalledTimes(1);
    const second = await searchWithStore(request, options);
    expect(second).toMatchObject({
      status: "found",
      fromCache: true,
      watches: [validatedWatch],
    });
    expect(validateDraft).toHaveBeenCalledTimes(1);
    expect(finderMock.runAiWatchSearch).not.toHaveBeenCalled();
  });

  it("uses metered discovery on a film cache miss and then reads the committed snapshot", async () => {
    let published = false;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("ai_watch_search_get_v1")) return json(null);
      return json(
        published
          ? {
              validationStatus: "valid",
              summary: "Checked.",
              watches: [validatedWatch],
              validatedAt: "2026-10-27T00:00:00Z",
              policyVersion: "source-v1",
            }
          : null,
      );
    });
    const validateDraft = vi.fn();
    const validateMissingFilm = vi.fn(async () => {
      published = true;
      return {
        status: "verified" as const,
        watches: [validatedWatch],
        rejected: 0,
      };
    });
    const request = {
      kind: "film" as const,
      cacheInput: { query: "daniel craig", kind: "actor" },
      run: finderMock.runAiWatchSearch,
    };
    const options = { store, fetchImpl, validateDraft, validateMissingFilm };
    expect(await searchWithStore(request, options)).toMatchObject({
      status: "found",
      fromCache: false,
      watches: [validatedWatch],
    });
    expect(await searchWithStore(request, options)).toMatchObject({
      status: "found",
      fromCache: true,
    });
    expect(validateMissingFilm).toHaveBeenCalledTimes(1);
    expect(validateDraft).not.toHaveBeenCalled();
    expect(finderMock.runAiWatchSearch).not.toHaveBeenCalled();
  });

  it("does not return a validation result that was not committed", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes("ai_watch_search_get_v1")
        ? json({
            validationStatus: "unverified",
            summary: "Draft.",
            watches: [foundWatch],
          })
        : json(null),
    );
    const result = await searchWithStore(
      {
        kind: "film",
        cacheInput: { query: "daniel craig", kind: "actor" },
        run: finderMock.runAiWatchSearch,
      },
      {
        store,
        fetchImpl: fetchImpl as unknown as typeof fetch,
        validateDraft: async () => ({
          status: "verified",
          watches: [validatedWatch],
          rejected: 0,
        }),
      },
    );
    expect(result).toEqual({ status: "unavailable" });
  });

  it("binds missing film attribution to the requested actor and rejects another wearer", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes("ai_watch_search_get_v1")
        ? json({
            validationStatus: "unverified",
            summary: "Draft.",
            watches: [
              { ...foundWatch, details: {} },
              {
                ...foundWatch,
                model: "Other",
                referenceCode: "OTHER123",
                details: { person: "Naomie Harris" },
              },
            ],
          })
        : json(null),
    );
    const validateDraft = vi.fn(async () => ({
      status: "unavailable" as const,
      reason: "no confirmed candidates",
    }));
    const result = await searchWithStore(
      {
        kind: "film",
        cacheInput: { query: "daniel craig", kind: "actor" },
        run: finderMock.runAiWatchSearch,
      },
      { store, fetchImpl, validateDraft },
    );
    expect(result.status).toBe("unavailable");
    expect(validateDraft).toHaveBeenCalledWith(expect.any(String), [
      expect.objectContaining({ details: { person: "daniel craig" } }),
    ]);
  });

  it("never serves a checked snapshot for a different actor", async () => {
    const fetchImpl = vi.fn(async () =>
      json({
        validationStatus: "valid",
        summary: "Checked.",
        watches: [validatedWatch],
        validatedAt: "2026-10-27T00:00:00Z",
        policyVersion: "source-v1",
      }),
    );
    const result = await searchWithStore(
      {
        kind: "film",
        cacheInput: { query: "naomie harris", kind: "actor" },
        run: finderMock.runAiWatchSearch,
      },
      { store, fetchImpl },
    );
    expect(result).toEqual({ status: "unavailable" });
  });

  it("uses the movie title as the required attribution for movie searches", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes("ai_watch_search_get_v1")
        ? json({
            validationStatus: "unverified",
            summary: "Draft.",
            watches: [
              { ...foundWatch, details: { person: "Daniel Craig" } },
              {
                ...foundWatch,
                model: "Other",
                referenceCode: "OTHER123",
                details: { work: "Spectre" },
              },
            ],
          })
        : json(null),
    );
    const validateDraft = vi.fn(async () => ({
      status: "unavailable" as const,
      reason: "no confirmed candidates",
    }));
    await searchWithStore(
      {
        kind: "film",
        cacheInput: { query: "skyfall", kind: "movie" },
        run: finderMock.runAiWatchSearch,
      },
      { store, fetchImpl, validateDraft },
    );
    expect(validateDraft).toHaveBeenCalledWith(expect.any(String), [
      expect.objectContaining({
        details: { person: "Daniel Craig", work: "skyfall" },
      }),
    ]);
  });

  it("never returns the old draft while a concurrent validation is in progress", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes("ai_watch_search_get_v1")
        ? json({
            validationStatus: "unverified",
            summary: "Draft.",
            watches: [foundWatch],
          })
        : json(null),
    );
    const result = await searchWithStore(
      {
        kind: "film",
        cacheInput: { query: "daniel craig", kind: "actor" },
        run: finderMock.runAiWatchSearch,
      },
      {
        store,
        fetchImpl: fetchImpl as unknown as typeof fetch,
        validateDraft: async () => ({
          status: "unavailable",
          reason: "in_progress",
        }),
        waitForValidation: async () => {},
      },
    );
    expect(result).toEqual({ status: "unavailable", reason: "in_progress" });
  });

  it("lets simultaneous visitors share the first committed result", async () => {
    let published = false;
    let releaseFirst: (() => void) | undefined;
    const firstFinished = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("ai_watch_search_get_v1"))
        return json({
          validationStatus: "unverified",
          summary: "Draft.",
          watches: [foundWatch],
        });
      return json(
        published
          ? {
              validationStatus: "valid",
              summary: "Checked.",
              watches: [validatedWatch],
              validatedAt: "2026-10-27T00:00:00Z",
              policyVersion: "source-v1",
            }
          : null,
      );
    });
    let calls = 0;
    const validateDraft = vi.fn(async () => {
      calls++;
      if (calls > 1)
        return { status: "unavailable" as const, reason: "in_progress" };
      await firstFinished;
      published = true;
      return {
        status: "verified" as const,
        watches: [validatedWatch],
        rejected: 0,
      };
    });
    const request = {
      kind: "film" as const,
      cacheInput: { query: "daniel craig", kind: "actor" },
      run: finderMock.runAiWatchSearch,
    };
    const first = searchWithStore(request, { store, fetchImpl, validateDraft });
    // The first caller must own the validation before the second enters it.
    while (calls === 0) await Promise.resolve();
    const second = searchWithStore(request, {
      store,
      fetchImpl,
      validateDraft,
      waitForValidation: async () => {
        releaseFirst?.();
        await first;
      },
    });
    expect(await first).toMatchObject({ status: "found", fromCache: false });
    expect(await second).toMatchObject({
      status: "found",
      fromCache: true,
      watches: [validatedWatch],
    });
    expect(validateDraft).toHaveBeenCalledTimes(2);
    expect(finderMock.runAiWatchSearch).not.toHaveBeenCalled();
  });

  it.each([
    ["monthly_limit", "budget"],
    ["budget_halted", "budget"],
    ["retry_later", "retry_later"],
    ["no confirmed candidates", "verification_failed"],
  ])("reports a safe availability reason for %s", async (reason, expected) => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes("ai_watch_search_get_v1")
        ? json({
            validationStatus: "unverified",
            summary: "Draft.",
            watches: [foundWatch],
          })
        : json(null),
    );
    const result = await searchWithStore(
      {
        kind: "film",
        cacheInput: { query: "daniel craig", kind: "actor" },
        run: finderMock.runAiWatchSearch,
      },
      {
        store,
        fetchImpl,
        validateDraft: async () => ({ status: "unavailable", reason }),
      },
    );
    expect(result).toEqual({ status: "unavailable", reason: expected });
  });

  it("reloads the snapshot when another request published just before reservation", async () => {
    let reads = 0;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("ai_watch_search_get_v1"))
        return json({
          validationStatus: "unverified",
          summary: "Draft.",
          watches: [foundWatch],
        });
      reads += 1;
      return json(
        reads === 1
          ? null
          : {
              validationStatus: "valid",
              summary: "Checked.",
              watches: [validatedWatch],
              validatedAt: "2026-10-27T00:00:00Z",
              policyVersion: "source-v1",
            },
      );
    });
    const result = await searchWithStore(
      {
        kind: "film",
        cacheInput: { query: "daniel craig", kind: "actor" },
        run: finderMock.runAiWatchSearch,
      },
      {
        store,
        fetchImpl: fetchImpl as unknown as typeof fetch,
        validateDraft: async () => ({ status: "unavailable", reason: "valid" }),
      },
    );
    expect(result).toMatchObject({
      status: "found",
      fromCache: true,
      summary: "Checked.",
    });
  });

  it("does not run an unbudgeted search on a miss", async () => {
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

    expect(result).toEqual({ status: "unavailable" });
    expect(finderMock.runAiWatchSearch).not.toHaveBeenCalled();
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

  it("does not start an unbudgeted search when the database is down", async () => {
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

    expect(result).toEqual({ status: "unavailable" });
    expect(finderMock.runAiWatchSearch).not.toHaveBeenCalled();
  });

  it("rejects a snapshot whose source is not a safe URL", async () => {
    const fetchImpl = vi.fn(async () =>
      json({
        validationStatus: "valid",
        summary: "Stored.",
        watches: [
          { ...validatedWatch, sourceUrl: "javascript:alert(1)" },
          validatedWatch,
        ],
        validatedAt: "2026-10-27T00:00:00Z",
        policyVersion: "source-v1",
      }),
    );

    const result = await searchWithStore(
      { kind: "quiz", cacheInput: { a: 1 }, run: finderMock.runAiWatchSearch },
      { store, fetchImpl: fetchImpl as unknown as typeof fetch },
    );

    expect(result.status).toBe("unavailable");
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
