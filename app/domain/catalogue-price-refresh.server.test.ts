import { describe, expect, it, vi } from "vitest";
import {
  refreshedPrice,
  runPriceRefresh,
  priceRefreshServices,
  type PriceRefreshServices,
} from "./catalogue-price-refresh.server";
import type { FoundWatch } from "./ai-watch-types";
import type { CatalogueWatch } from "./watch-catalogue";
import { defaultDeps } from "./ai-providers.server";

const watch: CatalogueWatch = {
  id: "00000000-0000-4000-8000-000000000001",
  identityKey: "omega|22015000",
  brand: "Omega",
  model: "Planet Ocean",
  referenceCode: "2201.50.00",
  referenceConfirmed: true,
  styles: ["dive"],
  caseDiameterMm: 42,
  caseThicknessMm: null,
  caseShape: "round",
  waterResistanceM: 600,
  movement: "automatic",
  inHouseCalibre: null,
  crystal: "sapphire",
  displayCaseback: false,
  complications: [],
  caseMaterial: "steel",
  casebackMaterial: "steel",
  strapMaterial: null,
  priceAmount: 3000,
  priceCurrency: "USD",
  priceStatus: "approximate",
  priceCheckedAt: "2026-01-01T00:00:00Z",
  priceEvidence: {},
  priceChange: null,
  sourceUrl: "https://first.example/watch",
  sourceKind: "manufacturer",
  imageUrl: null,
  rationale: null,
  foundIn: [],
  reviewStatus: "approved",
  reviewedAt: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};
function candidate(second = "USD 3600"): FoundWatch {
  const at = "2026-10-29T00:00:00Z";
  const sources = (["perplexity", "muse"] as const).map((provider, index) => ({
    provider,
    sourceUrl:
      index === 0
        ? "https://first.example/watch"
        : "https://second.example/watch",
    checkedAt: at,
    value: index === 0 ? "USD 3500" : second,
    quote: `Omega 2201.50.00 market price ${index === 0 ? "USD 3500" : second}`,
  }));
  return {
    brand: watch.brand,
    model: watch.model,
    referenceCode: watch.referenceCode,
    sourceUrl: sources[0]!.sourceUrl,
    imageUrl: null,
    priceNote: "USD 3500",
    rationale: "Checked",
    details: {
      price: { amount: 3500, currency: "USD" },
      priceConfirmed: false,
      validationEvidence: sources.map(({ provider, sourceUrl, checkedAt }) => ({
        provider,
        sourceUrl,
        checkedAt,
      })),
      priceObservation: { value: "USD 3500", sources },
    },
  };
}
function services(): PriceRefreshServices {
  return {
    reserve: vi.fn(async () => ({
      state: "reserved" as const,
      attemptId: "00000000-0000-4000-8000-000000000002",
      watches: [watch],
    })),
    check: vi.fn(async () => ({
      decision: {
        status: "verified" as const,
        watch: candidate(),
        evidence: [],
      },
      cost: 0.008,
    })),
    finish: vi.fn(async () => true),
    overrun: vi.fn(async () => true),
  };
}
describe("scheduled price estimates", () => {
  it("retains approximate status and the primary amount even if source order changes", () => {
    const card = candidate();
    card.details.priceObservation!.sources.reverse();
    expect(refreshedPrice(watch, card)).toMatchObject({
      id: watch.id,
      amount: 3500,
      currency: "USD",
      priceStatus: "approximate",
    });
  });
  it.each(["EUR 3500", "USD 4000"])(
    "rejects incompatible price observations: %s",
    (second) => {
      expect(refreshedPrice(watch, candidate(second))).toBeNull();
    },
  );
  it("rejects the wrong reference and unsupported evidence", () => {
    expect(
      refreshedPrice(watch, { ...candidate(), referenceCode: "OTHER123" }),
    ).toBeNull();
    const card = candidate();
    card.details.priceObservation!.sources[1]!.quote =
      "OTHER123 market price USD 3600";
    expect(refreshedPrice(watch, card)).toBeNull();
  });
  it("does not infer a new price from existing local values", () => {
    const card = candidate();
    delete card.details.priceObservation;
    expect(refreshedPrice(watch, card)).toBeNull();
  });
});
describe("metered daily price job", () => {
  it("uses the real provider/source adapters to replace a stale local price proposal", async () => {
    const providerRequests: unknown[] = [];
    const dbFetch = vi.fn<typeof fetch>(async (input) =>
      String(input).includes("reserve")
        ? Response.json({
            state: "reserved",
            attemptId: "00000000-0000-4000-8000-000000000002",
            watches: [watch],
          })
        : Response.json(true),
    );
    const externalFetch = vi.fn<typeof fetch>(async (input, init) => {
      const endpoint = String(input);
      const primary = endpoint.includes("api.perplexity.ai");
      if (primary || endpoint.includes("muse.example")) {
        providerRequests.push(JSON.parse(String(init?.body)) as unknown);
        const sourceUrl = primary
          ? "https://first.example/watch"
          : "https://second.example/watch";
        const claim = {
          brand: watch.brand,
          referenceCode: watch.referenceCode,
          person: null,
          work: null,
          sourceUrl,
          sourceQuote: "Omega 2201.50.00 market price USD 3500",
          supported: true,
          facts: [
            {
              field: "price",
              value: "USD 3500",
              quote: "Omega 2201.50.00 market price USD 3500",
            },
          ],
        };
        return Response.json({
          status: "completed",
          model: primary ? "openai/gpt-6-luna" : "muse-spark-1.3-contributor",
          output: [
            ...(primary
              ? [{ type: "search_results", results: [{ url: sourceUrl }] }]
              : [
                  {
                    type: "web_search_call",
                    status: "completed",
                    action: { type: "search", queries: ["Omega 2201.50.00"] },
                  },
                ]),
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify(claim),
                  annotations: [{ type: "url_citation", url: sourceUrl }],
                },
              ],
            },
          ],
          usage: primary
            ? {
                cost: { currency: "USD", total_cost: 0.004 },
                tool_calls_details: { search_web: { invocation: 1 } },
              }
            : { input_tokens: 1000, output_tokens: 500 },
        });
      }
      return new Response("<p>Omega 2201.50.00 market price USD 3500</p>", {
        headers: { "Content-Type": "text/html" },
      });
    });
    const deps = defaultDeps({
      config: {
        webSearch: "perplexity",
        perplexity: { apiKey: "test", model: "unused" },
        museSpark: {
          apiKey: "test",
          baseUrl: "https://muse.example/v1/",
          fastModel: "muse-spark-1.3-contributor",
        },
      },
      fetchImpl: externalFetch,
    });
    const result = await runPriceRefresh(
      priceRefreshServices(
        {
          config: { supabaseUrl: "https://db.example", serviceKey: "test" },
          fetchImpl: dbFetch,
        },
        deps,
      ),
    );
    expect(result).toEqual({ ok: true, checked: 1, verifiedPrices: 1 });
    expect(providerRequests).toHaveLength(2);
    for (const request of providerRequests)
      expect(JSON.stringify(request)).toContain(
        'Requested missing fields: [\\"price\\"]',
      );
    expect(String(dbFetch.mock.calls[1]![0])).toContain(
      "catalogue_price_recheck_finish_v1",
    );
    expect(JSON.parse(String(dbFetch.mock.calls[1]![1]?.body))).toMatchObject({
      p_results: [{ amount: 3500, priceStatus: "approximate" }],
    });
  });
  it.each([
    "no_due",
    "already_run",
    "in_progress",
    "monthly_limit",
    "budget_halted",
  ] as const)(
    "does not call a provider when admission returns %s",
    async (state) => {
      const s = services();
      s.reserve = vi.fn(async () => ({ state }));
      expect(await runPriceRefresh(s)).toEqual({
        ok: true,
        skipped: true,
        reason: state,
      });
      expect(s.check).not.toHaveBeenCalled();
      expect(s.finish).not.toHaveBeenCalled();
    },
  );
  it("reserves before calls and sends checked estimates plus every cost to the atomic finish", async () => {
    const s = services();
    expect(await runPriceRefresh(s)).toEqual({
      ok: true,
      checked: 1,
      verifiedPrices: 1,
    });
    expect(s.reserve).toHaveBeenCalledBefore(vi.mocked(s.check));
    expect(s.finish).toHaveBeenCalledWith(
      expect.any(String),
      [
        expect.objectContaining({
          id: watch.id,
          amount: 3500,
          priceStatus: "approximate",
        }),
      ],
      [0.008],
    );
  });
  it("charges unknown failures conservatively without refreshing old prices", async () => {
    const s = services();
    s.check = vi.fn(async () => {
      throw new Error("interrupted");
    });
    expect(await runPriceRefresh(s)).toMatchObject({
      ok: true,
      verifiedPrices: 0,
    });
    expect(s.finish).toHaveBeenCalledWith(expect.any(String), [], [null]);
  });
  it("keeps a known overrun held and never commits a smaller charge", async () => {
    const s = services();
    s.check = vi.fn(async () => ({
      decision: null,
      cost: 0.03,
      overrun: true,
    }));
    expect(await runPriceRefresh(s)).toEqual({
      ok: false,
      reason: "budget_halted",
    });
    expect(s.overrun).toHaveBeenCalledWith(expect.any(String), [0.03]);
    expect(s.finish).not.toHaveBeenCalled();
  });
  it("does not claim completion after a failed database settlement", async () => {
    const s = services();
    s.finish = vi.fn(async () => false);
    expect(await runPriceRefresh(s)).toEqual({
      ok: false,
      reason: "settlement_failed",
    });
  });
});
