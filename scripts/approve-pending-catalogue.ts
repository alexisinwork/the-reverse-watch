// Owner-requested one-time editorial approval. Never changes fact verification.
import { mkdir, writeFile } from "node:fs/promises";
import postgres from "postgres";
const url = process.env.DIRECT_DATABASE_URL;
if (!url) throw new Error("DIRECT_DATABASE_URL required");
const sql = postgres(url, {
  max: 1,
  ssl: "require",
  connect_timeout: 10,
  onnotice: () => undefined,
});
try {
  const at = new Date().toISOString();
  await mkdir("data/watch-archive/approvals", { recursive: true });
  let approved = 0;
  await sql.begin(async (tx) => {
    const rows =
      await tx`select id,review_status,reviewed_at,updated_at from private.watch_catalogue where review_status='pending' for update`;
    await writeFile(
      `data/watch-archive/approvals/${at.replace(/[:.]/g, "-")}.json`,
      JSON.stringify({ at, rows }, null, 2),
    );
    const changed =
      await tx`update private.watch_catalogue set review_status='approved',reviewed_at=now(),updated_at=now() where review_status='pending' returning id`;
    approved = changed.length;
  });
  const counts =
    await sql`select count(*)::int as total,count(*) filter(where review_status='pending')::int as pending,count(*) filter(where review_status='approved')::int as approved,count(*) filter(where review_status='rejected')::int as rejected,
    count(*) filter(where import_source is null or (price_amount is not null and price_status<>'unconfirmed'))::int as recommendation_pool,
    count(*) filter(where import_source is not null and (price_amount is null or price_status='unconfirmed'))::int as awaiting_price
    from private.watch_catalogue`;
  const report = {
    at,
    approvedThisRun: approved,
    counts,
    scope:
      "One-time owner editorial approval only; prices, primary-reference verification, facts and rejected rows unchanged. Ignored local before-state backup saved.",
  };
  await writeFile(
    "docs/reports/catalogue-owner-approval.json",
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await sql.end();
}
