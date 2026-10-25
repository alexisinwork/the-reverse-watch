/** Owner exception, 2026-10-25: only disposable integration-test fixtures. */
import postgres from "postgres";

export async function removeLocalTestPartners(ids: readonly string[]) {
  if (ids.length === 0) return;
  if (!process.env.DIRECT_DATABASE_URL)
    throw new Error("Test fixture cleanup requires DIRECT_DATABASE_URL.");
  const sql = postgres(process.env.DIRECT_DATABASE_URL, {
    max: 1,
    connect_timeout: 10,
    ssl: "require",
  });
  try {
    await sql.begin(async (tx) => {
      await tx`set local statement_timeout = '5s'`;
      for (const id of ids) {
        const rows = await tx`select id from private.partner_sites
          where id = ${id}::uuid and active = false and secret_key_hash is null
          and name in ('Local integration disabled check', 'Local integration quota check')
          and notes like 'Automated integration test;%'
          and allowed_origins = array['http://localhost:8080']::text[]
          and monthly_quota = 1 for update`;
        if (rows.length !== 1)
          throw new Error(
            "Cleanup refused: record is not a disabled local test fixture.",
          );
        const usage =
          await tx`select feature, uses from private.partner_site_usage where site_id = ${id}::uuid`;
        if (usage.some((row) => row.feature !== "quiz" || Number(row.uses) > 1))
          throw new Error("Cleanup refused: unexpected usage on test fixture.");
        // One exact locked fixture and its synthetic counter, never partner history.
        await tx`delete from private.partner_site_usage where site_id = ${id}::uuid`;
        await tx`delete from private.partner_sites where id = ${id}::uuid and active = false`;
      }
    });
  } finally {
    await sql.end();
  }
}
