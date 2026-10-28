import { describe, expect, it, vi } from "vitest";
import { defaultDeps } from "./ai-providers.server";
import { validationProviderCalls } from "./validation-provider-calls.server";
import { ProviderCostError } from "./validation-provider-response.server";

const brief = {
  brand: "Omega",
  model: "Planet Ocean",
  referenceCode: "2201.50.00",
  person: "Daniel Craig",
  work: "Quantum of Solace",
};
const claim = {
  ...brief,
  sourceUrl: "https://source.example/watch",
  sourceQuote: "Omega 2201.50.00 Daniel Craig Quantum of Solace",
  supported: true,
};
const config = {
  webSearch: "perplexity" as const,
  perplexity: { apiKey: "test-secret", model: "unused" },
  museSpark: {
    apiKey: "test-secret",
    baseUrl: "https://muse.example/v1/",
    fastModel: "muse-spark-1.3-contributor",
  },
};

describe("metered validation provider requests", () => {
  it("sends one bounded request to each distinct provider and parses their usage", async () => {
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) =>
        String(input).includes("perplexity")
          ? Response.json({
              status: "completed",
              model: "openai/gpt-6-luna",
              output: [
                { type: "search_results", results: [{ url: claim.sourceUrl }] },
                {
                  type: "message",
                  content: [
                    { type: "output_text", text: JSON.stringify(claim) },
                  ],
                },
              ],
              usage: {
                cost: { currency: "USD", total_cost: 0.004 },
                tool_calls_details: { search_web: { invocation: 1 } },
              },
            })
          : Response.json({
              status: "completed",
              model: "muse-spark-1.3-contributor",
              output: [
                {
                  type: "web_search_call",
                  status: "completed",
                  action: { type: "search", queries: ["Omega"] },
                },
                {
                  type: "message",
                  content: [
                    {
                      type: "output_text",
                      text: JSON.stringify(claim),
                      annotations: [
                        { type: "url_citation", url: claim.sourceUrl },
                      ],
                    },
                  ],
                },
              ],
              usage: { input_tokens: 1000, output_tokens: 500 },
            }),
    );
    const calls = validationProviderCalls(defaultDeps({ config, fetchImpl }));
    const [primary, secondary] = await Promise.all([
      calls.primary(brief),
      calls.secondary(brief),
    ]);
    expect(primary).toMatchObject({
      costUsd: 0.004,
      evidence: { provider: "perplexity", sourceVerified: false },
    });
    expect(secondary.evidence.provider).toBe("muse");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchImpl.mock.calls[0]![1]?.body))).toMatchObject(
      { max_tool_calls: 1, max_output_tokens: 600 },
    );
    expect(JSON.parse(String(fetchImpl.mock.calls[1]![1]?.body))).toMatchObject(
      { max_tool_calls: 1, max_output_tokens: 1200 },
    );
  });

  it("does not retry or fall back after a provider failure", async () => {
    const fetchImpl = vi.fn(async () => new Response("down", { status: 503 }));
    const calls = validationProviderCalls(defaultDeps({ config, fetchImpl }));
    await expect(calls.primary(brief)).rejects.toThrow("503");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retains reported cost when a successful provider response has invalid evidence", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes("perplexity")
        ? Response.json({
            status: "incomplete",
            usage: { cost: { currency: "USD", total_cost: 0.03 } },
          })
        : Response.json({
            status: "incomplete",
            model: "muse-spark-1.3-contributor",
            output: [
              {
                type: "web_search_call",
                status: "completed",
                action: { type: "search", queries: ["one", "two"] },
              },
            ],
            usage: { input_tokens: 1000, output_tokens: 500 },
          }),
    );
    const calls = validationProviderCalls(defaultDeps({ config, fetchImpl }));
    const result = await Promise.allSettled([
      calls.primary(brief),
      calls.secondary(brief),
    ]);
    expect(result[0]).toMatchObject({
      status: "rejected",
      reason: { costUsd: 0.03 },
    });
    expect(result[1].status).toBe("rejected");
    if (
      result[1].status !== "rejected" ||
      !(result[1].reason instanceof ProviderCostError)
    )
      throw new Error("expected cost error");
    expect(result[1].reason.costUsd).toBeCloseTo(0.0052);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
