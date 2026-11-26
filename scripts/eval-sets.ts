// The labelled sets and answer checks shared by the free evaluation
// (scripts/run-evals.ts) and the paid live round (scripts/run-evals-live.ts),
// so both score exactly the same cases with exactly the same rules. The sets
// are never edited to make a run pass (docs/eval-baseline.md).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  fitsDiameter,
  normalizeMovement,
} from "../app/domain/ai-watch-guardrails";
import type { FoundWatch } from "../app/domain/ai-watch-types";
import { convert, type FxTable } from "../app/domain/fx";
import {
  diameterRangeFor,
  findPriceRange,
  PRICE_RANGES,
  type ProfileV4,
} from "../app/domain/questionnaire-v4";

/** Database functions that only read: the free evaluation (and the live
 * round's dry run) allows these and refuses every other request. */
export const READ_ONLY_RPC: ReadonlySet<string> = new Set([
  "watch_catalogue_quiz_window_v1",
  "watch_catalogue_archetype_window_v1",
  "watch_catalogue_alternatives_window_v1",
  "watch_catalogue_name_index_v1",
  "watch_catalogue_rows_by_id_v1",
  "watch_catalogue_pool_lookup_v1",
  "watch_catalogue_pool_identity_keys_v1",
  "watch_catalogue_unpriced_candidates_v1",
  "watch_catalogue_candidate_lookup_v1",
  "watch_catalogue_named_v1",
  "watch_catalogue_named_v2",
  "watch_catalogue_name_candidates_v2",
  "watch_catalogue_lookup_v1",
  "ai_watch_search_get_v1",
  "ai_watch_validated_cache_get_v2",
  "discovery_published_stories_v1",
]);

// Deterministic sampling, so the same run gives the same answers.
export function random(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export const fold = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export const words = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(
      (word) =>
        word.length > 1 &&
        !["mm", "the", "automatic", "auto", "quartz"].includes(word),
    );

// ---------------------------------------------------------------------------
// Quiz: 40 seeded answers across budgets, currencies, wrists, styles,
// movements and water resistance.

/** The seeded answers; `pick` continues the same random sequence. */
export function seededQuizProfiles(seed = 20261125) {
  const next = random(seed);
  const pick = <T>(values: readonly T[]) =>
    values[Math.floor(next() * values.length)]!;
  const profiles: ProfileV4[] = Array.from({ length: 40 }, () => ({
    version: 4,
    budgetCurrency: pick(["USD", "EUR", "GBP", "CHF"] as const),
    priceRange: pick(
      PRICE_RANGES.filter(
        (range) => range.maximum !== null && range.maximum <= 10_000,
      ),
    ).id,
    wristCm: 15 + Math.round(next() * 50) / 10,
    wearingScenarios: [
      pick(["office", "everyday", "resort", "travel", "sport"]),
    ],
    minimumWaterResistanceM: pick([0, 50, 100, 200]),
    movementTypes: pick([
      ["automatic"],
      ["automatic", "manual"],
      ["quartz", "solar"],
    ]),
    requiredComplications: [],
    allergyConstraint: "none",
  }));
  return { profiles, pick };
}

/** A card's price in the answer's currency (null when unknown). */
export function priceInBudget(
  watch: FoundWatch,
  profile: ProfileV4,
  fx: FxTable,
) {
  const price = watch.details.price;
  if (!price) return null;
  return price.currency === profile.budgetCurrency
    ? price.amount
    : convert(price.amount, price.currency, profile.budgetCurrency, fx);
}

/** A card shown as meeting every answer: no listed miss, not "unverified". */
export const isExactQuizCard = (watch: FoundWatch) =>
  !watch.details.misses?.length &&
  watch.details.verificationStatus !== "unverified";

/**
 * The questionnaire's hard rules, restated from its definitions (price
 * range, diameter range, movement types, water resistance) rather than from
 * the quiz code, so they are an independent oracle. Returns each broken
 * rule; an empty list means the card meets every answer.
 */
export function quizRuleFailures(
  watch: FoundWatch,
  profile: ProfileV4,
  fx: FxTable,
) {
  const failures: string[] = [];
  const range = findPriceRange(profile.priceRange)!;
  const amount = priceInBudget(watch, profile, fx);
  if (
    amount === null ||
    amount < range.minimum ||
    (range.maximum !== null && amount > range.maximum)
  )
    failures.push(`price ${amount}`);
  if (
    !fitsDiameter(
      diameterRangeFor(profile),
      watch.details.caseDiameterMm ?? null,
    )
  )
    failures.push(`diameter ${watch.details.caseDiameterMm}`);
  const movement = normalizeMovement(watch.details.movement ?? null);
  if (
    !movement ||
    !(profile.movementTypes as readonly string[]).includes(movement)
  )
    failures.push(`movement ${watch.details.movement}`);
  if (
    profile.minimumWaterResistanceM > 0 &&
    (watch.details.waterResistanceM ?? -1) < profile.minimumWaterResistanceM
  )
    failures.push(`water ${watch.details.waterResistanceM}`);
  return failures;
}

// ---------------------------------------------------------------------------
// Alternatives: the owner's test set, 20 watches with three suggested
// alternatives each.

export type OwnerCase = {
  original: string;
  alternatives: {
    watch: string;
    eur?: [number, number];
    usd?: [number, number];
    quartz?: boolean;
  }[];
};

export function loadOwnerAlternatives() {
  return JSON.parse(
    readFileSync("data/alternatives/owner-test-set-2026-10-01.json", "utf8"),
  ) as { cases: OwnerCase[] };
}

/** Does a card name the owner's pick (its first three words)? */
export const matchesPick = (pickName: string, brand: string, model: string) => {
  const have = ` ${words(`${brand} ${model}`).join(" ")} `;
  return words(pickName)
    .slice(0, 3)
    .every((word) => have.includes(` ${word} `));
};

/** The budget a case searches with: the middle of the owner's price span. */
export function ownerCaseBudget(
  alternative: OwnerCase["alternatives"][number],
) {
  const [low, high] = alternative.usd ?? alternative.eur ?? [500, 500];
  return {
    kind: "exact" as const,
    amount: Math.max(50, Math.round((low + high) / 2)),
    currency: alternative.usd ? "USD" : "EUR",
  };
}

// ---------------------------------------------------------------------------
// Film and people: the independent set, labelled from opened sources and
// committed before it was first scored.

export type IndependentLabel = {
  id: string;
  query: string;
  kind: string;
  brand: string;
  brandAliases?: string[];
  models: string[] | null;
  reference: string | null;
  referenceMatch?: "exact" | "prefix";
  level: "reference" | "family";
};

export const INDEPENDENT_FILM_FILE =
  "data/eval/film-labels-independent-2026-11-26.json";

export function loadIndependentFilmSet() {
  const text = readFileSync(INDEPENDENT_FILM_FILE, "utf8");
  return {
    sha256: createHash("sha256").update(text).digest("hex"),
    set: JSON.parse(text) as {
      review: { status: string };
      positives: IndependentLabel[];
      controls: { id: string; query: string; kind: string }[];
    },
  };
}

export const independentHit = (watch: FoundWatch, label: IndependentLabel) => {
  const brandMatches = [label.brand, ...(label.brandAliases ?? [])].some(
    (brand) => fold(watch.brand) === fold(brand),
  );
  if (!brandMatches) return false;
  if (label.level === "reference") {
    const card = fold(watch.referenceCode ?? "");
    const wanted = fold(label.reference ?? "");
    if (!card || !wanted) return false;
    return label.referenceMatch === "prefix"
      ? card.startsWith(wanted)
      : card === wanted;
  }
  const model = words(`${watch.model}`);
  return (label.models ?? [""]).some((name) =>
    words(name).every((word) => model.includes(word)),
  );
};

/** A query that names its own answer (brand or reference) is leakage. */
export const leaksAnswer = (
  query: string,
  brand: string,
  reference: string | null,
) =>
  fold(query).includes(fold(brand)) ||
  Boolean(reference && fold(query).includes(fold(reference)));
