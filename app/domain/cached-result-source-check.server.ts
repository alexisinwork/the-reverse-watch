import { pageMentionsReference } from "./ai-watch-guardrails";
import type { FoundWatch } from "./ai-watch-types";
import {
  brandNames,
  mentionsAny,
  passageTiesSighting,
  personNames,
  spacedWords,
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

/** A sighting passage is short: at most 30 words and 280 characters. */
const PASSAGE_WORDS = 30;
const PASSAGE_CHARS = 280;
const shortPassage = (value: string) =>
  value.length <= PASSAGE_CHARS &&
  words(value).split(" ").length <= PASSAGE_WORDS;

/** Tags that end a sentence even without a full stop (headings, list items). */
const BLOCK_TAG =
  /<\/?(?:address|article|aside|blockquote|br|caption|dd|div|dl|dt|figcaption|figure|footer|h[1-6]|header|hr|li|main|nav|ol|p|section|table|td|th|title|tr|ul)\b[^>]*>/gi;
/** A full stop ends a sentence, but not after an initial or an
 * abbreviation ("Walter E. Kurtz", "Dr. No", "Ref. 2900.50.91"). */
const SENTENCE_END =
  /(?<=[.!?])(?<!\b[A-Za-z]\.)(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Vol|vs|Ref|ref|Lt|Col|Gen|Capt|Sgt|Prof|Inc|Co|approx|ca)\.)\s+(?=[^a-z\s])/;

/** Named character references common on article pages. */
const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  laquo: "«",
  raquo: "»",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  middot: "·",
  bull: "•",
  copy: "©",
  reg: "®",
  trade: "™",
  aacute: "á",
  agrave: "à",
  auml: "ä",
  ccedil: "ç",
  eacute: "é",
  egrave: "è",
  ecirc: "ê",
  iacute: "í",
  ntilde: "ñ",
  oacute: "ó",
  ouml: "ö",
  szlig: "ß",
  uacute: "ú",
  uuml: "ü",
};
/** Character references as the reader sees them ("Seiko&#8217;s" →
 * "Seiko’s"); unknown or invalid ones become a space. */
function decodeEntities(value: string) {
  return value.replace(
    /&([a-z][a-z0-9]{1,31}|#\d+|#x[0-9a-f]+);/gi,
    (_, name: string) => {
      const lower = name.toLowerCase();
      if (!lower.startsWith("#")) return NAMED_ENTITIES[lower] ?? " ";
      const code = lower.startsWith("#x")
        ? parseInt(lower.slice(2), 16)
        : parseInt(lower.slice(1), 10);
      return Number.isInteger(code) && code > 31 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : " ";
    },
  );
}

/** The page's visible text, sentence by sentence, in reading order. */
export function pageSentences(html: string) {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
      .replace(/<!--([\s\S]*?)-->/g, " ")
      .replace(BLOCK_TAG, "\n")
      .replace(/<[^>]*>/g, " "),
  )
    .split(/\n+/)
    .flatMap((block) => block.split(SENTENCE_END))
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

type SightingWatch = Parameters<typeof passageTiesSighting>[1];

/** The shortest run of words inside one sentence that still ties the watch
 * to its wearer or film, when it fits a short passage. */
function shortestTie(
  sentence: string,
  watch: SightingWatch,
  needsReference: boolean,
) {
  const ties = (value: string) =>
    passageTiesSighting(value, watch) &&
    (!needsReference || pageMentionsReference(watch.referenceCode, value, ""));
  if (!ties(sentence)) return null;
  if (shortPassage(sentence)) return sentence;
  const tokens = sentence.split(" ");
  let best: string | null = null;
  for (let start = 0; start < tokens.length; start++) {
    for (let end = start + 1; end <= tokens.length; end++) {
      const window = tokens.slice(start, end).join(" ");
      if (!shortPassage(window)) break;
      if (ties(window)) {
        if (!best || window.length < best.length) best = window;
        break;
      }
    }
  }
  return best;
}

/**
 * Our own reading of the page: a short passage, inside one sentence, that
 * names the brand, the watch (preferably by its exact reference) and every
 * attribution the card states. A provider that quotes the wrong sentence can
 * no longer hide a sighting the page documents; a page that never says it
 * in one sentence still gives none.
 */
export function sightingPassage(html: string, watch: SightingWatch) {
  const sentences = pageSentences(html);
  for (const needsReference of [true, false])
    for (const sentence of sentences) {
      const passage = shortestTie(sentence, watch, needsReference);
      if (passage) return passage;
    }
  return null;
}

/** The page's own title and main headings, as the reader sees them. */
function pageHeadings(html: string) {
  return [...html.matchAll(/<(title|h1)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi)]
    .slice(0, 4)
    .map((match) =>
      decodeEntities((match[2] ?? "").replace(/<[^>]*>/g, " "))
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((heading) => heading.length > 0 && heading.length <= 140);
}

/**
 * A page about the subject: its title or main heading names every
 * attribution the card states ("Die Hard » BAMF Style", "Steve McQueen's
 * watches"). On such a page, one sentence naming the brand and the exact
 * reference documents the sighting. The stored passage quotes the heading
 * and that sentence, each verbatim, with an ellipsis between them. A page
 * about something else, or one that never names the exact reference next to
 * the brand, gives none.
 */
export function headingPassage(
  html: string,
  watch: SightingWatch,
  onPage: (value: string) => boolean = () => true,
) {
  const person = personNames(watch.details.person);
  const work = workNames(watch.details.work);
  if (!person.length && !work.length) return null;
  const heading = pageHeadings(html).find((value) => {
    const spaced = spacedWords(value);
    return (
      onPage(value) &&
      (person.length === 0 || mentionsAny(spaced, person)) &&
      (work.length === 0 || mentionsAny(spaced, work))
    );
  });
  if (!heading) return null;
  const bare = { ...watch, details: {} };
  for (const sentence of pageSentences(html)) {
    if (sentence === heading) continue;
    const reference = shortestTie(sentence, bare, true);
    if (!reference || !onPage(reference)) continue;
    const passage = `${heading} … ${reference}`;
    if (passage.length <= PASSAGE_CHARS) return passage;
  }
  return null;
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
  /** For a sighting: the verbatim passage on this page that ties it. */
  passage?: string;
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
    // Decoded the same way as the page's sentences, so a passage read from
    // them is found again in this text.
    const visible = decodeEntities(
      html
        .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
        .replace(/<!--([\s\S]*?)-->/g, " ")
        .replace(/<[^>]*>/g, " "),
    );
    const text = ` ${words(visible)} `;
    // A wearer is matched by any name the attribution contains ("James Bond
    // (Daniel Craig)" → "Daniel Craig"); a title is matched whole.
    const person = personNames(watch.details.person);
    const work = workNames(watch.details.work);
    const matches =
      pageMentionsReference(watch.referenceCode, visible, "") &&
      mentionsAny(text, brandNames(watch.brand)) &&
      (person.length === 0 || mentionsAny(text, person)) &&
      (work.length === 0 || mentionsAny(text, work));
    if (!matches) return { status: "missing", finalUrl };
    let passage: string | null = null;
    if (person.length || work.length) {
      // A passage, found verbatim on this page, ties the watch to the
      // wearer or film. The page above carries the exact reference; the
      // passage names the watch by that reference or by its model words
      // ("Seamaster Planet Ocean"), so a page listing many watches cannot
      // lend one watch's sighting to another. The provider's quotation is
      // tried first, then the page's own sentences, then (on a page about
      // the subject) its heading with a sentence giving the exact reference.
      const onPage = (value: string) =>
        words(value).length > 0 && text.includes(` ${words(value)} `);
      const verbatim = (value: string) =>
        onPage(value) &&
        shortPassage(value) &&
        passageTiesSighting(value, watch);
      const quote = sourceQuote?.trim() ?? "";
      const own = verbatim(quote) ? null : sightingPassage(html, watch);
      passage = verbatim(quote)
        ? quote
        : own && verbatim(own)
          ? own
          : headingPassage(html, watch, onPage);
      if (!passage) return { status: "missing", finalUrl };
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
      ...(passage ? { passage } : {}),
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
