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
      const before = await tx<
        { id: string }[]
      >`select id from private.watch_catalogue order by brand, model, id limit 120`;
      if (!process.argv.includes("--applied"))
        await tx.unsafe(
          await readFile(
            "db/migrations/0106_index_complete_admin_catalogue_order.sql",
            "utf8",
          ),
        );
      const after = await tx<
        { id: string }[]
      >`select id from private.watch_catalogue order by brand, model, id limit 120`;
      assert.deepEqual(after, before);
      const plan =
        await tx`explain select * from private.watch_catalogue order by brand, model, id limit 60`;
      assert.match(JSON.stringify(plan), /watch_catalogue_admin_order_idx/);
      await tx`set local statement_timeout='8s'`;
      const [page] = await tx<
        {
          result: {
            counts: { all: number };
            rows: { id: string }[];
            pages: number;
          };
        }[]
      >`select public.watch_catalogue_admin_page_v1('all','',1) as result`;
      assert.equal(page!.result.rows.length, 60);
      assert.deepEqual(
        page!.result.rows.map((row) => row.id),
        before.slice(0, 60).map((row) => row.id),
      );
      const [total] =
        await tx`select count(*)::integer as n from private.watch_catalogue`;
      assert.equal(page!.result.counts.all, total!.n);
      const [roles] =
        await tx`select has_function_privilege('anon','public.watch_catalogue_admin_page_v1(text,text,integer)','execute') as anon, has_function_privilege('authenticated','public.watch_catalogue_admin_page_v1(text,text,integer)','execute') as authenticated`;
      assert.deepEqual(roles, { anon: false, authenticated: false });
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  console.log(
    "Complete admin catalogue ordering, counts, plan and permissions passed; rolled back.",
  );
} finally {
  await sql.end();
}
