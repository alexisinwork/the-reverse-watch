import { describe, expect, it } from "vitest";

import type { Deps } from "./ai-providers.server";
import {
  isNewCondition,
  lookupMarketPrice,
  median,
} from "./market-price.server";

const fx = { date: "2026-09-30", perEur: { EUR: 1, USD: 1.1, CHF: 0.95 } };

function deps(perplexity: object[], muse: object[] = []): Deps {
  const answer = (listings: object[]) => JSON.stringify({ listings });
  return {
    config: {
      museSpark: {
        apiKey: "m",
        baseUrl: "https://muse.test/v1/",
        fastModel: "f",
      },
      perplexity: { apiKey: "p", model: "sonar" },
      webSearch: "perplexity",
    },
    fetchImpl: async (input: string | URL | Request) => {
      const url = String(input);
      if (url.startsWith("https://api.perplexity.ai")) {
        return Response.json({
          choices: [{ message: { content: answer(perplexity) } }],
        });
      }
      return Response.json({
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: answer(muse) }],
          },
        ],
      });
    },
    sleep: async () => undefined,
    loadFx: async () => fx,
    now: () => Date.parse("2026-09-30T12:00:00Z"),
  };
}

const watch = {
  brand: "Ball",
  model: "Engineer Hydrocarbon AeroGMT II",
  referenceCode: "DG2018C-S20C-BK",
};

describe("isNewCondition", () => {
  it.each([
    ["New/unworn", true],
    ["Brand new, unworn", true],
    ["Pre-owned, like new", true],
    ["Unworn (approximately new)", true],
    ["Very good", false],
    ["Used (good)", false],
    ["Pre-owned", false],
  ])("%s -> %s", (condition, expected) => {
    expect(isNewCondition(condition)).toBe(expected);
  });
});

describe("lookupMarketPrice", () => {
  it("takes the median USD price of new or unworn listings only", async () => {
    const result = await lookupMarketPrice(
      watch,
      deps([
        {
          amount: 3_499,
          currency: "USD",
          condition: "New",
          url: "https://www.chrono24.com/a",
        },
        {
          amount: 3_000,
          currency: "EUR",
          condition: "Unworn",
          url: "https://www.chrono24.com/b",
        },
        {
          amount: 3_599,
          currency: "USD",
          condition: "New/unworn",
          url: "https://www.chrono24.com/c",
        },
        {
          amount: 1_900,
          currency: "USD",
          condition: "Very good",
          url: "https://www.chrono24.com/d",
        },
      ]),
      fx,
    );
    expect(result).toMatchObject({
      status: "found",
      amount: 3_499,
      currency: "USD",
    });
  });

  it("asks Muse Spark when Perplexity finds nothing, and refuses a price far off", async () => {
    const found = await lookupMarketPrice(
      watch,
      deps(
        [],
        [{ amount: 3_400, currency: "USD", condition: "New", url: null }],
      ),
      fx,
    );
    expect(found).toMatchObject({ status: "found", amount: 3_400 });
    expect(found.evidence.provider).toBe("muse");

    const far = await lookupMarketPrice(
      watch,
      deps([{ amount: 34_000, currency: "USD", condition: "New", url: null }]),
      fx,
      3_500,
    );
    expect(far).toMatchObject({ status: "none" });
    expect(far.evidence.reason).toBe("far_from_expected");
  });

  it("computes medians", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });
});
