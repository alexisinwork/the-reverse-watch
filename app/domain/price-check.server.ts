/**
 * Price confirmation for the catalogue. A price is stored only when two
 * independent web lookups (Perplexity or Muse Spark, per WEB_SEARCH_PROVIDER),
 * on two different source pages, agree
 * within 5% in the same currency, and each source is either under 90 days
 * old or a live page that shows the price and the reference right now.
 */
import {
  museWebResearch,
  parseModelJson,
  perplexityPost,
  type Deps,
} from "./ai-providers.server";
import { safeHttpUrl } from "./source-pages.server";
import { classifySource, pageMentionsReference } from "./ai-watch-guardrails";
import { convert, type FxTable } from "./fx";
import { musePriceSearch } from "./muse-price-search.server";

export const PRICE_TOLERANCE = 0.05;
export const PRICE_MAX_AGE_DAYS = 90;

/**
 * Only prices in the quiz's budget currencies count: a regional price in
 * another market (Brazil, Japan...) converted by exchange rate misleads.
 */
const PRICE_CURRENCIES = new Set(["USD", "EUR", "GBP", "CHF"]);

export type PriceLookup = {
  amount: number;
  currency: string;
  sourceUrl: string;
  sourceDate: string | null;
  /** The page loads now and shows both the amount and the reference. */
  live: boolean;
  /** Who saw it live: our own fetch, or (only when we are blocked) Muse. */
  liveVia?: "fetch" | "muse";
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
          imageUrl: { type: ["string", "null"] },
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

type PageCheck = "shows" | "missing" | "blocked";

/**
 * Loads the page ourselves: "shows" when it carries both the amount and the
 * reference, "missing" when it loads without them, "blocked" when it will
 * not load for our server (bot walls, geo-blocks, errors).
 */
async function checkPage(
  url: string,
  amount: number,
  reference: string | null,
  fetchImpl: typeof fetch,
): Promise<PageCheck> {
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
      return "blocked";
    }
    const html = (await response.text()).slice(0, 1_500_000);
    // The price must sit on a page about this exact reference.
    return pageShowsPrice(html, amount) &&
      (reference === null ||
        pageMentionsReference(reference, html, response.url || url))
      ? "shows"
      : "missing";
  } catch {
    return "blocked";
  }
}

/**
 * Owner's rule: a page is live when our own fetch shows the price and the
 * reference. Only when our server is blocked does a page that Muse Spark's
 * web search opened in this same lookup count instead.
 */
async function liveCheck(
  url: string,
  amount: number,
  reference: string | null,
  fetchImpl: typeof fetch,
  openedByMuse: Set<string>,
): Promise<Pick<PriceLookup, "live" | "liveVia">> {
  const result = await checkPage(url, amount, reference, fetchImpl);
  if (result === "shows") return { live: true, liveVia: "fetch" };
  if (result === "blocked" && openedByMuse.has(urlKey(url))) {
    return { live: true, liveVia: "muse" };
  }
  return { live: false };
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
  /(^|\.)(chrono24\.[a-z.]+|watchmaxx\.com|jomashop\.com|watchfinder\.[a-z.]+|ebay\.[a-z.]+|amazon\.[a-z.]+|timeshop24\.[a-z.]+|uhrzeit\.org|watchspies\.com|crownandcaliber\.com|bobswatches\.com|thewatchbox\.com|watchbox\.com|1stdibs\.com|walmart\.com|aliexpress\.com|ashford\.com|prestigetime\.com|authenticwatches\.com|worldofwatches\.com|creationwatches\.com|certifiedwatchstore\.com|trendyol\.com|hepsiburada\.com|allegro\.[a-z.]+|idealo\.[a-z.]+|preissuchmaschine\.de|reddit\.com|watchuseek\.com|watchcharts\.com)$/;

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
  const list = `For each of up to ${MAX_SOURCES} pages give the amount, the ISO currency code, the page URL, the page date (YYYY-MM-DD) if known, and the URL of the product photo shown on that page (imageUrl) if there is one.`;
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
    (currency !== null && !PRICE_CURRENCIES.has(currency)) ||
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
  const openedByMuse = new Set<string>();
  let body: SonarBody;
  if (deps.config.webSearch === "muse") {
    const research = await museWebResearch(lookupPrompt(watch, options), deps, {
      schema: priceSchema,
      // Measured 2026-09-30: caps of 3/4 halved cost but re-confirmed 2 of 10
      // known prices instead of 6; 5/8 keeps accuracy.
      maxToolCalls: options.contextSize === "low" ? 5 : 8,
    });
    for (const page of research.openedPages) openedByMuse.add(urlKey(page));
    body = { choices: [{ message: { content: research.text } }] };
  } else {
    body = await sonarPriceLookup(watch, deps, options);
  }
  return readPriceAnswer(watch, deps, options, body, openedByMuse);
}

async function sonarPriceLookup(
  watch: WatchIdentity,
  deps: Deps,
  options: LookupOptions,
): Promise<SonarBody> {
  return (await perplexityPost(
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
}

async function readPriceAnswer(
  watch: WatchIdentity,
  deps: Deps,
  options: LookupOptions,
  body: SonarBody,
  openedByMuse: Set<string>,
): Promise<{ lookups: PriceLookup[]; imageUrls: string[] }> {
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
        ...(await liveCheck(
          entry.sourceUrl,
          entry.amount,
          watch.referenceCode,
          deps.fetchImpl,
          openedByMuse,
        )),
        fresh: dates.some((date) => isFreshDate(date, now)),
      };
    }),
  );
  // Photos the answer reported for its pages come after the search's own.
  const reportedImages = (
    Array.isArray(parsed.prices) ? (parsed.prices as unknown[]) : []
  )
    .map((entry) => (entry ?? {}) as { imageUrl?: unknown })
    .map((entry) =>
      safeHttpUrl(typeof entry.imageUrl === "string" ? entry.imageUrl : null),
    )
    .filter((url): url is string => url !== null);
  return { lookups, imageUrls: [...imageUrls, ...reportedImages] };
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
async function perplexityDoubleCheck(
  watch: WatchIdentity,
  deps: Deps,
  fx: FxTable | null,
  hintUrl: string | null,
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

/** Muse Spark's reported prices, kept only for live retail pages showing the price and reference. */
async function museLookups(
  watch: WatchIdentity,
  deps: Deps,
  options: {
    avoidUrls: string[];
    currency: string | null;
    hintUrl: string | null;
  },
) {
  const reported = await musePriceSearch(watch, deps, options).catch(() => []);
  const avoid = new Set(options.avoidUrls.map(urlKey));
  const seen = new Set<string>();
  const checked = await Promise.all(
    reported
      .filter((price) => {
        const key = urlKey(price.sourceUrl);
        if (
          !PRICE_CURRENCIES.has(price.currency) ||
          !isRetailSource(price.sourceUrl) ||
          avoid.has(key) ||
          seen.has(key)
        )
          return false;
        seen.add(key);
        return options.currency === null || price.currency === options.currency;
      })
      .slice(0, MAX_SOURCES)
      .map(async (price): Promise<PriceLookup> => ({
        ...price,
        sourceDate: null,
        ...(await liveCheck(
          price.sourceUrl,
          price.amount,
          watch.referenceCode,
          deps.fetchImpl,
          new Set(),
        )),
        fresh: false,
      })),
  );
  return { reported: checked, live: checked.filter((lookup) => lookup.live) };
}

function agreeingPair(
  firsts: PriceLookup[],
  seconds: PriceLookup[],
  fx: FxTable | null,
) {
  for (const a of firsts) {
    for (const b of seconds) {
      if (
        a.currency !== b.currency ||
        urlKey(a.sourceUrl) === urlKey(b.sourceUrl)
      )
        continue;
      const difference = priceDifference(a, b, fx);
      if (difference !== null && difference <= PRICE_TOLERANCE)
        return { a, b, difference };
    }
  }
  return null;
}

/**
 * The Perplexity double check, then (when museFallback is on and it could
 * not confirm) Muse Spark searching the web for this watch's price itself.
 * A Muse price is one more independent lookup: it counts only on a live
 * retail page showing the price and the reference, and only when it agrees
 * within 5% with another lookup - a Perplexity source or a second Muse
 * search on a different page.
 */
export async function doublePriceCheck(
  watch: WatchIdentity,
  deps: Deps,
  fx: FxTable | null,
  hintUrl: string | null = null,
  {
    museFallback = false,
    previous,
  }: {
    museFallback?: boolean;
    /** An earlier, unconfirmed Perplexity check to reuse instead of repeating it. */
    previous?: PriceCheck;
  } = {},
): Promise<PriceCheck> {
  const check =
    previous ?? (await perplexityDoubleCheck(watch, deps, fx, hintUrl));
  if (
    check.status === "confirmed" ||
    !museFallback ||
    !deps.config.museSpark ||
    deps.config.webSearch === "muse"
  )
    return check;

  const earlier = (
    (check.evidence.lookups as PriceLookup[][] | undefined) ?? []
  ).flat();
  const earlierUsable = earlier
    .filter(usable)
    .sort(preferManufacturer(watch.brand));
  const first = await museLookups(watch, deps, {
    avoidUrls: [],
    currency: null,
    hintUrl,
  });
  const done = (
    pair: { a: PriceLookup; b: PriceLookup; difference: number },
    muse: PriceLookup[][],
  ): PriceCheck => ({
    status: "confirmed",
    amount: pair.a.amount,
    currency: pair.a.currency,
    evidence: {
      method: "perplexity_and_muse_web_search",
      checkedAt: check.evidence.checkedAt,
      difference: pair.difference,
      agreed: [pair.a, pair.b],
      lookups: check.evidence.lookups,
      museLookups: muse,
    },
    imageUrls: check.imageUrls,
  });
  const withEarlier = agreeingPair(earlierUsable, first.live, fx);
  if (withEarlier) return done(withEarlier, [first.reported]);
  if (first.live.length === 0) {
    return {
      ...check,
      evidence: {
        ...check.evidence,
        museLookups: [first.reported],
        museReason: "no_live_price",
      },
    };
  }
  const currency = first.live[0]!.currency;
  const second = await museLookups(watch, deps, {
    avoidUrls: [...first.reported, ...earlier].map(
      (lookup) => lookup.sourceUrl,
    ),
    currency,
    hintUrl: null,
  });
  const pair = agreeingPair(first.live, second.live, fx);
  if (pair) return done(pair, [first.reported, second.reported]);
  return {
    ...check,
    evidence: {
      ...check.evidence,
      museLookups: [first.reported, second.reported],
      museReason:
        second.live.length === 0 ? "second_muse_empty" : "muse_disagree",
    },
  };
}
