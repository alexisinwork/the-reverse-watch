// How a film or person attribution may be written on a page. Providers
// describe a wearer as "James Bond (Daniel Craig)" or "Mads Mikkelsen as Le
// Chiffre"; a page says "Daniel Craig" or "Le Chiffre". Matching the whole
// string never succeeds, so a wearer is matched by any of the names it
// contains. Names are folded to lowercase letters and digits.
import { pageMentionsReference } from "./ai-watch-guardrails";

const fold = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Ranks and titles that may precede a name ("Colonel Walter E. Kurtz"). */
const TITLES = new Set([
  "agent",
  "captain",
  "capt",
  "colonel",
  "col",
  "commander",
  "detective",
  "doctor",
  "dr",
  "general",
  "lady",
  "lieutenant",
  "lord",
  "lt",
  "major",
  "mr",
  "mrs",
  "ms",
  "president",
  "professor",
  "sergeant",
  "sgt",
  "sir",
]);

/** Every name a wearer attribution contains, longest first. */
export function personNames(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  const parts = value
    .split(/[()/,;]|\s+as\s+|\s+aka\s+|\s+[–—-]\s+/i)
    .map(fold)
    .filter(Boolean);
  const names = new Set<string>([fold(value), ...parts]);
  for (const name of [...names]) {
    const words = name.split(" ");
    if (words.length > 1 && TITLES.has(words[0]!))
      names.add(words.slice(1).join(" "));
  }
  return [...names]
    .filter((name) => name.replace(/ /g, "").length >= 3)
    .sort((a, b) => b.length - a.length);
}

/** A film or series title, folded. Titles are matched whole. */
export function workNames(value: string | null | undefined): string[] {
  const name = fold(value ?? "");
  return name ? [name] : [];
}

/** Two wearer attributions name the same person when one name agrees. */
export function samePerson(
  a: string | null | undefined,
  b: string | null | undefined,
) {
  const first = new Set(personNames(a).map((name) => name.replace(/ /g, "")));
  return personNames(b).some((name) => first.has(name.replace(/ /g, "")));
}

/** Brands written more than one way on pages: Bulgari's house style is
 * "Bvlgari"; a vintage Heuer is sold today as TAG Heuer. Each group lists
 * every spelling, folded. */
const BRAND_SPELLINGS: readonly (readonly string[])[] = [
  ["bvlgari", "bulgari"],
  ["tag heuer", "heuer"],
];

/** Every spelling of a brand, folded ("Bvlgari" → bvlgari, bulgari). */
export function brandNames(brand: string | null | undefined): string[] {
  const name = fold(brand ?? "");
  if (!name) return [];
  return [...(BRAND_SPELLINGS.find((names) => names.includes(name)) ?? [name])];
}

/** Two brand names are the same house, ignoring spaces and spellings. A
 * maker's line written with the maker's name ("Casio G-Shock") is that
 * maker; another word in front ("Grand Seiko") is not. */
export function sameBrand(
  a: string | null | undefined,
  b: string | null | undefined,
) {
  const first = brandNames(a);
  const second = brandNames(b);
  const squash = (name: string) => name.replace(/ /g, "");
  const line = (whole: string, maker: string) => whole.startsWith(`${maker} `);
  return first.some((x) =>
    second.some((y) => squash(x) === squash(y) || line(x, y) || line(y, x)),
  );
}

/** Folded text with a space at each end, for whole-name `includes` checks. */
export const spacedWords = (value: string) => ` ${fold(value)} `;

/** True when the spaced text contains one of the names as whole words. */
export const mentionsAny = (spaced: string, names: readonly string[]) =>
  names.some((name) => spaced.includes(` ${name} `));

const GENERIC_MODEL_WORDS = new Set([
  "and",
  "auto",
  "automatic",
  "axial",
  "black",
  "blue",
  "bracelet",
  "brown",
  "ceramic",
  "dial",
  "edition",
  "everose",
  "gold",
  "gray",
  "green",
  "grey",
  "leather",
  "limited",
  "manual",
  "new",
  "pink",
  "platinum",
  "quartz",
  "red",
  "ref",
  "reference",
  "rose",
  "rubber",
  "silver",
  "stainless",
  "steel",
  "strap",
  "the",
  "titanium",
  "vintage",
  "watch",
  "watches",
  "white",
  "with",
  "yellow",
]);

/** The words of a model name that tell it apart: no brand, reference,
 * colour, material or bare size ("Seamaster Planet Ocean 600M Co-Axial 45.5
 * Stainless Steel" → seamaster, planet, ocean, 600m). */
export function distinctiveModelWords(watch: {
  brand: string;
  model: string;
  referenceCode: string | null;
}) {
  const skip = new Set([
    ...fold(watch.brand).split(" "),
    ...fold(watch.referenceCode ?? "").split(" "),
  ]);
  return [
    ...new Set(
      fold(watch.model)
        .split(" ")
        .filter(
          (word) =>
            word.length >= 3 &&
            !/^\d+$/.test(word) &&
            !skip.has(word) &&
            !GENERIC_MODEL_WORDS.has(word),
        ),
    ),
  ];
}

/**
 * A sighting passage ties the watch to its wearer or film: it names the
 * brand, the watch by its exact reference or by its model words (at least
 * two of them, or the only one), and every attribution the card states: a
 * name of the wearer and the film's title. The page around it must carry
 * the exact reference; that is checked where the page is read.
 */
export function passageTiesSighting(
  passage: string,
  watch: {
    brand: string;
    model: string;
    referenceCode: string | null;
    details: { person?: string | null; work?: string | null };
  },
) {
  const text = spacedWords(passage);
  const modelWords = distinctiveModelWords(watch);
  const namesWatch =
    pageMentionsReference(watch.referenceCode, passage, "") ||
    (modelWords.length > 0 &&
      modelWords.filter((word) => text.includes(` ${word} `)).length >=
        Math.min(2, modelWords.length));
  const person = personNames(watch.details.person);
  const work = workNames(watch.details.work);
  return (
    mentionsAny(text, brandNames(watch.brand)) &&
    namesWatch &&
    (person.length === 0 || mentionsAny(text, person)) &&
    (work.length === 0 || mentionsAny(text, work))
  );
}

/** A film or series title without a release year or a leading article:
 * "Casino Royale (2006)" and "The Martian" compare as "casino royale" and
 * "martian". */
const titleKey = (value: string) =>
  fold(value)
    .replace(/ (?:19|20)\d{2}$/, "")
    .replace(/^the /, "")
    .trim();

/** Two titles name the same film or series. */
export function sameWork(
  a: string | null | undefined,
  b: string | null | undefined,
) {
  if (!a?.trim() || !b?.trim()) return false;
  const first = titleKey(a);
  return first.length > 0 && first === titleKey(b);
}
