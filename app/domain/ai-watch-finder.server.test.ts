import { vi } from "vitest";

import { searchWatchForQuiz } from "./ai-watch-finder.server";
import type { ProfileV3 } from "./questionnaire-v3";

const profile: ProfileV3 = {
  version: 3,
  budgetCurrency: "USD",
  budgetMax: 5000,
  wearingScenarios: ["office"],
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

function scriptedFetch(finalAnswer: Record<string, unknown>) {
  const calls: { url: string; body: string }[] = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, body: String(init?.body ?? "") });
    if (url.includes("perplexity")) {
      return json({ choices: [{ message: { content: "search results" } }] });
    }
    const museCalls = calls.filter((call) => call.url.includes("muse.test"));
    if (museCalls.length === 1) {
      return json({
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
      });
    }
    return json({
      choices: [{ message: { role: "assistant", content: JSON.stringify(finalAnswer) } }],
    });
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}

describe("searchWatchForQuiz", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the searched pick and calls Perplexity through the tool", async () => {
    const { fetchImpl, calls } = scriptedFetch({
      found: true,
      brand: "Seiko",
      model: "Prospex",
      referenceCode: "SPB143",
      sourceUrl: "https://www.seikowatches.com/spb143",
      rationale: "Fits.",
    });

    const result = await searchWatchForQuiz(profile, { config, fetchImpl });

    expect(result).toMatchObject({ status: "found", brand: "Seiko" });
    expect(calls.some((call) => call.url.includes("perplexity"))).toBe(true);
  });

  it("drops a non-http source URL from model output", async () => {
    const { fetchImpl } = scriptedFetch({
      found: true,
      brand: "X",
      model: "Y",
      referenceCode: null,
      sourceUrl: "javascript:alert(1)",
      rationale: "Fits.",
    });

    const result = await searchWatchForQuiz(profile, { config, fetchImpl });

    expect(result).toMatchObject({ status: "found", sourceUrl: null });
  });

  it("reports unavailable when the search fails", async () => {
    const fetchImpl = vi.fn(async () => new Response("down", { status: 503 }));

    const result = await searchWatchForQuiz(profile, {
      config,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ status: "unavailable" });
  });

  it("reports unavailable when the search exceeds its time budget", async () => {
    const fetchImpl = vi.fn(() => new Promise<Response>(() => undefined));

    const result = await searchWatchForQuiz(profile, {
      config,
      timeoutMs: 20,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ status: "unavailable" });
  });

  it("reports unavailable without calling anything when unconfigured", async () => {
    const fetchImpl = vi.fn();

    const result = await searchWatchForQuiz(profile, {
      config: { museSpark: null, perplexity: null },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ status: "unavailable" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
