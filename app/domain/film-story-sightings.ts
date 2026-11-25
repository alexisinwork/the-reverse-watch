/**
 * The owner's published, source-reviewed stories are confirmed sightings, so
 * film and people search shows them first for the person, character or work
 * they are about. The first evaluation (docs/eval-baseline.md) found none of
 * the twenty labelled story facts confirmed in search results; this closes
 * that gap without any new research.
 *
 * Pure: the caller passes the published stories.
 */
import type { FoundWatch } from "./ai-watch-types";
import type { FilmSubjectKind } from "./film-subject";

type StoryLike = {
  slug: string;
  summary: string;
  entity: { kind: string; name: string };
  work: { title: string; year?: number | null } | null;
  attribution: {
    precision?: string;
    brand: string | null;
    model: string | null;
    reference: string | null;
    confidence: string;
  } | null;
  citations: { url: string; publisher?: string | null }[];
};

const fold = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const PERSON_KINDS: Record<string, readonly FilmSubjectKind[]> = {
  public_figure: ["actor", "celebrity"],
  fictional_character: ["character"],
};

/** Story-backed confirmed sightings for one search, in story order. */
export function storySightings(
  stories: readonly StoryLike[],
  query: string,
  kind: FilmSubjectKind,
): FoundWatch[] {
  const wanted = fold(query);
  if (!wanted) return [];
  return stories.flatMap((story) => {
    const attribution = story.attribution;
    // An unconfirmed story is a lead, not a sighting.
    if (
      !attribution?.brand ||
      !["confirmed", "family_only"].includes(attribution.confidence)
    ) {
      return [];
    }
    const aboutPerson =
      (PERSON_KINDS[story.entity.kind] ?? []).includes(kind) &&
      fold(story.entity.name) === wanted;
    const aboutWork =
      (kind === "movie" || kind === "series") &&
      story.work !== null &&
      fold(story.work.title) === wanted;
    if (!aboutPerson && !aboutWork) return [];
    const exact =
      attribution.precision === "exact_reference" && attribution.reference;
    const source = story.citations[0];
    return [
      {
        brand: attribution.brand,
        model: attribution.model ?? "",
        referenceCode: exact ? attribution.reference : null,
        sourceUrl:
          source?.url ??
          `https://thereserve.watch/watches/stories/${story.slug}`,
        imageUrl: null,
        priceNote: null,
        rationale: exact
          ? story.summary
          : `${story.summary} The model family is confirmed; the exact reference is not.`,
        details: {
          person: story.entity.name,
          work: story.work?.title ?? null,
          year: story.work?.year ?? null,
          evidenceUrl: `https://thereserve.watch/watches/stories/${story.slug}`,
          context: "From The Reserve's published, source-reviewed stories.",
        },
      },
    ];
  });
}
