// Authorized bounded cron probe. Never logs its bearer tokens or watch data.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { catalogueClient } from "../app/domain/watch-catalogue.server";
import { validationBudgetStatus } from "../app/domain/validation-budget.server";
const base = process.argv.includes("--local")
  ? "http://localhost:5173"
  : "https://thereserve.watch";
const client = catalogueClient();
assert.ok(client && process.env.CRON_SECRET && process.env.OPERATIONS_TOKEN);
const path = `${base}/internal/catalogue/recheck-prices`;
assert.equal((await fetch(path)).status, 401);
assert.equal(
  (await fetch(path, { headers: { Authorization: "Bearer invalid" } })).status,
  401,
);
const before = await validationBudgetStatus(client);
const invoke = async () => {
  const response = await fetch(path, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    signal: AbortSignal.timeout(180000),
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  return (await response.json()) as {
    ok: boolean;
    reason?: string;
    checked?: number;
    verifiedPrices?: number;
  };
};
const first = await invoke();
assert.equal(first.ok, true);
const middle = await validationBudgetStatus(client);
assert.ok(middle.spentUsd - before.spentUsd <= 0.20001);
const second = await invoke();
assert.equal(second.ok, true);
assert.ok(
  second.reason &&
    ["no_due", "already_run", "monthly_limit", "budget_halted"].includes(
      second.reason,
    ),
);
const after = await validationBudgetStatus(client);
assert.equal(after.spentUsd, middle.spentUsd);
assert.equal(after.attempts, middle.attempts);
assert.equal(after.reservedUsd, middle.reservedUsd);
const health = await fetch(`${base}/internal/operations/health`, {
  headers: { Authorization: `Bearer ${process.env.OPERATIONS_TOKEN}` },
});
assert.equal(health.status, 200);
const readiness: unknown = await health.json();
const report = {
  at: new Date().toISOString(),
  base,
  first,
  second,
  addedChargeUsd: middle.spentUsd - before.spentUsd,
  duplicateAddedChargeUsd: after.spentUsd - middle.spentUsd,
  duplicateAddedAttempts: after.attempts - middle.attempts,
  readiness,
  budget: after,
  scope:
    "Daily cron admission/repeat check. An empty batch does not demonstrate a fresh live two-provider price lookup.",
};
await writeFile(
  process.argv.includes("--local")
    ? ".scratch/price-refresh-local.json"
    : "docs/reports/price-refresh-production.json",
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report));
