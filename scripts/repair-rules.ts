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
  for (const line of lines)
    if (
      SPEC_LINE.test(line) ||
      (reference && pageMentionsReference(reference, line, ""))
    )
      add(line);
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
};

/** The passage is on our copy of the page. */
export const onPage = (page: string, passage: string | null) =>
  Boolean(passage) &&
  plain(passage!).length >= 3 &&
  page.includes(plain(passage!));

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
    if (!new RegExp(`${number(mm)}\\s*mm`).test(quoted)) return unconfirmed;
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

/**
 * The page shows another watch: it names the watch with none of the stored
 * name's words and differs in a hard fact (case diameter by a millimetre or
 * more, movement or water resistance). A name written differently for the
 * same watch ("SKYDWELLER" for "Sky-Dweller White Rolesor", "Series8 890"
 * for "Series 8 890 Mechanical") changes nothing, so the stored name stays.
 */
export function anotherWatch(fields: Partial<Record<Field, FieldResult>>) {
  if (fields.model?.status !== "corrected") return false;
  const diameter = fields.caseDiameterMm;
  return (
    (diameter?.status === "corrected" &&
      Math.abs(Number(diameter.value) - Number(diameter.stored)) >= 1) ||
    fields.movement?.status === "corrected" ||
    fields.waterResistanceM?.status === "corrected"
  );
}
