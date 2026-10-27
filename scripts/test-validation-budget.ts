// Exercises migration 0091 in a rolled-back transaction, without provider calls.
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import postgres from "postgres";

const url = process.env.DIRECT_DATABASE_URL;
if (!url) throw new Error("DIRECT_DATABASE_URL required");
const migration = await readFile(
  "db/migrations/0091_validation_budget_attempts.sql",
  "utf8",
);
const sql = postgres(url, {
  max: 1,
  ssl: "require",
  onnotice: () => undefined,
});
const rollback = new Error("expected rollback");
try {
  try {
    await sql.begin(async (tx) => {
      if (!process.argv.includes("--applied")) await tx.unsafe(migration);
      const privileges = await tx<
        { anon_can_reserve: boolean; service_can_reserve: boolean }[]
      >`
        select has_function_privilege('anon', 'public.ai_watch_validation_reserve_v2(text,integer)', 'execute') as anon_can_reserve,
          has_function_privilege('service_role', 'public.ai_watch_validation_reserve_v2(text,integer)', 'execute') as service_can_reserve`;
      assert.equal(privileges[0]!.anon_can_reserve, false);
      assert.equal(privileges[0]!.service_can_reserve, true);
      const key = randomBytes(32).toString("hex");
      const first = await tx<
        { result: { state: string; attemptId: string; reservedUsd: number } }[]
      >`
        select public.ai_watch_validation_reserve_v2(${key}, 8) as result`;
      assert.equal(first[0]!.result.state, "reserved");
      assert.equal(Number(first[0]!.result.reservedUsd), 0.2);
      const again = await tx<{ result: { state: string } }[]>`
        select public.ai_watch_validation_reserve_v2(${key}, 8) as result`;
      assert.equal(again[0]!.result.state, "in_progress");
      await assert.rejects(
        tx.savepoint(async (sp) => {
          await sp`select public.ai_watch_validation_settle_v2(${first[0]!.result.attemptId}::uuid, ${sp.json([0.026, 0, 0, 0, 0, 0, 0, 0])})`;
        }),
      );
      const settled = await tx<{ result: boolean }[]>`
        select public.ai_watch_validation_settle_v2(${first[0]!.result.attemptId}::uuid, ${tx.json([0.01, 0, 0, 0, 0, 0, 0, 0])}) as result`;
      assert.equal(settled[0]!.result, true);
      const repeated = await tx<{ result: boolean }[]>`
        select public.ai_watch_validation_settle_v2(${first[0]!.result.attemptId}::uuid, ${tx.json([0.01, 0, 0, 0, 0, 0, 0, 0])}) as result`;
      assert.equal(repeated[0]!.result, false);
      await tx`update private.ai_watch_validation_monthly_budget set spent_usd=99.99, reserved_usd=0 where month_start=date_trunc('month',now() at time zone 'UTC')::date`;
      const capped = await tx<{ result: { state: string } }[]>`
        select public.ai_watch_validation_reserve_v2(${randomBytes(32).toString("hex")}, 1) as result`;
      assert.equal(capped[0]!.result.state, "monthly_limit");
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  console.log(
    "Validation budget transaction checks passed; all changes rolled back.",
  );
} finally {
  await sql.end();
}
