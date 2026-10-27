// Uses isolated fixtures and rolls back every write, including the migration.
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import postgres from "postgres";

const url = process.env.DIRECT_DATABASE_URL;
if (!url) throw new Error("DIRECT_DATABASE_URL required");
const migration = await readFile(
  "db/migrations/0094_archive_validated_reference_evidence.sql",
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
      const brand = `Fixture${randomBytes(8).toString("hex")}`;
      const reference = "REF1234";
      const rows = await tx<{ id: string }[]>`
        insert into private.watch_catalogue(identity_key,brand,model,reference_code)
        values (${brand},${brand},'Fixture',${reference}) returning id`;
      const reserved = await tx<
        { result: { state: string; attemptId: string } }[]
      >`
        select public.ai_watch_validation_reserve_v2(${key},2) as result`;
      assert.equal(reserved[0]!.result.state, "reserved");
      const attempt = reserved[0]!.result.attemptId;
      const watch = {
        brand,
        model: "Fixture",
        referenceCode: reference,
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
              sourceQuote: "Fixture REF1234 Person Work",
              person: "Person",
              work: "Work",
            },
            {
              provider: "muse",
              sourceUrl: "https://second.example/watch",
              checkedAt: "2026-10-27T00:00:00Z",
            },
          ],
        },
      };
      const watches = [watch, { ...watch, referenceCode: "UNKNOWN-5678" }];
      const publish = () => tx<{ result: boolean }[]>`
        select public.ai_watch_validated_cache_publish_v3(${attempt}::uuid, 'Test', ${tx.json(watches)}, ${tx.json([0.01, 0.01])}) as result`;
      assert.equal((await publish())[0]!.result, true);
      assert.equal((await publish())[0]!.result, true);
      const archived = await tx<
        {
          watch_id: string | null;
          state: string;
          payload: { referenceCode: string };
        }[]
      >`
        select watch_id,state,payload from private.watch_catalogue_intake
        where source='validated-cache' and snapshot='source-v1' and source_record_id like ${attempt + ":%"}
        order by source_record_id`;
      assert.equal(archived.length, 2);
      assert.equal(archived[0]!.watch_id, rows[0]!.id);
      assert.equal(archived[0]!.state, "needs_evidence");
      assert.deepEqual(archived[0]!.payload, {
        brand,
        referenceCode: reference,
        validationEvidence: watch.details.validationEvidence,
      });
      assert.equal(archived[1]!.watch_id, null);
      assert.equal(archived[1]!.state, "blocked_identity");
      const permissions = await tx<{ anon: boolean; service: boolean }[]>`
        select has_function_privilege('anon','public.ai_watch_validated_cache_publish_v3(uuid,text,jsonb,jsonb)','execute') as anon,
        has_function_privilege('service_role','public.ai_watch_validated_cache_publish_v3(uuid,text,jsonb,jsonb)','execute') as service`;
      assert.equal(permissions[0]!.anon, false);
      assert.equal(permissions[0]!.service, true);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  console.log(
    "Cache and catalogue evidence checks passed; all changes rolled back.",
  );
} finally {
  await sql.end();
}
