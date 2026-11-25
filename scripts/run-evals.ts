// The quality evaluation (phase 1 of the rebuild): scores the real search
// functions against labelled data, next to random baselines, without paid
// calls or writes. Every network request goes through a guard that allows
// only read-only catalogue/cache functions and the ECB rate feed; anything
// else (a provider, a write) fails the run.
//
//   node --env-file=.env --import tsx scripts/run-evals.ts
//
// Writes docs/reports/eval-<date>.json. The first run is the baseline
// (docs/eval-baseline.md): the labelled sets are not edited to make a run
// pass (alexisinwork/ai_engineering, PopChoice THEORY §7).
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  fitsDiameter,
  normalizeMovement,
} from "../app/domain/ai-watch-guardrails";
import type { AiSearchView, FoundWatch } from "../app/domain/ai-watch-types";
import { loadAiWatchStoreConfig } from "../app/domain/ai-watch-store.server";
import {
  alternativesCatalogueWindow,
  hasComparisonFacts,
  rankAlternatives,
  type AlternativesBudget,
} from "../app/domain/alternatives";
import { resolveNamedWatch } from "../app/domain/alternatives.server";
import { runFilmSearch } from "../app/domain/film-search-run.server";
import type { FilmSubjectKind } from "../app/domain/film-subject";
import { convert } from "../app/domain/fx";
import { loadFxTable } from "../app/domain/fx.server";
import {
  diameterRangeFor,
  findPriceRange,
  PRICE_RANGES,
  type ProfileV4,
} from "../app/domain/questionnaire-v4";
import { searchQuiz } from "../app/domain/quiz-search.server";
import {
  catalogueClient,
  loadAlternativesWindow,
  loadCatalogueRowsById,
  loadNameIndexCached,
} from "../app/domain/watch-catalogue.server";

// ---------------------------------------------------------------------------
// Network guard: read-only database functions and the ECB feed only.

const READ_ONLY_RPC = new Set([
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
  "watch_catalogue_lookup_v1",
  "ai_watch_search_get_v1",
  "ai_watch_validated_cache_get_v2",
  "discovery_published_stories_v1",
]);
// Blocked requests are prevented, not failures: a write the code tries
// (such as caching a completed answer) is refused. A request to any other
// host (a paid provider) fails the run.
const blocked: string[] = [];
const providerRequests: string[] = [];
const realFetch = globalThis.fetch.bind(globalThis);
const supabaseHost = new URL(process.env.SUPABASE_URL!).host;
globalThis.fetch = async (input, init) => {
  const url = new URL(
    typeof input === "string" || input instanceof URL ? input : input.url,
  );
  if (url.host === "www.ecb.europa.eu") return realFetch(input, init);
  const rpc = url.pathname.match(/\/rest\/v1\/rpc\/([a-z0-9_]+)$/)?.[1];
  if (url.host === supabaseHost && rpc && READ_ONLY_RPC.has(rpc)) {
    return realFetch(input, init);
  }
  if (url.host === supabaseHost) {
    blocked.push(rpc ?? url.pathname);
  } else {
    providerRequests.push(url.host);
  }
  return new Response("blocked by the eval guard", { status: 403 });
};

const client = catalogueClient()!;
const fx = await loadFxTable();
if (!fx) throw new Error("Exchange rates are unavailable; rerun later.");
const store = loadAiWatchStoreConfig();

// Deterministic sampling, so the same run gives the same answers.
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
const fold = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// ---------------------------------------------------------------------------
// 1. Quiz: every card shown as meeting every answer must meet it. The checks
//    below restate the questionnaire's hard rules from its definitions
//    (price range, diameter range, movement types, water resistance), not
//    from the quiz code, so they are an independent oracle.

const next = random(20261125);
const pick = <T>(values: readonly T[]) =>
  values[Math.floor(next() * values.length)]!;
const quizProfiles: ProfileV4[] = Array.from({ length: 40 }, () => ({
  version: 4,
  budgetCurrency: pick(["USD", "EUR", "GBP", "CHF"] as const),
  priceRange: pick(
    PRICE_RANGES.filter(
      (range) => range.maximum !== null && range.maximum <= 10_000,
    ),
  ).id,
  wristCm: 15 + Math.round(next() * 50) / 10,
  wearingScenarios: [pick(["office", "everyday", "resort", "travel", "sport"])],
  minimumWaterResistanceM: pick([0, 50, 100, 200]),
  movementTypes: pick([
    ["automatic"],
    ["automatic", "manual"],
    ["quartz", "solar"],
  ]),
  requiredComplications: [],
  allergyConstraint: "none",
}));
const priceInBudget = (watch: FoundWatch, profile: ProfileV4) => {
  const price = watch.details.price;
  if (!price) return null;
  return price.currency === profile.budgetCurrency
    ? price.amount
    : convert(price.amount, price.currency, profile.budgetCurrency, fx);
};
const quiz = {
  profiles: 0,
  exactCards: 0,
  violations: [] as string[],
  profilesWithExact: 0,
  closeFits: 0,
  closeFitsWithoutReason: 0,
  baselineRandomExactRate: 0,
};
for (const profile of quizProfiles) {
  const view: AiSearchView = await searchQuiz(profile, {
    client,
    loadFx: () => Promise.resolve(fx),
    runLive: () => Promise.resolve({ status: "unavailable" as const }),
  });
  quiz.profiles++;
  if (view.status !== "found") continue;
  const range = findPriceRange(profile.priceRange)!;
  const diameter = diameterRangeFor(profile);
  const cards = [...view.watches, ...(view.alsoWorth ?? [])];
  const exact = cards.filter(
    (watch) =>
      !watch.details.misses?.length &&
      watch.details.verificationStatus !== "unverified",
  );
  if (exact.length) quiz.profilesWithExact++;
  for (const watch of exact) {
    quiz.exactCards++;
    const label = `${profile.budgetCurrency} ${profile.priceRange}: ${watch.brand} ${watch.model}`;
    const amount = priceInBudget(watch, profile);
    if (
      amount === null ||
      amount < range.minimum ||
      (range.maximum !== null && amount > range.maximum)
    )
      quiz.violations.push(`${label}: price ${amount}`);
    if (!fitsDiameter(diameter, watch.details.caseDiameterMm ?? null))
      quiz.violations.push(
        `${label}: diameter ${watch.details.caseDiameterMm}`,
      );
    const movement = normalizeMovement(watch.details.movement ?? null);
    if (
      !movement ||
      !(profile.movementTypes as readonly string[]).includes(movement)
    )
      quiz.violations.push(`${label}: movement ${watch.details.movement}`);
    if (
      profile.minimumWaterResistanceM > 0 &&
      (watch.details.waterResistanceM ?? -1) < profile.minimumWaterResistanceM
    )
      quiz.violations.push(`${label}: water ${watch.details.waterResistanceM}`);
  }
  const close = cards.filter((watch) => watch.details.misses?.length);
  quiz.closeFits += close.length;
  quiz.closeFitsWithoutReason += close.filter(
    (watch) => !watch.details.misses?.every((miss) => miss.trim().length > 0),
  ).length;
}

// Random baseline: how often ten random priced pool rows would all be real
// exact fits is not meaningful; instead, the share of random pool rows that
// meet a profile's price and size answers, for scale.
{
  const rows = await loadNameIndexCached(client);
  const sample = Array.from({ length: 2_000 }, () => pick(rows));
  let fits = 0;
  let trials = 0;
  const priced = await loadCatalogueRowsById(
    client,
    sample.slice(0, 200).map((row) => row.id),
  );
  for (const profile of quizProfiles) {
    const range = findPriceRange(profile.priceRange)!;
    const diameter = diameterRangeFor(profile);
    for (const row of priced) {
      trials++;
      const amount =
        row.priceAmount === null ||
        row.priceCurrency === null ||
        row.priceStatus === "unconfirmed"
          ? null
          : convert(
              row.priceAmount,
              row.priceCurrency,
              profile.budgetCurrency,
              fx,
            );
      if (
        amount !== null &&
        amount >= range.minimum &&
        (range.maximum === null || amount <= range.maximum) &&
        fitsDiameter(diameter, row.caseDiameterMm)
      )
        fits++;
    }
  }
  quiz.baselineRandomExactRate = Number(
    (fits / Math.max(1, trials)).toFixed(4),
  );
}

// ---------------------------------------------------------------------------
// 2. Alternatives: is the owner's suggested alternative in our top 5 / 10?

type OwnerCase = {
  original: string;
  alternatives: {
    watch: string;
    eur?: [number, number];
    usd?: [number, number];
    quartz?: boolean;
  }[];
};
const ownerSet = JSON.parse(
  readFileSync("data/alternatives/owner-test-set-2026-10-01.json", "utf8"),
) as { cases: OwnerCase[] };
const words = (value: string) =>
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
const matchesPick = (pickName: string, brand: string, model: string) => {
  const have = ` ${words(`${brand} ${model}`).join(" ")} `;
  return words(pickName)
    .slice(0, 3)
    .every((word) => have.includes(` ${word} `));
};
const nameIndex = await loadNameIndexCached(client);
const alternatives = {
  cases: 0,
  resolvedTargets: 0,
  comparableTargets: 0,
  inTop5: 0,
  inTop10: 0,
  randomTop10Expected: 0,
  /** The owner's rules allow cheaper models of the same brand; these cases
   * share a brand word with the typed name by design, so they are listed,
   * not treated as leakage. */
  sameBrandCases: [] as string[],
};
for (const testCase of ownerSet.cases) {
  const resolved = resolveNamedWatch(nameIndex, testCase.original, null);
  const comparable =
    resolved.status === "found" && hasComparisonFacts(resolved.watch);
  if (resolved.status === "found") alternatives.resolvedTargets++;
  const [target] = comparable
    ? await loadCatalogueRowsById(client, [resolved.watch.id])
    : [];
  if (target) alternatives.comparableTargets++;
  for (const alternative of testCase.alternatives) {
    alternatives.cases++;
    const brandWord = words(alternative.watch)[0];
    if (brandWord && words(testCase.original).includes(brandWord))
      alternatives.sameBrandCases.push(
        `${testCase.original} → ${alternative.watch}`,
      );
    if (!target) continue;
    const [low, high] = alternative.usd ?? alternative.eur ?? [500, 500];
    const budget: AlternativesBudget = {
      kind: "exact",
      amount: Math.max(50, Math.round((low + high) / 2)),
      currency: alternative.usd ? "USD" : "EUR",
    };
    const allowQuartz = Boolean(alternative.quartz);
    const window = await loadAlternativesWindow(
      client,
      alternativesCatalogueWindow(target, budget, allowQuartz, fx),
    );
    const ranked = rankAlternatives(
      target,
      window,
      budget,
      allowQuartz,
      fx,
      10,
    );
    const position = ranked.findIndex((entry) =>
      matchesPick(alternative.watch, entry.watch.brand, entry.watch.model),
    );
    if (position >= 0 && position < 5) alternatives.inTop5++;
    if (position >= 0) alternatives.inTop10++;
    // Random baseline: ten random rows from the same window.
    const eligible = window.filter((row) => row.id !== target.id);
    const matches = eligible.filter((row) =>
      matchesPick(alternative.watch, row.brand, row.model),
    ).length;
    alternatives.randomTop10Expected += eligible.length
      ? 1 -
        Math.pow(1 - matches / eligible.length, Math.min(10, eligible.length))
      : 0;
  }
}

// ---------------------------------------------------------------------------
// 3. Film and people search against the owner's published stories.

type FilmLabel = {
  query: string;
  kind: string;
  brand: string;
  model: string | null;
  reference: string | null;
  level: "reference" | "family";
};
const filmSet = JSON.parse(
  readFileSync("data/eval/film-labels-2026-11-25.json", "utf8"),
) as {
  positives: FilmLabel[];
  negatives: {
    query: string;
    kind: string;
    brand: string;
    reference: string;
  }[];
};
const film = {
  positives: filmSet.positives.length,
  answered: 0,
  foundConfirmed: 0,
  foundAny: 0,
  negativeViolations: [] as string[],
  leakage: [] as string[],
};
const sameReference = (a: string | null | undefined, b: string | null) =>
  Boolean(a && b && fold(a) === fold(b));
const sameFamily = (watch: FoundWatch, label: FilmLabel) =>
  fold(watch.brand) === fold(label.brand) &&
  words(label.model ?? "")
    .slice(0, 2)
    .every((word) => words(`${watch.model}`).includes(word));
for (const label of filmSet.positives) {
  if (
    fold(label.query).includes(fold(label.brand)) ||
    (label.reference && fold(label.query).includes(fold(label.reference)))
  )
    film.leakage.push(label.query);
  // The site's own path, saved research only: no paid search can run.
  const view = await runFilmSearch({
    query: label.query,
    kind: label.kind as FilmSubjectKind,
    rateKey: "eval",
    searchOptions: { store },
  });
  if (view.status !== "found") continue;
  film.answered++;
  const hit = (watch: FoundWatch) =>
    label.level === "reference"
      ? sameReference(watch.referenceCode, label.reference)
      : sameFamily(watch, label);
  const all = [...view.watches, ...(view.alsoWorth ?? [])];
  if (all.some(hit)) film.foundAny++;
  if (
    all.some(
      (watch) =>
        hit(watch) && watch.details.verificationStatus !== "unverified",
    )
  )
    film.foundConfirmed++;
}
for (const negative of filmSet.negatives) {
  const view = await runFilmSearch({
    query: negative.query,
    kind: negative.kind as FilmSubjectKind,
    rateKey: "eval",
    searchOptions: { store },
  });
  if (view.status !== "found") continue;
  for (const watch of [...view.watches, ...(view.alsoWorth ?? [])]) {
    if (
      sameReference(watch.referenceCode, negative.reference) &&
      watch.details.verificationStatus !== "unverified"
    )
      film.negativeViolations.push(`${negative.query}: ${watch.referenceCode}`);
  }
}

// ---------------------------------------------------------------------------

const report = {
  at: new Date().toISOString(),
  fxDate: fx.date,
  guard: {
    providerRequests,
    blockedWrites: blocked.length,
    blockedFunctions: [...new Set(blocked)],
  },
  quiz: {
    ...quiz,
    violations: quiz.violations.length,
    violationExamples: quiz.violations.slice(0, 10),
    exactPrecision:
      quiz.exactCards === 0
        ? null
        : Number((1 - quiz.violations.length / quiz.exactCards).toFixed(4)),
  },
  alternatives: {
    ...alternatives,
    recallAt5: Number((alternatives.inTop5 / alternatives.cases).toFixed(4)),
    recallAt10: Number((alternatives.inTop10 / alternatives.cases).toFixed(4)),
    randomRecallAt10: Number(
      (alternatives.randomTop10Expected / alternatives.cases).toFixed(4),
    ),
  },
  film: {
    ...film,
    recallConfirmed: Number((film.foundConfirmed / film.positives).toFixed(4)),
    recallAny: Number((film.foundAny / film.positives).toFixed(4)),
    randomBaseline:
      "about 1 in 25,000 per card (one labelled watch in the pool)",
  },
  gates: {
    noProviderRequests: providerRequests.length === 0,
    zeroQuizHardConstraintViolations: quiz.violations.length === 0,
    zeroNegativeSightings: film.negativeViolations.length === 0,
    noFilmQueryLeakage: film.leakage.length === 0,
  },
};
const output = resolve(`docs/reports/eval-${report.at.slice(0, 10)}.json`);
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
console.log(`Wrote ${output}`);
if (Object.values(report.gates).some((passed) => !passed)) {
  process.exit(1);
}
