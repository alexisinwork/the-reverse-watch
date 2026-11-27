// The catalogue repair's rules (scripts/repair-catalogue.ts), kept apart
// from the run so tests can hold them to the cases calibration found
// (scripts/repair-rules.test.ts): which pages may give a fact, which lines
// of a page are read, and when a copied passage confirms, corrects or fills
// a stored fact.
import {
  normalizeMovement,
  pageMentionsReference,
} from "../app/domain/ai-watch-guardrails";
import { isRetailSource } from "../app/domain/price-check.server";
import { sourceHost } from "../app/domain/source-pages.server";
import type { CatalogueWatch } from "../app/domain/watch-catalogue";
import { fold } from "./eval-sets";

/** Forums, magazines, social sites, databases, auction houses and
 * pre-owned dealers never give a fact (a sampled run took a Sotheby's lot
 * and a Japanese pre-owned dealer for shops). */
export const EDITORIAL =
  /(^|\.)(([a-z0-9-]*forums?[a-z0-9-]*)\.[a-z.]+|watchuseek\.com|hodinkee\.com|monochrome-watches\.com|fratellowatches\.com|ablogtowatch\.com|wornandwound\.com|timeandtidewatches\.com|gearpatrol\.com|watchtime\.com|revolutionwatch\.com|oracleoftime\.com|twobrokewatchsnobs\.com|deployant\.com|europastar\.com|calibercorner\.com|wristcheck\.com|watchbase\.com|instagram\.com|facebook\.com|youtube\.com|tiktok\.com|pinterest\.[a-z.]+|twitter\.com|x\.com|wikipedia\.org|gq\.com|esquire\.com|robbreport\.com|bloomberg\.com|forbes\.com|sothebys\.com|christies\.com|phillips\.com|bonhams\.com|antiquorum\.swiss|monacolegendauctions\.com|catawiki\.[a-z.]+|ha\.com|invaluable\.com|liveauctioneers\.com|zenluxe\.[a-z.]+|swisswatchexpo\.com|europeanwatch\.com|davidsw\.com|theluxuryhut\.com|luxurybazaar\.com|beckertime\.com|watchexchange\.[a-z.]+|millenarywatches\.com|precioustime\.[a-z.]+)$/;

const transliterate = (value: string) =>
  value
    .toLowerCase()
    .replace(/ü/g, "ue")
    .replace(/ö/g, "oe")
    .replace(/ä/g, "ae")
    .replace(/ß/g, "ss");

/** The maker's own site, another shop, or a page that cannot give facts. */
/** The site's own name: "us.alpinawatches.com" is alpinawatches.com, and a
 * shop's subdomain such as "grandseiko.hrd-web.com" is hrd-web.com. */
export function registrableDomain(host: string) {
  const labels = host.split(".");
  const second = labels.at(-2) ?? "";
  return labels.length >= 3 &&
    /^(co|com|net|org|ac|gov|edu|ne|or)$/.test(second) &&
    (labels.at(-1) ?? "").length === 2
    ? labels.slice(-3).join(".")
    : labels.slice(-2).join(".");
}

export function pageKind(url: string, brand: string) {
  const host = sourceHost(url);
  // Makers and shops serve their pages over https; one that does not
  // gives no fact (and the fact log accepts https addresses only).
  if (!url.startsWith("https://")) return null;
  if (!host || !isRetailSource(url) || EDITORIAL.test(host)) return null;
  const site = fold(registrableDomain(host));
  const keys = new Set<string>();
  for (const name of [brand, transliterate(brand)]) {
    keys.add(fold(name));
    for (const word of name.split(/[^a-z0-9äöüß]+/i))
      if (fold(word).length >= 4) keys.add(fold(word));
  }
  return [...keys].some((key) => key.length >= 3 && site.includes(key))
    ? ("maker" as const)
    : ("retailer" as const);
}

/** The page's title area and every line that could state a fact. */
const SPEC_LINE =
  /\d\s*(mm|m\b|bar|atm|ft|feet|hours|h\b|jewels|vph)|diamet|thick|height|water|resist|movement|calib|automatic|self-?winding|manual|hand-?wound|quartz|solar|spring drive|kinetic|case|material|steel|titan|gold|ceramic|bronze|carbon|crystal|sapphire|mineral|hesalite|strap|bracelet|rubber|leather|back/i;
/** A specification table's label on a line of its own, such as "Case width
 * (mm)" or "Water Resistance", whose value is the next line. */
const SPEC_LABEL =
  /^(case\s+)?(diameter|width|size|thickness|height|length)\b|^water[\s-]*resistan|^movement\b|^(movement\s+)?(type|calib(re|er))\b|^(case|case\s*back|caseback|bracelet|strap|band)(\s+material)?$|^(crystal|glass)\b/i;
/** A label holds no value of its own: no digit outside "(mm)". */
const isLabel = (line: string) => {
  const clean = line.trim().replace(/[:：]\s*$/, "");
  return (
    clean.length <= 40 &&
    SPEC_LABEL.test(clean) &&
    !/\d/.test(clean.replace(/\((mm|m|ft)\)/gi, ""))
  );
};
/** The next line is the label's value when it reads like one. */
const isValue = (line: string) =>
  line.length > 0 &&
  line.length <= 60 &&
  !isLabel(line) &&
  (/\d/.test(line) || SPEC_LINE.test(line));
export function specText(text: string, reference: string | null) {
  const lines = text.split(" \n ");
  const keep: string[] = [];
  const seen = new Set<string>();
  const add = (line: string) => {
    const clean = line.trim();
    if (clean && clean.length <= 400 && !seen.has(clean)) {
      seen.add(clean);
      keep.push(clean);
    }
  };
  lines.slice(0, 25).forEach(add);
  for (const [at, line] of lines.entries()) {
    // A table puts the label and its value on lines of their own; read
    // alone, the label says nothing (2026-11-27: Tissot's "Case width (mm)"
    // then "42.00", Seiko's "Water Resistance" then its value).
    const value = lines[at + 1]?.trim() ?? "";
    if (isLabel(line) && isValue(value)) {
      add(`${line.trim().replace(/[:：]\s*$/, "")}: ${value}`);
      continue;
    }
    if (
      SPEC_LINE.test(line) ||
      (reference && pageMentionsReference(reference, line, ""))
    )
      add(line);
  }
  let joined = "";
  for (const line of keep) {
    if (joined.length + line.length > 7_000) break;
    joined += `${line}\n`;
  }
  return joined;
}

export const FIELDS = [
  "model",
  "caseDiameterMm",
  "caseThicknessMm",
  "movement",
  "inHouseCalibre",
  "waterResistanceM",
  "caseMaterial",
  "casebackMaterial",
  "strapMaterial",
  "crystal",
] as const;
export type Field = (typeof FIELDS)[number];

export const plain = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/[^a-z0-9.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const number = (value: number) =>
  `(?<![0-9.])${String(Number(value.toFixed(2))).replace(".", "\\.")}(?:\\.0+)?(?![0-9])`;

const MOVEMENT_WORDS: Record<string, RegExp> = {
  automatic: /automatic|self.?winding|automatique|automatik|selbstaufzug/,
  manual: /hand.?wound|hand.?winding|manual|handaufzug|remontage manuel/,
  quartz: /quartz|quarz/,
  solar: /solar|eco.?drive|light.?powered/,
  spring_drive: /spring drive/,
  hybrid: /kinetic|hybrid/,
};
const IN_HOUSE =
  /in.?house|manufacture|manufaktur|own movement|own calibre|own caliber/;
const THIRD_PARTY =
  /\beta\b|sellita|\bsw ?[0-9]|valjoux|miyota|ronda|soprod|\bnh ?[0-9]{2}|seagull|sea.gull|unitas|peseux|landeron|concepto|la joux|\bstp\b|dubois|\bisa\b/;
const MATERIAL_KEYS = [
  "titanium",
  "ceramic",
  "platinum",
  "gold",
  "bronze",
  "carbon",
  "aluminium",
  "aluminum",
  "brass",
  "silver",
  "tantalum",
  "steel",
  "resin",
  "plastic",
  "rubber",
  "silicone",
  "leather",
  "alligator",
  "nylon",
  "textile",
  "fabric",
  "canvas",
  "sapphire",
  "mineral",
  "hesalite",
  "acrylic",
  "hardlex",
];
export const materialKey = (value: string | null) => {
  if (!value) return null;
  const text = plain(value).replace("aluminum", "aluminium");
  return MATERIAL_KEYS.find((key) => text.includes(key)) ?? text;
};

export type FieldResult = {
  status: "confirmed" | "corrected" | "filled" | "unconfirmed";
  stored: string | number | boolean | null;
  value?: string | number | boolean;
  passage?: string;
  /** The page names the watch with only some of the stored name's words. */
  ambiguous?: boolean;
  /** The maker's own name for the exact reference, from its product page's
   * title (makerName). */
  makerTitle?: boolean;
};

/** The passage is on our copy of the page. */
export const onPage = (page: string, passage: string | null) =>
  Boolean(passage) &&
  plain(passage!).length >= 3 &&
  page.includes(plain(passage!));

const HEDGED =
  /\b(frequently|often|usually|typically|generally|commonly|sometimes|can be|may be|might be|such as|for example)\b/;

function storedValue(watch: CatalogueWatch, field: Field) {
  return watch[field] ?? null;
}

export function checkField(
  watch: CatalogueWatch,
  field: Field,
  answer: {
    value: string | number | boolean | null;
    passage: string | null;
  } | null,
  page: string,
): FieldResult {
  const stored = storedValue(watch, field);
  const unconfirmed = { status: "unconfirmed" as const, stored };
  const value = answer?.value;
  const passage = answer?.passage ?? null;
  if (value === null || value === undefined || !onPage(page, passage))
    return unconfirmed;
  const quoted = plain(passage!);
  // A general remark ("a transparent caseback, frequently made of sapphire")
  // says nothing about this watch (2026-11-27, an Omega page).
  if (HEDGED.test(quoted)) return unconfirmed;
  const verdict = (same: boolean, written: string | number | boolean) =>
    stored === null || stored === ""
      ? { status: "filled" as const, stored, value: written, passage: passage! }
      : same
        ? {
            status: "confirmed" as const,
            stored,
            value: written,
            passage: passage!,
          }
        : {
            status: "corrected" as const,
            stored,
            value: written,
            passage: passage!,
          };

  if (field === "caseDiameterMm" || field === "caseThicknessMm") {
    const mm = Number(value);
    if (
      !Number.isFinite(mm) ||
      mm < (field === "caseDiameterMm" ? 15 : 2) ||
      mm > (field === "caseDiameterMm" ? 70 : 40)
    )
      return unconfirmed;
    // "42 mm", or a table's "Case width (mm): 42.00".
    if (!new RegExp(`${number(mm)}\\s*mm|\\bmm\\s*${number(mm)}`).test(quoted))
      return unconfirmed;
    if (
      field === "caseDiameterMm" &&
      /length|lug|thick|height|strap|bracelet|band|crystal|dial/.test(quoted)
    )
      return unconfirmed;
    if (
      field === "caseThicknessMm" &&
      !/thick|height|depth|tall|profile/.test(quoted)
    )
      return unconfirmed;
    // A whole number never corrects a more precise one by less than a
    // millimetre: a shop rounded Orient's 41.8 mm to 41 in calibration.
    if (
      stored !== null &&
      Number.isInteger(mm) &&
      !Number.isInteger(Number(stored)) &&
      Math.abs(Number(stored) - mm) < 1 &&
      Math.abs(Number(stored) - mm) > 0.25
    )
      return unconfirmed;
    return verdict(
      stored !== null && Math.abs(Number(stored) - mm) <= 0.25,
      mm,
    );
  }
  if (field === "waterResistanceM") {
    const metres = Number(value);
    if (!Number.isInteger(metres) || metres < 0 || metres > 20_000)
      return unconfirmed;
    const gives = new RegExp(
      `${number(metres)}\\s*(m|meter|metre)|${number(metres / 10)}\\s*(bar|atm)`,
    );
    if (
      !gives.test(quoted) ||
      !/water|wr|resist|etanch|wasserdicht|bar|atm|depth/.test(quoted)
    )
      return unconfirmed;
    return verdict(stored !== null && Number(stored) === metres, metres);
  }
  if (field === "movement") {
    const kind = normalizeMovement(String(value));
    if (!kind || !MOVEMENT_WORDS[kind]?.test(quoted)) return unconfirmed;
    return verdict(normalizeMovement(String(stored ?? "")) === kind, kind);
  }
  if (field === "inHouseCalibre") {
    if (typeof value !== "boolean") return unconfirmed;
    if (value ? !IN_HOUSE.test(quoted) : !THIRD_PARTY.test(quoted))
      return unconfirmed;
    return verdict(stored === value, value);
  }
  if (field === "model") {
    const name = String(value).trim();
    if (name.length < 2 || name.length > 160) return unconfirmed;
    return modelCheck(watch, name, passage!);
  }
  // Materials and crystal: the passage gives the value's main word.
  const text = String(value).trim().toLowerCase();
  const key = materialKey(text);
  if (!key || text.length > 80 || !quoted.includes(key)) return unconfirmed;
  return verdict(materialKey(String(stored ?? "")) === key, text);
}

const GENERIC = new Set(
  "automatic quartz manual watch watches mm stainless steel black white blue green grey gray silver dial bracelet strap rubber leather men mens women ladies chronograph diver dive date gmt the and with".split(
    " ",
  ),
);
/**
 * The stored name against the name the page gives the watch (its own
 * passage, not the whole page, whose menus name other models). Every
 * distinctive stored word there: confirmed. None: the reference belongs to
 * another model. Some: ambiguous, so nothing changes. A name in another
 * script (a Japanese shop's page) settles nothing.
 */
export function modelCheck(
  watch: CatalogueWatch,
  name: string,
  passage: string,
): FieldResult {
  const stored = watch.model;
  const unconfirmed: FieldResult = { status: "unconfirmed", stored };
  const letters = passage.replace(/[\s\d\p{P}]/gu, "");
  if ((letters.match(/[a-z]/gi) ?? []).length < letters.length / 2)
    return unconfirmed;
  const brandWords = new Set(plain(watch.brand).split(" "));
  const distinctive = (value: string) =>
    plain(value)
      .split(" ")
      .filter(
        (word) =>
          word.length > 2 &&
          !GENERIC.has(word) &&
          !brandWords.has(word) &&
          !/^\d+(\.\d+)?(mm|m)?$/.test(word),
      );
  const words = distinctive(stored);
  if (!words.length || !distinctive(name).length) return unconfirmed;
  const target = plain(`${name} ${passage}`);
  const found = words.filter((word) =>
    new RegExp(`(?<![a-z0-9])${word.replace(/\./g, "\\.")}(?![a-z0-9])`).test(
      target,
    ),
  ).length;
  if (found === words.length)
    return { status: "confirmed", stored, value: stored, passage };
  if (found === 0) return { status: "corrected", stored, value: name, passage };
  return { ...unconfirmed, ambiguous: true };
}

const COLOURS = new Set(
  "black white blue green grey gray silver red brown champagne cream ivory salmon pink purple orange yellow anthracite slate bronze gold".split(
    " ",
  ),
);
/** The first lines of our copy of a page: its title, description and main
 * heading. */
export const titleArea = (pageText: string) =>
  plain(pageText.split(" \n ").slice(0, 5).join(" "));

/**
 * On the maker's own product page for the exact reference, the watch takes
 * the maker's name for it when the stored name contradicts it (2026-11-27:
 * the judge found "Khaki Navy Frogman Automatic 41" for Hamilton's 42 mm
 * H77725335 and "DS Action Day-Date" for Certina's DS Action Diver 43mm
 * Powermatic 80):
 * - a size in the stored name that is not the page's case diameter,
 * - a colour in the stored name while the title names another colour, or
 * - another model: a distinctive word in the stored name the maker's name
 *   lacks while the maker's name has one the stored name lacks, and either
 *   that stored word is nowhere on the page or a hard fact differs too
 *   ("Prospex" for "Prospex 1965 Heritage Diver" changes nothing, nor does
 *   a longer marketing title for a name the page also uses).
 * The name must stand in the page's title area, so a menu or a related
 * model never names the watch. Returns null when the stored name holds up
 * or the page gives no usable name.
 */
export function makerName(
  watch: CatalogueWatch,
  answer: {
    value: string | number | boolean | null;
    passage: string | null;
  } | null,
  title: string,
  page: {
    diameterMm: number | null;
    /** plain() of the whole page. */
    text: string;
    hardFactDiffers: boolean;
  },
): FieldResult | null {
  const pageDiameterMm = page.diameterMm;
  const name = typeof answer?.value === "string" ? answer.value.trim() : "";
  const passage = answer?.passage ?? "";
  if (name.length < 2 || name.length > 120 || plain(passage).length < 3)
    return null;
  if (!title.includes(plain(passage)) || !plain(passage).includes(plain(name)))
    return null;
  const letters = name.replace(/[\s\d\p{P}]/gu, "");
  if ((letters.match(/[a-z]/gi) ?? []).length < letters.length / 2) return null;
  const brandWords = new Set(plain(watch.brand).split(" "));
  const reference = plain(watch.referenceCode ?? "").replace(/ /g, "");
  const words = (value: string) =>
    plain(value)
      .split(" ")
      .filter((word) => word && !brandWords.has(word));
  const distinctive = (word: string) =>
    word.length > 2 &&
    !GENERIC.has(word) &&
    !/^\d/.test(word) &&
    !reference.includes(word.replace(/\./g, ""));
  const makers = words(name);
  // A name made of the reference, generic words or numbers is no name.
  if (!makers.some(distinctive)) return null;
  const stored = words(watch.model);
  const sizeOf = (word: string) => {
    const size = /^(\d{2}(?:\.\d+)?)(?:mm)?$/.exec(word);
    const mm = size ? Number(size[1]) : Number.NaN;
    return mm >= 20 && mm <= 55 ? mm : null;
  };
  const sizeConflict = stored.some((word) => {
    const mm = sizeOf(word);
    return (
      mm !== null &&
      pageDiameterMm !== null &&
      Math.abs(mm - pageDiameterMm) >= 0.5
    );
  });
  const titleWords = new Set(title.split(" "));
  const colourConflict =
    stored.some((word) => COLOURS.has(word) && !titleWords.has(word)) &&
    [...titleWords].some((word) => COLOURS.has(word) && !stored.includes(word));
  // A stored word anywhere in the title area is not contradicted ("Elegance
  // Collection" stays when Grand Seiko's title names it beside the GMT).
  const nameWords = new Set([...makers, ...words(passage), ...titleWords]);
  const lacking = stored.filter(
    (word) => distinctive(word) && !nameWords.has(word),
  );
  const onThePage = (word: string) =>
    new RegExp(`(?<![a-z0-9])${word.replace(/\./g, "\\.")}(?![a-z0-9])`).test(
      page.text,
    );
  const anotherName =
    lacking.length > 0 &&
    makers.some((word) => distinctive(word) && !stored.includes(word)) &&
    (page.hardFactDiffers || lacking.some((word) => !onThePage(word)));
  if (!sizeConflict && !colourConflict && !anotherName) return null;
  // A word the maker writes in capitals keeps the stored spelling
  // ("HYDROCONQUEST GMT" stays "HydroConquest GMT").
  const spelling = new Map(
    watch.model.split(/\s+/).map((word) => [plain(word), word] as const),
  );
  const written = name
    .split(/\s+/)
    .map((word) =>
      word.length > 3 && word === word.toUpperCase() && /[A-Z]/.test(word)
        ? (spelling.get(plain(word)) ?? word)
        : word,
    )
    .join(" ");
  // The same name again changes nothing.
  if (written === watch.model) return null;
  return {
    status: "corrected",
    stored: watch.model,
    value: written,
    passage,
    makerTitle: true,
  };
}

/**
 * The page shows another watch: it names the watch with none of the stored
 * name's words and differs in a hard fact (case diameter by a millimetre or
 * more, movement or water resistance). A name written differently for the
 * same watch ("SKYDWELLER" for "Sky-Dweller White Rolesor", "Series8 890"
 * for "Series 8 890 Mechanical") changes nothing, so the stored name stays.
 */
export function anotherWatch(fields: Partial<Record<Field, FieldResult>>) {
  if (fields.model?.status !== "corrected") return false;
  return (
    anotherSizeOrMovement(fields) ||
    fields.waterResistanceM?.status === "corrected"
  );
}

/**
 * The maker's page gives another case size (by a millimetre or more) or
 * another movement. With the maker's own name for the watch (makerName),
 * only this makes it another model whose price is checked again: AI-found
 * records got the water resistance of the same watch wrong (Citizen
 * NB6021-68L stored at 300 m, its page gives 200 m).
 */
export function anotherSizeOrMovement(
  fields: Partial<Record<Field, FieldResult>>,
) {
  const diameter = fields.caseDiameterMm;
  return (
    (diameter?.status === "corrected" &&
      Math.abs(Number(diameter.value) - Number(diameter.stored)) >= 1) ||
    fields.movement?.status === "corrected"
  );
}
