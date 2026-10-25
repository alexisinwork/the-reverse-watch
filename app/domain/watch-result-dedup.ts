import type { AiSearchView, FoundWatch } from "./ai-watch-types";

type Identity = Pick<FoundWatch, "brand" | "model" | "referenceCode">;

const UNKNOWN = new Set([
  "null",
  "none",
  "unknown",
  "unknownreference",
  "notavailable",
  "notconfirmed",
  "notprovided",
  "notidentified",
  "notstated",
  "noreference",
  "unconfirmed",
  "tbc",
  "tba",
]);

function fold(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function keys(watch: Identity) {
  const brand = fold(watch.brand);
  if (!brand) return [];
  let title = watch.model.trim();
  // Some providers repeat the brand at the start of the model title.
  const prefix = watch.brand.trim();
  if (title.toLowerCase().startsWith(`${prefix.toLowerCase()} `))
    title = title.slice(prefix.length).trim();
  const model = fold(title);
  const reference = fold(watch.referenceCode ?? "");
  const knownReference = reference.length >= 3 && !UNKNOWN.has(reference);
  return [
    model && !UNKNOWN.has(model) ? `${brand}|title:${model}` : null,
    knownReference ? `${brand}|ref:${reference}` : null,
  ].filter((key): key is string => key !== null);
}

/** Display only: match an exact normalized brand/title OR brand/reference.
 * Keep the first ranked card's facts intact; never combine variant facts.
 * Transitive aliases are resolved so renamed references cannot reappear later.
 */
export function uniqueWatchResults<T extends Identity>(
  watches: readonly T[],
): T[] {
  const parents = watches.map((_, index) => index);
  const aliases = new Map<string, number>();
  const root = (index: number): number => {
    while (parents[index] !== index) {
      parents[index] = parents[parents[index]!]!;
      index = parents[index]!;
    }
    return index;
  };
  watches.forEach((watch, index) => {
    for (const key of keys(watch)) {
      const previous = aliases.get(key);
      if (previous !== undefined) {
        const a = root(previous);
        const b = root(index);
        parents[Math.max(a, b)] = Math.min(a, b);
      }
      aliases.set(key, index);
    }
  });
  return watches.filter((_, index) => root(index) === index);
}

/** The final guard for cache, live, catalogue and archetype result cards. */
export function uniqueSearchView(result: AiSearchView): AiSearchView {
  if (result.status !== "found") return result;
  const mainCount = result.watches.length;
  const cards = [...result.watches, ...(result.alsoWorth ?? [])];
  const unique = uniqueWatchResults(cards);
  const watches = unique.filter((watch) => result.watches.includes(watch));
  const alsoWorth = result.alsoWorth
    ? unique.filter((watch) => !result.watches.includes(watch))
    : undefined;
  const summary =
    mainCount !== watches.length
      ? result.summary.replace(
          new RegExp(`\\b${mainCount} watches\\b`),
          `${watches.length} ${watches.length === 1 ? "watch" : "watches"}`,
        )
      : result.summary;
  return { ...result, watches, summary, ...(alsoWorth ? { alsoWorth } : {}) };
}
