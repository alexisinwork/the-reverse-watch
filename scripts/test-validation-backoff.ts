// Checks migration 0121: the wait between paid re-checks of one saved search
// grows with each failed check (5 minutes, 1 hour, 1 day, then 7 days), a
// published result is still 'valid' at once, and only the service role may
// call the function. Runs in a transaction that always rolls back; applies
// 0121 inside it first unless --applied is passed.
//
//   node --env-file=.env --import tsx scripts/test-validation-backoff.ts [--applied]
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";

import postgres from "postgres";

import { databaseTls } from "./database-tls";

const url = process.env.DIRECT_DATABASE_URL;
if (!url) throw new Error("DIRECT_DATABASE_URL required");
const migration = await readFile(
  "db/migrations/0121_validation_backoff.sql",
  "utf8",
);
const sql = postgres(url, {
  max: 1,
  ssl: databaseTls(),
  onnotice: () => undefined,
});
const rollback = new Error("expected rollback");

// After n failed checks, a re-check is refused just before the wait ends and
// allowed just after it.
const schedule = [
  { failures: 1, refusedAt: "4 minutes", allowedAt: "6 minutes" },
  { failures: 2, refusedAt: "59 minutes", allowedAt: "61 minutes" },
  { failures: 3, refusedAt: "23 hours", allowedAt: "25 hours" },
  { failures: 4, refusedAt: "6 days", allowedAt: "8 days" },
  { failures: 9, refusedAt: "6 days", allowedAt: "8 days" },
];

try {
  try {
    await sql.begin(async (tx) => {
      if (!process.argv.includes("--applied")) await tx.unsafe(migration);
      const [privileges] = await tx<
        { anon: boolean; authenticated: boolean; service: boolean }[]
      >`select has_function_privilege('anon','public.ai_watch_validation_reserve_v4(text,integer)','execute') as anon,
               has_function_privilege('authenticated','public.ai_watch_validation_reserve_v4(text,integer)','execute') as authenticated,
               has_function_privilege('service_role','public.ai_watch_validation_reserve_v4(text,integer)','execute') as service`;
      assert.deepEqual(privileges, {
        anon: false,
        authenticated: false,
        service: true,
      });

      for (const step of schedule) {
        const key = randomBytes(32).toString("hex");
        const reserve = async () =>
          (
            await tx<{ result: { state: string; attemptId?: string } }[]>`
              select public.ai_watch_validation_reserve_v5(${key},1) as result`
          )[0]!.result;
        // n failed checks, each reserved and settled without a snapshot.
        for (let index = 0; index < step.failures; index += 1) {
          await tx`update private.ai_watch_validation_attempts
            set settled_at = now() - interval '30 days'
            where cache_key = ${key} and state = 'settled'`;
          const attempt = await reserve();
          assert.equal(attempt.state, "reserved", `failure ${index + 1}`);
          await tx`select public.ai_watch_validation_settle_v2(${attempt.attemptId!}::uuid, ${tx.json([0.001])})`;
        }
        await tx`update private.ai_watch_validation_attempts
          set settled_at = now() - ${step.refusedAt}::interval
          where cache_key = ${key} and state = 'settled'`;
        assert.equal(
          (await reserve()).state,
          "retry_later",
          `${step.failures} failures, ${step.refusedAt} later`,
        );
        await tx`update private.ai_watch_validation_attempts
          set settled_at = now() - ${step.allowedAt}::interval
          where cache_key = ${key} and state = 'settled'`;
        const next = await reserve();
        assert.equal(
          next.state,
          "reserved",
          `${step.failures} failures, ${step.allowedAt} later`,
        );
        // A published result answers 'valid' whatever the failures before.
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
                checkedAt: "2026-11-26T00:00:00Z",
              },
              {
                provider: "muse",
                sourceUrl: "https://second.example/watch",
                checkedAt: "2026-11-26T00:00:00Z",
              },
            ],
          },
        };
        await tx`select public.ai_watch_validated_cache_publish_v3(${next.attemptId!}::uuid,'Test',${tx.json([watch])},${tx.json([0.001])})`;
        assert.equal((await reserve()).state, "valid");
        console.log(
          `PASS ${step.failures} failed check(s): refused after ${step.refusedAt}, allowed after ${step.allowedAt}, valid once published`,
        );
      }
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  console.log("Validation backoff checks passed; all changes rolled back.");
} finally {
  await sql.end();
}
