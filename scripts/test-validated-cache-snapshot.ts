// Exercises snapshot publication with production schema inside a rolled-back transaction.
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import postgres from "postgres";

const url = process.env.DIRECT_DATABASE_URL;
if (!url) throw new Error("DIRECT_DATABASE_URL required");
const migration = await readFile(
  "db/migrations/0092_validated_cache_snapshots.sql",
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
      await assert.rejects(
        tx.savepoint(async (sp) => {
          await sp`select public.ai_watch_validated_cache_publish_v2(${attempt}::uuid, 'Test', ${sp.json([{ ...watch, details: {} }])}, ${sp.json([0.01])})`;
        }),
      );
      const stillReserved = await tx<
        { state: string }[]
      >`select state from private.ai_watch_validation_attempts where id=${attempt}::uuid`;
      assert.equal(stillReserved[0]!.state, "reserved");
      const written = await tx<{ result: boolean }[]>`
        select public.ai_watch_validated_cache_publish_v2(${attempt}::uuid, 'Test', ${tx.json([watch])}, ${tx.json([0.01])}) as result`;
      assert.equal(written[0]!.result, true);
      const read = await tx<
        { result: { validationStatus: string; watches: unknown[] } }[]
      >`
        select public.ai_watch_validated_cache_get_v2(${key}) as result`;
      assert.equal(read[0]!.result.validationStatus, "valid");
      assert.equal(read[0]!.result.watches.length, 1);
      const retry = await tx<{ result: boolean }[]>`
        select public.ai_watch_validated_cache_publish_v2(${attempt}::uuid, 'Test', ${tx.json([watch])}, ${tx.json([0.01])}) as result`;
      assert.equal(retry[0]!.result, true);
      await assert.rejects(
        tx.savepoint(async (sp) => {
          await sp`select public.ai_watch_validated_cache_publish_v2(${attempt}::uuid, 'Changed', ${sp.json([watch])}, ${sp.json([0.01])})`;
        }),
      );
      const permissions = await tx<
        { anon_read: boolean; service_read: boolean }[]
      >`
        select has_function_privilege('anon','public.ai_watch_validated_cache_get_v2(text)','execute') as anon_read,
          has_function_privilege('service_role','public.ai_watch_validated_cache_get_v2(text)','execute') as service_read`;
      assert.equal(permissions[0]!.anon_read, false);
      assert.equal(permissions[0]!.service_read, true);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  console.log(
    "Validated cache transaction checks passed; all changes rolled back.",
  );
} finally {
  await sql.end();
}
