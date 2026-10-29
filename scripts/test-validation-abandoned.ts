import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
const sql = postgres(process.env.DIRECT_DATABASE_URL!, {
  ssl: "require",
  max: 1,
  onnotice: () => undefined,
});
const rollback = new Error("expected rollback");
try {
  try {
    await sql.begin(async (tx) => {
      if (!process.argv.includes("--applied"))
        await tx.unsafe(
          await readFile(
            "db/migrations/0109_recover_abandoned_validation_attempts.sql",
            "utf8",
          ),
        );
      const key = randomBytes(32).toString("hex");
      const [first] = await tx<
        { r: { state: string; attemptId: string } }[]
      >`select public.ai_watch_validation_reserve_v5(${key},1) r`;
      assert.equal(first!.r.state, "reserved");
      const [active] = await tx<
        { r: { state: string } }[]
      >`select public.ai_watch_validation_reserve_v5(${key},1) r`;
      assert.equal(active!.r.state, "in_progress");
      const [before] = await tx<
        { spent_usd: string; reserved_usd: string }[]
      >`select spent_usd,reserved_usd from private.ai_watch_validation_monthly_budget where month_start=date_trunc('month',now() at time zone 'UTC')::date`;
      await tx`update private.ai_watch_validation_attempts set created_at=now()-interval '16 minutes' where id=${first!.r.attemptId}::uuid`;
      const [retried] = await tx<
        { r: { state: string; attemptId: string } }[]
      >`select public.ai_watch_validation_reserve_v5(${key},1) r`;
      assert.equal(retried!.r.state, "reserved");
      assert.notEqual(retried!.r.attemptId, first!.r.attemptId);
      const [old] = await tx<
        { state: string; charged_usd: string }[]
      >`select state,charged_usd from private.ai_watch_validation_attempts where id=${first!.r.attemptId}::uuid`;
      assert.equal(old!.state, "settled");
      assert.equal(Number(old!.charged_usd), 0.025);
      const [after] = await tx<
        { spent_usd: string; reserved_usd: string }[]
      >`select spent_usd,reserved_usd from private.ai_watch_validation_monthly_budget where month_start=date_trunc('month',now() at time zone 'UTC')::date`;
      assert.ok(
        Math.abs(Number(after!.spent_usd) - Number(before!.spent_usd) - 0.025) <
          0.000001,
      );
      assert.equal(Number(after!.reserved_usd), Number(before!.reserved_usd));
      const [late] = await tx<
        { r: boolean }[]
      >`select public.ai_watch_validation_settle_v2(${first!.r.attemptId}::uuid,'[0]'::jsonb) r`;
      assert.equal(late!.r, false);
      await tx`select public.ai_watch_validation_report_overrun_v1(${retried!.r.attemptId}::uuid,'[0.03]'::jsonb)`;
      await tx`update private.ai_watch_validation_attempts set created_at=now()-interval '16 minutes' where id=${retried!.r.attemptId}::uuid`;
      const [halted] = await tx<
        { r: { state: string } }[]
      >`select public.ai_watch_validation_reserve_v5(${key},1) r`;
      assert.equal(halted!.r.state, "budget_halted");
      const [stillHeld] = await tx<
        { state: string }[]
      >`select state from private.ai_watch_validation_attempts where id=${retried!.r.attemptId}::uuid`;
      assert.equal(stillHeld!.state, "reserved");
      const [roles] =
        await tx`select has_function_privilege('anon','public.ai_watch_validation_reserve_v5(text,integer)','execute') as anon,has_function_privilege('authenticated','public.ai_watch_validation_reserve_v5(text,integer)','execute') as authenticated,has_function_privilege('service_role','public.ai_watch_validation_reserve_v5(text,integer)','execute') as service`;
      assert.deepEqual(roles, {
        anon: false,
        authenticated: false,
        service: true,
      });
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  console.log(
    "Active/abandoned/late-settlement/overrun and privilege checks passed; rolled back.",
  );
} finally {
  await sql.end();
}
