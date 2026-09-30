// Fills the watch catalogue: 11 price ranges up to 10k x 6 wearing styles x
// 10 runs = 660 searches, run locally and written to the production
// catalogue (migration 0071). Resumable: finished searches are recorded in
// .catalogue-build/progress.json and skipped on the next start.
// Stops starting new searches once the estimated spend reaches --budget
// (USD, default 30).
//   node --env-file=.env --import tsx scripts/build-catalogue.ts [--runs 10] [--concurrency 6] [--limit 5] [--budget 30]
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";

import { defaultDeps } from "../app/domain/ai-watch-finder.server";
import {
  BUILD_RUNS,
  candidateIdentity,
  proposeForCell,
  proposedPriceFits,
  readBuildCandidate,
  verifyCandidate,
  type BuildCandidate,
  type BuildCell,
} from "../app/domain/catalogue-build.server";
import { loadFxTable } from "../app/domain/fx.server";
import { PRICE_RANGES } from "../app/domain/questionnaire-v4";
import {
  CATALOGUE_MAX_PRICE,
  CATALOGUE_STYLES,
} from "../app/domain/watch-catalogue";
import {
  catalogueClient,
  listCatalogue,
  upsertCatalogueWatch,
} from "../app/domain/watch-catalogue.server";

function flag(name: string, fallback: number) {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? Number(process.argv[index + 1]) : Number.NaN;
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const RUNS = flag("runs", BUILD_RUNS);
const CONCURRENCY = flag("concurrency", 6);
const LIMIT = flag("limit", Number.POSITIVE_INFINITY);
const BUDGET_USD = flag("budget", 30);
const CANDIDATE_CONCURRENCY = 3;

// Estimated cost per call (USD). Perplexity: Sonar request fee plus a few
// hundred tokens; Search API per request. Muse Spark: a rough allowance.
const COST_PER_CALL: Record<string, number> = {
  "perplexity-chat": 0.0075,
  "perplexity-search": 0.005,
  muse: 0.006,
  web: 0,
};

function estimatedSpend(calls: Record<string, number>) {
  return Object.entries(calls).reduce(
    (total, [kind, count]) => total + (COST_PER_CALL[kind] ?? 0) * count,
    0,
  );
}

const DIR = ".catalogue-build";
const PROGRESS = `${DIR}/progress.json`;
mkdirSync(DIR, { recursive: true });

type CellResult = {
  key: string;
  range: string;
  style: string;
  run: number;
  proposals: number;
  outOfRange: number;
  merged: number;
  added: number;
  referenceConfirmed: number;
  priceConfirmed: number;
  errors: number;
  seconds: number;
  finishedAt: string;
};
type Progress = {
  startedAt: string;
  cells: Record<string, CellResult>;
  calls: Record<string, number>;
};

const progress: Progress = existsSync(PROGRESS)
  ? (JSON.parse(readFileSync(PROGRESS, "utf8")) as Progress)
  : { startedAt: new Date().toISOString(), cells: {}, calls: {} };
const saveProgress = () =>
  writeFileSync(PROGRESS, JSON.stringify(progress, null, 1));

// ---------------------------------------------------------------------------
// Rate-limited fetch: bounded concurrency per provider, patient 429 retries,
// and call counts for the cost estimate. Only the provider's own API key
// travels with a request; nothing about any visitor exists here.

function semaphore(size: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async <T>(task: () => Promise<T>) => {
    if (active >= size)
      await new Promise<void>((resolve) => waiting.push(resolve));
    active += 1;
    try {
      return await task();
    } finally {
      active -= 1;
      waiting.shift()?.();
    }
  };
}

const limits = {
  "perplexity-chat": semaphore(6),
  "perplexity-search": semaphore(3),
  muse: semaphore(CONCURRENCY),
  web: semaphore(24),
};

function bucket(url: string): keyof typeof limits {
  if (url.startsWith("https://api.perplexity.ai/chat"))
    return "perplexity-chat";
  if (url.startsWith("https://api.perplexity.ai/search"))
    return "perplexity-search";
  if (url.includes("api.meta.ai")) return "muse";
  return "web";
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const limitedFetch: typeof fetch = async (input, init) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  const kind = bucket(url);
  return limits[kind](async () => {
    for (let attempt = 0; ; attempt += 1) {
      progress.calls[kind] = (progress.calls[kind] ?? 0) + 1;
      const response = await fetch(input, init);
      if (response.status !== 429 || kind === "web" || attempt >= 7)
        return response;
      await response.body?.cancel();
      const retryAfter = Number(response.headers.get("retry-after"));
      await sleep(
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1_000
          : 2_000 * 2 ** attempt,
      );
    }
  });
};

// ---------------------------------------------------------------------------

const client = catalogueClient({ fetchImpl: fetch });
if (!client)
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
const baseDeps = defaultDeps({ fetchImpl: limitedFetch });
if (!baseDeps.config.museSpark || !baseDeps.config.perplexity) {
  throw new Error("MUSE_SPARK_API_KEY and PERPLEXITY_API_KEY are required.");
}
// Latency does not matter here, knowledge does: use the full model.
const deps = {
  ...baseDeps,
  config: {
    ...baseDeps.config,
    museSpark: {
      ...baseDeps.config.museSpark,
      fastModel:
        process.env.MUSE_SPARK_MODEL?.trim() ||
        baseDeps.config.museSpark.fastModel,
    },
  },
};
const fx = await loadFxTable();

// What each (range, style) already holds, so later runs propose new watches.
const known = new Set<string>();
const inFlight = new Map<string, Promise<void>>();
const cellNames = new Map<string, Set<string>>();
const cellKeyOf = (range: string, style: string) => `${range}|${style}`;
for (const watch of await listCatalogue(client, true)) {
  known.add(watch.identityKey);
  for (const entry of watch.foundIn) {
    const found = entry as { range?: string; style?: string };
    if (!found.range || !found.style) continue;
    const key = cellKeyOf(found.range, found.style);
    if (!cellNames.has(key)) cellNames.set(key, new Set());
    cellNames
      .get(key)!
      .add(
        `${watch.brand} ${watch.model}${watch.referenceCode ? ` ${watch.referenceCode}` : ""}`,
      );
  }
}
console.log(`Catalogue holds ${known.size} watches before this run.`);

const ranges = PRICE_RANGES.filter(
  (range) => range.maximum !== null && range.maximum <= CATALOGUE_MAX_PRICE,
);
const cells: BuildCell[] = [];
for (let run = 1; run <= RUNS; run += 1) {
  for (const range of ranges)
    for (const style of CATALOGUE_STYLES) cells.push({ range, style, run });
}
const todo = cells
  .filter(
    (cell) => !progress.cells[`${cell.range.id}|${cell.style}|${cell.run}`],
  )
  .slice(0, LIMIT);
console.log(
  `${cells.length} searches in the plan, ${Object.keys(progress.cells).length} already done, ${todo.length} to run now.`,
);

async function pool<T>(
  items: T[],
  size: number,
  work: (item: T) => Promise<void>,
) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(size, queue.length) }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift())
        await work(item);
    }),
  );
}

let budgetStopped = false;

async function runCell(cell: BuildCell) {
  if (estimatedSpend(progress.calls) >= BUDGET_USD) {
    if (!budgetStopped)
      console.log(
        `Budget of USD ${BUDGET_USD} reached; not starting further searches.`,
      );
    budgetStopped = true;
    return;
  }
  const started = performance.now();
  const key = `${cell.range.id}|${cell.style}|${cell.run}`;
  const names =
    cellNames.get(cellKeyOf(cell.range.id, cell.style)) ?? new Set<string>();
  cellNames.set(cellKeyOf(cell.range.id, cell.style), names);
  const result: CellResult = {
    key,
    range: cell.range.id,
    style: cell.style,
    run: cell.run,
    proposals: 0,
    outOfRange: 0,
    merged: 0,
    added: 0,
    referenceConfirmed: 0,
    priceConfirmed: 0,
    errors: 0,
    seconds: 0,
    finishedAt: "",
  };
  const foundIn = {
    range: cell.range.id,
    style: cell.style,
    run: cell.run,
    at: new Date().toISOString().slice(0, 10),
  };

  let proposals: BuildCandidate[] = [];
  try {
    proposals = (await proposeForCell(cell, [...names], deps))
      .map(readBuildCandidate)
      .filter((candidate): candidate is BuildCandidate => candidate !== null);
  } catch (error) {
    result.errors += 1;
    console.error(
      `  ${key} proposal failed: ${error instanceof Error ? error.message.slice(0, 160) : "unknown"}`,
    );
    return; // not recorded: retried on the next start
  }
  result.proposals = proposals.length;

  const unique = new Map<string, BuildCandidate>();
  for (const candidate of proposals) {
    if (!proposedPriceFits(candidate, cell.range, fx)) {
      result.outOfRange += 1;
      continue;
    }
    unique.set(candidateIdentity(candidate), candidate);
  }

  await pool(
    [...unique.entries()],
    CANDIDATE_CONCURRENCY,
    async ([identity, candidate]) => {
      names.add(
        `${candidate.brand} ${candidate.model}${candidate.referenceCode ? ` ${candidate.referenceCode}` : ""}`,
      );
      try {
        const pending = inFlight.get(identity);
        if (pending) await pending;
        if (known.has(identity)) {
          // Already catalogued: only record that this search found it too.
          await upsertCatalogueWatch(client!, {
            identityKey: identity,
            brand: candidate.brand,
            model: candidate.model,
            referenceCode: candidate.referenceCode,
            referenceConfirmed: false,
            styles: [cell.style],
            foundIn: [foundIn],
          });
          result.merged += 1;
          return;
        }
        const work = (async () => {
          const entry = await verifyCandidate(
            candidate,
            [cell.style],
            foundIn,
            deps,
            fx,
          );
          await upsertCatalogueWatch(client!, entry);
          known.add(identity);
          result.added += 1;
          if (entry.referenceConfirmed) result.referenceConfirmed += 1;
          if (entry.priceStatus === "confirmed") result.priceConfirmed += 1;
        })();
        inFlight.set(
          identity,
          work.catch(() => undefined),
        );
        await work;
      } catch (error) {
        result.errors += 1;
        console.error(
          `  ${key} ${candidate.brand} ${candidate.model}: ${error instanceof Error ? error.message.slice(0, 160) : "unknown"}`,
        );
      } finally {
        inFlight.delete(identity);
      }
    },
  );

  result.seconds = Math.round((performance.now() - started) / 100) / 10;
  result.finishedAt = new Date().toISOString();
  progress.cells[key] = result;
  saveProgress();
  const done = Object.keys(progress.cells).length;
  console.log(
    `$${estimatedSpend(progress.calls).toFixed(2)} ${String(done).padStart(3)}/${cells.length} ${key.padEnd(24)} proposed=${result.proposals} new=${result.added} (ref ${result.referenceConfirmed}, price ${result.priceConfirmed}) repeat=${result.merged} out=${result.outOfRange} err=${result.errors} ${result.seconds}s | catalogue ${known.size}`,
  );
}

const started = Date.now();
await pool(todo, CONCURRENCY, runCell);
saveProgress();
console.log(
  `\nFinished in ${Math.round((Date.now() - started) / 60_000)} min. Catalogue now holds ${known.size} watches.`,
);
console.log(`Calls: ${JSON.stringify(progress.calls)}`);
console.log(
  `Estimated spend: USD ${estimatedSpend(progress.calls).toFixed(2)}`,
);
