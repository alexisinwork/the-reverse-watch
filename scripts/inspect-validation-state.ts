import postgres from "postgres";

const url = process.env.DIRECT_DATABASE_URL;
if (!url) throw new Error("DIRECT_DATABASE_URL required");
const sql = postgres(url, {
  ssl: "require",
  max: 1,
  onnotice: () => undefined,
});
try {
  const states =
    await sql`select validation_status, count(*)::int as total from private.ai_watch_searches group by validation_status order by validation_status`;
  const budgets =
    await sql`select month_start, reserved_usd, spent_usd from private.ai_watch_validation_monthly_budget order by month_start`;
  console.log(JSON.stringify({ states, budgets }));
} finally {
  await sql.end();
}
