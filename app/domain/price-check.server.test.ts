import { describe, expect, it } from "vitest";

import type { Deps } from "./ai-providers.server";
import {
  doublePriceCheck,
  isFreshDate,
  pageShowsPrice,
} from "./price-check.server";

const NOW = Date.parse("2026-09-30T12:00:00Z");

describe("pageShowsPrice", () => {
  it("finds the amount in common number formats", () => {
    expect(pageShowsPrice("<span>$5,450.00</span>", 5_450)).toBe(true);
    expect(pageShowsPrice("CHF 5’450.–", 5_450)).toBe(true);
    expect(pageShowsPrice("5.450,00 €", 5_450)).toBe(true);
    expect(pageShowsPrice("Price 15,450", 5_450)).toBe(false);
    expect(pageShowsPrice("$6,100 210.30.42.20.03.001", 6_100)).toBe(true);
    expect(pageShowsPrice("<b>$6,100</b> 200 m", 6_100)).toBe(true);
    expect(pageShowsPrice("CHF 6 100.–", 6_100)).toBe(true);
    expect(pageShowsPrice("USD 6100", 6_100)).toBe(true);
    expect(pageShowsPrice("ref 61001", 6_100)).toBe(false);
  });
});

describe("isFreshDate", () => {
  it("accepts sources under 90 days old only", () => {
    expect(isFreshDate("2026-08-01", NOW)).toBe(true);
    expect(isFreshDate("2026-05-01", NOW)).toBe(false);
    expect(isFreshDate(null, NOW)).toBe(false);
  });
});

function sonar(price: object, extra: object = {}) {
  const content = { prices: [price] };
  return Response.json({
    choices: [{ message: { content: JSON.stringify(content) } }],
    ...extra,
  });
}

function deps(responses: {
  sonar: Response[];
  pages: Record<string, string>;
}): Deps {
  const queue = [...responses.sonar];
  return {
    config: {
      museSpark: null,
      perplexity: { apiKey: "test", model: "sonar" },
      webSearch: "perplexity",
    },
    fetchImpl: async (input: string | URL | Request) => {
      const url = String(input);
      if (url.startsWith("https://api.perplexity.ai")) return queue.shift()!;
      const page = responses.pages[url];
      return page === undefined
        ? new Response("", { status: 404 })
        : new Response(page);
    },
    sleep: async () => undefined,
    loadFx: async () => null,
    now: () => NOW,
  };
}

const watch = {
  brand: "Omega",
  model: "Seamaster Diver 300M",
  referenceCode: "210.30.42.20.03.001",
};
const fx = { date: "2026-09-29", perEur: { EUR: 1, USD: 1.1, CHF: 0.95 } };

describe("doublePriceCheck", () => {
  it("confirms a price two independent live sources agree on", async () => {
    const result = await doublePriceCheck(
      watch,
      deps({
        sonar: [
          sonar({
            amount: 6_100,
            currency: "USD",
            sourceUrl: "https://www.omegawatches.com/a",
            sourceDate: null,
          }),
          sonar({
            amount: 6_100,
            currency: "USD",
            sourceUrl: "https://www.mayors.com/b",
            sourceDate: "2026-09-10",
          }),
        ],
        pages: {
          "https://www.omegawatches.com/a": "<b>$6,100</b> 210.30.42.20.03.001",
          "https://www.mayors.com/b": "gone",
        },
      }),
      fx,
    );
    expect(result).toMatchObject({
      status: "confirmed",
      amount: 6_100,
      currency: "USD",
    });
  });

  it("rejects lookups that disagree by more than 5%", async () => {
    const result = await doublePriceCheck(
      watch,
      deps({
        sonar: [
          sonar({
            amount: 6_100,
            currency: "USD",
            sourceUrl: "https://www.omegawatches.com/a",
            sourceDate: "2026-09-20",
          }),
          sonar({
            amount: 5_500,
            currency: "USD",
            sourceUrl: "https://www.mayors.com/omega",
            sourceDate: "2026-09-20",
          }),
        ],
        pages: {},
      }),
      fx,
    );
    expect(result.status).toBe("unconfirmed");
    expect(result.evidence.reason).toBe("lookups_disagree");
  });

  it("compares prices within one market only", async () => {
    const eur = {
      amount: 5_550,
      currency: "EUR",
      sourceUrl: "https://www.omegawatches.com/de",
      sourceDate: "2026-09-20",
    };
    const result = await doublePriceCheck(
      watch,
      deps({
        sonar: [
          sonar({
            amount: 6_100,
            currency: "USD",
            sourceUrl: "https://www.omegawatches.com/a",
            sourceDate: "2026-09-20",
          }),
          sonar(eur),
          sonar(eur),
        ],
        pages: {},
      }),
      fx,
    );
    expect(result.evidence.reason).toBe("currency_mismatch");
  });

  it("rejects a stale source that is not live", async () => {
    const result = await doublePriceCheck(
      watch,
      deps({
        sonar: [
          sonar({
            amount: 6_100,
            currency: "USD",
            sourceUrl: "https://www.omegawatches.com/a",
            sourceDate: "2025-01-01",
          }),
        ],
        pages: {},
      }),
      fx,
    );
    expect(result.evidence.reason).toBe("first_source_stale");
  });

  it("does not count the same page twice as independent", async () => {
    const result = await doublePriceCheck(
      watch,
      deps({
        sonar: [
          sonar({
            amount: 6_100,
            currency: "USD",
            sourceUrl: "https://www.omegawatches.com/a",
            sourceDate: "2026-09-20",
          }),
          sonar({
            amount: 6_100,
            currency: "USD",
            sourceUrl: "https://omegawatches.com/a/",
            sourceDate: "2026-09-20",
          }),
        ],
        pages: {},
      }),
      fx,
    );
    expect(result.evidence.reason).toBe("second_lookup_empty");
  });
});

describe("Perplexity finds, Muse Spark double-checks", () => {
  function museAnswer(prices: object[], opened: string[] = []) {
    return Response.json({
      output: [
        ...opened.map((url) => ({
          type: "web_search_call",
          status: "completed",
          action: { type: "open_page", url },
        })),
        {
          type: "message",
          content: [{ type: "output_text", text: JSON.stringify({ prices }) }],
        },
      ],
    });
  }

  function withMuse(
    perplexity: Response[],
    muse: Response[],
    pages: Record<string, string>,
  ) {
    const base = deps({ sonar: perplexity, pages });
    const museQueue = [...muse];
    const museUrls: string[] = [];
    const value: typeof base = {
      ...base,
      config: {
        ...base.config,
        museSpark: {
          apiKey: "test",
          baseUrl: "https://muse.test/v1/",
          fastModel: "m",
        },
      },
      fetchImpl: async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.startsWith("https://muse.test")) {
          museUrls.push(url);
          return museQueue.shift() ?? museAnswer([]);
        }
        return base.fetchImpl(input, init);
      },
    };
    return { deps: value, museUrls };
  }

  it("confirms when Muse's page agrees with Perplexity's, ignoring grey-market pages", async () => {
    const { deps: museDeps, museUrls } = withMuse(
      [
        sonar({
          amount: 6_100,
          currency: "USD",
          sourceUrl: "https://www.omegawatches.com/a",
          sourceDate: null,
        }),
      ],
      [
        museAnswer([
          {
            amount: 5_200,
            currency: "USD",
            sourceUrl: "https://www.chrono24.com/x",
          },
          {
            amount: 6_100,
            currency: "USD",
            sourceUrl: "https://www.mayors.com/omega",
          },
        ]),
      ],
      {
        "https://www.omegawatches.com/a": "<b>$6,100</b> 210.30.42.20.03.001",
        "https://www.mayors.com/omega":
          "Price $6,100.00 ref 210.30.42.20.03.001",
        "https://www.chrono24.com/x": "$5,200 210.30.42.20.03.001",
      },
    );
    const result = await doublePriceCheck(watch, museDeps, fx);
    expect(result).toMatchObject({
      status: "confirmed",
      amount: 6_100,
      currency: "USD",
    });
    expect(result.evidence.method).toBe("perplexity_then_muse");
    expect(museUrls[0]).toBe("https://muse.test/v1/responses");
  });

  it("falls back to a second Perplexity lookup when Muse finds nothing", async () => {
    const { deps: museDeps } = withMuse(
      [
        sonar({
          amount: 6_100,
          currency: "USD",
          sourceUrl: "https://www.omegawatches.com/a",
          sourceDate: null,
        }),
        sonar({
          amount: 6_100,
          currency: "USD",
          sourceUrl: "https://www.mayors.com/omega",
          sourceDate: null,
        }),
      ],
      [],
      {
        "https://www.omegawatches.com/a": "<b>$6,100</b> 210.30.42.20.03.001",
        "https://www.mayors.com/omega": "$6,100 210.30.42.20.03.001",
      },
    );
    const result = await doublePriceCheck(watch, museDeps, fx);
    expect(result).toMatchObject({ status: "confirmed", amount: 6_100 });
    expect(result.evidence.method).toBe("perplexity_then_perplexity");
  });

  it("counts a page Muse opened only when our own fetch is blocked", async () => {
    const blocked = "https://www.tissotwatches.com/en-us/T1224101103300.html";
    const run = (opened: string[]) =>
      withMuse(
        [
          sonar({
            amount: 450,
            currency: "USD",
            sourceUrl: "https://www.mayors.com/tissot",
            sourceDate: null,
          }),
        ],
        [
          museAnswer(
            [{ amount: 450, currency: "USD", sourceUrl: blocked }],
            opened,
          ),
        ],
        { "https://www.mayors.com/tissot": "$450 T122.410.11.033.00" },
      ).deps;
    const tissot = {
      brand: "Tissot",
      model: "Carson Premium",
      referenceCode: "T122.410.11.033.00",
    };
    expect((await doublePriceCheck(tissot, run([blocked]), fx)).status).toBe(
      "confirmed",
    );
    expect((await doublePriceCheck(tissot, run([]), fx)).status).toBe(
      "unconfirmed",
    );
  });
});
