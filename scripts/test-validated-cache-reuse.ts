// Test cache-publication/reservation ordering with all writes rolled back.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import postgres from "postgres";

const url = process.env.DIRECT_DATABASE_URL;
if (!url) throw new Error("DIRECT_DATABASE_URL required");
const migration = await readFile(
  "db/migrations/0093_reuse_validated_before_reserving.sql",
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
        select public.ai_watch_validation_reserve_v2(${key}, 1) as result`;
      assert.equal(reserved[0]!.result.state, "reserved");
      const attempt = reserved[0]!.result.attemptId;
      const watch = {
        brand: "Example",
        model: "Watch",
        referenceCode: "REF-123",
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
      await tx`select public.ai_watch_validated_cache_publish_v2(${attempt}::uuid, 'Test', ${tx.json([watch])}, ${tx.json([0.01])})`;
      const reused = await tx<{ result: { state: string } }[]>`
        select public.ai_watch_validation_reserve_v2(${key}, 1) as result`;
      assert.equal(reused[0]!.result.state, "valid");
      const rows = await tx<
        { count: number }[]
      >`select count(*)::int as count from private.ai_watch_validation_attempts where cache_key=${key}`;
      assert.equal(rows[0]!.count, 1);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  console.log("Validated cache reuse checks passed; all changes rolled back.");
} finally {
  await sql.end();
}
