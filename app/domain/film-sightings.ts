/**
 * Film-search results can list the same watch (same brand and reference)
 * once per film, e.g. Bond's Planet Ocean 2201.50.00 in Casino Royale and
 * again in Quantum of Solace. This shows it once, naming every film.
 */
import { normalizeReference } from "./ai-watch-guardrails";
import type { FoundWatch } from "./ai-watch-types";

function sightingKey(watch: FoundWatch) {
  const brand = watch.brand.trim().toLowerCase();
  const reference = normalizeReference(watch.referenceCode);
  return reference
    ? `${brand}|r:${reference}`
    : `${brand}|m:${watch.model.trim().toLowerCase()}`;
}

function workLabel(watch: FoundWatch) {
  const work = watch.details.work?.trim();
  if (!work) return null;
  return watch.details.year ? `${work} (${watch.details.year})` : work;
}

export function mergeSightings(watches: FoundWatch[]): FoundWatch[] {
  const groups = new Map<string, FoundWatch[]>();
  for (const watch of watches) {
    const key = sightingKey(watch);
    groups.set(key, [...(groups.get(key) ?? []), watch]);
  }
  return [...groups.values()].map((group) => {
    const [first, ...rest] = group as [FoundWatch, ...FoundWatch[]];
    const works = [
      ...new Set(group.map(workLabel).filter((work) => work !== null)),
    ];
    if (rest.length === 0 || works.length < 2) return first;
    return {
      ...first,
      imageUrl:
        first.imageUrl ??
        rest.find((watch) => watch.imageUrl)?.imageUrl ??
        null,
      rationale: `${first.rationale} Also worn in ${works.slice(1).join(", ")}.`,
      details: {
        ...first.details,
        // The films with their years, in the order they were found.
        work: works.join(", "),
        year: null,
      },
    };
  });
}
