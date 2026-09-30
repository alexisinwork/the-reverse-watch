/**
 * Filling the catalogue: one search per (price range, wearing style, run).
 * Muse Spark or Perplexity proposes watches; each new one is grounded on a
 * manufacturer or authorised-retailer page that shows its reference, its
 * price is double-checked through Perplexity, and its photo URL is kept.
 * Only search constraints are ever sent to either provider.
 */
import {
  inspectSourcePage,
  safeHttpUrl,
  verifyImageUrl,
} from "./source-pages.server";
import {
  findPages,
  museJson,
  webResearchJson,
  type Deps,
} from "./ai-providers.server";
import {
  classifySource,
  normalizeMovement,
  normalizeReference,
} from "./ai-watch-guardrails";
import { convert, type FxTable } from "./fx";
import {
  doublePriceCheck,
  priceDifference,
  PRICE_TOLERANCE,
} from "./price-check.server";
import { lookupMarketPrice } from "./market-price.server";
import type { PriceRange } from "./questionnaire-v4";
import {
  CATALOGUE_STYLES,
  catalogueIdentityKey,
  STYLE_BRIEFS,
  type CatalogueStyle,
  type CatalogueWatch,
} from "./watch-catalogue";
import type { CatalogueEntry, PriceRecord } from "./watch-catalogue.server";

export type BuildCell = {
  range: PriceRange;
  style: CatalogueStyle;
  run: number;
  /** Gap-filling searches ask for one specific kind of watch. */
  gap?: CatalogueGap;
};

/**
 * Kinds of watch the first build rarely found (measured 2026-09-30: most
 * quiz answers that fell back to a live search asked for one of these).
 */
export type CatalogueGap = {
  id: string;
  text: string;
  styles: CatalogueStyle[];
  fits: (candidate: BuildCandidate) => boolean;
};

export const CATALOGUE_GAPS: CatalogueGap[] = [
  {
    id: "quartz_solar",
    text: "quartz or solar movement only (no mechanical watches)",
    styles: ["dress", "everyday", "sport", "dive", "field", "travel"],
    fits: (candidate) =>
      candidate.movement === "quartz" || candidate.movement === "solar",
  },
  {
    id: "water_200",
    text: "water resistance of at least 200 m",
    styles: ["dive", "sport", "field"],
    fits: (candidate) => (candidate.waterResistanceM ?? 0) >= 200,
  },
  {
    id: "water_300",
    text: "water resistance of at least 300 m (a proper diver)",
    styles: ["dive"],
    fits: (candidate) => (candidate.waterResistanceM ?? 0) >= 300,
  },
  {
    id: "small_case",
    text: "a small case, 34 to 38 mm in diameter, for a slim wrist",
    styles: ["dress", "everyday", "sport"],
    fits: (candidate) =>
      candidate.caseDiameterMm !== null &&
      candidate.caseDiameterMm >= 33.5 &&
      candidate.caseDiameterMm <= 38.5,
  },
  {
    id: "large_case",
    text: "a large case, 44 to 46 mm in diameter, for a large wrist",
    styles: ["sport", "dive", "field"],
    fits: (candidate) =>
      candidate.caseDiameterMm !== null &&
      candidate.caseDiameterMm >= 43.5 &&
      candidate.caseDiameterMm <= 46.5,
  },
];

export const BUILD_RUNS = 10;

/** Each run looks from a different angle so the ten runs do not repeat. */
export const RUN_FOCUS: { provider: "muse" | "web"; text: string }[] = [
  { provider: "muse", text: "Focus on established Swiss brands." },
  { provider: "muse", text: "Focus on Japanese brands." },
  { provider: "muse", text: "Focus on German and Austrian brands." },
  {
    provider: "muse",
    text: "Focus on independent brands and well-regarded microbrands.",
  },
  { provider: "muse", text: "Focus on British, American and Nordic brands." },
  {
    provider: "muse",
    text: "Focus on French, Italian and other European brands.",
  },
  { provider: "web", text: "Favour releases from the last two years." },
  {
    provider: "muse",
    text: "Focus on the best-known, most widely recommended classics.",
  },
  {
    provider: "muse",
    text: "Focus on lesser-known heritage brands and overlooked models.",
  },
  {
    provider: "web",
    text: "Favour models that authorised retailers currently stock and recommend.",
  },
];

const BUILD_FIELDS =
  '{"candidates":[{"brand","model","referenceCode","priceAmount","priceCurrency","caseDiameterMm","caseThicknessMm","caseShape","waterResistanceM","movementType","inHouseCalibre","crystal","displayCaseback","complications","caseMaterial","casebackMaterial","strapMaterial","styles","manufacturerUrl","why"}]}';

export const COMPLICATION_SLUGS = [
  "date",
  "pointer_date",
  "day_of_week",
  "annual_calendar",
  "moonphase",
  "small_seconds",
  "gmt",
  "day_night_indicator",
  "bezel_24h",
  "dive_bezel",
  "sixty_minute_bezel",
  "chronograph",
  "tachymeter",
  "flyback",
  "regatta_timer",
  "helium_valve",
  "antimagnetic_shield",
  "power_reserve",
  "alarm",
  "world_time",
  "perpetual_calendar",
] as const;

const BUILD_SYSTEM = [
  "You are the senior watch buyer of The Reserve, building a catalogue of current-production wristwatches.",
  "You receive a price range, a wearing style and a focus, and propose specific current-production references that suit that style and whose current official new retail price is inside the range.",
  "Give the exact manufacturer reference number of one specific configuration, its current official new retail price (priceAmount with ISO priceCurrency, US dollars where the brand publishes them), case diameter and thickness in mm, case shape (round, tonneau, rectangular, cushion, square or oval), water resistance in metres, movement type (automatic, manual, quartz, solar, spring_drive or hybrid), whether the calibre is in-house (inHouseCalibre), crystal (sapphire, mineral, acrylic or other), whether the case back is a display back, the case, case-back and strap or bracelet materials, and the official product page URL (manufacturerUrl).",
  `complications is a list using only these words: ${COMPLICATION_SLUGS.join(", ")}.`,
  `styles is every wearing style it genuinely suits, using only: ${CATALOGUE_STYLES.join(", ")}.`,
  "Use null for any fact you are not sure of rather than guessing. Never invent a reference.",
  "why is one plain-English sentence on why it suits the style.",
  `Respond only with JSON: ${BUILD_FIELDS}.`,
].join(" ");

function stringOrNull(key: string) {
  return [key, { type: ["string", "null"] }] as const;
}
function numberOrNull(key: string) {
  return [key, { type: ["number", "null"] }] as const;
}

const buildCandidateSchema = {
  type: "object",
  properties: {
    candidates: {
      type: "array",
      items: {
        type: "object",
        properties: Object.fromEntries<unknown>([
          ["brand", { type: "string" }],
          ["model", { type: "string" }],
          ...[
            "referenceCode",
            "priceCurrency",
            "caseShape",
            "movementType",
            "crystal",
            "caseMaterial",
            "casebackMaterial",
            "strapMaterial",
            "manufacturerUrl",
            "why",
          ].map(stringOrNull),
          ...[
            "priceAmount",
            "caseDiameterMm",
            "caseThicknessMm",
            "waterResistanceM",
          ].map(numberOrNull),
          ["inHouseCalibre", { type: ["boolean", "null"] }],
          ["displayCaseback", { type: ["boolean", "null"] }],
          ["complications", { type: "array", items: { type: "string" } }],
          ["styles", { type: "array", items: { type: "string" } }],
        ]),
        required: ["brand", "model"],
      },
    },
  },
  required: ["candidates"],
};

function money(amount: number) {
  return `USD ${Math.round(amount).toLocaleString("en")}`;
}

export function cellPrompt(cell: BuildCell, exclude: string[]) {
  const focus = RUN_FOCUS[(cell.run - 1) % RUN_FOCUS.length]!;
  return [
    `Propose 6 candidates. ${focus.text}`,
    `Price range: new retail price between ${money(cell.range.minimum)} and ${money(cell.range.maximum!)}.`,
    `Wearing style: ${STYLE_BRIEFS[cell.style]}.`,
    cell.gap
      ? `Hard requirement: ${cell.gap.text}. Every watch you propose must meet it.`
      : "",
    exclude.length > 0
      ? `Already in the catalogue for this range and style; propose different watches: ${exclude.slice(0, 60).join("; ")}.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function proposeForCell(
  cell: BuildCell,
  exclude: string[],
  deps: Deps,
): Promise<unknown[]> {
  const focus = RUN_FOCUS[(cell.run - 1) % RUN_FOCUS.length]!;
  const prompt = cellPrompt(cell, exclude);
  if (focus.provider === "muse") {
    const payload = (await museJson(
      BUILD_SYSTEM,
      prompt,
      "reserve-catalogue-build-v1",
      deps,
      120_000,
      // The full model with a long "already found" list can spend 4,000
      // tokens reasoning and return nothing.
      12_000,
    )) as {
      candidates?: unknown;
    };
    return Array.isArray(payload.candidates)
      ? (payload.candidates as unknown[])
      : [];
  }
  const payload = (await webResearchJson(prompt, buildCandidateSchema, deps, {
    system: BUILD_SYSTEM,
    maxToolCalls: 6,
  })) as { candidates?: unknown };
  return Array.isArray(payload.candidates)
    ? (payload.candidates as unknown[])
    : [];
}

export type BuildCandidate = {
  brand: string;
  model: string;
  referenceCode: string | null;
  price: { amount: number; currency: string } | null;
  caseDiameterMm: number | null;
  caseThicknessMm: number | null;
  caseShape: string | null;
  waterResistanceM: number | null;
  movement: string | null;
  inHouseCalibre: boolean | null;
  crystal: string | null;
  displayCaseback: boolean | null;
  complications: string[];
  caseMaterial: string | null;
  casebackMaterial: string | null;
  strapMaterial: string | null;
  styles: CatalogueStyle[];
  manufacturerUrl: string | null;
  why: string | null;
};

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function num(value: unknown, min: number, max: number) {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
    ? value
    : null;
}
function bool(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

const VAGUE = /\b(unknown|unidentified|unspecified|various|n\/a|tbd)\b/i;
const SHAPES = new Set([
  "round",
  "tonneau",
  "rectangular",
  "cushion",
  "square",
  "oval",
]);
const CRYSTALS = new Set(["sapphire", "mineral", "acrylic", "other"]);

export function readBuildCandidate(raw: unknown): BuildCandidate | null {
  const item = (raw ?? {}) as Record<string, unknown>;
  const brand = text(item.brand);
  const model = text(item.model);
  if (!brand || !model || VAGUE.test(`${brand} ${model}`)) return null;
  const amount = num(item.priceAmount, 1, 10_000_000);
  const currency = text(item.priceCurrency)?.toUpperCase().slice(0, 3) ?? null;
  const shape = text(item.caseShape)?.toLowerCase() ?? null;
  const crystal = text(item.crystal)?.toLowerCase() ?? null;
  const list = (value: unknown) =>
    Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === "string")
      : [];
  return {
    brand,
    model,
    referenceCode: text(item.referenceCode),
    price:
      amount !== null && currency && /^[A-Z]{3}$/.test(currency)
        ? { amount, currency }
        : null,
    caseDiameterMm: num(item.caseDiameterMm, 15, 70),
    caseThicknessMm: num(item.caseThicknessMm, 2, 40),
    caseShape: shape && SHAPES.has(shape) ? shape : null,
    waterResistanceM: num(item.waterResistanceM, 0, 20_000),
    movement: normalizeMovement(text(item.movementType)),
    inHouseCalibre: bool(item.inHouseCalibre),
    crystal: crystal && CRYSTALS.has(crystal) ? crystal : null,
    displayCaseback: bool(item.displayCaseback),
    complications: list(item.complications).filter((slug): slug is string =>
      (COMPLICATION_SLUGS as readonly string[]).includes(slug),
    ),
    caseMaterial: text(item.caseMaterial),
    casebackMaterial: text(item.casebackMaterial),
    strapMaterial: text(item.strapMaterial),
    styles: list(item.styles)
      .map((style) => style.toLowerCase())
      .filter((style): style is CatalogueStyle =>
        (CATALOGUE_STYLES as readonly string[]).includes(style),
      ),
    manufacturerUrl: safeHttpUrl(text(item.manufacturerUrl)),
    why: text(item.why),
  };
}

/** The proposal's own price, in USD, sits inside the cell's range (±5%). */
export function proposedPriceFits(
  candidate: BuildCandidate,
  range: PriceRange,
  fx: FxTable | null,
) {
  if (!candidate.price) return false;
  const usd =
    candidate.price.currency === "USD"
      ? candidate.price.amount
      : fx
        ? convert(candidate.price.amount, candidate.price.currency, "USD", fx)
        : null;
  if (usd === null) return false;
  return usd >= range.minimum * 0.95 && usd <= range.maximum! * 1.05;
}

export function candidateIdentity(candidate: {
  brand: string;
  model: string;
  referenceCode: string | null;
}) {
  return catalogueIdentityKey(
    candidate.brand,
    candidate.model,
    candidate.referenceCode,
  );
}

async function firstVerifiedImage(
  urls: (string | null)[],
  fetchImpl: typeof fetch,
) {
  for (const url of urls.slice(0, 4)) {
    const verified = await verifyImageUrl(url, fetchImpl);
    if (verified) return verified;
  }
  return null;
}

/**
 * Grounds the reference on a manufacturer or authorised-retailer page,
 * double-checks the price and finds a photo. Returns the catalogue entry.
 */
export async function verifyCandidate(
  candidate: BuildCandidate,
  styles: CatalogueStyle[],
  foundIn: Record<string, unknown>,
  deps: Deps,
  fx: FxTable | null,
): Promise<CatalogueEntry> {
  const reference = normalizeReference(candidate.referenceCode);
  let sourceUrl: string | null = null;
  let sourceKind: "manufacturer" | "retailer" | null = null;
  let referenceConfirmed = false;
  let pageImage: string | null = null;

  const hits = await findPages(
    [`${candidate.brand} ${candidate.referenceCode ?? candidate.model}`],
    deps,
  ).catch(() => []);
  const ranked = [
    candidate.manufacturerUrl,
    ...hits
      .filter((hit) =>
        reference
          ? `${hit.url} ${hit.title} ${hit.snippet}`
              .toLowerCase()
              .replace(/[^a-z0-9]/g, "")
              .includes(reference)
          : true,
      )
      .map((hit) => hit.url),
  ].filter(
    (url, index, all): url is string =>
      url !== null &&
      all.indexOf(url) === index &&
      classifySource(url, candidate.brand) !== null,
  );

  if (reference) {
    for (const url of ranked.slice(0, 3)) {
      const page = await inspectSourcePage(
        url,
        candidate.referenceCode,
        deps.fetchImpl,
      );
      if (!page.referenceFound) continue;
      sourceUrl = url;
      sourceKind = classifySource(url, candidate.brand);
      referenceConfirmed = true;
      pageImage = page.imageUrl;
      break;
    }
  }
  if (!sourceUrl) {
    // Not confirmed: keep the best maker or retailer page as the link.
    const fallback = ranked[0] ?? null;
    if (fallback) {
      const page = await inspectSourcePage(
        fallback,
        candidate.referenceCode,
        deps.fetchImpl,
      );
      if (page.reachable) {
        sourceUrl = fallback;
        sourceKind = classifySource(fallback, candidate.brand);
        pageImage = page.imageUrl;
      }
    }
  }

  const price = await doublePriceCheck(candidate, deps, fx, sourceUrl);
  const imageUrl = await firstVerifiedImage(
    [pageImage, ...price.imageUrls],
    deps.fetchImpl,
  );

  return {
    identityKey: candidateIdentity(candidate),
    brand: candidate.brand,
    model: candidate.model,
    referenceCode: candidate.referenceCode,
    referenceConfirmed,
    styles: [...new Set([...styles, ...candidate.styles])],
    caseDiameterMm: candidate.caseDiameterMm,
    caseThicknessMm: candidate.caseThicknessMm,
    caseShape: candidate.caseShape,
    waterResistanceM: candidate.waterResistanceM,
    movement: candidate.movement,
    inHouseCalibre: candidate.inHouseCalibre,
    crystal: candidate.crystal,
    displayCaseback: candidate.displayCaseback,
    complications: candidate.complications,
    caseMaterial: candidate.caseMaterial,
    casebackMaterial: candidate.casebackMaterial,
    strapMaterial: candidate.strapMaterial,
    priceStatus: price.status,
    priceAmount: price.status === "confirmed" ? price.amount : null,
    priceCurrency: price.status === "confirmed" ? price.currency : null,
    priceCheckedAt: new Date(deps.now()).toISOString(),
    priceEvidence: { ...price.evidence, proposed: candidate.price },
    sourceUrl,
    sourceKind,
    imageUrl,
    rationale: candidate.why,
    foundIn: [foundIn],
  };
}

/** A 90-day recheck of one catalogue watch's price. */
/** The price the search first proposed, in USD, for the market sanity check. */
export function proposedUsd(
  watch: { priceEvidence: Record<string, unknown> },
  fx: FxTable | null,
) {
  const evidence = watch.priceEvidence as {
    proposed?: { amount?: unknown; currency?: unknown } | null;
    observed?: { amount?: unknown; currency?: unknown } | null;
  };
  const price = evidence.proposed ?? evidence.observed;
  if (
    !price ||
    typeof price.amount !== "number" ||
    typeof price.currency !== "string"
  ) {
    return null;
  }
  return price.currency === "USD"
    ? price.amount
    : fx
      ? convert(price.amount, price.currency, "USD", fx)
      : null;
}

export async function recheckPrice(
  watch: CatalogueWatch,
  deps: Deps,
  fx: FxTable | null,
): Promise<PriceRecord> {
  const check = await doublePriceCheck(watch, deps, fx, watch.sourceUrl);
  if (check.status !== "confirmed") {
    // No retail price: a watch with no price at all gets an approximate
    // market price instead; an approximate or confirmed one keeps its own.
    if (watch.priceStatus !== "unconfirmed") return { kind: "unconfirmed" };
    const market = await lookupMarketPrice(
      watch,
      deps,
      fx,
      proposedUsd(watch, fx),
    );
    return market.status === "found"
      ? {
          kind: "approximate",
          amount: market.amount,
          currency: market.currency,
          evidence: market.evidence,
        }
      : { kind: "unconfirmed" };
  }
  if (
    watch.priceStatus !== "confirmed" ||
    watch.priceAmount === null ||
    !watch.priceCurrency
  ) {
    return {
      kind: "confirmed",
      amount: check.amount,
      currency: check.currency,
      evidence: check.evidence,
    };
  }
  const difference = priceDifference(
    { amount: watch.priceAmount, currency: watch.priceCurrency },
    { amount: check.amount, currency: check.currency },
    fx,
  );
  if (difference !== null && difference <= PRICE_TOLERANCE) {
    return { kind: "same", evidence: check.evidence };
  }
  return {
    kind: "changed",
    amount: check.amount,
    currency: check.currency,
    evidence: check.evidence,
  };
}
