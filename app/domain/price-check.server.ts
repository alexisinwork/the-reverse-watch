/**
 * Price confirmation for the catalogue. A price is stored only when two
 * independent Perplexity lookups, on two different source pages, agree
 * within 5% in the same currency, and each source is either under 90 days
 * old or a live page that shows the price and the reference right now.
 */
import {
  parseModelJson,
  perplexityPost,
  safeHttpUrl,
  type Deps,
} from "./ai-watch-finder.server";
import { classifySource, pageMentionsReference } from "./ai-watch-guardrails";
import { convert, type FxTable } from "./fx";

export const PRICE_TOLERANCE = 0.05;
export const PRICE_MAX_AGE_DAYS = 90;

export type PriceLookup = {
  amount: number;
  currency: string;
  sourceUrl: string;
  sourceDate: string | null;
  /** The page loads now and shows both the amount and the reference. */
  live: boolean;
  /** The source is dated within the last 90 days. */
  fresh: boolean;
};

export type PriceCheck =
  | {
      status: "confirmed";
      amount: number;
      currency: string;
      evidence: Record<string, unknown>;
      imageUrls: string[];
    }
  | {
      status: "unconfirmed";
      evidence: Record<string, unknown>;
      imageUrls: string[];
    };

type WatchIdentity = {
  brand: string;
  model: string;
  referenceCode: string | null;
};

const MAX_SOURCES = 3;

/** Up to three priced sources per lookup, so two lookups can meet. */
const priceSchema = {
  type: "object",
  properties: {
    prices: {
      type: "array",
      items: {
        type: "object",
        properties: {
          amount: { type: ["number", "null"] },
          currency: { type: ["string", "null"] },
          sourceUrl: { type: ["string", "null"] },
          sourceDate: { type: ["string", "null"] },
        },
        required: ["amount", "currency", "sourceUrl", "sourceDate"],
      },
    },
  },
  required: ["prices"],
};

/** True when the page text shows the amount, in any common number format. */
export function pageShowsPrice(html: string, amount: number) {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/(\d)[\s,.'  ’](?=\d{3}(?!\d))/g, "$1")
    .replace(/(\d)[\s,.'  ’](?=\d{3}(?!\d))/g, "$1");
  const target = String(Math.round(amount));
  return new RegExp(`(?<!\\d)${target}(?:[.,]\\d{2})?(?!\\d)`).test(text);
}

export function isFreshDate(
  date: string | null,
  now: number,
  maxAgeDays = PRICE_MAX_AGE_DAYS,
) {
  if (!date) return false;
  const time = Date.parse(date);
  if (!Number.isFinite(time)) return false;
  const ageDays = (now - time) / 86_400_000;
  return ageDays >= -2 && ageDays <= maxAgeDays;
}

function urlKey(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname.replace(/\/$/, "")}`.toLowerCase();
  } catch {
    return url;
  }
}

async function pageIsLive(
  url: string,
  amount: number,
  reference: string | null,
  fetchImpl: typeof fetch,
) {
  try {
    const response = await fetchImpl(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; TheReserveBot/1.0; +https://thereserve.watch)",
        accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      return false;
    }
    const html = (await response.text()).slice(0, 1_500_000);
    // The price must sit on a page about this exact reference.
    return (
      pageShowsPrice(html, amount) &&
      (reference === null ||
        pageMentionsReference(reference, html, response.url || url))
    );
  } catch {
    return false;
  }
}

export type LookupOptions = {
  /** The second lookup must use pages the first did not. */
  avoidUrls: string[];
  /** The second lookup stays in the first one's currency (same market). */
  currency: string | null;
  /** The maker's page that confirmed the reference, as a starting point. */
  hintUrl: string | null;
  contextSize: "low" | "medium";
};

// Grey-market dealers, marketplaces and pre-owned sellers: their prices
// are discounts or asks, not the retail price, so they never count.
const NON_RETAIL_HOSTS =
  /(^|\.)(chrono24\.[a-z.]+|watchmaxx\.com|jomashop\.com|watchfinder\.[a-z.]+|ebay\.[a-z.]+|amazon\.[a-z.]+|timeshop24\.[a-z.]+|uhrzeit\.org|watchspies\.com|crownandcaliber\.com|bobswatches\.com|thewatchbox\.com|watchbox\.com|1stdibs\.com|walmart\.com|aliexpress\.com|ashford\.com|prestigetime\.com|authenticwatches\.com|worldofwatches\.com|creationwatches\.com|certifiedwatchstore\.com|reddit\.com|watchuseek\.com|watchcharts\.com)$/;

export function isRetailSource(url: string) {
  try {
    return !NON_RETAIL_HOSTS.test(
      new URL(url).hostname.toLowerCase().replace(/^www\./, ""),
    );
  } catch {
    return false;
  }
}

function lookupPrompt(watch: WatchIdentity, options: LookupOptions) {
  const name = `${watch.brand} ${watch.model}${watch.referenceCode ? ` reference ${watch.referenceCode}` : ""}`;
  const list = `For each of up to ${MAX_SOURCES} pages give the amount, the ISO currency code, the page URL and the page date (YYYY-MM-DD) if known.`;
  // Plainly worded questions get answers; long lists of caveats make the
  // model return nulls. Grey-market pages are filtered out in code.
  if (options.avoidUrls.length === 0) {
    return [
      `What is the current new retail price of the ${name} watch in the United States?`,
      options.hintUrl
        ? `The manufacturer's product page is probably ${options.hintUrl}.`
        : "",
      `List up to ${MAX_SOURCES} web pages that show this price (the manufacturer or authorised retailers).`,
      list,
    ]
      .filter(Boolean)
      .join(" ");
  }
  return [
    `Find the list price in ${options.currency} of the ${name} watch, as shown on its product pages at the manufacturer's site and at authorised retailers in the same market.`,
    `Use pages other than ${options.avoidUrls.slice(0, 4).join(", ")}.`,
    list,
  ].join(" ");
}

type SonarBody = {
  choices?: { message?: { content?: unknown } }[];
  search_results?: { url?: unknown; date?: unknown; last_updated?: unknown }[];
  images?: { image_url?: unknown; origin_url?: unknown }[];
};

function readLookupEntry(entry: unknown) {
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
  const sourceUrl = safeHttpUrl(
    typeof item.sourceUrl === "string" ? item.sourceUrl : null,
  );
  if (
    amount === null ||
    amount < 20 ||
    amount > 5_000_000 ||
    !currency ||
    !sourceUrl
  ) {
    return null;
  }
  return {
    amount,
    currency,
    sourceUrl,
    sourceDate: typeof item.sourceDate === "string" ? item.sourceDate : null,
  };
}

export async function lookupPrices(
  watch: WatchIdentity,
  deps: Deps,
  options: LookupOptions,
): Promise<{ lookups: PriceLookup[]; imageUrls: string[] }> {
  const body = (await perplexityPost(
    "chat/completions",
    {
      model: deps.config.perplexity!.model,
      max_tokens: 900,
      web_search_options: { search_context_size: options.contextSize },
      response_format: {
        type: "json_schema",
        json_schema: { schema: priceSchema },
      },
      return_images: options.avoidUrls.length === 0,
      messages: [{ role: "user", content: lookupPrompt(watch, options) }],
    },
    deps,
    30_000,
  )) as SonarBody;

  // Product photos come back with the first lookup; manufacturer and
  // authorised-retailer pages first.
  const imageUrls = (body.images ?? [])
    .map((image) => ({
      url: safeHttpUrl(
        typeof image.image_url === "string" ? image.image_url : null,
      ),
      origin: typeof image.origin_url === "string" ? image.origin_url : null,
    }))
    .filter(
      (image): image is { url: string; origin: string | null } =>
        image.url !== null,
    )
    .sort(
      (a, b) =>
        Number(classifySource(b.origin, watch.brand) !== null) -
        Number(classifySource(a.origin, watch.brand) !== null),
    )
    .map((image) => image.url);

  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== "string") return { lookups: [], imageUrls };
  let parsed: { prices?: unknown };
  try {
    parsed = parseModelJson(content) as { prices?: unknown };
  } catch {
    return { lookups: [], imageUrls };
  }
  const avoid = new Set(options.avoidUrls.map(urlKey));
  const seen = new Set<string>();
  const entries = (
    Array.isArray(parsed.prices) ? (parsed.prices as unknown[]) : []
  )
    .map(readLookupEntry)
    .filter((entry): entry is NonNullable<typeof entry> => {
      if (!entry || !isRetailSource(entry.sourceUrl)) return false;
      const key = urlKey(entry.sourceUrl);
      if (avoid.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_SOURCES);
  const now = deps.now();
  const lookups = await Promise.all(
    entries.map(async (entry): Promise<PriceLookup> => {
      const key = urlKey(entry.sourceUrl);
      const cited = (body.search_results ?? []).find(
        (result) =>
          typeof result.url === "string" && urlKey(result.url) === key,
      );
      const dates = [
        entry.sourceDate,
        typeof cited?.last_updated === "string" ? cited.last_updated : null,
        typeof cited?.date === "string" ? cited.date : null,
      ].filter((date): date is string => date !== null);
      return {
        ...entry,
        sourceDate: dates[0] ?? null,
        live: await pageIsLive(
          entry.sourceUrl,
          entry.amount,
          watch.referenceCode,
          deps.fetchImpl,
        ),
        fresh: dates.some((date) => isFreshDate(date, now)),
      };
    }),
  );
  return { lookups, imageUrls };
}

/** Relative difference of b from a, after converting b into a's currency. */
export function priceDifference(
  a: { amount: number; currency: string },
  b: { amount: number; currency: string },
  fx: FxTable | null,
) {
  const bInA =
    a.currency === b.currency
      ? b.amount
      : fx
        ? convert(b.amount, b.currency, a.currency, fx)
        : null;
  return bInA === null ? null : Math.abs(bInA - a.amount) / a.amount;
}

const usable = (lookup: PriceLookup) => lookup.live || lookup.fresh;

/** One lookup, retried once with a wider web search when nothing usable comes back. */
async function lookupWithRetry(
  watch: WatchIdentity,
  deps: Deps,
  options: Omit<LookupOptions, "contextSize">,
) {
  const attempt = (contextSize: LookupOptions["contextSize"]) =>
    lookupPrices(watch, deps, { ...options, contextSize }).catch(() => ({
      lookups: [] as PriceLookup[],
      imageUrls: [] as string[],
    }));
  const fits = (lookup: PriceLookup) =>
    usable(lookup) &&
    (options.currency === null || lookup.currency === options.currency);
  const first = await attempt("low");
  if (first.lookups.some(fits)) return first;
  const second = await attempt("medium");
  const seen = new Set(first.lookups.map((lookup) => urlKey(lookup.sourceUrl)));
  return {
    lookups: [
      ...first.lookups,
      ...second.lookups.filter((lookup) => !seen.has(urlKey(lookup.sourceUrl))),
    ],
    imageUrls: [...first.imageUrls, ...second.imageUrls],
  };
}

function preferManufacturer(brand: string) {
  return (a: PriceLookup, b: PriceLookup) =>
    Number(classifySource(b.sourceUrl, brand) === "manufacturer") -
      Number(classifySource(a.sourceUrl, brand) === "manufacturer") ||
    Number(b.live) - Number(a.live) ||
    Number(b.currency === "USD") - Number(a.currency === "USD");
}

/**
 * Confirmed only when a source from the first lookup and a different
 * source from the second, independent lookup agree within 5% in the same
 * currency, and both are live pages or dated within 90 days.
 */
export async function doublePriceCheck(
  watch: WatchIdentity,
  deps: Deps,
  fx: FxTable | null,
  hintUrl: string | null = null,
): Promise<PriceCheck> {
  const checkedAt = new Date(deps.now()).toISOString();
  const unconfirmed = (
    reason: string,
    lookups: PriceLookup[][],
    imageUrls: string[],
  ): PriceCheck => ({
    status: "unconfirmed",
    evidence: { method: "double_perplexity", checkedAt, reason, lookups },
    imageUrls,
  });

  const first = await lookupWithRetry(watch, deps, {
    avoidUrls: [],
    currency: null,
    hintUrl,
  });
  const imageUrls = first.imageUrls;
  const firstUsable = first.lookups
    .filter(usable)
    .sort(preferManufacturer(watch.brand));
  if (firstUsable.length === 0) {
    return unconfirmed(
      first.lookups.length > 0 ? "first_source_stale" : "first_lookup_empty",
      [first.lookups],
      imageUrls,
    );
  }
  // Same market only: a UK price and a euro price legitimately differ.
  const currency = firstUsable[0]!.currency;
  const second = await lookupWithRetry(watch, deps, {
    avoidUrls: first.lookups.map((lookup) => lookup.sourceUrl),
    currency,
    hintUrl: null,
  });
  const lookups = [first.lookups, second.lookups];
  const secondUsable = second.lookups.filter(
    (lookup) => usable(lookup) && lookup.currency === currency,
  );
  if (secondUsable.length === 0) {
    return unconfirmed(
      second.lookups.length === 0
        ? "second_lookup_empty"
        : second.lookups.some(usable)
          ? "currency_mismatch"
          : "second_source_stale",
      lookups,
      imageUrls,
    );
  }
  for (const a of firstUsable.filter(
    (lookup) => lookup.currency === currency,
  )) {
    for (const b of secondUsable) {
      if (urlKey(a.sourceUrl) === urlKey(b.sourceUrl)) continue;
      const difference = priceDifference(a, b, fx);
      if (difference !== null && difference <= PRICE_TOLERANCE) {
        return {
          status: "confirmed",
          amount: a.amount,
          currency: a.currency,
          evidence: {
            method: "double_perplexity",
            checkedAt,
            difference,
            agreed: [a, b],
            lookups,
          },
          imageUrls,
        };
      }
    }
  }
  return unconfirmed("lookups_disagree", lookups, imageUrls);
}
