import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Measures how fast public pages answer, so every speed change can be
 * compared before and after with the same command. It only sends GET
 * requests to free pages and cached searches: no paid provider call, no
 * sign-in, no form submission.
 *
 *   node --import tsx scripts/measure-page-speed.ts --label before
 *   node --import tsx scripts/measure-page-speed.ts --label after --runs 7
 *
 * Writes docs/reports/page-speed-<label>.json.
 */

export const DEFAULT_PATHS = [
  "/",
  "/health",
  "/watches",
  "/watches/stories/don-draper-mad-men-omega",
  "/partners",
  "/privacy",
  "/watches/find?q=Daniel+Craig&type=actor",
  "/watches/find?q=Heat&type=movie",
] as const;

export type Sample = {
  firstByteMs: number;
  totalMs: number;
  status: number;
  cache: string | null;
  cacheControl: string | null;
  functionRegion: string | null;
};

export type PathSummary = {
  path: string;
  runs: number;
  medianFirstByteMs: number;
  slowestFirstByteMs: number;
  medianTotalMs: number;
  cacheResults: Record<string, number>;
  cacheControl: string | null;
  functionRegion: string | null;
  statuses: number[];
};

/** The region code is the second-to-last group of x-vercel-id, e.g. iad1. */
export function functionRegionFrom(vercelId: string | null) {
  if (!vercelId) {
    return null;
  }
  const groups = vercelId.split("::");
  return groups.length >= 2 ? (groups[groups.length - 2] ?? null) : null;
}

export function median(values: readonly number[]) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

export function summarize(path: string, samples: readonly Sample[]) {
  const cacheResults: Record<string, number> = {};
  for (const sample of samples) {
    const key = sample.cache ?? "(none)";
    cacheResults[key] = (cacheResults[key] ?? 0) + 1;
  }
  const firstBytes = samples.map((sample) => sample.firstByteMs);
  const summary: PathSummary = {
    path,
    runs: samples.length,
    medianFirstByteMs: Math.round(median(firstBytes)),
    slowestFirstByteMs: Math.round(Math.max(0, ...firstBytes)),
    medianTotalMs: Math.round(median(samples.map((sample) => sample.totalMs))),
    cacheResults,
    cacheControl: samples.at(-1)?.cacheControl ?? null,
    functionRegion:
      samples.find((sample) => sample.functionRegion)?.functionRegion ?? null,
    statuses: [...new Set(samples.map((sample) => sample.status))],
  };
  return summary;
}

async function measureOnce(url: URL, fetchImpl: typeof fetch) {
  const startedAt = performance.now();
  const response = await fetchImpl(url, {
    headers: { "User-Agent": "TheReserveSpeedCheck/1.0" },
    signal: AbortSignal.timeout(120_000),
  });
  const firstByteMs = performance.now() - startedAt;
  // Streamed pages finish only when the whole body has arrived.
  await response.arrayBuffer();
  const sample: Sample = {
    firstByteMs,
    totalMs: performance.now() - startedAt,
    status: response.status,
    cache: response.headers.get("x-vercel-cache"),
    cacheControl: response.headers.get("cache-control"),
    functionRegion: functionRegionFrom(response.headers.get("x-vercel-id")),
  };
  return sample;
}

export async function measurePaths({
  baseUrl,
  paths,
  runs,
  fetchImpl = fetch,
}: {
  baseUrl: string;
  paths: readonly string[];
  runs: number;
  fetchImpl?: typeof fetch;
}) {
  const results: PathSummary[] = [];
  for (const path of paths) {
    const samples: Sample[] = [];
    // Sequential on purpose: parallel requests would measure contention.
    for (let run = 0; run < runs; run++) {
      samples.push(await measureOnce(new URL(path, baseUrl), fetchImpl));
    }
    results.push(summarize(path, samples));
  }
  return results;
}

function readOption(args: readonly string[], name: string) {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main() {
  const args = process.argv.slice(2);
  const label = readOption(args, "label") ?? "run";
  if (!/^[a-z0-9-]+$/.test(label)) {
    throw new Error("--label may contain only a-z, 0-9 and hyphens");
  }
  const runs = Number(readOption(args, "runs") ?? "5");
  if (!Number.isInteger(runs) || runs < 1 || runs > 20) {
    throw new Error("--runs must be a whole number from 1 to 20");
  }
  const baseUrl = readOption(args, "base") ?? "https://thereserve.watch";
  const results = await measurePaths({ baseUrl, paths: DEFAULT_PATHS, runs });
  const report = { at: new Date().toISOString(), baseUrl, runs, results };
  const output = resolve(`docs/reports/page-speed-${label}.json`);
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.table(
    results.map((result) => ({
      path: result.path,
      medianFirstByteMs: result.medianFirstByteMs,
      slowestFirstByteMs: result.slowestFirstByteMs,
      cache: JSON.stringify(result.cacheResults),
      region: result.functionRegion,
    })),
  );
  console.log(`Wrote ${output}`);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main();
}
