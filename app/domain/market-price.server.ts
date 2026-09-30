/**
 * Approximate market prices (owner decision, 2026-09-30): where no retail
 * price can be confirmed, the typical asking price of the watch in new,
 * unworn or like-new condition, from Chrono24 or other dealers (grey
 * market is fine). Visitors only need a rough price range, and every price
 * they see is marked approximate.
 *
 * Perplexity is asked first (cheap); Muse Spark's own web search only when
 * Perplexity finds nothing. The middle (median) price in US dollars is kept.
 */
import {
  museWebResearch,
  parseModelJson,
  sonarJson,
  type Deps,
} from "./ai-providers.server";
import { convert, type FxTable } from "./fx";
import { safeHttpUrl } from "./source-pages.server";

type WatchIdentity = {
  brand: string;
  model: string;
  referenceCode: string | null;
};

export type MarketListing = {
  amount: number;
  currency: string;
  condition: string;
  seller: string | null;
  url: string | null;
  usd: number;
};

const listingSchema = {
  type: "object",
  properties: {
    listings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          amount: { type: ["number", "null"] },
          currency: { type: ["string", "null"] },
          condition: { type: ["string", "null"] },
          seller: { type: ["string", "null"] },
          url: { type: ["string", "null"] },
        },
        required: ["amount", "currency", "condition", "url"],
      },
    },
  },
  required: ["listings"],
};

/** New, unworn or like new; never used, worn, "very good" and the like. */
export function isNewCondition(condition: string) {
  const text = condition.toLowerCase();
  const fresh = /\b(new|unworn|like new|mint|nos|unused)\b/.test(text);
  const worn =
    /\b(used|worn|very good|good|fair|poor|vintage|refurbished)\b/.test(
      text.replace(/like new/g, ""),
    ) && !/\b(unworn|like new)\b/.test(text);
  return fresh && !worn;
}

function marketPrompt(watch: WatchIdentity) {
  const name = `${watch.brand} ${watch.model}${watch.referenceCode ? ` (reference ${watch.referenceCode})` : ""}`;
  return [
    `What does a new or unworn ${name} currently sell for?`,
    "Use current listings on Chrono24 or other watch dealers (grey-market prices are fine), and the brand's own price if published.",
    "Only new, unworn or like-new condition, never pre-owned in used condition.",
    "List up to 5 prices, each with the ISO currency, the stated condition, the seller and the page URL.",
  ].join(" ");
}

function readListings(payload: unknown, fx: FxTable | null): MarketListing[] {
  const raw = (payload as { listings?: unknown })?.listings;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): MarketListing[] => {
    const item = (entry ?? {}) as Record<string, unknown>;
    const amount =
      typeof item.amount === "number" && Number.isFinite(item.amount)
        ? item.amount
        : null;
    const currency =
      typeof item.currency === "string" &&
      /^[A-Za-z]{3}$/.test(item.currency.trim())
        ? item.currency.trim().toUpperCase()
        : null;
    const condition =
      typeof item.condition === "string" ? item.condition.trim() : "";
    if (amount === null || amount < 20 || !currency) return [];
    if (!isNewCondition(condition)) return [];
    const usd =
      currency === "USD"
        ? amount
        : fx
          ? convert(amount, currency, "USD", fx)
          : null;
    if (usd === null || usd > 5_000_000) return [];
    return [
      {
        amount,
        currency,
        condition,
        seller: typeof item.seller === "string" ? item.seller.trim() : null,
        url: safeHttpUrl(typeof item.url === "string" ? item.url : null),
        usd,
      },
    ];
  });
}

export function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

export type MarketPrice =
  | {
      status: "found";
      amount: number;
      currency: "USD";
      evidence: Record<string, unknown>;
    }
  | { status: "none"; evidence: Record<string, unknown> };

/**
 * The typical new/unworn market price in USD, or none. `expectedUsd` (the
 * price the search originally proposed, if any) guards against a listing
 * set that is clearly for a different watch: more than 3x off is refused.
 */
export async function lookupMarketPrice(
  watch: WatchIdentity,
  deps: Deps,
  fx: FxTable | null,
  expectedUsd: number | null = null,
): Promise<MarketPrice> {
  const checkedAt = new Date(deps.now()).toISOString();
  const prompt = marketPrompt(watch);
  let provider = "perplexity";
  let listings: MarketListing[] = [];
  if (deps.config.perplexity && deps.config.webSearch !== "muse") {
    listings = readListings(
      await sonarJson(prompt, listingSchema, deps, "medium").catch(() => null),
      fx,
    );
  }
  if (listings.length === 0 && deps.config.museSpark) {
    provider = "muse";
    const research = await museWebResearch(prompt, deps, {
      schema: listingSchema,
      maxToolCalls: 5,
    }).catch(() => null);
    listings = research
      ? readListings(
          (() => {
            try {
              return parseModelJson(research.text);
            } catch {
              return null;
            }
          })(),
          fx,
        )
      : [];
  }
  const base = {
    method: "market_new_listings",
    provider,
    checkedAt,
    listings,
    // Kept so later checks can compare the market price with the price
    // the search first proposed.
    expectedUsd,
  };
  if (listings.length === 0) {
    return { status: "none", evidence: { ...base, reason: "no_new_listings" } };
  }
  const amount = Math.round(median(listings.map((listing) => listing.usd)));
  if (expectedUsd && (amount > expectedUsd * 3 || amount < expectedUsd / 3)) {
    return {
      status: "none",
      evidence: { ...base, reason: "far_from_expected", amount },
    };
  }
  return { status: "found", amount, currency: "USD", evidence: base };
}
