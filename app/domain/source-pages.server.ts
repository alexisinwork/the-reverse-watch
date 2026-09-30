/**
 * Reading source pages: does a manufacturer or retailer page show the exact
 * reference, and which product photo does it declare? Only the photo's URL
 * is ever kept, never the file.
 *
 * Every URL here comes from AI output, so the server only ever fetches
 * public web addresses: never localhost, private networks or cloud
 * metadata endpoints, including via redirects (see publicFetch).
 */
import { isIP } from "node:net";

import { pageMentionsReference } from "./ai-watch-guardrails";

const BLOCKED_HOSTNAMES =
  /^(localhost|metadata|metadata\.google\.internal)$|\.(localhost|local|internal|intranet|lan|home|corp)$/i;

function privateIpv4(address: string) {
  const [a = 0, b = 0] = address.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function privateIpv6(address: string) {
  const lower = address.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return privateIpv4(mapped[1]!);
  // The URL parser writes IPv4-mapped addresses in hex: ::ffff:7f00:1.
  const hex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const high = parseInt(hex[1]!, 16);
    const low = parseInt(hex[2]!, 16);
    return privateIpv4(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
  }
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(lower);
}

/**
 * An http(s) URL on a public host and the default port, or null. Model
 * output ends up in href and src attributes and in server-side fetches.
 */
export function safeHttpUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    if (url.port && url.port !== "80" && url.port !== "443") return null;
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (!host.includes(".") && isIP(host) === 0) return null;
    if (BLOCKED_HOSTNAMES.test(host)) return null;
    if (isIP(host) === 4 && privateIpv4(host)) return null;
    if (isIP(host) === 6 && privateIpv6(host)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

const MAX_REDIRECTS = 4;

/**
 * fetch() for AI-supplied URLs: follows redirects itself so that every hop,
 * not just the first, must be a public web address. Returns the response
 * and the final URL, or null when a hop is refused.
 */
export async function publicFetch(
  url: string,
  init: RequestInit,
  fetchImpl: typeof fetch,
): Promise<{ response: Response; finalUrl: string } | null> {
  let current = safeHttpUrl(url);
  for (let hop = 0; current && hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetchImpl(current, { ...init, redirect: "manual" });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel();
      current = safeHttpUrl(new URL(location, current).toString());
      continue;
    }
    return { response, finalUrl: current };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Source pages: reference check and product photo

const PAGE_BYTES = 1_500_000;

const PAGE_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (compatible; TheReserveBot/1.0; +https://thereserve.watch)",
  accept: "text/html,application/xhtml+xml",
};

export async function inspectSourcePage(
  url: string,
  reference: string | null,
  fetchImpl: typeof fetch,
): Promise<{
  reachable: boolean;
  referenceFound: boolean;
  imageUrl: string | null;
}> {
  // A page that exists but blocks automated visitors (401/403/429) can still
  // confirm the reference when the maker's own URL carries it (the caller
  // has already checked the domain). A missing page (404/410) or one that
  // never answered confirms nothing: AI output can invent a URL that
  // contains its own invented reference.
  const unreachable = {
    reachable: false,
    referenceFound: false,
    imageUrl: null,
  };
  const blocked = {
    ...unreachable,
    referenceFound: pageMentionsReference(reference, "", url),
  };
  try {
    const fetched = await publicFetch(
      url,
      { headers: PAGE_HEADERS, signal: AbortSignal.timeout(5_000) },
      fetchImpl,
    );
    if (!fetched) return unreachable;
    const { response, finalUrl } = fetched;
    if (!response.ok) {
      await response.body?.cancel();
      return [401, 403, 429].includes(response.status) ? blocked : unreachable;
    }
    const html = (await response.text()).slice(0, PAGE_BYTES);
    const meta =
      html.match(
        /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)(?::src)?["'][^>]*content=["']([^"']+)["']/i,
      ) ??
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/i,
      );
    let imageUrl: string | null = null;
    if (meta?.[1]) {
      try {
        imageUrl = safeHttpUrl(
          new URL(meta[1].replace(/&amp;/g, "&"), finalUrl).toString(),
        );
      } catch {
        imageUrl = null;
      }
    }
    return {
      reachable: true,
      referenceFound: pageMentionsReference(reference, html, finalUrl),
      imageUrl,
    };
  } catch {
    return unreachable;
  }
}

/**
 * The URL is kept (never the file) only if the host serves an image. A
 * one-byte ranged GET, not HEAD: some CDNs (Akamai for Longines) leave a
 * HEAD from Node's fetch hanging while answering a ranged GET instantly.
 */
export async function verifyImageUrl(
  url: string | null,
  fetchImpl: typeof fetch,
): Promise<string | null> {
  if (!url) return null;
  try {
    const fetched = await publicFetch(
      url,
      { headers: { range: "bytes=0-0" }, signal: AbortSignal.timeout(3_000) },
      fetchImpl,
    );
    if (!fetched) return null;
    await fetched.response.body?.cancel();
    const type = (
      fetched.response.headers.get("content-type") ?? ""
    ).toLowerCase();
    return fetched.response.ok && type.startsWith("image/")
      ? safeHttpUrl(url)
      : null;
  } catch {
    return null;
  }
}
