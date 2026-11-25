// Times the production quiz API for answers the catalogue fully covers, so
// no live or paid search runs. Uses the owner's own test partner site
// ("Portfolio local integration") and one of its registered origins; each
// request counts once against that site's monthly test allowance.
//
//   node --env-file=.env --import tsx scripts/measure-quiz-api.ts --label after
//
// Writes docs/reports/quiz-api-speed-<label>.json. The key is never printed.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import postgres from "postgres";

import { loadFxTable } from "../app/domain/fx.server";
import type { ProfileV4 } from "../app/domain/questionnaire-v4";
import { CATALOGUE_ENOUGH } from "../app/domain/quiz-search.server";
import {
  matchCatalogue,
  quizCatalogueWindow,
} from "../app/domain/watch-catalogue";
import {
  catalogueClient,
  loadQuizWindow,
} from "../app/domain/watch-catalogue.server";

const TEST_SITE = "Portfolio local integration";
const label = process.argv[process.argv.indexOf("--label") + 1] ?? "run";
if (!/^[a-z0-9-]+$/.test(label)) {
  throw new Error("--label may contain only a-z, 0-9 and hyphens");
}
const base = "https://thereserve.watch";

const sql = postgres(process.env.DIRECT_DATABASE_URL!, {
  ssl: "require",
  max: 1,
  onnotice: () => undefined,
});
const [site] = await sql<
  { public_key: string; allowed_origins: string[]; active: boolean }[]
>`select public_key, allowed_origins, active from private.partner_sites where name = ${TEST_SITE}`;
await sql.end();
if (!site?.active || !site.allowed_origins[0]) {
  throw new Error(`The test partner site "${TEST_SITE}" is not active.`);
}

// Answers the catalogue covers on its own: the quiz then returns from the
// catalogue branch and never calls a provider.
const client = catalogueClient()!;
const fx = await loadFxTable();
const candidates: ProfileV4[] = [
  ["1000_2000", 17, ["office"]],
  ["2000_3000", 18, ["everyday"]],
  ["500_1000", 16.5, ["everyday"]],
  ["3000_4000", 17.5, ["office"]],
  ["4000_5000", 18, ["everyday"]],
].map(([priceRange, wristCm, wearingScenarios]) => ({
  version: 4,
  budgetCurrency: "USD",
  priceRange: priceRange as string,
  wristCm: wristCm as number,
  wearingScenarios: wearingScenarios as string[],
  minimumWaterResistanceM: 0,
  movementTypes: ["automatic", "manual"],
  requiredComplications: [],
  allergyConstraint: "none",
}));
const covered: ProfileV4[] = [];
for (const profile of candidates) {
  const window = await loadQuizWindow(client, quizCatalogueWindow(profile, fx));
  if (matchCatalogue(window, profile, fx).main.length >= CATALOGUE_ENOUGH) {
    covered.push(profile);
  }
}
if (covered.length === 0) {
  throw new Error("No candidate answer is fully covered by the catalogue.");
}

const results = [];
for (const profile of covered.slice(0, 3)) {
  for (const run of [1, 2]) {
    const startedAt = performance.now();
    const response = await fetch(`${base}/api/v1/quiz`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: site.allowed_origins[0],
        "X-Reserve-Key": site.public_key,
      },
      body: JSON.stringify(profile),
      signal: AbortSignal.timeout(120_000),
    });
    const body =
      (
        (await response.json()) as {
          result?: { status?: string; origin?: string; watches?: unknown[] };
        }
      ).result ?? {};
    results.push({
      priceRange: profile.priceRange,
      wristCm: profile.wristCm,
      run,
      status: response.status,
      ms: Math.round(performance.now() - startedAt),
      resultStatus: body.status ?? null,
      resultOrigin: body.origin ?? null,
      watches: body.watches?.length ?? 0,
      functionRegion:
        response.headers.get("x-vercel-id")?.split("::").at(-2) ?? null,
    });
    console.log(JSON.stringify(results.at(-1)));
  }
}
const report = { at: new Date().toISOString(), base, label, results };
const output = resolve(`docs/reports/quiz-api-speed-${label}.json`);
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Wrote ${output}`);
