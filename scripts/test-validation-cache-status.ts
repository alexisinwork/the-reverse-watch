// Tests cache lifecycle transitions with disposable rows in a rolled-back transaction.
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import postgres from "postgres";

const url = process.env.DIRECT_DATABASE_URL;
if (!url) throw new Error("DIRECT_DATABASE_URL required");
const migration = await readFile(
  "db/migrations/0096_sync_validation_cache_status.sql",
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
      async function draft() {
        const key = randomBytes(32).toString("hex");
        await tx`insert into private.ai_watch_searches(kind,cache_key,brief,summary)
          values('film',${key},'{}'::jsonb,'Test')`;
        const rows = await tx<
          { result: { state: string; attemptId: string } }[]
        >`
          select public.ai_watch_validation_reserve_v3(${key},1) as result`;
        assert.equal(rows[0]!.result.state, "reserved");
        return { key, attempt: rows[0]!.result.attemptId };
      }
      async function status(key: string) {
        const rows = await tx<
          { validation_status: string; validation_error: string | null }[]
        >`
          select validation_status,validation_error from private.ai_watch_searches where cache_key=${key}`;
        return rows[0]!;
      }
      const first = await draft();
      assert.equal((await status(first.key)).validation_status, "validating");
      await tx`select public.ai_watch_validation_settle_v2(${first.attempt}::uuid,${tx.json([0.01])})`;
      assert.equal((await status(first.key)).validation_status, "failed");
      const second = await draft();
      const watch = {
        brand: "Fixture",
        model: "REF123",
        referenceCode: "REF123",
        sourceUrl: "https://first.example/watch",
        imageUrl: null,
        priceNote: null,
        rationale: "Test",
        details: {
          validationEvidence: [
            {
              provider: "perplexity",
              sourceUrl: "https://first.example/watch",
              checkedAt: "2026-10-27T00:00:00Z",
            },
            {
              provider: "muse",
              sourceUrl: "https://second.example/watch",
              checkedAt: "2026-10-27T00:00:00Z",
            },
          ],
        },
      };
      await tx`select public.ai_watch_validated_cache_publish_v3(${second.attempt}::uuid,'Test',${tx.json([watch])},${tx.json([0.01])})`;
      assert.equal((await status(second.key)).validation_status, "valid");
      const third = await draft();
      await tx`select public.ai_watch_validation_report_overrun_v1(${third.attempt}::uuid,${tx.json([0.03])})`;
      assert.deepEqual(await status(third.key), {
        validation_status: "failed",
        validation_error: "Provider cost exceeded reservation",
      });
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  console.log("Cache lifecycle checks passed; all changes rolled back.");
} finally {
  await sql.end();
}
