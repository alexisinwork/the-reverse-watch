import { describe, expect, it, vi } from "vitest";
import { searchWithStore } from "./ai-watch-store.server";
import { defaultDeps } from "./ai-providers.server";
import { validateCachedSearch } from "./validate-cached-search.server";
import { validationServices } from "./validation-services.server";
import type { CatalogueClient } from "./watch-catalogue.server";

describe("first-use cache validation flow", () => {
  it("validates once, publishes the checked facts atomically and reuses the committed snapshot", async () => {
    const attemptId = "00000000-0000-4000-8000-000000000001";
    const config = { supabaseUrl: "https://db.example", serviceKey: "test" };
    const draftWatch = {
      brand: "Omega",
      model: "Planet Ocean",
      referenceCode: "2201.50.00",
      sourceUrl: "https://old.example/watch",
      imageUrl: null,
      priceNote: null,
      rationale: "Unverified legacy claim",
      details: { person: "Daniel Craig", work: "Quantum of Solace" },
    };
    let snapshot: unknown = null;
    let publication: Record<string, unknown> | null = null;
    let reservations = 0;
    const dbFetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = String(input);
        if (path.includes("ai_watch_validated_cache_get"))
          return Response.json(snapshot);
        if (path.includes("ai_watch_search_get"))
          return Response.json({
            validationStatus: "unverified",
            summary: "Old",
            watches: [draftWatch],
          });
        if (path.includes("watch_catalogue_lookup")) return Response.json([]);
        if (path.includes("validation_reserve")) {
          reservations++;
          return Response.json({
            state: "reserved",
            attemptId,
            reservedUsd: 0.025,
          });
        }
        if (path.includes("validated_cache_publish_v7")) {
          publication = JSON.parse(String(init?.body)) as Record<
            string,
            unknown
          >;
          snapshot = {
            validationStatus: "valid",
            summary: publication.p_summary,
            watches: publication.p_watches,
            validatedAt: "2026-10-28T00:00:00Z",
            policyVersion: "source-v1",
          };
          return Response.json(true);
        }
        return new Response("not found", { status: 404 });
      },
    );
    const claim = {
      brand: "Omega",
      referenceCode: "2201.50.00",
      person: "Daniel Craig",
      work: "Quantum of Solace",
      sourceQuote: "Omega 2201.50.00 Daniel Craig Quantum of Solace",
      supported: true,
      facts: [
        {
          field: "caseDiameterMm",
          value: 41.5,
          quote: "2201.50.00 case diameter 41.5 mm",
        },
        {
          field: "price",
          value: "USD 3500",
          quote: "2201.50.00 market price USD 3,500",
        },
      ],
    };
    const providerBodies: string[] = [];
    const externalFetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const endpoint = String(input);
        if (endpoint.includes("api.perplexity.ai")) {
          providerBodies.push(String(init?.body));
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
                      ...claim,
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
          providerBodies.push(String(init?.body));
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
                      ...claim,
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
        if (endpoint.includes("image.example"))
          return new Response(new Uint8Array([1]), {
            headers: { "content-type": "image/jpeg" },
          });
        return new Response(
          `<p>Omega 2201.50.00 Daniel Craig Quantum of Solace. 2201.50.00 case diameter 41.5 mm. 2201.50.00 market price USD 3,500</p><script type="application/ld+json">${JSON.stringify({ "@type": "Product", brand: "Omega", sku: "2201.50.00", image: "https://image.example/watch.jpg" })}</script>`,
          { headers: { "content-type": "text/html" } },
        );
      },
    );
    const client: CatalogueClient = { config, fetchImpl: dbFetch };
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
      now: () => Date.parse("2026-10-28T00:00:00Z"),
    });
    const validateDraft = vi.fn((key, watches) =>
      validateCachedSearch(
        key as string,
        watches as (typeof draftWatch)[],
        validationServices(client, deps),
      ),
    );
    const request = {
      kind: "film" as const,
      cacheInput: { query: "daniel craig", kind: "actor" },
      run: vi.fn(),
    };
    const options = { store: config, fetchImpl: dbFetch, validateDraft };

    const first = await searchWithStore(request, options);
    expect(first).toMatchObject({
      status: "found",
      fromCache: false,
      watches: [
        {
          referenceCode: "2201.50.00",
          imageUrl: "https://image.example/watch.jpg",
          details: {
            caseDiameterMm: 41.5,
            price: { amount: 3500, currency: "USD" },
            priceConfirmed: false,
          },
        },
      ],
    });
    expect(publication).toMatchObject({
      p_attempt_id: attemptId,
      p_costs_usd: [0.0067],
    });
    expect(reservations).toBe(1);
    expect(providerBodies).toHaveLength(2);
    expect(providerBodies.join(" ")).not.toContain("Unverified legacy claim");
    const second = await searchWithStore(request, options);
    expect(second).toMatchObject({
      status: "found",
      fromCache: true,
      watches: [{ referenceCode: "2201.50.00" }],
    });
    expect(validateDraft).toHaveBeenCalledTimes(1);
    expect(providerBodies).toHaveLength(2);
    expect(request.run).not.toHaveBeenCalled();
  });
});
