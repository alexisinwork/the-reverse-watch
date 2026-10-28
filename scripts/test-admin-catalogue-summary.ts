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
      const inputs = [
        ["all", "", 1],
        ["all", "", 2],
        ["approved", "", 1],
        ["pending", "", 1],
        ["price", "", 1],
        ["all", "231.10.39.21.03.001", 1],
      ] as const;
      const before = [];
      for (const [filter, query, page] of inputs)
        before.push(
          (
            await tx`select public.watch_catalogue_admin_page_v1(${filter},${query},${page}) as result`
          )[0]!.result,
        );
      if (!process.argv.includes("--applied"))
        await tx.unsafe(
          await readFile(
            "db/migrations/0107_bound_admin_catalogue_summary_reads.sql",
            "utf8",
          ),
        );
      await tx`set local statement_timeout='8s'`;
      for (const [index, [filter, query, page]] of inputs.entries()) {
        const [row] =
          await tx`select public.watch_catalogue_admin_page_v1(${filter},${query},${page}) as result`;
        assert.deepEqual(row!.result, before[index]);
      }
      const plan =
        await tx`explain select count(*) from private.watch_catalogue where price_change is not null`;
      assert.match(
        JSON.stringify(plan),
        /watch_catalogue_price_change_ids_idx/,
      );
      const [roles] =
        await tx`select has_function_privilege('anon','public.watch_catalogue_admin_page_v1(text,text,integer)','execute') as anon, has_function_privilege('authenticated','public.watch_catalogue_admin_page_v1(text,text,integer)','execute') as authenticated,has_function_privilege('service_role','public.watch_catalogue_admin_page_v1(text,text,integer)','execute') as service`;
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
    "Admin summary/first/second/filtered/search pages and privileges match; rolled back.",
  );
} finally {
  await sql.end();
}
