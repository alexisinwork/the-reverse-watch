/**
 * Pre-owned asking prices from established dealers only (owner decision,
 * 2026-10-01): no private sellers, no auction or classified sites. At
 * least two listings are needed; the low, median and high are kept in
 * US dollars, converted with the day's ECB rates.
 */
import { sonarJson, type Deps } from "./ai-providers.server";
import { convert, type FxTable } from "./fx";
import { safeHttpUrl } from "./source-pages.server";
import type { PreownedPrice } from "./watch-catalogue";

/** Dealers we trust for pre-owned prices. Chrono24 counts for its dealer listings only. */
const DEALER_HOSTS = [
  "chrono24.",
  "watchfinder.",
  "bobswatches.com",
  "the1916company.com",
  "watchbox.com",
  "tourneau.com",
  "crownandcaliber.com",
  "analogshift.com",
  "europeanwatch.com",
  "swisswatchexpo.com",
  "shop.hodinkee.com",
  "davidsw.com",
  "goldsmiths.co.uk",
  "mappinandwebb.com",
  "beckertime.com",
  "luxurybazaar.com",
];

export function isEstablishedDealer(url: string | null) {
  const safe = safeHttpUrl(url);
  if (!safe) return false;
  const host = new URL(safe).hostname.replace(/^www\./, "");
  return DEALER_HOSTS.some((dealer) =>
    dealer.endsWith(".")
      ? host.startsWith(dealer) || host.includes(`.${dealer}`)
      : host === dealer || host.endsWith(`.${dealer}`),
  );
}

const SCHEMA = {
  type: "object",
  properties: {
    listings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          price: { type: "number" },
          currency: { type: "string" },
          condition: { type: "string" },
          sellerType: {
            type: "string",
            enum: ["dealer", "private", "unknown"],
          },
          url: { type: "string" },
        },
        required: ["price", "currency", "url"],
      },
    },
  },
  required: ["listings"],
};

type Listing = {
  price?: unknown;
  currency?: unknown;
  condition?: unknown;
  sellerType?: unknown;
  url?: unknown;
};

export async function lookupPreownedPrice(
  watch: { brand: string; model: string; referenceCode: string | null },
  deps: Deps,
  fx: FxTable | null,
  now = new Date(),
): Promise<PreownedPrice | null> {
  if (!fx) return null;
  const name = `${watch.brand} ${watch.model}${watch.referenceCode ? `, reference ${watch.referenceCode}` : ""}`;
  const answer = (await sonarJson(
    [
      `Find current pre-owned asking prices for the ${name}.`,
      "Only listings from established watch dealers (for example Chrono24 dealer listings, Watchfinder, Bob's Watches, The 1916 Company, Crown & Caliber, Tourneau). Exclude private sellers, auctions and classifieds, and exclude new or unworn listings.",
      "List up to 8 individual listings you can see, each with price, currency, condition, sellerType and the listing URL. Do not estimate.",
    ].join(" "),
    SCHEMA,
    deps,
    "medium",
  )) as { listings?: Listing[] };

  const usd = (answer.listings ?? []).flatMap((listing) => {
    const url = typeof listing.url === "string" ? listing.url : null;
    if (!isEstablishedDealer(url) || listing.sellerType === "private")
      return [];
    if (typeof listing.price !== "number" || listing.price <= 0) return [];
    if (typeof listing.currency !== "string") return [];
    if (
      typeof listing.condition === "string" &&
      /\b(new|unworn)\b/i.test(listing.condition) &&
      !/pre-?owned|used/i.test(listing.condition)
    ) {
      return [];
    }
    const amount = convert(
      listing.price,
      listing.currency.toUpperCase(),
      "USD",
      fx,
    );
    return amount === null ? [] : [amount];
  });
  if (usd.length < 2) return null;
  usd.sort((a, b) => a - b);
  return {
    currency: "USD",
    low: Math.round(usd[0]!),
    median: Math.round(usd[Math.floor(usd.length / 2)]!),
    high: Math.round(usd[usd.length - 1]!),
    listings: usd.length,
    checkedAt: now.toISOString(),
  };
}
