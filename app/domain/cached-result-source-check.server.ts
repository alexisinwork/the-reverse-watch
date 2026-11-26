import { pageMentionsReference } from "./ai-watch-guardrails";
import type { FoundWatch } from "./ai-watch-types";
import {
  mentionsAny,
  passageTiesSighting,
  personNames,
  workNames,
} from "./attribution-names";
import type { ValidationFact } from "./cached-result-validation";
import { quoteSupportsValue } from "./catalogue-enrichment.server";
import { quoteSupportsObservedPrice } from "./validated-price";
import { referencedProductImage } from "./referenced-product-image.server";
import { publicFetch } from "./source-pages.server";

const MAX_BYTES = 1_500_000;
const counterfeitSource = (url: string) =>
  /replica|fake(?:luxury|watch)|clonewatch/i.test(new URL(url).hostname);

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
  sourceQuote?: string,
  facts?: ValidationFact[],
  discoverImage = false,
): Promise<{
  status: "matched" | "missing" | "unavailable";
  finalUrl: string | null;
  checkedFacts?: ValidationFact[];
  imageCandidate?: string;
}> {
  if (!watch.referenceCode) return { status: "missing", finalUrl: null };
  try {
    if (counterfeitSource(sourceUrl))
      return { status: "unavailable", finalUrl: null };
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
    if (counterfeitSource(finalUrl)) {
      await response.body?.cancel();
      return { status: "unavailable", finalUrl };
    }
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
    // A wearer is matched by any name the attribution contains ("James Bond
    // (Daniel Craig)" → "Daniel Craig"); a title is matched whole.
    const person = personNames(watch.details.person);
    const work = workNames(watch.details.work);
    const matches =
      pageMentionsReference(watch.referenceCode, visible, "") &&
      has(watch.brand) &&
      (person.length === 0 || mentionsAny(text, person)) &&
      (work.length === 0 || mentionsAny(text, work));
    if (!matches) return { status: "missing", finalUrl };
    if (person.length || work.length) {
      // The passage, found verbatim on this page, ties the watch to the
      // wearer or film. The page above carries the exact reference; the
      // passage names the watch by that reference or by its model words
      // ("Seamaster Planet Ocean"), so a page listing many watches cannot
      // lend one watch's sighting to another.
      const quote = sourceQuote?.trim() ?? "";
      const quoteWords = words(quote);
      if (
        !quoteWords ||
        quote.length > 280 ||
        quoteWords.split(" ").length > 30 ||
        !text.includes(` ${quoteWords} `) ||
        !passageTiesSighting(quote, watch)
      )
        return { status: "missing", finalUrl };
    }
    const checkedFacts = facts?.filter((fact) => {
      const quotation = words(fact.quote);
      return (
        quotation.length > 0 &&
        fact.quote.length <= 280 &&
        text.includes(` ${quotation} `) &&
        pageMentionsReference(watch.referenceCode, fact.quote, "") &&
        (fact.field === "price"
          ? typeof fact.value === "string" &&
            quoteSupportsObservedPrice(fact.value, fact.quote)
          : quoteSupportsValue({
              ...fact,
              field: fact.field,
              sourceUrl: finalUrl,
            }))
      );
    });
    return {
      status: "matched",
      finalUrl,
      ...(checkedFacts ? { checkedFacts } : {}),
      ...(discoverImage &&
      /^(text\/html|application\/xhtml\+xml)/.test(contentType)
        ? {
            imageCandidate:
              referencedProductImage(
                html,
                watch.referenceCode,
                watch.brand,
                finalUrl,
              ) ?? undefined,
          }
        : {}),
    };
  } catch {
    return { status: "unavailable", finalUrl: null };
  }
}
