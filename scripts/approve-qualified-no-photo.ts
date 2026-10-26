// Owner-approved bulk review: a missing image alone does not block a watch
// that has an exact listed reference, usable approximate/confirmed price and
// the catalogue's active filter facts. Photos are acquired only on selection.
import postgres from "postgres";

const databaseUrl = process.env.DIRECT_DATABASE_URL;
if (!databaseUrl) throw new Error("DIRECT_DATABASE_URL required");
const sql = postgres(databaseUrl, {
  max: 1,
  ssl: "require",
  connect_timeout: 10,
  onnotice: () => undefined,
});

try {
  const candidates = await sql<{ id: string }[]>`
    select id::text from private.watch_catalogue
    where review_status <> 'rejected'
      and image_url is null
      and price_amount is not null
      and price_status <> 'unconfirmed'
      and source_url is not null
      and reference_confirmed
      and case_diameter_mm is not null
      and movement is not null
      and cardinality(styles) > 0`;
  const updated = await sql<{ id: string }[]>`
    update private.watch_catalogue
    set review_status='approved',reviewed_at=coalesce(reviewed_at,now()),updated_at=now()
    where id in ${sql(candidates.map((row) => row.id))}
      and review_status <> 'rejected'
      and review_status <> 'approved'
    returning id::text`;
  console.log(
    JSON.stringify(
      {
        eligibleWithoutPhoto: candidates.length,
        newlyApproved: updated.length,
        alreadyApproved: candidates.length - updated.length,
      },
      null,
      2,
    ),
  );
} finally {
  await sql.end();
}
