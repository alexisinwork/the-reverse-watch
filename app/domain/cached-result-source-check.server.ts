import { pageMentionsReference } from "./ai-watch-guardrails";
import type { FoundWatch } from "./ai-watch-types";
import { publicFetch } from "./source-pages.server";

const MAX_BYTES = 1_500_000;

function words(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Inspect the cited page itself; an URL or a blocked page is not evidence.
 * A lexical match is necessary but does not by itself prove a relationship. */
export async function inspectCachedResultSource(
  watch: FoundWatch,
  sourceUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{
  status: "matched" | "missing" | "unavailable";
  finalUrl: string | null;
}> {
  if (!watch.referenceCode) return { status: "missing", finalUrl: null };
  try {
    const fetched = await publicFetch(
      sourceUrl,
      {
        headers: {
          accept: "text/html,text/plain,application/xhtml+xml",
          "user-agent":
            "Mozilla/5.0 (compatible; TheReserveBot/1.0; +https://thereserve.watch)",
        },
        signal: AbortSignal.timeout(6_000),
      },
      fetchImpl,
    );
    if (!fetched) return { status: "unavailable", finalUrl: null };
    const { response, finalUrl } = fetched;
    const contentType =
      response.headers.get("content-type")?.toLowerCase() ?? "";
    if (
      !response.ok ||
      !/^(text\/html|text\/plain|application\/xhtml\+xml)(;|$)/.test(
        contentType,
      )
    ) {
      await response.body?.cancel();
      return { status: "unavailable", finalUrl };
    }
    const declaredBytes = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredBytes) && declaredBytes > MAX_BYTES) {
      await response.body?.cancel();
      return { status: "unavailable", finalUrl };
    }
    const reader = response.body?.getReader();
    if (!reader) return { status: "unavailable", finalUrl };
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > MAX_BYTES) {
        await reader.cancel();
        return { status: "unavailable", finalUrl };
      }
      chunks.push(part.value);
    }
    const decoder = new TextDecoder();
    const html =
      chunks.map((chunk) => decoder.decode(chunk, { stream: true })).join("") +
      decoder.decode();
    const visible = html
      .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
      .replace(/<!--([\s\S]*?)-->/g, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/&(?:nbsp|amp|quot|apos|lt|gt|#\d+|#x[0-9a-f]+);/gi, " ");
    const text = ` ${words(visible)} `;
    const has = (value: string) => text.includes(` ${words(value)} `);
    const matches =
      pageMentionsReference(watch.referenceCode, visible, "") &&
      has(watch.brand) &&
      (!watch.details.person || has(watch.details.person)) &&
      (!watch.details.work || has(watch.details.work));
    return { status: matches ? "matched" : "missing", finalUrl };
  } catch {
    return { status: "unavailable", finalUrl: null };
  }
}
