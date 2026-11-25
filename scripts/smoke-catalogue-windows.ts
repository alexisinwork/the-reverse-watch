// Production smoke for the database windows (migrations 0115–0117) at zero
// provider cost: it calls only answers that already have a checked or
// completed saved result, and fails if the validation ledger gains an
// attempt. Uses the owner's own test partner site; each call counts against
// that site's monthly test allowance. The key is never printed.
//
//   node --env-file=.env --import tsx scripts/smoke-catalogue-windows.ts
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import postgres from "postgres";

import { aiSearchCacheKey } from "../app/domain/ai-watch-store.server";
import { completeSearchInput } from "../app/domain/complete-search-cache.server";
import {
  ARCHETYPE_QUESTIONS,
  scoreArchetype,
  type ArchetypeAnswers,
} from "../app/domain/discovery-archetype";

const TEST_SITE = "Portfolio local integration";
const base = "https://thereserve.watch";
const sql = postgres(process.env.DIRECT_DATABASE_URL!, {
  ssl: "require",
  max: 1,
  onnotice: () => undefined,
});
const [site] = await sql<
  { public_key: string; allowed_origins: string[]; active: boolean }[]
>`select public_key, allowed_origins, active from private.partner_sites where name = ${TEST_SITE}`;
if (!site?.active || !site.allowed_origins[0]) {
  throw new Error(`The test partner site "${TEST_SITE}" is not active.`);
}
const ledger = async () =>
  (
    await sql<{ attempts: number; charged: number }[]>`
      select count(*)::int as attempts, coalesce(sum(charged_usd), 0)::float as charged
      from private.ai_watch_validation_attempts`
  )[0]!;
const before = await ledger();

// Archetype answers whose selection already has a checked snapshot.
const savedKeys = new Set(
  (
    await sql<{ cache_key: string }[]>`
      select cache_key from private.ai_watch_validated_cache_snapshots
      union select cache_key from private.ai_watch_searches`
  ).map((row) => row.cache_key),
);
const options = ARCHETYPE_QUESTIONS.map((question) =>
  question.options.map(([value]) => value),
);
const combos = new Map<string, Record<string, string>>();
const walk = (index: number, answers: Record<string, string>) => {
  if (index === ARCHETYPE_QUESTIONS.length) {
    const archetype = scoreArchetype(answers as ArchetypeAnswers).id;
    const band = answers.priceComfort!;
    const input = {
      feature: "archetype",
      constraints: { archetype, band },
      selectionPolicy: 1,
    };
    const saved =
      savedKeys.has(aiSearchCacheKey("find", input)) ||
      savedKeys.has(aiSearchCacheKey("find", completeSearchInput(input)));
    if (saved && !combos.has(`${archetype}/${band}`)) {
      combos.set(`${archetype}/${band}`, { ...answers });
    }
    return;
  }
  for (const value of options[index]!) {
    walk(index + 1, {
      ...answers,
      [ARCHETYPE_QUESTIONS[index]!.name]: value,
    });
  }
};
walk(0, {});

const call = async (label: string, path: string, init: RequestInit = {}) => {
  const startedAt = performance.now();
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Origin: site.allowed_origins[0]!,
      "X-Reserve-Key": site.public_key,
    },
    signal: AbortSignal.timeout(120_000),
  });
  const text = await response.text();
  const watches = (text.match(/"brand":/g) ?? []).length;
  const result = {
    label,
    status: response.status,
    ms: Math.round(performance.now() - startedAt),
    brandFields: watches,
    functionRegion:
      response.headers.get("x-vercel-id")?.split("::").at(-2) ?? null,
  };
  console.log(JSON.stringify(result));
  return result;
};

const results = [];
for (const [combo, answers] of [...combos.entries()].slice(0, 3)) {
  results.push(
    await call(
      `archetype ${combo}`,
      `/api/v1/archetype?${new URLSearchParams(answers).toString()}`,
    ),
  );
}
results.push(
  await call(
    "alternatives Tudor Black Bay 58 / USD 2,000 / no quartz",
    `/api/v1/alternatives?${new URLSearchParams({
      name: "Tudor Black Bay 58",
      ref: "M79030N-0001",
      mode: "exact",
      amount: "2000",
      currency: "USD",
      quartz: "no",
    }).toString()}`,
  ),
);

const after = await ledger();
await sql.end();
const report = {
  at: new Date().toISOString(),
  base,
  archetypeCombosWithSavedResults: combos.size,
  results,
  ledger: { before, after },
  addedAttempts: after.attempts - before.attempts,
  addedChargeUsd: Number((after.charged - before.charged).toFixed(5)),
  result:
    after.attempts === before.attempts &&
    results.every((entry) => entry.status === 200)
      ? "PASS"
      : "FAIL",
};
const output = resolve(
  `docs/reports/catalogue-windows-smoke-${report.at.slice(0, 10)}.json`,
);
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(
  JSON.stringify({
    result: report.result,
    addedAttempts: report.addedAttempts,
    addedChargeUsd: report.addedChargeUsd,
  }),
);
console.log(`Wrote ${output}`);
if (report.result !== "PASS") {
  process.exit(1);
}
