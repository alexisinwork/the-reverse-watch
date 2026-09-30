/**
 * The film, series, actor, character and public-figure search behind
 * /watches/find. A live web search (Perplexity or Muse Spark) gathers documented sightings from three angles
 * at once; Muse Spark merges and ranks them while product photos are found.
 */
import { z } from "zod";

import {
  clean,
  defaultDeps,
  finite,
  logError,
  museJson,
  searchReady,
  webResearchJson,
  VAGUE,
  type Deps,
} from "./ai-providers.server";
import type { AiSearchOutcome, FoundWatch } from "./ai-watch-types";
import type { FilmSubjectKind } from "./film-subject";
import {
  inspectSourcePage,
  safeHttpUrl,
  verifyImageUrl,
} from "./source-pages.server";

// ---------------------------------------------------------------------------
// Film, series, actor, character, and public-figure search

const filmCandidateSchema = {
  type: "object",
  properties: {
    sightings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          brand: { type: "string" },
          model: { type: "string" },
          referenceCode: { type: ["string", "null"] },
          person: { type: ["string", "null"] },
          work: { type: ["string", "null"] },
          year: { type: ["number", "null"] },
          context: { type: "string" },
          evidenceUrl: { type: ["string", "null"] },
          manufacturerUrl: { type: ["string", "null"] },
          imageUrl: { type: ["string", "null"] },
        },
        required: ["brand", "model", "context"],
      },
    },
  },
  required: ["sightings"],
};

type FilmCandidate = {
  brand: string;
  model: string;
  referenceCode: string | null;
  person: string | null;
  work: string | null;
  year: number | null;
  context: string;
  evidenceUrl: string;
  manufacturerUrl: string | null;
  /** A photo URL the search reported; checked before it is used. */
  imageUrl: string | null;
};

// Forums and social posts are not documentation.
const WEAK_EVIDENCE_HOSTS =
  /(^|\.)(reddit\.com|quora\.com|pinterest\.[a-z.]+|facebook\.com|instagram\.com|tiktok\.com|x\.com|twitter\.com)$/;

function readFilmCandidates(payload: unknown): FilmCandidate[] {
  const sightings = (payload as { sightings?: unknown })?.sightings;
  if (!Array.isArray(sightings)) return [];
  return sightings.flatMap((raw) => {
    const item = raw as Record<string, unknown>;
    const brand = clean(item.brand);
    const model = clean(item.model);
    const evidenceUrl = safeHttpUrl(clean(item.evidenceUrl));
    // A sighting without a named watch and a documenting page is never shown.
    if (
      !brand ||
      !model ||
      !evidenceUrl ||
      VAGUE.test(`${brand} ${model}`) ||
      // Wristwatches (and pocket watches) only: never clocks.
      /\b(clock|alarm clock|westclox|big ben)\b/i.test(`${brand} ${model}`)
    )
      return [];
    if (WEAK_EVIDENCE_HOSTS.test(new URL(evidenceUrl).hostname)) return [];
    const year = finite(item.year);
    return [
      {
        brand,
        model,
        referenceCode: clean(item.referenceCode),
        person: clean(item.person),
        work: clean(item.work),
        year:
          year !== null && year > 1850 && year < 2100 ? Math.round(year) : null,
        context: clean(item.context) ?? "",
        evidenceUrl,
        manufacturerUrl: safeHttpUrl(clean(item.manufacturerUrl)),
        imageUrl: safeHttpUrl(clean(item.imageUrl)),
      },
    ];
  });
}

/** "Severance (TV series), season 2" and "Severance" are the same work. */
function workKey(work: string | null) {
  return (work ?? "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/\bseason\s*\d+\b|\bs\d+\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** One sighting per watch per work, whoever the search named as wearer. */
function dedupeSightings(items: FilmCandidate[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key =
      `${item.brand}|${item.referenceCode ?? item.model}|${workKey(item.work)}`
        .toLowerCase()
        .replace(/[^a-z0-9|]/g, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const FILM_MAX_WATCHES = 8;

/** Lowercased, whitespace-collapsed subject: the film search cache input. */
export function normalizeFilmQuery(query: string) {
  return query.trim().replace(/\s+/g, " ").toLowerCase();
}

const SIGHTING_FIELDS =
  "For each watch give the brand, model, exact reference number if documented, who wore it (person), the film or series title (work) if any, the year, one sentence of context (scene or occasion), a URL of a page that documents the sighting (evidenceUrl), the official manufacturer product page URL if one exists (manufacturerUrl), and the URL of a photo of that watch model from a page you found (imageUrl). Use null for anything you cannot confirm. Never invent a sighting.";

const WATCH_SPOTTING_SITES =
  "watch-identification sites and publications (for example watchesinmovies.info, Hodinkee, Esquire, GQ, WatchPaparazzi)";

/**
 * Three questions asked at once, worded for what the visitor chose. Without
 * a kind (older links and scripts) the questions cover every kind.
 */
function filmPrompts(subject: string, kind: FilmSubjectKind | null) {
  const ask = SIGHTING_FIELDS;
  switch (kind) {
    case "movie":
    case "series": {
      const what = kind === "movie" ? "film" : "TV series";
      return [
        `Which specific wristwatches are worn on screen in the ${what} "${subject}", and by which character (and actor)? ${ask}`,
        `Which watches are tied to the ${what} "${subject}" through official brand partnerships, product placement, or its lead cast at its premieres and press? ${ask}`,
        `Which watch sightings in the ${what} "${subject}" are documented by ${WATCH_SPOTTING_SITES}? ${ask}`,
      ];
    }
    case "actor":
      return [
        `Which specific wristwatches has the actor ${subject} worn on screen, in which films or series and roles? ${ask}`,
        `Which specific wristwatches has the actor ${subject} worn in public, at premieres and events, owned, or promoted as a brand ambassador? ${ask}`,
        `Which watch sightings of the actor ${subject} are documented by ${WATCH_SPOTTING_SITES}? ${ask}`,
      ];
    case "character":
      return [
        `Which specific wristwatches does the fictional character ${subject} wear, in which films or series, and played by which actor? ${ask}`,
        `Which watch brands have official partnerships tied to the character ${subject}, and which models were made for or worn in the role? ${ask}`,
        `Which watch sightings of the character ${subject} are documented by ${WATCH_SPOTTING_SITES}? ${ask}`,
      ];
    case "celebrity":
      return [
        `Which specific wristwatches has ${subject} worn in public, at events, in interviews or on official occasions? ${ask}`,
        `Which watches does ${subject} own, and which brands has ${subject} promoted as an ambassador? ${ask}`,
        `Which watch sightings of ${subject} are documented by ${WATCH_SPOTTING_SITES}? ${ask}`,
      ];
    default: {
      const intro = `The subject may be a film, TV series, actor, fictional character, or public figure: "${subject}".`;
      return [
        `${intro} Which specific wristwatches are worn on screen in it, or by this person or character on screen? ${ask}`,
        `${intro} Which specific wristwatches has this person worn in public, owned, or promoted as a brand ambassador? If the subject is a film or series, which watches are tied to it through official partnerships or its cast? ${ask}`,
        `${intro} Which watch sightings connected to it are documented by ${WATCH_SPOTTING_SITES}? ${ask}`,
      ];
    }
  }
}

/** The fallback questions: documented watches of the subject's lead cast. */
function castPrompts(subject: string) {
  const ask =
    "For each watch give the brand, model, exact reference number if documented, the actor (person), work as null, the year, one sentence of context (occasion), a URL of a page that documents it (evidenceUrl), the official manufacturer product page URL if one exists (manufacturerUrl), and the URL of a photo of that watch model (imageUrl). Use null for anything you cannot confirm. Never invent a sighting.";
  return [
    `"${subject}" is a film or TV series with no documented wristwatch on screen. Who are its two or three lead actors, and which specific wristwatches has each of them been documented wearing in public, owning, or promoting as a brand ambassador? ${ask}`,
    `Name the lead actors of "${subject}". For each, list the wristwatches that watch-spotting sites and publications (for example Hodinkee, GQ, Esquire, WatchPaparazzi, WatchRanker) document them wearing off screen. ${ask}`,
  ];
}

const FILM_RANK_SYSTEM = [
  "You are the film and culture editor of The Reserve.",
  "You receive a search subject (a film, series, actor, character, or public figure) and a JSON list of documented watch sightings gathered from web searches.",
  "Merge duplicates of the same watch and moment, drop sightings the evidence does not support, and rank the rest by how notable and well documented they are.",
  "For each kept sighting write one sentence of context naming who wore it, where, and when, using only the facts provided.",
  'Respond only with JSON: {"order":[{"index","note"}],"summary"}.',
].join(" ");

const rankSchema = z.object({
  order: z.array(
    z.object({ index: z.number().int().nonnegative(), note: z.string() }),
  ),
  summary: z.string(),
});

async function firstImage(
  urls: (string | null)[],
  reference: string | null,
  deps: Deps,
) {
  for (const url of urls) {
    if (!url) continue;
    const page = await inspectSourcePage(url, reference, deps.fetchImpl);
    const image = await verifyImageUrl(page.imageUrl, deps.fetchImpl);
    if (image) return image;
  }
  return null;
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

const STAGE_ONE_MS = 18_000;

/** Rejects after `ms`, so Promise.allSettled keeps only answers in time. */
function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`No answer within ${ms} ms.`)), ms),
    ),
  ]);
}

export async function searchFilmWatches(
  query: string,
  overrides: Partial<Deps> = {},
  /** Movie, series, actor, character or celebrity, as the visitor chose. */
  kind: FilmSubjectKind | null = null,
): Promise<AiSearchOutcome> {
  const deps = defaultDeps(overrides);
  if (!searchReady(deps.config)) {
    logError(
      "ai_watch_search_unavailable",
      new Error("Muse Spark or Perplexity is not configured."),
    );
    return { status: "unavailable" };
  }
  const subject = query.trim().replace(/\s+/g, " ").slice(0, 160);

  // Stage 1: three live angles at once.
  deps.report?.({
    text: `Searching films, series, interviews and watch-spotting sites for "${subject}"…`,
  });
  // Each question gets 18 s; whatever has answered by then is used, so a
  // slow search can never push the page past its time limit.
  const settled = await Promise.allSettled(
    filmPrompts(subject, kind).map((prompt) =>
      withDeadline(
        webResearchJson(prompt, filmCandidateSchema, deps, {
          maxToolCalls: 4,
          contextSize: "medium",
        }),
        STAGE_ONE_MS,
      ),
    ),
  );
  if (settled.every((result) => result.status === "rejected")) {
    throw new Error("Every film search angle failed.");
  }
  let candidates = dedupeSightings(
    settled.flatMap((result) =>
      result.status === "fulfilled" ? readFilmCandidates(result.value) : [],
    ),
  ).slice(0, 16);

  // Many films (period pieces especially) have no documented wristwatch on
  // screen. Rather than a dead end, show what the lead cast wear off screen,
  // and say so plainly.
  let castFallback = false;
  const titleSearch = kind === null || kind === "movie" || kind === "series";
  if (candidates.length === 0 && titleSearch) {
    deps.report?.({
      text: `No wristwatch is documented on screen in "${subject}". Checking the watches its lead actors wear off screen…`,
    });
    // Asked two ways at once: single answers to this are unreliable.
    const cast = await Promise.allSettled(
      castPrompts(subject).map((prompt) =>
        webResearchJson(prompt, filmCandidateSchema, deps, {
          maxToolCalls: 4,
          contextSize: "medium",
        }),
      ),
    );
    // Failed lookups are not "nothing found": saying no watch exists after
    // a provider hiccup would be wrong (and would be remembered).
    if (cast.every((result) => result.status === "rejected")) {
      throw new Error("Every cast search failed.");
    }
    candidates = dedupeSightings(
      cast.flatMap((result) =>
        result.status === "fulfilled" ? readFilmCandidates(result.value) : [],
      ),
    ).slice(0, 12);
    castFallback = candidates.length > 0;
  }
  if (candidates.length === 0) {
    return {
      status: "no_match",
      summary: titleSearch
        ? `No documented watch sightings were found for "${subject}", on screen or on its cast. Try an actor's name instead.`
        : `No documented watch sightings were found for "${subject}".`,
    };
  }

  deps.report?.({
    text: `Found ${candidates.length} documented ${candidates.length === 1 ? "sighting" : "sightings"}. Merging duplicates, ranking them and finding a photo of each watch…`,
  });

  // Stage 2: Muse Spark merges and ranks while photos are fetched; the photo
  // stage has its own budget so one slow site cannot hold the answer back.
  const pageImages = new Map<string, Promise<string | null>>();
  const imageFor = (candidate: FilmCandidate) => {
    const key = `${candidate.manufacturerUrl}|${candidate.evidenceUrl}`;
    if (!pageImages.has(key)) {
      // The photo the search reported first, then the pages' own photos.
      pageImages.set(
        key,
        verifyImageUrl(candidate.imageUrl, deps.fetchImpl).then(
          (reported) =>
            reported ??
            firstImage(
              [candidate.manufacturerUrl, candidate.evidenceUrl],
              candidate.referenceCode,
              deps,
            ),
        ),
      );
    }
    return pageImages.get(key)!;
  };
  // The ranker keeps only sightings tied to the subject, so it would drop
  // every off-screen cast watch: the fallback keeps the order found.
  const [ranking, images] = await Promise.all([
    castFallback
      ? Promise.resolve(null)
      : museJson(
          FILM_RANK_SYSTEM,
          [
            `Subject: ${subject}`,
            "",
            "Sightings:",
            JSON.stringify(
              candidates.map((candidate, index) => ({
                index,
                brand: candidate.brand,
                model: candidate.model,
                reference: candidate.referenceCode,
                person: candidate.person,
                work: candidate.work,
                year: candidate.year,
                context: candidate.context,
                evidence: candidate.evidenceUrl,
              })),
            ),
          ].join("\n"),
          "reserve-film-rank-v1",
          deps,
          10_000,
        )
          .then((payload) => rankSchema.parse(payload))
          .catch((error: unknown) => {
            logError("ai_rank_failed", error);
            return null;
          }),
    withTimeout(
      Promise.all(candidates.map(imageFor)),
      8_000,
      candidates.map(() => null),
    ),
  ]);

  const ranked =
    ranking?.order.filter((entry) => entry.index < candidates.length) ?? [];
  // A ranker that keeps nothing is ignored rather than trusted: the
  // sightings each carry their own evidence link.
  const order =
    ranked.length > 0
      ? ranked
      : candidates.map((candidate, index) => ({
          index,
          note: candidate.context,
        }));
  const used = new Set<number>();
  const watches: FoundWatch[] = [];
  for (const entry of order) {
    if (used.has(entry.index)) continue;
    used.add(entry.index);
    const candidate = candidates[entry.index]!;
    watches.push({
      brand: candidate.brand,
      model: candidate.model,
      referenceCode: candidate.referenceCode,
      sourceUrl: candidate.evidenceUrl,
      imageUrl: images[entry.index] ?? null,
      priceNote: null,
      rationale: entry.note.trim() || candidate.context,
      details: {
        person: candidate.person,
        work: candidate.work,
        year: candidate.year,
        context: candidate.context,
        evidenceUrl: candidate.evidenceUrl,
      },
    });
    if (watches.length === FILM_MAX_WATCHES) break;
  }
  if (watches.length === 0) {
    return {
      status: "no_match",
      summary: `No documented watch sightings were found for "${subject}".`,
    };
  }
  return {
    status: "found",
    watches,
    summary: castFallback
      ? `No wristwatch is documented on screen in "${subject}". These are documented watches its lead actors wear off screen.`
      : ranking?.summary?.trim() ||
        `${watches.length} documented watch sightings.`,
  };
}
