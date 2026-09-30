/**
 * Reading source pages: does a manufacturer or retailer page show the exact
 * reference, and which product photo does it declare? Only the photo's URL
 * is ever kept, never the file.
 */
import { pageMentionsReference } from "./ai-watch-guardrails";

// Model output ends up in href and src attributes.
export function safeHttpUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Source pages: reference check and product photo

const PAGE_BYTES = 1_500_000;

export async function inspectSourcePage(
  url: string,
  reference: string | null,
  fetchImpl: typeof fetch,
): Promise<{
  reachable: boolean;
  referenceFound: boolean;
  imageUrl: string | null;
}> {
  try {
    const response = await fetchImpl(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; TheReserveBot/1.0; +https://thereserve.watch)",
        accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      return {
        reachable: false,
        referenceFound: pageMentionsReference(reference, "", url),
        imageUrl: null,
      };
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
          new URL(
            meta[1].replace(/&amp;/g, "&"),
            response.url || url,
          ).toString(),
        );
      } catch {
        imageUrl = null;
      }
    }
    return {
      reachable: true,
      referenceFound: pageMentionsReference(
        reference,
        html,
        response.url || url,
      ),
      imageUrl,
    };
  } catch {
    return {
      reachable: false,
      referenceFound: pageMentionsReference(reference, "", url),
      imageUrl: null,
    };
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
    const response = await fetchImpl(url, {
      headers: { range: "bytes=0-0" },
      redirect: "follow",
      signal: AbortSignal.timeout(3_000),
    });
    await response.body?.cancel();
    const type = (response.headers.get("content-type") ?? "").toLowerCase();
    return response.ok && type.startsWith("image/") ? url : null;
  } catch {
    return null;
  }
}
