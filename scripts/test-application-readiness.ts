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
            "db/migrations/0110_application_readiness.sql",
            "utf8",
          ),
        );
      const [row] = await tx<
        { result: Record<string, unknown> }[]
      >`select public.application_readiness_v1() as result`;
      assert.equal(row!.result.catalogueAvailable, true);
      assert.equal(row!.result.validationContractReady, true);
      assert.equal(row!.result.tableAccessProtected, true);
      assert.equal(row!.result.staleReservations, 0);
      const [roles] =
        await tx`select has_function_privilege('anon','public.application_readiness_v1()','execute') as anon, has_function_privilege('authenticated','public.application_readiness_v1()','execute') as authenticated, has_function_privilege('service_role','public.application_readiness_v1()','execute') as service`;
      assert.deepEqual(roles, {
        anon: false,
        authenticated: false,
        service: true,
      });
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  console.log(
    "Readiness database contract and privilege checks passed; rolled back.",
  );
} finally {
  await sql.end();
}
