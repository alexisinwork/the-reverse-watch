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
      const before =
        await tx`select id from private.watch_catalogue where review_status<>'rejected' and (import_source is null or (price_amount is not null and price_status<>'unconfirmed')) order by brand,model,id limit 500`;
      if (!process.argv.includes("--applied"))
        await tx.unsafe(
          await readFile(
            "db/migrations/0105_index_catalogue_recommendation_order.sql",
            "utf8",
          ),
        );
      const after =
        await tx`select id from private.watch_catalogue where review_status<>'rejected' and (import_source is null or (price_amount is not null and price_status<>'unconfirmed')) order by brand,model,id limit 500`;
      assert.deepEqual(after, before);
      const plan =
        await tx`explain select * from private.watch_catalogue where review_status<>'rejected' and (import_source is null or (price_amount is not null and price_status<>'unconfirmed')) order by brand,model,id limit 500`;
      assert.match(
        JSON.stringify(plan),
        /watch_catalogue_recommendation_order_idx/,
      );
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  console.log(
    "Catalogue ordering and index plan checks passed; transaction rolled back.",
  );
} finally {
  await sql.end();
}
