// Exercises the retry cooldown in a transaction that always rolls back.
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import postgres from "postgres";

const url = process.env.DIRECT_DATABASE_URL;
if (!url) throw new Error("DIRECT_DATABASE_URL required");
const migration = await readFile(
  "db/migrations/0097_validation_retry_cooldown.sql",
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
      const reserve = () => tx<
        { result: { state: string; attemptId?: string } }[]
      >`
        select public.ai_watch_validation_reserve_v4(${key},1) as result`;
      const first = (await reserve())[0]!.result;
      assert.equal(first.state, "reserved");
      assert.ok(first.attemptId);
      assert.equal((await reserve())[0]!.result.state, "in_progress");
      await tx`select public.ai_watch_validation_settle_v2(${first.attemptId}::uuid,${tx.json([0.01])})`;
      assert.equal((await reserve())[0]!.result.state, "retry_later");
      await tx`update private.ai_watch_validation_attempts set settled_at=now()-interval '6 minutes'
        where id=${first.attemptId}::uuid`;
      const second = (await reserve())[0]!.result;
      assert.equal(second.state, "reserved");
      assert.ok(second.attemptId);
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
      await tx`select public.ai_watch_validated_cache_publish_v3(${second.attemptId}::uuid,'Test',${tx.json([watch])},${tx.json([0.01])})`;
      assert.equal((await reserve())[0]!.result.state, "valid");
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  console.log("Validation retry checks passed; all changes rolled back.");
} finally {
  await sql.end();
}
