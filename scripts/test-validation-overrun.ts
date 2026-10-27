// Tests the shared halt and accounting inside a transaction that always rolls back.
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import postgres from "postgres";

const url = process.env.DIRECT_DATABASE_URL;
if (!url) throw new Error("DIRECT_DATABASE_URL required");
const migration = await readFile(
  "db/migrations/0095_halt_on_validation_overrun.sql",
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
      const key = randomBytes(32).toString("hex");
      const reserved = await tx<
        { result: { state: string; attemptId: string } }[]
      >`
        select public.ai_watch_validation_reserve_v3(${key}, 1) as result`;
      assert.equal(reserved[0]!.result.state, "reserved");
      const attempt = reserved[0]!.result.attemptId;
      await assert.rejects(
        tx.savepoint(async (sp) => {
          await sp`select public.ai_watch_validation_report_overrun_v1(${attempt}::uuid, ${sp.json([0.02])})`;
        }),
      );
      const reported = await tx<{ result: boolean }[]>`
        select public.ai_watch_validation_report_overrun_v1(${attempt}::uuid, ${tx.json([0.03])}) as result`;
      assert.equal(reported[0]!.result, true);
      const retry = await tx<{ result: boolean }[]>`
        select public.ai_watch_validation_report_overrun_v1(${attempt}::uuid, ${tx.json([0.03])}) as result`;
      assert.equal(retry[0]!.result, true);
      await assert.rejects(
        tx.savepoint(async (sp) => {
          await sp`select public.ai_watch_validation_report_overrun_v1(${attempt}::uuid, ${sp.json([0.04])})`;
        }),
      );
      const blocked = await tx<{ result: { state: string } }[]>`
        select public.ai_watch_validation_reserve_v3(${randomBytes(32).toString("hex")}, 1) as result`;
      assert.equal(blocked[0]!.result.state, "budget_halted");
      const rows = await tx<{ state: string; observed_costs: number[] }[]>`
        select a.state,o.observed_costs from private.ai_watch_validation_attempts a
        join private.ai_watch_validation_overruns o on o.attempt_id=a.id where a.id=${attempt}::uuid`;
      assert.equal(rows[0]!.state, "reserved");
      assert.deepEqual(rows[0]!.observed_costs, [0.03]);
      const grants = await tx<{ anon: boolean; service: boolean }[]>`
        select has_function_privilege('anon','public.ai_watch_validation_report_overrun_v1(uuid,jsonb)','execute') as anon,
        has_function_privilege('service_role','public.ai_watch_validation_report_overrun_v1(uuid,jsonb)','execute') as service`;
      assert.equal(grants[0]!.anon, false);
      assert.equal(grants[0]!.service, true);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  console.log("Validation overrun checks passed; all changes rolled back.");
} finally {
  await sql.end();
}
