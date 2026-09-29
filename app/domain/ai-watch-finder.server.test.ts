import { vi } from "vitest";

import {
  findWatchesWithAi,
  quizBrief,
  quizCacheInput,
  runAiWatchSearch,
  type WatchBrief,
} from "./ai-watch-finder.server";
import type { ProfileV3 } from "./questionnaire-v3";

const profile: ProfileV3 = {
  version: 3,
  budgetCurrency: "EUR",
  budgetMax: 2_100,
  wearingScenarios: ["office", "everyday"],
  minimumWaterResistanceM: 100,
  caseDiameterMinMm: 36,
  caseDiameterMaxMm: 41,
  movementTypes: ["automatic"],
  requiredComplications: [],
  allergyConstraint: "none",
};

const config = {
  museSpark: { apiKey: "muse-key", baseUrl: "https://muse.test/v1/", model: "m" },
  perplexity: { apiKey: "pplx-key", model: "sonar-pro" },
};

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

const toolCall = {
  choices: [
    {
      message: {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: {
              name: "search_watches_via_perplexity",
              arguments: JSON.stringify({ query: "office automatic 36-41mm" }),
            },
          },
        ],
      },
    },
  ],
};

function watch(overrides: Record<string, unknown> = {}) {
  return {
    brand: "Seiko",
    model: "Prospex",
    referenceCode: "SPB143",
    sourceUrl: "https://www.seikowatches.com/spb143",
    imageUrl: "https://img.example/spb143.jpg",
    priceNote: "about EUR 1,200",
    rationale: "Fits.",
    ...overrides,
  };
}

function scriptedFetch(
  answer: Record<string, unknown>,
  {
    firstReply = toolCall,
    imageContentType = "image/jpeg",
  }: { firstReply?: unknown; imageContentType?: string } = {},
) {
  const calls: { url: string; method: string; body: string }[] = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? "GET", body: String(init?.body ?? "") });
    if (url.includes("perplexity")) {
      return json({
        choices: [{ message: { content: "search results" } }],
        citations: ["https://www.seikowatches.com/spb143"],
        images: [{ image_url: "https://img.example/spb143.jpg", origin_url: "https://www.seikowatches.com" }],
      });
    }
    if (url.startsWith("https://img.example/")) {
      return new Response(null, { status: 200, headers: { "content-type": imageContentType } });
    }
    const museCalls = calls.filter((call) => call.url.includes("muse.test"));
    if (museCalls.length === 1) return json(firstReply);
    return json({
      choices: [{ message: { role: "assistant", content: JSON.stringify(answer) } }],
    });
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}

const brief: WatchBrief = { task: "Find watches.", lines: ["Constraint."], maxWatches: 5 };

describe("runAiWatchSearch", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("searches through Perplexity first and returns the verified watches", async () => {
    const { fetchImpl, calls } = scriptedFetch({
      found: true,
      summary: "One fit.",
      watches: [watch()],
    });

    const result = await runAiWatchSearch(brief, { config, fetchImpl });

    expect(result).toEqual({
      status: "found",
      summary: "One fit.",
      watches: [
        {
          brand: "Seiko",
          model: "Prospex",
          referenceCode: "SPB143",
          sourceUrl: "https://www.seikowatches.com/spb143",
          imageUrl: "https://img.example/spb143.jpg",
          priceNote: "about EUR 1,200",
          rationale: "Fits.",
        },
      ],
    });
    const perplexityCall = calls.find((call) => call.url.includes("perplexity"));
    expect(JSON.parse(perplexityCall!.body)).toMatchObject({ return_images: true });
  });

  it("drops watches without a brand, model, or http(s) source, and caps the count", async () => {
    const { fetchImpl } = scriptedFetch({
      found: true,
      summary: "Several.",
      watches: [
        watch({ sourceUrl: "javascript:alert(1)" }),
        watch({ brand: " " }),
        watch({ model: "One" }),
        watch({ model: "One" }),
        watch({ model: "Two" }),
      ],
    });

    const result = await runAiWatchSearch(
      { ...brief, maxWatches: 1 },
      { config, fetchImpl },
    );

    expect(result.status).toBe("found");
    if (result.status !== "found") throw new Error("expected found");
    expect(result.watches.map((found) => found.model)).toEqual(["One"]);
  });

  it("keeps a watch but drops an image URL that does not serve an image", async () => {
    const { fetchImpl } = scriptedFetch(
      { found: true, summary: "One.", watches: [watch()] },
      { imageContentType: "text/html" },
    );

    const result = await runAiWatchSearch(brief, { config, fetchImpl });

    if (result.status !== "found") throw new Error("expected found");
    expect(result.watches[0]!.imageUrl).toBeNull();
  });

  it("reports no_match when nothing usable survives", async () => {
    const { fetchImpl } = scriptedFetch({
      found: true,
      summary: "Nothing reliable.",
      watches: [watch({ sourceUrl: null })],
    });

    expect(await runAiWatchSearch(brief, { config, fetchImpl })).toEqual({
      status: "no_match",
      summary: "Nothing reliable.",
    });
  });

  it("refuses an answer that skipped the search", async () => {
    const { fetchImpl } = scriptedFetch(
      { found: true, summary: "x", watches: [watch()] },
      {
        firstReply: {
          choices: [
            {
              message: {
                role: "assistant",
                content: JSON.stringify({ found: true, summary: "x", watches: [watch()] }),
              },
            },
          ],
        },
      },
    );

    expect(await runAiWatchSearch(brief, { config, fetchImpl })).toEqual({
      status: "unavailable",
    });
  });

  it("reports unavailable on failure, timeout, or missing configuration", async () => {
    const failing = vi.fn(async () => new Response("down", { status: 503 }));
    expect(
      await runAiWatchSearch(brief, { config, fetchImpl: failing as unknown as typeof fetch }),
    ).toEqual({ status: "unavailable" });

    const hanging = vi.fn(() => new Promise<Response>(() => undefined));
    expect(
      await runAiWatchSearch(brief, {
        config,
        timeoutMs: 20,
        fetchImpl: hanging as unknown as typeof fetch,
      }),
    ).toEqual({ status: "unavailable" });

    const untouched = vi.fn();
    expect(
      await runAiWatchSearch(brief, {
        config: { museSpark: null, perplexity: null },
        fetchImpl: untouched as unknown as typeof fetch,
      }),
    ).toEqual({ status: "unavailable" });
    expect(untouched).not.toHaveBeenCalled();
  });
});

describe("Perplexity rate limits", () => {
  it("runs tool calls one at a time, retries a 429, and caps searches per brief", async () => {
    const sixCalls = {
      choices: [
        {
          message: {
            role: "assistant",
            content: null,
            tool_calls: Array.from({ length: 6 }, (_, index) => ({
              id: `call_${index}`,
              type: "function",
              function: {
                name: "search_watches_via_perplexity",
                arguments: JSON.stringify({ query: `query ${index}` }),
              },
            })),
          },
        },
      ],
    };
    let inFlight = 0;
    let maxInFlight = 0;
    let perplexityRequests = 0;
    let museRequests = 0;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("perplexity")) {
        perplexityRequests += 1;
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await Promise.resolve();
        inFlight -= 1;
        if (perplexityRequests === 1) {
          return new Response("slow down", { status: 429, headers: { "retry-after": "1" } });
        }
        return json({ choices: [{ message: { content: "results" } }] });
      }
      if (url.startsWith("https://img.example/")) {
        return new Response(null, { status: 200, headers: { "content-type": "image/png" } });
      }
      museRequests += 1;
      return museRequests === 1
        ? json(sixCalls)
        : json({
            choices: [
              {
                message: {
                  role: "assistant",
                  content: JSON.stringify({ found: true, summary: "ok", watches: [watch()] }),
                },
              },
            ],
          });
    });
    const sleep = vi.fn(async () => undefined);

    const result = await findWatchesWithAi(
      brief,
      config,
      fetchImpl as unknown as typeof fetch,
      sleep,
    );

    expect(result.status).toBe("found");
    expect(maxInFlight).toBe(1);
    expect(sleep).toHaveBeenCalledWith(1_000);
    // 4 searches allowed; the first was retried once after the 429.
    expect(perplexityRequests).toBe(5);
  });
});

describe("quiz brief and cache input", () => {
  it("searches the price band, not the exact budget", () => {
    const lines = quizBrief(profile).lines.join("\n");
    expect(lines).toContain("Price: between EUR 2,000 and EUR 5,000");
    expect(lines).not.toContain("2100");
  });

  it("gives the same cache input for reordered answers in the same band", () => {
    expect(
      quizCacheInput({
        ...profile,
        budgetMax: 4_900,
        wearingScenarios: ["everyday", "office"],
      }),
    ).toEqual(quizCacheInput(profile));
  });
});
