import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
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
            "db/migrations/0104_validation_budget_admin_status.sql",
            "utf8",
          ),
        );
      const [row] = await tx<
        {
          status: {
            limitUsd: number;
            spentUsd: number;
            reservedUsd: number;
            remainingUsd: number;
            attempts: number;
            inProgress: number;
            validated: number;
            failed: number;
          };
        }[]
      >`select public.ai_watch_validation_admin_status_v1() as status`;
      assert.equal(row!.status.limitUsd, 100);
      assert.equal(
        row!.status.attempts,
        row!.status.inProgress + row!.status.validated + row!.status.failed,
      );
      assert.ok(
        Math.abs(
          row!.status.remainingUsd -
            Math.max(0, 100 - row!.status.spentUsd - row!.status.reservedUsd),
        ) < 0.000001,
      );
      const [roles] = await tx<
        { anon: boolean; authenticated: boolean; service: boolean }[]
      >`select has_function_privilege('anon','public.ai_watch_validation_admin_status_v1()','execute') as anon, has_function_privilege('authenticated','public.ai_watch_validation_admin_status_v1()','execute') as authenticated, has_function_privilege('service_role','public.ai_watch_validation_admin_status_v1()','execute') as service`;
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
    "Budget summary and privilege checks passed; transaction rolled back.",
  );
} finally {
  await sql.end();
}
