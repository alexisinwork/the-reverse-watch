// Recheck only newly imported primary-reference confirmations, not the cache.
import postgres from "postgres";
import { inspectSourcePage } from "../app/domain/source-pages.server";
const url = process.env.DIRECT_DATABASE_URL;
if (!url) throw new Error("DIRECT_DATABASE_URL required");
const sql = postgres(url, {
  max: 1,
  ssl: "require",
  connect_timeout: 10,
  onnotice: () => undefined,
});
try {
  const rows = await sql<
    { id: string; brand: string; reference_code: string; source_url: string }[]
  >`select id,brand,reference_code,source_url from private.watch_catalogue where import_source is not null and reference_confirmed and source_url is not null and review_status='pending'`;
  for (const row of rows) {
    const result = await inspectSourcePage(
      row.source_url,
      row.reference_code,
      fetch,
    );
    if (!result.referenceFound) {
      await sql.begin(async (tx) => {
        await tx`update private.watch_catalogue set reference_confirmed=false,price_status='unconfirmed',updated_at=now(),price_evidence=price_evidence || '{"referenceRecheck":"exact_variant_not_confirmed"}'::jsonb where id=${row.id} and import_source is not null and review_status='pending'`;
        await tx`update private.watch_catalogue_intake set state='needs_evidence',last_error='exact_variant_not_confirmed',updated_at=now() where watch_id=${row.id}`;
      });
    }
    console.log(
      JSON.stringify({
        reference: `${row.brand} ${row.reference_code}`,
        exactReferenceConfirmed: result.referenceFound,
      }),
    );
  }
} finally {
  await sql.end();
}
