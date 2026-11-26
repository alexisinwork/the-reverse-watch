// Migration 0122: a checked watch whose catalogue record already has a
// different photo is published, and the catalogue keeps its own photo.
// Invalid image evidence is still refused. Everything runs in a transaction
// that always rolls back; without --applied the migration is applied inside
// it first.
//
//   node --env-file=.env --import tsx scripts/test-image-conflict-publish.ts [--applied]
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";

import postgres from "postgres";

import { databaseTls } from "./database-tls";

const url = process.env.DIRECT_DATABASE_URL;
if (!url) throw new Error("DIRECT_DATABASE_URL required");
const migration = await readFile(
  "db/migrations/0122_keep_catalogue_image_on_publish.sql",
  "utf8",
);
const sql = postgres(url, {
  max: 1,
  ssl: databaseTls(),
  onnotice: () => undefined,
});
const rollback = new Error("expected rollback");
try {
  await sql.begin(async (tx) => {
    if (!process.argv.includes("--applied")) await tx.unsafe(migration);
    const brand = `Fixture${randomBytes(8).toString("hex")}`;
    const rows = await tx<{ id: string }[]>`
      insert into private.watch_catalogue(identity_key,brand,model,reference_code,image_url)
      values(${brand},${brand},'Fixture','REF1234','https://img.example/existing.jpg')
      returning id`;
    const reserve = async () => {
      const reserved = await tx<
        { result: { state: string; attemptId: string } }[]
      >`select public.ai_watch_validation_reserve_v4(${randomBytes(32).toString("hex")},1) as result`;
      assert.equal(reserved[0]!.result.state, "reserved");
      return reserved[0]!.result.attemptId;
    };
    const evidence = [
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
    ];
    const imageEvidence = {
      sourceUrl: evidence[0]!.sourceUrl,
      imageUrl: "https://img.example/new-photo.jpg",
      referenceCode: "REF1234",
      checkedAt: "2026-11-26T00:00:00Z",
    };
    const watch = {
      brand,
      model: "REF1234",
      referenceCode: "REF1234",
      sourceUrl: evidence[0]!.sourceUrl,
      imageUrl: imageEvidence.imageUrl,
      priceNote: null,
      rationale: "Test",
      details: { imageEvidence, validationEvidence: evidence },
    };

    // Invalid image evidence is still refused and nothing is published.
    const invalidAttempt = await reserve();
    await assert.rejects(
      tx.savepoint(
        (sp) =>
          sp`select public.ai_watch_validated_cache_publish_v6(${invalidAttempt}::uuid,'Test',${sp.json(
            [
              {
                ...watch,
                details: {
                  ...watch.details,
                  imageEvidence: {
                    ...imageEvidence,
                    referenceCode: "OTHER123",
                  },
                },
              },
            ],
          )},${sp.json([0.01])})`,
      ),
    );
    console.log("PASS invalid image evidence is still refused");

    // A different existing photo no longer stops the publication.
    const attempt = await reserve();
    const published = await tx<{ result: boolean }[]>`
      select public.ai_watch_validated_cache_publish_v6(${attempt}::uuid,'Test',${tx.json([watch])},${tx.json([0.01])}) as result`;
    assert.equal(published[0]!.result, true);
    const after = await tx<
      { image_url: string; snapshots: string; evidence: unknown }[]
    >`
      select w.image_url,
        (select count(*) from private.ai_watch_validated_cache_snapshots s where s.attempt_id=${attempt}::uuid)::text snapshots,
        (select i.payload->'imageEvidence' from private.watch_catalogue_intake i
          where i.source_record_id=${`${attempt}:1`}) evidence
      from private.watch_catalogue w where w.id=${rows[0]!.id}::uuid`;
    assert.equal(after[0]!.image_url, "https://img.example/existing.jpg");
    assert.equal(after[0]!.snapshots, "1");
    assert.deepEqual(after[0]!.evidence, imageEvidence);
    console.log(
      "PASS a different catalogue photo is kept and the checked answer is published",
    );

    const privileges = await tx<{ anon: boolean; service: boolean }[]>`
      select has_function_privilege('anon','public.ai_watch_validated_cache_publish_v6(uuid,text,jsonb,jsonb)','execute') anon,
        has_function_privilege('service_role','public.ai_watch_validated_cache_publish_v6(uuid,text,jsonb,jsonb)','execute') service`;
    assert.deepEqual(privileges[0], { anon: false, service: true });
    console.log("PASS only the server may publish");
    throw rollback;
  });
} catch (error) {
  if (error !== rollback) throw error;
  console.log("Image conflict checks passed; all changes rolled back.");
} finally {
  await sql.end({ timeout: 2 });
}
