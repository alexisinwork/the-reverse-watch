import { describe, expect, it, vi } from "vitest";
import { defaultDeps } from "./ai-providers.server";
import type { FoundWatch } from "./ai-watch-types";
import { validateCachedSearch } from "./validate-cached-search.server";
import { validationServices } from "./validation-services.server";
import type { CatalogueClient } from "./watch-catalogue.server";

const attemptId = "00000000-0000-4000-8000-000000000001";
const watch: FoundWatch = {
  brand: "Omega",
  model: "Planet Ocean",
  referenceCode: "2201.50.00",
  sourceUrl: "https://p.example/watch",
  imageUrl: "https://old.example/unverified.jpg",
  priceNote: "Unverified old price",
  rationale: "Unverified old claim",
  details: {
    person: "Daniel Craig",
    work: "Quantum of Solace",
    price: { amount: 1, currency: "USD" },
    caseDiameterMm: 12,
    movement: "quartz",
    referenceVerified: true,
  },
};
const identity = {
  brand: watch.brand,
  referenceCode: watch.referenceCode,
  person: "Daniel Craig",
  work: "Quantum of Solace",
  sourceQuote: "Omega 2201.50.00 Daniel Craig Quantum of Solace",
  supported: true,
};

describe("validation services integration", () => {
  it("reserves before two grounded checks, opens both sources and settles once", async () => {
    const order: string[] = [];
    const dbFetch = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.includes("watch_catalogue_lookup")) return Response.json([]);
      if (path.includes("validation_reserve")) {
        order.push("reserve");
        return Response.json({
          state: "reserved",
          attemptId,
          reservedUsd: 0.025,
        });
      }
      if (path.includes("validated_cache_publish")) {
        order.push("publish");
        return Response.json(true);
      }
      return new Response("not found", { status: 404 });
    });
    const externalFetch = vi.fn(async (input: RequestInfo | URL) => {
      const endpoint = String(input);
      if (endpoint.includes("api.perplexity.ai")) {
        order.push("perplexity");
        return Response.json({
          status: "completed",
          model: "openai/gpt-6-luna",
          output: [
            {
              type: "search_results",
              results: [{ url: "https://p.example/watch" }],
            },
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    ...identity,
                    sourceUrl: "https://p.example/watch",
                  }),
                },
              ],
            },
          ],
          usage: {
            cost: { currency: "USD", total_cost: 0.004 },
            tool_calls_details: { search_web: { invocation: 1 } },
          },
        });
      }
      if (endpoint.includes("muse-api.example")) {
        order.push("muse");
        return Response.json({
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
                  text: JSON.stringify({
                    ...identity,
                    sourceUrl: "https://m.example/watch",
                  }),
                  annotations: [
                    { type: "url_citation", url: "https://m.example/watch" },
                  ],
                },
              ],
            },
          ],
          usage: { input_tokens: 1000, output_tokens: 500 },
        });
      }
      order.push("source");
      return new Response("Omega 2201.50.00 Daniel Craig Quantum of Solace", {
        headers: { "content-type": "text/plain" },
      });
    });
    const client: CatalogueClient = {
      config: { supabaseUrl: "https://db.example", serviceKey: "test" },
      fetchImpl: dbFetch,
    };
    const deps = defaultDeps({
      config: {
        webSearch: "perplexity",
        perplexity: { apiKey: "test", model: "unused" },
        museSpark: {
          apiKey: "test",
          baseUrl: "https://muse-api.example/v1/",
          fastModel: "muse-spark-1.3-contributor",
        },
      },
      fetchImpl: externalFetch,
    });
    const result = await validateCachedSearch(
      "a".repeat(64),
      [watch],
      validationServices(client, deps),
    );
    expect(result).toMatchObject({
      status: "verified",
      rejected: 0,
      watches: [
        {
          model: "2201.50.00",
          referenceCode: "2201.50.00",
          sourceUrl: "https://p.example/watch",
          imageUrl: null,
          priceNote: null,
          rationale:
            "Reference and available attribution checked against cited sources.",
          details: {
            validationEvidence: [
              {
                provider: "perplexity",
                sourceQuote: identity.sourceQuote,
                person: "Daniel Craig",
                work: "Quantum of Solace",
              },
              {
                provider: "muse",
                sourceQuote: identity.sourceQuote,
                person: "Daniel Craig",
                work: "Quantum of Solace",
              },
            ],
          },
        },
      ],
    });
    expect(order[0]).toBe("reserve");
    expect(order.slice(-1)).toEqual(["publish"]);
    expect(order.filter((entry) => entry === "source")).toHaveLength(2);
    expect(order.filter((entry) => entry === "perplexity")).toHaveLength(1);
    expect(order.filter((entry) => entry === "muse")).toHaveLength(1);
    if (result.status !== "verified") throw new Error("expected verified");
    expect(result.watches[0]!.details).not.toHaveProperty("price");
    expect(result.watches[0]!.details).not.toHaveProperty("caseDiameterMm");
    expect(result.watches[0]!.details).not.toHaveProperty("movement");
    expect(result.watches[0]!.details).not.toHaveProperty("referenceVerified");
  });
});
