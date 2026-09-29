/**
 * Hard rules applied in code to every quiz candidate the search returns.
 * A fact the search could not establish fails its rule rather than passing
 * it: an unknown water resistance does not satisfy a 100 m minimum.
 */

import type { SourceKind } from "./ai-watch-types";

export type { SourceKind };

// Authorised-dealer groups selling new watches; marketplaces and grey
// dealers are deliberately absent.
const AUTHORISED_RETAILER_HOSTS = [
  "watchesofswitzerland.com",
  "watches-of-switzerland.co.uk",
  "mayors.com",
  "goldsmiths.co.uk",
  "ernestjones.co.uk",
  "beaverbrooks.co.uk",
  "fraserhart.co.uk",
  "bucherer.com",
  "tourneau.com",
  "wempe.com",
  "wempe.de",
  "beyer-ch.com",
  "beyer.ch",
  "christ.de",
  "huebner.de",
  "kirchhofer.com",
  "gubelin.com",
  "ethoswatches.com",
  "thewatchgallery.com",
  "bensimon.com",
  "shop.hodinkee.com",
];

const BRAND_STOPWORDS = new Set(["watch", "watches", "company", "and", "the", "de"]);

function hostOf(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function fold(value: string) {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** The brand's own site (by domain) or an authorised retailer, else null. */
export function classifySource(url: string | null, brand: string): SourceKind | null {
  if (!url) return null;
  const host = hostOf(url);
  if (!host) return null;
  if (
    AUTHORISED_RETAILER_HOSTS.some(
      (retailer) => host === retailer || host.endsWith(`.${retailer}`),
    )
  ) {
    return "retailer";
  }
  const hostLabel = fold(host.split(".").slice(0, -1).join(""));
  const words = brand
    .split(/[\s&.\-']+/)
    .map(fold)
    .filter((word) => word.length >= 4 && !BRAND_STOPWORDS.has(word));
  const whole = fold(brand);
  if (whole.length >= 3 && hostLabel.startsWith(whole)) return "manufacturer";
  return words.some((word) => hostLabel.includes(word)) ? "manufacturer" : null;
}

export function normalizeReference(value: string | null | undefined) {
  const folded = value?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  return folded.length >= 3 ? folded : null;
}

/** True when the reference appears in the page text or its URL. */
export function pageMentionsReference(
  reference: string | null,
  pageText: string,
  url: string,
) {
  const needle = normalizeReference(reference);
  if (!needle) return false;
  const haystack = `${url} ${pageText}`.toLowerCase().replace(/[^a-z0-9]/g, "");
  return haystack.includes(needle);
}

export function meetsWaterResistance(
  minimumM: number,
  waterResistanceM: number | null,
) {
  if (minimumM <= 0) return true;
  return waterResistanceM !== null && waterResistanceM >= minimumM;
}

export function fitsDiameter(
  range: { minimumMm: number; maximumMm: number },
  caseDiameterMm: number | null,
) {
  if (caseDiameterMm === null) return false;
  // Published diameters are often rounded to the nearest half millimetre.
  return (
    caseDiameterMm >= range.minimumMm - 0.5 && caseDiameterMm <= range.maximumMm + 0.5
  );
}

export function fitsPrice(
  range: { minimum: number; maximum: number | null },
  priceInBudgetCurrency: number | null,
) {
  if (priceInBudgetCurrency === null || !Number.isFinite(priceInBudgetCurrency)) {
    return false;
  }
  return (
    priceInBudgetCurrency >= range.minimum &&
    (range.maximum === null || priceInBudgetCurrency <= range.maximum)
  );
}

const MOVEMENT_ALIASES: Record<string, string> = {
  automatic: "automatic",
  selfwinding: "automatic",
  autowinding: "automatic",
  manual: "manual",
  handwound: "manual",
  manualwinding: "manual",
  mechanicalhandwound: "manual",
  quartz: "quartz",
  solar: "solar",
  solarquartz: "solar",
  ecodrive: "solar",
  springdrive: "spring_drive",
  hybrid: "hybrid",
  smart: "hybrid",
};

export function normalizeMovement(value: string | null) {
  if (!value) return null;
  const folded = fold(value);
  if (MOVEMENT_ALIASES[folded]) return MOVEMENT_ALIASES[folded]!;
  const found = Object.keys(MOVEMENT_ALIASES).find((alias) => folded.includes(alias));
  return found ? MOVEMENT_ALIASES[found]! : null;
}

export function allowedMovement(allowed: readonly string[], value: string | null) {
  const movement = normalizeMovement(value);
  return movement !== null && allowed.includes(movement);
}

const NICKEL_RISK = /steel|inox|316|904|nickel|brass|alloy|plated|silver/;
const METAL_SAFE = /titanium|ceramic|gold|platinum|carbon|sapphire/;
const STRAP_SAFE =
  /leather|rubber|silicone|fkm|textile|fabric|nylon|canvas|alligator|calf|velcro|titanium|ceramic|gold|platinum/;

/**
 * Owner's rule for a nickel allergy: no steel may touch the skin. The case
 * back (or the case, when the back is not stated separately) must be a
 * nickel-free metal, and the strap or bracelet must be a nickel-free
 * material. Any unknown material fails.
 */
export function nickelSafe(materials: {
  case: string | null;
  caseback: string | null;
  strap: string | null;
}) {
  const back = (materials.caseback ?? materials.case)?.toLowerCase() ?? null;
  const strap = materials.strap?.toLowerCase() ?? null;
  if (!back || !strap) return false;
  if (NICKEL_RISK.test(back) || !METAL_SAFE.test(back)) return false;
  if (NICKEL_RISK.test(strap) || !STRAP_SAFE.test(strap)) return false;
  return true;
}
