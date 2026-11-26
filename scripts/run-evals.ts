// The quality evaluation (phase 1 of the rebuild): scores the real search
// functions against labelled data, next to random baselines, without paid
// calls or writes. Every network request goes through a guard that allows
// only read-only catalogue/cache functions and the ECB rate feed; anything
// else (a provider, a write) fails the run.
//
//   node --env-file=.env --import tsx scripts/run-evals.ts [--label name]
//
// In CI (.github/workflows/eval.yml) only EVAL_DATABASE_URL is set, and the
// functions run as the read-only sign-in reserve_eval_reader
// (scripts/eval-database.ts). Writes docs/reports/eval-<date>.json. The first run is the baseline
// (docs/eval-baseline.md): the labelled sets are not edited to make a run
// pass (alexisinwork/ai_engineering, PopChoice THEORY §7). The paid live
// round over the same sets is scripts/run-evals-live.ts.
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { fitsDiameter } from "../app/domain/ai-watch-guardrails";
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
} from "../app/domain/questionnaire-v4";
import { searchQuiz } from "../app/domain/quiz-search.server";
import {
  catalogueClient,
  loadAlternativesWindow,
  loadCatalogueRowsById,
  loadNameIndexCached,
} from "../app/domain/watch-catalogue.server";
import { openEvalDatabase } from "./eval-database";
import {
  fold,
  INDEPENDENT_FILM_FILE,
  independentHit,
  isExactQuizCard,
  leaksAnswer,
  loadIndependentFilmSet,
  loadOwnerAlternatives,
  matchesPick,
  ownerCaseBudget,
  quizRuleFailures,
  READ_ONLY_RPC,
  seededQuizProfiles,
  words,
} from "./eval-sets";

// ---------------------------------------------------------------------------
// Network guard: read-only database functions (READ_ONLY_RPC) and the ECB
// feed only.

// With EVAL_DATABASE_URL (the CI job, .github/workflows/eval.yml), these
// functions run over PostgreSQL as reserve_eval_reader, a sign-in that can
// only read (scripts/eval-database.ts), and no service key is needed: the
// Supabase address is then a placeholder that no request reaches.
const evalDatabaseUrl = process.env.EVAL_DATABASE_URL?.trim();
if (evalDatabaseUrl) {
  process.env.SUPABASE_URL ||= "https://eval-database.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= "unused-by-the-evaluation";
}
const database = evalDatabaseUrl
  ? await openEvalDatabase(evalDatabaseUrl, READ_ONLY_RPC)
  : null;

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
    if (!database) return realFetch(input, init);
    const body =
      init?.body ?? (input instanceof Request ? await input.text() : null);
    return database.call(rpc, body);
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

// ---------------------------------------------------------------------------
// 1. Quiz: every card shown as meeting every answer must meet it. The checks
//    (quizRuleFailures in eval-sets.ts) restate the questionnaire's hard
//    rules from its definitions, not from the quiz code, so they are an
//    independent oracle.

const { profiles: quizProfiles, pick } = seededQuizProfiles();
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
  const cards = [...view.watches, ...(view.alsoWorth ?? [])];
  const exact = cards.filter(isExactQuizCard);
  if (exact.length) quiz.profilesWithExact++;
  for (const watch of exact) {
    quiz.exactCards++;
    const label = `${profile.budgetCurrency} ${profile.priceRange}: ${watch.brand} ${watch.model}`;
    for (const failure of quizRuleFailures(watch, profile, fx))
      quiz.violations.push(`${label}: ${failure}`);
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

const ownerSet = loadOwnerAlternatives();
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
    const budget: AlternativesBudget = ownerCaseBudget(alternative);
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
  if (leaksAnswer(label.query, label.brand, label.reference))
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
// 3b. Film and people search against the independent set: subjects that are
// not owner stories, each labelled from opened maker, auction or two
// independent sources and committed before it was first scored. Its score
// is what the search achieves on its own; the controls are invented
// subjects, and any confirmed card for them is an invented sighting.

const { sha256, set: independentSet } = loadIndependentFilmSet();
const independent = {
  file: INDEPENDENT_FILM_FILE,
  sha256,
  review: independentSet.review.status,
  positives: independentSet.positives.length,
  answered: 0,
  foundAny: 0,
  foundConfirmed: 0,
  confirmed: [] as string[],
  onlyPossible: [] as string[],
  missed: [] as string[],
  controlViolations: [] as string[],
  leakage: [] as string[],
};
for (const label of independentSet.positives) {
  if (leaksAnswer(label.query, label.brand, label.reference))
    independent.leakage.push(label.id);
  const view = await runFilmSearch({
    query: label.query,
    kind: label.kind as FilmSubjectKind,
    rateKey: "eval",
    searchOptions: { store },
  });
  if (view.status !== "found") {
    independent.missed.push(label.id);
    continue;
  }
  independent.answered++;
  const hits = [...view.watches, ...(view.alsoWorth ?? [])].filter((watch) =>
    independentHit(watch, label),
  );
  if (hits.length === 0) {
    independent.missed.push(label.id);
    continue;
  }
  independent.foundAny++;
  if (hits.some((watch) => watch.details.verificationStatus !== "unverified")) {
    independent.foundConfirmed++;
    independent.confirmed.push(label.id);
  } else {
    independent.onlyPossible.push(label.id);
  }
}
for (const control of independentSet.controls) {
  const view = await runFilmSearch({
    query: control.query,
    kind: control.kind as FilmSubjectKind,
    rateKey: "eval",
    searchOptions: { store },
  });
  if (view.status !== "found") continue;
  for (const watch of [...view.watches, ...(view.alsoWorth ?? [])]) {
    if (watch.details.verificationStatus !== "unverified")
      independent.controlViolations.push(
        `${control.id}: ${watch.brand} ${watch.model}`,
      );
  }
}

// ---------------------------------------------------------------------------

await database?.end();

const report = {
  at: new Date().toISOString(),
  fxDate: fx.date,
  guard: {
    database: database
      ? "PostgreSQL as reserve_eval_reader"
      : "Supabase API with the service key",
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
  filmIndependent: {
    ...independent,
    recallConfirmed: Number(
      (independent.foundConfirmed / independent.positives).toFixed(4),
    ),
    recallAny: Number(
      (independent.foundAny / independent.positives).toFixed(4),
    ),
  },
  gates: {
    noProviderRequests: providerRequests.length === 0,
    zeroQuizHardConstraintViolations: quiz.violations.length === 0,
    zeroNegativeSightings: film.negativeViolations.length === 0,
    noFilmQueryLeakage: film.leakage.length === 0,
    zeroInventedSightingsForControls:
      independent.controlViolations.length === 0,
    noIndependentQueryLeakage: independent.leakage.length === 0,
  },
};
// `--label after-live` writes eval-<date>-after-live.json, so a second run
// on the same day keeps the first report.
const labelAt = process.argv.indexOf("--label");
const label = labelAt > 0 ? process.argv[labelAt + 1] : undefined;
if (label !== undefined && !/^[a-z0-9-]{1,40}$/.test(label))
  throw new Error("--label takes lowercase letters, digits and dashes.");
const output = resolve(
  `docs/reports/eval-${report.at.slice(0, 10)}${label ? `-${label}` : ""}.json`,
);
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
console.log(`Wrote ${output}`);
// In GitHub Actions the gates and headline numbers also go to the job's
// summary page.
if (process.env.GITHUB_STEP_SUMMARY) {
  const summary = [
    `### Search quality evaluation, ${report.at.slice(0, 10)}`,
    "",
    "| Gate | Result |",
    "| --- | --- |",
    ...Object.entries(report.gates).map(
      ([gate, passed]) => `| ${gate} | ${passed ? "PASS" : "FAIL"} |`,
    ),
    "",
    `Quiz exact precision ${report.quiz.exactPrecision ?? "none"}; alternatives recall@10 ${report.alternatives.recallAt10} (random ${report.alternatives.randomRecallAt10}); film recall ${report.film.recallConfirmed} confirmed, ${report.film.recallAny} any; independent film set ${report.filmIndependent.recallConfirmed} confirmed. Database: ${report.guard.database}.`,
  ];
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary.join("\n")}\n`);
}
if (Object.values(report.gates).some((passed) => !passed)) {
  process.exit(1);
}
