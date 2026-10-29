import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
const sql = postgres(process.env.DIRECT_DATABASE_URL!, {
  ssl: "require",
  max: 1,
  onnotice: () => undefined,
});
const rollback = new Error("expected rollback");
try {
  try {
    await sql.begin(async (tx) => {
      if (!process.argv.includes("--applied"))
        await tx.unsafe(
          await readFile(
            "db/migrations/0111_server_only_analytics.sql",
            "utf8",
          ),
        );
      const [row] = await tx<
        { result: { analyticsAccessProtected: boolean } }[]
      >`select public.application_readiness_v2() as result`;
      assert.equal(row!.result.analyticsAccessProtected, true);
      const [roles] =
        await tx`select has_function_privilege('anon','public.application_readiness_v2()','execute') as anon,has_function_privilege('authenticated','public.application_readiness_v2()','execute') as authenticated,has_function_privilege('service_role','public.application_readiness_v2()','execute') as service`;
      assert.deepEqual(roles, {
        anon: false,
        authenticated: false,
        service: true,
      });
      await tx`set local role service_role`;
      await tx`select public.quiz_funnel_summary_v1(now()-interval '1 hour',now())`;
      await tx`select public.discovery_funnel_summary_v1(now()-interval '1 hour',now())`;
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  console.log(
    "Server-only analytics permissions and service reads passed; rolled back.",
  );
} finally {
  await sql.end();
}
