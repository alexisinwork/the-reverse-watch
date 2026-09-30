/**
 * The watch catalogue: individual watches with checked facts and a review
 * status (migration 0071). Quiz answers are filtered from it in code; a
 * fact the catalogue does not hold never satisfies an active filter.
 */
import { z } from "zod";

import {
  allowedMovement,
  fitsDiameter,
  fitsPrice,
  meetsWaterResistance,
  nickelSafe,
  normalizeReference,
} from "./ai-watch-guardrails";
import type { FoundWatch } from "./ai-watch-types";
import { convert, type FxTable } from "./fx";
import {
  caseDiameterForWrist,
  diameterRangeFor,
  findPriceRange,
  WRIST_CM_MAX,
  WRIST_CM_MIN,
  type PriceRange,
  type ProfileV4,
} from "./questionnaire-v4";

export const CATALOGUE_STYLES = [
  "dress",
  "everyday",
  "sport",
  "dive",
  "field",
  "travel",
] as const;
export type CatalogueStyle = (typeof CATALOGUE_STYLES)[number];

export const STYLE_LABELS: Record<CatalogueStyle, string> = {
  dress: "Dress",
  everyday: "Everyday",
  sport: "Sport",
  dive: "Dive",
  field: "Field",
  travel: "Travel",
};

/** Plain description of each wearing style, used in search prompts. */
export const STYLE_BRIEFS: Record<CatalogueStyle, string> = {
  dress:
    "dress and formal wear: suits, evening, black tie; slim and understated",
  everyday:
    "everyday and office wear: versatile, works with a shirt cuff and at the weekend",
  sport:
    "sport and active wear: robust, sporty, often on a bracelet or rubber strap",
  dive: "diving and water: a proper dive watch or water-sports watch with high water resistance",
  field:
    "field and outdoor use: legible, rugged, military-field or expedition style",
  travel:
    "travel: a second time zone (GMT, dual time or world time), pilot and aviation watches",
};

// Quiz wearing scenarios (catalogue vocabulary slugs) to wearing styles.
const SCENARIO_STYLES: Record<string, CatalogueStyle[]> = {
  everyday: ["everyday"],
  office: ["everyday", "dress"],
  business: ["everyday", "dress"],
  boardroom: ["dress", "everyday"],
  negotiation: ["dress", "everyday"],
  executive: ["dress", "everyday"],
  smart_casual: ["everyday"],
  sport_chic: ["sport", "everyday"],
  suit: ["dress"],
  black_tie: ["dress"],
  evening: ["dress"],
  gala: ["dress"],
  reception: ["dress"],
  high_society: ["dress"],
  club: ["dress", "everyday"],
  private_club: ["dress"],
  cocktail: ["dress"],
  theatre: ["dress"],
  status: ["dress", "everyday"],
  collection: ["dress", "everyday"],
  auction: ["dress"],
  art: ["dress", "everyday"],
  weekend: ["everyday", "sport"],
  leisure: ["everyday", "sport"],
  sport: ["sport"],
  motorsport: ["sport"],
  field: ["field"],
  expedition: ["field"],
  caving: ["field"],
  extreme: ["field", "sport"],
  diving: ["dive"],
  professional_diving: ["dive"],
  deep_sea_diving: ["dive"],
  marine_sport: ["dive", "sport"],
  sailing: ["dive", "sport"],
  regatta: ["sport", "dive"],
  yachting: ["dive", "sport"],
  beach: ["dive"],
  resort: ["dive", "everyday"],
  travel: ["travel"],
  business_travel: ["travel", "everyday"],
  flights: ["travel"],
  aviation: ["travel"],
  laboratory: ["everyday"],
};

export function stylesForScenarios(
  scenarios: readonly string[],
): CatalogueStyle[] {
  const styles = new Set<CatalogueStyle>();
  for (const scenario of scenarios) {
    for (const style of SCENARIO_STYLES[scenario] ?? ["everyday"])
      styles.add(style);
  }
  return CATALOGUE_STYLES.filter((style) => styles.has(style));
}

/** The price ranges the catalogue build covers: everything up to 10k. */
export const CATALOGUE_MAX_PRICE = 10_000;

export function catalogueCoversRange(range: PriceRange) {
  return range.maximum !== null && range.maximum <= CATALOGUE_MAX_PRICE;
}

function fold(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** One row per brand and reference, or brand and model when no reference. */
export function catalogueIdentityKey(
  brand: string,
  model: string,
  referenceCode: string | null,
) {
  const reference = normalizeReference(referenceCode);
  return `${fold(brand)}|${reference ? `r:${reference}` : `m:${fold(model)}`}`;
}

const nullableNumber = z
  .union([z.number(), z.string()])
  .nullable()
  .transform((value) => (value === null ? null : Number(value)))
  .pipe(z.number().finite().nullable());

export const catalogueWatchSchema = z.object({
  id: z.string(),
  identityKey: z.string(),
  brand: z.string(),
  model: z.string(),
  referenceCode: z.string().nullable(),
  referenceConfirmed: z.boolean(),
  styles: z.array(z.enum(CATALOGUE_STYLES)),
  caseDiameterMm: nullableNumber,
  caseThicknessMm: nullableNumber,
  caseShape: z.string().nullable(),
  waterResistanceM: nullableNumber,
  movement: z.string().nullable(),
  inHouseCalibre: z.boolean().nullable(),
  crystal: z.string().nullable(),
  displayCaseback: z.boolean().nullable(),
  complications: z.array(z.string()),
  caseMaterial: z.string().nullable(),
  casebackMaterial: z.string().nullable(),
  strapMaterial: z.string().nullable(),
  priceAmount: nullableNumber,
  priceCurrency: z.string().nullable(),
  /**
   * confirmed: two independent retail lookups agree within 5%.
   * approximate: a market price from new or unworn listings (Chrono24 or
   * other dealers) where no retail price could be confirmed.
   */
  priceStatus: z.enum(["confirmed", "approximate", "unconfirmed"]),
  priceCheckedAt: z.string().nullable(),
  priceEvidence: z.record(z.string(), z.unknown()),
  priceChange: z
    .object({
      amount: z.number(),
      currency: z.string(),
      foundAt: z.string().optional(),
    })
    .passthrough()
    .nullable(),
  sourceUrl: z.string().nullable(),
  sourceKind: z.enum(["manufacturer", "retailer"]).nullable(),
  imageUrl: z.string().nullable(),
  rationale: z.string().nullable(),
  foundIn: z.array(z.unknown()),
  reviewStatus: z.enum(["pending", "approved", "rejected"]),
  reviewedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CatalogueWatch = z.infer<typeof catalogueWatchSchema>;

/** The confirmed price in the given currency, or null when unknown. */
export function priceIn(
  watch: CatalogueWatch,
  currency: string,
  fx: FxTable | null,
) {
  // Both confirmed retail and approximate market prices place a watch in a
  // price range; visitors are told every price is approximate.
  if (
    watch.priceStatus === "unconfirmed" ||
    watch.priceAmount === null ||
    !watch.priceCurrency
  ) {
    return null;
  }
  if (watch.priceCurrency === currency) return watch.priceAmount;
  return fx
    ? convert(watch.priceAmount, watch.priceCurrency, currency, fx)
    : null;
}

/** Every quiz rule the watch breaks; empty means it fits every answer. */
export function catalogueRuleFailures(
  watch: CatalogueWatch,
  profile: ProfileV4,
  fx: FxTable | null,
) {
  const range = findPriceRange(profile.priceRange)!;
  const failures: string[] = [];
  const wanted = stylesForScenarios(profile.wearingScenarios);
  if (!watch.styles.some((style) => wanted.includes(style)))
    failures.push("style");
  if (!fitsPrice(range, priceIn(watch, profile.budgetCurrency, fx)))
    failures.push("price");
  if (!fitsDiameter(diameterRangeFor(profile), watch.caseDiameterMm))
    failures.push("diameter");
  if (
    !meetsWaterResistance(
      profile.minimumWaterResistanceM,
      watch.waterResistanceM,
    )
  ) {
    failures.push("water_resistance");
  }
  if (!allowedMovement(profile.movementTypes, watch.movement))
    failures.push("movement");
  if (
    profile.allergyConstraint === "nickel_contact" &&
    !nickelSafe({
      case: watch.caseMaterial,
      caseback: watch.casebackMaterial,
      strap: watch.strapMaterial,
    })
  ) {
    failures.push("nickel");
  }
  if (
    !profile.requiredComplications.every((slug) =>
      watch.complications.includes(slug),
    )
  ) {
    failures.push("complications");
  }
  if (
    profile.maxCaseThicknessMm !== undefined &&
    (watch.caseThicknessMm === null ||
      watch.caseThicknessMm > profile.maxCaseThicknessMm)
  ) {
    failures.push("thickness");
  }
  if (
    profile.caseShape !== undefined &&
    watch.caseShape !== profile.caseShape
  ) {
    failures.push("case_shape");
  }
  if (profile.crystal !== undefined && watch.crystal !== profile.crystal)
    failures.push("crystal");
  if (
    profile.displayCaseback !== undefined &&
    watch.displayCaseback !== profile.displayCaseback
  ) {
    failures.push("caseback");
  }
  if (
    profile.movementConstruction !== undefined &&
    watch.inHouseCalibre !== (profile.movementConstruction === "manufacture")
  ) {
    failures.push("calibre");
  }
  // The catalogue does not record clasps, so a clasp requirement can only
  // be met by the live search.
  if (profile.microAdjustmentRequired !== undefined) failures.push("clasp");
  return failures;
}

const MOVEMENT_WORDS: Record<string, string> = {
  automatic: "automatic",
  manual: "hand-wound",
  quartz: "quartz",
  solar: "solar",
  spring_drive: "Spring Drive",
  hybrid: "hybrid",
};

function factsLine(watch: CatalogueWatch) {
  const parts = [
    watch.caseDiameterMm !== null ? `${watch.caseDiameterMm} mm` : null,
    watch.movement ? (MOVEMENT_WORDS[watch.movement] ?? watch.movement) : null,
    watch.waterResistanceM !== null
      ? `${watch.waterResistanceM} m water resistance`
      : null,
  ].filter(Boolean);
  return parts.length > 0
    ? `${parts.join(", ")}.`
    : "Meets every stated constraint.";
}

export function catalogueToFoundWatch(
  watch: CatalogueWatch,
): FoundWatch | null {
  const sourceUrl = watch.sourceUrl;
  if (!sourceUrl) return null;
  const knownPrice =
    watch.priceStatus !== "unconfirmed" &&
    watch.priceAmount !== null &&
    watch.priceCurrency
      ? { amount: watch.priceAmount, currency: watch.priceCurrency }
      : null;
  return {
    brand: watch.brand,
    model: watch.model,
    referenceCode: watch.referenceCode,
    sourceUrl,
    imageUrl: watch.imageUrl,
    priceNote: knownPrice
      ? `${knownPrice.currency} ${Math.round(knownPrice.amount).toLocaleString("en")}`
      : null,
    rationale: watch.rationale ?? factsLine(watch),
    details: {
      price: knownPrice,
      priceConfirmed: watch.priceStatus === "confirmed",
      waterResistanceM: watch.waterResistanceM,
      caseDiameterMm: watch.caseDiameterMm,
      movement: watch.movement,
      materials: {
        case: watch.caseMaterial,
        caseback: watch.casebackMaterial,
        strap: watch.strapMaterial,
      },
      ...(watch.sourceKind ? { sourceKind: watch.sourceKind } : {}),
      referenceVerified: watch.referenceConfirmed,
      reviewStatus: watch.reviewStatus,
    },
  };
}

/** Reviewed watches first, then round-robin by brand for variety. */
function pick(
  watches: CatalogueWatch[],
  limit: number,
  wanted: CatalogueStyle[],
) {
  const score = (watch: CatalogueWatch) =>
    (watch.reviewStatus === "approved" ? 100 : 0) +
    watch.styles.filter((style) => wanted.includes(style)).length * 10 +
    (watch.imageUrl ? 1 : 0);
  const ordered = [...watches].sort(
    (a, b) =>
      score(b) - score(a) ||
      a.brand.localeCompare(b.brand) ||
      a.model.localeCompare(b.model),
  );
  const byBrand = new Map<string, CatalogueWatch[]>();
  for (const watch of ordered) {
    const brand = fold(watch.brand);
    byBrand.set(brand, [...(byBrand.get(brand) ?? []), watch]);
  }
  const result: CatalogueWatch[] = [];
  for (let round = 0; result.length < limit; round += 1) {
    let added = false;
    for (const group of byBrand.values()) {
      const watch = group[round];
      if (!watch) continue;
      added = true;
      result.push(watch);
      if (result.length === limit) break;
    }
    if (!added) break;
  }
  return result;
}

export const CATALOGUE_MAIN_LIMIT = 5;
export const CATALOGUE_ALSO_LIMIT = 3;

/**
 * Main picks have their reference confirmed on a maker's or authorised
 * retailer's page; "also worth a look" picks fit every answer too, but
 * their reference is not confirmed.
 */
export function matchCatalogue(
  watches: readonly CatalogueWatch[],
  profile: ProfileV4,
  fx: FxTable | null,
) {
  const wanted = stylesForScenarios(profile.wearingScenarios);
  const eligible = watches.filter(
    (watch) =>
      watch.reviewStatus !== "rejected" &&
      watch.sourceUrl !== null &&
      catalogueRuleFailures(watch, profile, fx).length === 0,
  );
  return {
    main: pick(
      eligible.filter((watch) => watch.referenceConfirmed),
      CATALOGUE_MAIN_LIMIT,
      wanted,
    ),
    alsoWorth: pick(
      eligible.filter((watch) => !watch.referenceConfirmed),
      CATALOGUE_ALSO_LIMIT,
      wanted,
    ),
  };
}

/**
 * The last resort when nothing fits every answer and the live search is
 * down: catalogue watches in the visitor's price range that break the
 * fewest other answers. Price is never relaxed.
 */
export function closestCatalogue(
  watches: readonly CatalogueWatch[],
  profile: ProfileV4,
  fx: FxTable | null,
  limit = CATALOGUE_MAIN_LIMIT,
) {
  const wanted = stylesForScenarios(profile.wearingScenarios);
  const scored = watches.flatMap((watch) => {
    if (watch.reviewStatus === "rejected" || watch.sourceUrl === null)
      return [];
    const failures = catalogueRuleFailures(watch, profile, fx);
    return failures.includes("price")
      ? []
      : [{ watch, misses: failures.length }];
  });
  const fewest = Math.min(...scored.map((entry) => entry.misses));
  // Only the best tier, so a two-rule miss never sits above a one-rule miss.
  return pick(
    scored
      .filter((entry) => entry.misses <= fewest + 1)
      .sort((a, b) => a.misses - b.misses)
      .slice(0, 60)
      .map((entry) => entry.watch),
    limit,
    wanted,
  );
}

/** Wrist sizes (cm) whose suggested diameter range includes this case. */
export function wristFit(caseDiameterMm: number | null) {
  if (caseDiameterMm === null) return null;
  const fits: number[] = [];
  for (let wrist = WRIST_CM_MIN; wrist <= WRIST_CM_MAX; wrist += 0.5) {
    if (fitsDiameter(caseDiameterForWrist(wrist), caseDiameterMm))
      fits.push(wrist);
  }
  if (fits.length === 0) return null;
  const low = fits[0]!;
  const high = fits[fits.length - 1]!;
  return {
    minimumCm: low,
    maximumCm: high === WRIST_CM_MAX ? null : high + 0.5,
  };
}

export function wristFitLabel(caseDiameterMm: number | null) {
  const fit = wristFit(caseDiameterMm);
  if (!fit) return "unknown";
  return fit.maximumCm === null
    ? `${fit.minimumCm} cm and up`
    : `${fit.minimumCm}–${fit.maximumCm} cm`;
}
