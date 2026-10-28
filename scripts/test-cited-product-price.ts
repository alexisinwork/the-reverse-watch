// Tests atomic approximate price publication in a rolled-back transaction.
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import postgres from "postgres";

const url = process.env.DIRECT_DATABASE_URL;
if (!url) throw new Error("DIRECT_DATABASE_URL required");
const migration = await readFile(
  "db/migrations/0103_allow_cited_product_fact_sources.sql",
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
      const rows = await tx<
        { id: string }[]
      >`insert into private.watch_catalogue(identity_key,brand,model,reference_code)
        values(${brand},${brand},'Fixture','REF1234') returning id`;
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
          citedUrls: ["https://product-one.example/watch"],
          checkedAt: "2026-10-27T00:00:00Z",
        },
        {
          provider: "muse",
          sourceUrl: "https://second.example/watch",
          citedUrls: ["https://product-two.example/watch"],
          checkedAt: "2026-10-27T00:00:00Z",
        },
      ];
      const observation = {
        value: "USD 3500",
        sources: [
          {
            ...evidence[0]!,
            sourceUrl: evidence[0]!.citedUrls[0]!,
            citedUrl: evidence[0]!.citedUrls[0]!,
            value: "USD 3500",
            quote: "REF1234 market price USD 3500",
          },
          {
            ...evidence[1]!,
            sourceUrl: evidence[1]!.citedUrls[0]!,
            citedUrl: evidence[1]!.citedUrls[0]!,
            value: "EUR 4000",
            quote: "REF1234 asking price EUR 4000",
          },
        ],
      };
      const watch = {
        brand,
        model: "REF1234",
        referenceCode: "REF1234",
        sourceUrl: evidence[0]!.sourceUrl,
        imageUrl: null,
        priceNote: "USD 3500",
        rationale: "Test",
        details: {
          price: { amount: 3500, currency: "USD" },
          priceConfirmed: false,
          priceObservation: observation,
          validationEvidence: evidence,
        },
      };
      const bad = {
        ...watch,
        details: {
          ...watch.details,
          priceObservation: {
            ...observation,
            sources: observation.sources.map((source) => ({
              ...source,
              citedUrl: "https://uncited.example/watch",
            })),
          },
        },
      };
      await assert.rejects(
        tx.savepoint(async (sp) => {
          await sp`select public.ai_watch_validated_cache_publish_v7(${attempt}::uuid,'Test',${sp.json([bad])},${sp.json([0.01])})`;
        }),
      );
      const before = await tx<{ state: string; n: string }[]>`select a.state,
        (select count(*) from private.ai_watch_validated_cache_snapshots s where s.attempt_id=a.id)::text n
        from private.ai_watch_validation_attempts a where a.id=${attempt}::uuid`;
      assert.equal(before[0]!.state, "reserved");
      assert.equal(before[0]!.n, "0");
      await tx`update private.watch_catalogue set price_amount=4000,price_currency='USD',price_status='approximate' where id=${rows[0]!.id}::uuid`;
      await assert.rejects(
        tx.savepoint(async (sp) => {
          await sp`select public.ai_watch_validated_cache_publish_v7(${attempt}::uuid,'Test',${sp.json([watch])},${sp.json([0.01])})`;
        }),
      );
      const conflict = await tx<
        { price_amount: string }[]
      >`select price_amount from private.watch_catalogue where id=${rows[0]!.id}::uuid`;
      assert.equal(Number(conflict[0]!.price_amount), 4000);
      await tx`update private.watch_catalogue set price_amount=null,price_currency=null,price_status='unconfirmed' where id=${rows[0]!.id}::uuid`;
      const published = await tx<{ result: boolean }[]>`
        select public.ai_watch_validated_cache_publish_v7(${attempt}::uuid,'Test',${tx.json([watch])},${tx.json([0.01])}) as result`;
      assert.equal(published[0]!.result, true);
      const actual = await tx<
        {
          price_amount: string;
          price_currency: string;
          price_status: string;
          payload: { priceObservation: unknown };
        }[]
      >`
        select w.price_amount,w.price_currency,w.price_status,i.payload from private.watch_catalogue w
        join private.watch_catalogue_intake i on i.watch_id=w.id
        where w.id=${rows[0]!.id}::uuid and i.source_record_id=${attempt + ":1"}`;
      assert.equal(Number(actual[0]!.price_amount), 3500);
      assert.equal(actual[0]!.price_currency, "USD");
      assert.equal(actual[0]!.price_status, "approximate");
      assert.deepEqual(actual[0]!.payload.priceObservation, observation);
      const retry = await tx<{ result: boolean }[]>`
        select public.ai_watch_validated_cache_publish_v7(${attempt}::uuid,'Test',${tx.json([watch])},${tx.json([0.01])}) as result`;
      assert.equal(retry[0]!.result, true);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  console.log(
    "Validated approximate price checks passed; all changes rolled back.",
  );
} finally {
  await sql.end();
}
