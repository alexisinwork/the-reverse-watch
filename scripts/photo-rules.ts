// Rules for taking a watch's product photo from a page our server opened
// (scripts/find-catalogue-photos.ts). Each rule names the test-run case of
// 2026-11-28 that made it necessary.
import { safeHttpUrl, sourceHost } from "../app/domain/source-pages.server";
import { pageKind } from "./repair-rules";

/** Grey-market dealers and marketplaces: never a price source (AGENTS.md),
 * but the owner accepts their photos (2026-11-28). */
const GREY_SHOPS =
  /(^|\.)(chrono24\.[a-z.]+|jomashop\.com|watchmaxx\.com|watchfinder\.[a-z.]+|timeshop24\.[a-z.]+|crownandcaliber\.com|bobswatches\.com|thewatchbox\.com|watchbox\.com|1stdibs\.com|ashford\.com|prestigetime\.com|authenticwatches\.com|worldofwatches\.com|creationwatches\.com|certifiedwatchstore\.com|spacecitytimepiece\.com|the1916company\.com|chronext\.[a-z.]+|getbezel\.com|timescapeusa\.com|abbeyfive\.com|swisswatchexpo\.com|europeanwatch\.com|davidsw\.com|theluxuryhut\.com|luxurybazaar\.com|beckertime\.com|watchexchange\.[a-z.]+|millenarywatches\.com|precioustime\.[a-z.]+|zenluxe\.[a-z.]+|wristaficionado\.com)$/;

/** Chrono24 answers our server with an error page; its addresses go last. */
export const BLOCKS_US = /(^|\.)chrono24\.[a-z.]+$/;

export type PhotoSource = "maker" | "shop" | "grey";
export const SOURCE_ORDER: Record<PhotoSource, number> = {
  maker: 0,
  shop: 1,
  grey: 2,
};

/** The maker's own site, a shop, a grey-market dealer, or a page whose
 * photo is not taken (magazines, forums, social sites, auctions). */
export function photoSourceKind(
  url: string,
  brand: string,
): PhotoSource | null {
  if (!url.startsWith("https://")) return null;
  const host = sourceHost(url);
  if (!host) return null;
  if (GREY_SHOPS.test(host)) return "grey";
  const kind = pageKind(url, brand);
  return kind === "maker" ? "maker" : kind === "retailer" ? "shop" : null;
}

/** A site's logo or share card is not a photo of the watch (Space City
 * Timepiece gives every page the same og-image.svg). */
export const NOT_A_PRODUCT_PHOTO =
  /logo|favicon|placeholder|default[-_.]|og[-_]?(default|image)|share[-_]?image|social[-_]?(card|image)|banner|\.svg$/i;

export const alnum = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Whether an address names a sibling of the reference rather than the
 * reference itself: Breitling's page for U17395211A1U1 lists U17395211A1P1
 * as another strap, and its photo is of U17395211A1U1. An address that
 * names no reference at all is neutral.
 */
export function namesAnotherVariant(address: string, reference: string) {
  const own = alnum(reference);
  if (own.length < 6) return false;
  let path: string;
  try {
    path = alnum(decodeURIComponent(new URL(address).pathname));
  } catch {
    return false;
  }
  if (path.includes(own)) return false;
  const stem = own.slice(0, Math.max(6, Math.ceil(own.length * 0.75)));
  return path.includes(stem);
}

/** Only https photos show on the site (its pages are https): a shop's
 * http:// address is tried as https. */
export function asHttps(url: string | null) {
  if (!url) return null;
  return safeHttpUrl(url.replace(/^http:\/\//i, "https://"));
}

/**
 * The photo's width and height from the first bytes of the file (PNG, JPEG,
 * GIF, WebP), or null for another format or when it cannot be read.
 */
export function imageSize(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (from: number, to: number) =>
    String.fromCharCode(...bytes.subarray(from, to));
  if (bytes.length >= 24 && ascii(1, 4) === "PNG")
    return { width: view.getUint32(16), height: view.getUint32(20) };
  if (bytes.length >= 10 && ascii(0, 3) === "GIF")
    return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
  if (bytes.length >= 30 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
    const chunk = ascii(12, 16);
    if (chunk === "VP8 ")
      return {
        width: view.getUint16(26, true) & 0x3fff,
        height: view.getUint16(28, true) & 0x3fff,
      };
    if (chunk === "VP8X")
      return {
        width: 1 + (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16)),
        height: 1 + (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16)),
      };
    if (chunk === "VP8L") {
      const bits = view.getUint32(21, true);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
    return null;
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let at = 2;
    while (at + 9 < bytes.length && bytes[at] === 0xff) {
      const marker = bytes[at + 1]!;
      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        ![0xc4, 0xc8, 0xcc].includes(marker)
      )
        return {
          width: view.getUint16(at + 7),
          height: view.getUint16(at + 5),
        };
      at += 2 + view.getUint16(at + 2);
    }
  }
  return null;
}

/** A wide banner or a tiny picture is not a product photo: Second Vintage's
 * pages share a 1920×1080 picture of its auction site. An unknown size is
 * not held against a photo. */
export function productPhotoShape(
  size: { width: number; height: number } | null,
) {
  if (!size || size.width <= 0 || size.height <= 0) return true;
  return (
    size.width / size.height <= 1.7 && Math.max(size.width, size.height) >= 250
  );
}

type Product = Record<string, unknown>;
/** The schema.org Product objects a page describes itself with. */
export function productsOf(html: string): Product[] {
  const products: Product[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    const object = value as Product;
    const type = object["@type"];
    if (type === "Product" || (Array.isArray(type) && type.includes("Product")))
      products.push(object);
    for (const nested of Object.values(object)) visit(nested);
  };
  for (const match of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      visit(JSON.parse(match[1]!.trim()));
    } catch {
      // A broken block names no product.
    }
  }
  return products;
}

const imagesOf = (value: unknown): string[] =>
  typeof value === "string"
    ? [value]
    : Array.isArray(value)
      ? value.flatMap(imagesOf)
      : value && typeof value === "object" && "url" in value
        ? imagesOf(value.url)
        : [];

/**
 * The photo addresses a page offers for the watch, best first: its own
 * product's image, then og:image and twitter:image, then pictures in the
 * page whose description or file name gives the reference. A page about
 * several products gives only the one that names the reference.
 */
export function photoAddresses(
  html: string,
  pageUrl: string,
  reference: string,
) {
  const own = alnum(reference);
  const products = productsOf(html);
  const matching = products.filter((product) =>
    alnum(
      JSON.stringify([product.name, product.sku, product.mpn, product.url]),
    ).includes(own),
  );
  const product = matching[0] ?? (products.length === 1 ? products[0]! : null);
  const meta = [
    ...html.matchAll(
      /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)(?::src)?["'][^>]*content=["']([^"']+)["']/gi,
    ),
    ...html.matchAll(
      /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/gi,
    ),
  ].map((match) => match[1]!);
  const inPage = [...html.matchAll(/<img\b[^>]*>/gi)].flatMap((match) => {
    const tag = match[0];
    const attribute = (name: string) =>
      tag.match(new RegExp(`\\s${name}=["']([^"']+)["']`, "i"))?.[1] ?? "";
    const src =
      attribute("data-src") ||
      attribute("src") ||
      attribute("srcset").split(/\s+/)[0] ||
      "";
    return src &&
      !src.startsWith("data:") &&
      alnum(`${attribute("alt")} ${src}`).includes(own)
      ? [src]
      : [];
  });
  const addresses: string[] = [];
  for (const raw of [
    ...(product ? imagesOf(product.image) : []),
    ...meta,
    ...inPage,
  ]) {
    try {
      const url = asHttps(
        new URL(raw.replace(/&amp;/g, "&"), pageUrl).toString(),
      );
      if (url && !addresses.includes(url)) addresses.push(url);
    } catch {
      // Not an address.
    }
  }
  return { addresses, product };
}

/** A price the page states about its own product (JSON-LD offer or product
 * meta). Reported for the owner only; never stored. */
export function pagePrice(html: string, product: Product | null) {
  const offers = product?.offers;
  const offer = (Array.isArray(offers) ? offers[0] : offers) as
    Record<string, unknown> | undefined;
  const meta = (name: string) =>
    html.match(
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']+)["']`,
        "i",
      ),
    )?.[1] ?? null;
  // A JSON-LD price is a number or a string; anything else is no price.
  const text = (value: unknown) =>
    typeof value === "string" || typeof value === "number"
      ? String(value)
      : null;
  const amount =
    text(offer?.price) ??
    text(offer?.lowPrice) ??
    meta("(?:product|og):price:amount") ??
    "";
  const currency =
    text(offer?.priceCurrency) ?? meta("(?:product|og):price:currency") ?? null;
  const value = Number(amount.replace(/,/g, ""));
  return Number.isFinite(value) && value > 0
    ? { amount: value, currency }
    : null;
}
