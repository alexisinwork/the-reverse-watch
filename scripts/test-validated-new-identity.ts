// Tests new reference insertion and rejected-reference protection; rolls back.
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import postgres from "postgres";

const url = process.env.DIRECT_DATABASE_URL;
if (!url) throw new Error("DIRECT_DATABASE_URL required");
const migration = await readFile(
  "db/migrations/0101_add_validated_reference_identities.sql",
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
      const brand = `Fixture${randomBytes(8).toString("hex")}`;
      const key = randomBytes(32).toString("hex");
      const reserved = await tx<
        { result: { state: string; attemptId: string } }[]
      >`
        select public.ai_watch_validation_reserve_v4(${key},1) as result`;
      assert.equal(reserved[0]!.result.state, "reserved");
      const attempt = reserved[0]!.result.attemptId;
      const evidence = [
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
      ];
      const fact = {
        field: "caseDiameterMm",
        value: 40,
        sources: evidence.map((source) => ({
          ...source,
          quote: "REF1234 case diameter 40 mm",
        })),
      };
      const priceObservation = {
        value: "USD 3500",
        sources: [
          {
            ...evidence[0]!,
            value: "USD 3500",
            quote: "REF1234 market price USD 3500",
          },
          {
            ...evidence[1]!,
            value: "EUR 4000",
            quote: "REF1234 asking price EUR 4000",
          },
        ],
      };
      const imageEvidence = {
        sourceUrl: evidence[0]!.sourceUrl,
        imageUrl: "https://img.example/photo.jpg",
        referenceCode: "REF1234",
        checkedAt: "2026-10-27T00:00:00Z",
      };
      const watch = {
        brand,
        model: "Unverified name",
        referenceCode: "REF1234",
        sourceUrl: evidence[0]!.sourceUrl,
        imageUrl: imageEvidence.imageUrl,
        priceNote: "USD 3500",
        rationale: "Test",
        details: {
          caseDiameterMm: 40,
          price: { amount: 3500, currency: "USD" },
          priceConfirmed: false,
          validationFacts: [fact],
          priceObservation,
          imageEvidence,
          validationEvidence: evidence,
        },
      };
      const published = await tx<{ result: boolean }[]>`
        select public.ai_watch_validated_cache_publish_v7(${attempt}::uuid,'Test',${tx.json([watch])},${tx.json([0.01])}) as result`;
      assert.equal(published[0]!.result, true);
      const rows = await tx<
        {
          model: string;
          reference_confirmed: boolean;
          review_status: string;
          case_diameter_mm: string;
          price_amount: string;
          price_status: string;
          image_url: string;
          state: string;
        }[]
      >`
        select w.model,w.reference_confirmed,w.review_status,w.case_diameter_mm,w.price_amount,w.price_status,w.image_url,i.state
        from private.watch_catalogue w join private.watch_catalogue_intake i on i.watch_id=w.id
        where i.source='validated-cache' and i.source_record_id=${attempt + ":1"}`;
      assert.equal(rows.length, 1);
      assert.equal(rows[0]!.model, "REF1234");
      assert.equal(rows[0]!.reference_confirmed, false);
      assert.equal(rows[0]!.review_status, "pending");
      assert.equal(Number(rows[0]!.case_diameter_mm), 40);
      assert.equal(Number(rows[0]!.price_amount), 3500);
      assert.equal(rows[0]!.price_status, "approximate");
      assert.equal(rows[0]!.image_url, imageEvidence.imageUrl);
      assert.equal(rows[0]!.state, "needs_evidence");
      const retry = await tx<{ result: boolean }[]>`
        select public.ai_watch_validated_cache_publish_v7(${attempt}::uuid,'Test',${tx.json([watch])},${tx.json([0.01])}) as result`;
      assert.equal(retry[0]!.result, true);

      const rejectedBrand = `Rejected${randomBytes(8).toString("hex")}`;
      await tx`insert into private.watch_catalogue(identity_key,brand,model,reference_code,review_status)
        values(${rejectedBrand},${rejectedBrand},'Fixture','REF1234','rejected')`;
      const next = await tx<{ result: { state: string; attemptId: string } }[]>`
        select public.ai_watch_validation_reserve_v4(${randomBytes(32).toString("hex")},1) as result`;
      assert.equal(next[0]!.result.state, "reserved");
      const rejectedAttempt = next[0]!.result.attemptId;
      const rejected = { ...watch, brand: rejectedBrand };
      await assert.rejects(
        tx.savepoint(async (sp) => {
          await sp`select public.ai_watch_validated_cache_publish_v7(${rejectedAttempt}::uuid,'Test',${sp.json([rejected])},${sp.json([0.01])})`;
        }),
      );
      const remaining = await tx<
        { state: string }[]
      >`select state from private.ai_watch_validation_attempts where id=${rejectedAttempt}::uuid`;
      assert.equal(remaining[0]!.state, "reserved");
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  console.log(
    "Validated new-reference checks passed; all changes rolled back.",
  );
} finally {
  await sql.end();
}
