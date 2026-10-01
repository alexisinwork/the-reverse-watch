/**
 * The cheaper-alternative finder's rules (owner decisions, 2026-10-01):
 * watches that look and work like the one a subscriber names, inside
 * their budget, new or pre-owned. No homages. The same brand's cheaper
 * models count when they look alike. Quartz and solar only when the
 * subscriber said they're fine.
 *
 * Two layers: strict rules a match must pass, then a fixed, versioned
 * points table for how alike it looks. No model decides the ranking.
 */
import type { DesignTraits } from "./design-traits";
import type { FxTable } from "./fx";
import { convert } from "./fx";
import { findPriceRange } from "./questionnaire-v4";
import {
  priceIn,
  type CatalogueStyle,
  type CatalogueWatch,
} from "./watch-catalogue";

export const ALTERNATIVES_SCORING_VERSION = "1.3.0";

/** A case within this many millimetres can be an alternative. */
export const SIZE_TOLERANCE_MM = 3;

// ---------------------------------------------------------------------------
// Budget

export type AlternativesBudget =
  | { kind: "exact"; amount: number; currency: string }
  | { kind: "range"; rangeId: string; currency: string };

/** An exact price means that price ± 1,000 (owner decision). */
export const EXACT_PRICE_SPREAD = 1_000;

export function budgetWindow(budget: AlternativesBudget) {
  if (budget.kind === "exact") {
    return {
      currency: budget.currency,
      minimum: Math.max(0, budget.amount - EXACT_PRICE_SPREAD),
      maximum: budget.amount + EXACT_PRICE_SPREAD,
    };
  }
  const range = findPriceRange(budget.rangeId);
  if (!range) throw new Error("Unknown price range.");
  return {
    currency: budget.currency,
    minimum: range.minimum,
    maximum: range.maximum,
  };
}

// ---------------------------------------------------------------------------
// Homages: brands whose business is copying other brands' designs. Kept as
// a short, reviewed list; extend it when one turns up.

const HOMAGE_BRANDS = [
  "steinhart",
  "san martin",
  "pagani design",
  "parnis",
  "heimdallr",
  "cadisen",
  "bliger",
  "corgeut",
  "addiesdive",
  "sugess",
  "benyar",
  "tisell",
  "phylida",
  "escapement time",
  "merkur",
  "proxima",
  "watchdives",
  "invicta",
];

export function isHomageBrand(brand: string) {
  const name = brand.trim().toLowerCase();
  return HOMAGE_BRANDS.some(
    (homage) => name === homage || name.startsWith(`${homage} `),
  );
}

// ---------------------------------------------------------------------------
// Strict rules

/** The watch's main role, the one an alternative must share. */
const STYLE_PRIORITY: CatalogueStyle[] = [
  "dive",
  "travel",
  "field",
  "dress",
  "sport",
  "everyday",
];

export function primaryStyle(watch: CatalogueWatch): CatalogueStyle {
  return (
    STYLE_PRIORITY.find((style) => watch.styles.includes(style)) ?? "everyday"
  );
}

const MECHANICAL = new Set(["automatic", "manual", "spring_drive"]);
const BATTERY = new Set(["quartz", "solar", "hybrid"]);

const SHAPE_FAMILY: Record<string, string> = {
  round: "round",
  oval: "round",
  cushion: "cushion",
  tonneau: "tonneau",
  rectangular: "rectangular",
  square: "rectangular",
  octagonal: "octagonal",
};

/**
 * The case shape family. The catalogue's facts and the photo can disagree;
 * a non-round reading from either is the telling one (a round photo crop
 * of a square watch is far likelier than the reverse).
 */
function shapeOf(watch: CatalogueWatch) {
  const family = (shape: string | null | undefined) =>
    shape ? (SHAPE_FAMILY[shape] ?? shape) : "round";
  const fromFacts = family(watch.caseShape);
  const fromPhoto = family(watch.designTraits?.caseShape);
  return fromFacts !== "round" ? fromFacts : fromPhoto;
}

const has = (watch: CatalogueWatch, slug: string) =>
  watch.complications.includes(slug);

/** Every strict rule the candidate breaks; empty means it may be shown. */
/**
 * Functions, from the catalogue's tags or, when those miss one, from what
 * the photo plainly shows (a chronograph dial, a GMT bezel or dial, a
 * diving bezel).
 */
function functionsOf(watch: CatalogueWatch) {
  const traits = watch.designTraits;
  return {
    chronograph:
      has(watch, "chronograph") ||
      traits?.dialLayout?.startsWith("chronograph") === true,
    secondZone:
      has(watch, "gmt") ||
      has(watch, "world_time") ||
      traits?.dialLayout === "gmt" ||
      traits?.bezel === "gmt",
    diveBezel: has(watch, "dive_bezel") || traits?.bezel === "dive",
  };
}

/** Rectangular and square cases form one family; every other shape another. */
const isRectangular = (watch: CatalogueWatch) =>
  shapeOf(watch) === "rectangular";

/** Every strict rule the candidate breaks; empty means it may be shown. */
export function strictFailures(
  target: CatalogueWatch,
  candidate: CatalogueWatch,
  allowQuartz: boolean,
) {
  const failures: string[] = [];
  if (isHomageBrand(candidate.brand)) failures.push("homage");
  // Role: a diver's alternative is a diver. Other style labels overlap
  // (dress, everyday, sport), so sharing any one of them is enough.
  if (primaryStyle(target) === "dive") {
    if (!candidate.styles.includes("dive")) failures.push("style");
  } else if (!candidate.styles.some((style) => target.styles.includes(style))) {
    failures.push("style");
  }
  // An alternative never adds or drops a chronograph or second time zone.
  const mine = functionsOf(target);
  const theirs = functionsOf(candidate);
  if (mine.chronograph !== theirs.chronograph) failures.push("chronograph");
  if (mine.secondZone !== theirs.secondZone) failures.push("gmt");
  if (mine.diveBezel && !theirs.diveBezel) failures.push("dive_bezel");
  // Rectangular watches stay rectangular, round-ish ones stay round-ish.
  if (isRectangular(target) !== isRectangular(candidate))
    failures.push("shape");
  // Diameter only means something for round-ish cases.
  if (
    !isRectangular(target) &&
    target.caseDiameterMm !== null &&
    (candidate.caseDiameterMm === null ||
      Math.abs(candidate.caseDiameterMm - target.caseDiameterMm) >
        SIZE_TOLERANCE_MM)
  ) {
    failures.push("size");
  }
  if (
    (target.waterResistanceM ?? 0) >= 200 &&
    (candidate.waterResistanceM ?? 0) < 200
  ) {
    failures.push("water_resistance");
  }
  if (
    target.movement &&
    MECHANICAL.has(target.movement) &&
    candidate.movement &&
    BATTERY.has(candidate.movement) &&
    !allowQuartz
  ) {
    failures.push("movement");
  }
  return failures;
}

// ---------------------------------------------------------------------------
// How alike it looks

type TraitKey = keyof DesignTraits;

/** Points per shared trait, and how the trait is described to visitors. */
const TRAIT_POINTS: {
  key: TraitKey;
  points: number;
  label: (value: string) => string;
}[] = [
  { key: "dialColour", points: 3, label: (v) => `${v} dial` },
  { key: "dialLayout", points: 3, label: (v) => LAYOUT_WORDS[v] ?? v },
  {
    key: "bezel",
    points: 2,
    label: (v) =>
      v === "plain" ? "plain bezel" : `${v.replaceAll("_", " ")} bezel`,
  },
  {
    key: "handStyle",
    points: 2,
    label: (v) => `${v.replaceAll("_", " ")} hands`,
  },
  { key: "bezelColour", points: 1, label: (v) => `${v} bezel colour` },
  {
    key: "lume",
    points: 1,
    label: (v) =>
      v === "cream"
        ? "vintage-tone lume"
        : v === "none"
          ? "no lume"
          : "white lume",
  },
  {
    key: "numerals",
    points: 1,
    label: (v) => (v === "indices" ? "baton indices" : `${v} numerals`),
  },
  { key: "dialTexture", points: 1, label: (v) => `${v} dial finish` },
  {
    key: "strap",
    points: 1,
    label: (v) =>
      v === "integrated_bracelet" ? "integrated bracelet" : `on ${v}`,
  },
  {
    key: "era",
    points: 1,
    label: (v) =>
      v === "vintage_inspired" ? "vintage-inspired" : "modern design",
  },
];

const LAYOUT_WORDS: Record<string, string> = {
  time_only: "time-only dial",
  date: "date window",
  chronograph_panda: "panda chronograph dial",
  chronograph_reverse_panda: "reverse-panda chronograph dial",
  chronograph: "chronograph dial",
  gmt: "GMT dial",
  pilot: "pilot's dial",
  complicated: "complication dial",
};

export const MAX_LOOK_POINTS =
  TRAIT_POINTS.reduce((sum, trait) => sum + trait.points, 0) + 7;

export function lookScore(target: CatalogueWatch, candidate: CatalogueWatch) {
  let points = 0;
  const shares: string[] = [];
  const differs: string[] = [];
  const a = target.designTraits;
  const b = candidate.designTraits;
  if (a && b) {
    for (const trait of TRAIT_POINTS) {
      const mine = a[trait.key];
      const theirs = b[trait.key];
      if (
        mine === null ||
        mine === undefined ||
        theirs === null ||
        theirs === undefined
      )
        continue;
      if (mine === theirs) {
        points += trait.points;
        if (trait.points >= 1) shares.push(trait.label(String(mine)));
      } else if (trait.points >= 2) {
        differs.push(trait.label(String(theirs)));
      }
    }
  }
  // Size: full marks within 1 mm, sliding to none at 3 mm.
  if (target.caseDiameterMm !== null && candidate.caseDiameterMm !== null) {
    const gap = Math.abs(target.caseDiameterMm - candidate.caseDiameterMm);
    points += Math.max(0, 2 - Math.max(0, gap - 1));
    if (gap <= 1) shares.push(`${candidate.caseDiameterMm} mm`);
    else differs.push(`${candidate.caseDiameterMm} mm case`);
  }
  // The same case shape (round, cushion, octagonal…) and an integrated
  // bracelet are a large part of the look.
  if (shapeOf(target) === shapeOf(candidate)) {
    points += 2;
    if (shapeOf(target) !== "round") shares.push(`${shapeOf(target)} case`);
  }
  if (
    target.designTraits?.strap === "integrated_bracelet" &&
    candidate.designTraits?.strap === "integrated_bracelet"
  ) {
    points += 2;
  } else if (target.designTraits?.strap === "integrated_bracelet") {
    differs.push("no integrated bracelet");
  }
  // A diving bezel the original lacks makes it a different watch to wear.
  if (!has(target, "dive_bezel") && has(candidate, "dive_bezel")) {
    points -= 1;
    differs.push("adds a diving bezel");
  }
  // Date or no date.
  if (has(target, "date") === has(candidate, "date")) {
    points += 1;
    shares.push(has(target, "date") ? "date" : "no date");
  }
  if (
    candidate.movement &&
    target.movement &&
    candidate.movement !== target.movement
  ) {
    differs.push(`${candidate.movement.replaceAll("_", " ")} movement`);
  }
  return { points, shares, differs };
}

/** Same-brand alternatives must look at least this alike (share of max). */
export const SAME_BRAND_MIN_LOOK = 0.55;

// ---------------------------------------------------------------------------
// Price: new, or pre-owned from established dealers

export type AlternativePrice =
  | { condition: "new"; amount: number; currency: string }
  | {
      condition: "pre-owned";
      amount: number;
      low: number;
      high: number;
      currency: string;
    };

export function priceInWindow(
  watch: CatalogueWatch,
  window: ReturnType<typeof budgetWindow>,
  fx: FxTable | null,
): AlternativePrice | null {
  const within = (amount: number) =>
    amount >= window.minimum &&
    (window.maximum === null || amount <= window.maximum);
  const fresh = priceIn(watch, window.currency, fx);
  if (fresh !== null && within(fresh)) {
    return { condition: "new", amount: fresh, currency: window.currency };
  }
  const used = watch.preownedPrice;
  if (used && fx) {
    const median = convert(used.median, used.currency, window.currency, fx);
    const low = convert(used.low, used.currency, window.currency, fx);
    const high = convert(used.high, used.currency, window.currency, fx);
    if (median !== null && low !== null && high !== null && within(median)) {
      return {
        condition: "pre-owned",
        amount: median,
        low,
        high,
        currency: window.currency,
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Ranking

export type Alternative = {
  watch: CatalogueWatch;
  price: AlternativePrice;
  points: number;
  shares: string[];
  differs: string[];
};

export function rankAlternatives(
  target: CatalogueWatch,
  catalogue: readonly CatalogueWatch[],
  budget: AlternativesBudget,
  allowQuartz: boolean,
  fx: FxTable | null,
  limit = 10,
): Alternative[] {
  const window = budgetWindow(budget);
  const ranked = catalogue.flatMap((candidate): Alternative[] => {
    if (
      candidate.id === target.id ||
      candidate.reviewStatus === "rejected" ||
      strictFailures(target, candidate, allowQuartz).length > 0
    ) {
      return [];
    }
    const price = priceInWindow(candidate, window, fx);
    if (!price) return [];
    const look = lookScore(target, candidate);
    // Around a typed price, nearer is better: up to one point.
    if (budget.kind === "exact") {
      const distance =
        Math.abs(price.amount - budget.amount) / EXACT_PRICE_SPREAD;
      look.points += Math.max(0, 1 - distance);
    }
    const sameBrand =
      candidate.brand.trim().toLowerCase() ===
      target.brand.trim().toLowerCase();
    if (sameBrand && look.points < SAME_BRAND_MIN_LOOK * MAX_LOOK_POINTS)
      return [];
    return [{ watch: candidate, price, ...look }];
  });
  ranked.sort(
    (a, b) =>
      b.points - a.points ||
      Number(b.watch.referenceConfirmed) - Number(a.watch.referenceConfirmed) ||
      a.price.amount - b.price.amount,
  );
  // At most two per brand, so one maker can't fill the list.
  const perBrand = new Map<string, number>();
  return ranked
    .filter((entry) => {
      const brand = entry.watch.brand.toLowerCase();
      const count = perBrand.get(brand) ?? 0;
      perBrand.set(brand, count + 1);
      return count < 2;
    })
    .slice(0, limit);
}
