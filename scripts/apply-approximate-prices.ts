// One-time application of the owner's decision of 2026-11-28 (#13, "да -
// примерная") to the "confirmed" prices that the recheck of 2026-11-27 could
// not reproduce: each goes through watch_catalogue_price_v1 with kind
// 'unconfirmed', exactly as a failed recheck now does (migration 0127).
// A price the owner has edited since (updated after 2026-11-27) is left
// alone. Writes docs/reports/approximate-prices-2026-11-28.json with each
// previous status, so a row can be set back by hand on /admin/catalogue.
//
//   node --env-file=.env --import tsx scripts/apply-approximate-prices.ts          # dry run
//   node --env-file=.env --import tsx scripts/apply-approximate-prices.ts --write
import { writeFileSync } from "node:fs";
import postgres from "postgres";

import { databaseTls } from "./database-tls";

// The references whose confirmed price the two-source recheck of 2026-11-27
// could not reproduce (scripts/recheck-catalogue-prices.ts --references;
// docs/eval-baseline.md, "Repair step 5").
const UNREPRODUCED = [
  "WSSA0010",
  "Q9008160",
  "027/3400.02",
  "671530",
  "RE-AV0001S00B",
  "RE-ND0001S00B",
  "PAM01045",
  "801-EN",
  "WAS2110.BA0732",
  "ZO9257",
];
const write = process.argv.includes("--write");
const sql = postgres(process.env.DIRECT_DATABASE_URL!.trim(), {
  max: 1,
  ssl: databaseTls(),
  onnotice: () => undefined,
});
const rows = await sql<
  {
    id: string;
    brand: string;
    reference_code: string;
    price_amount: string;
    price_currency: string;
    price_status: string;
    updated_at: Date;
  }[]
>`select id, brand, reference_code, price_amount, price_currency, price_status, updated_at
  from private.watch_catalogue
  where reference_code in ${sql(UNREPRODUCED)} and review_status <> 'rejected'
  order by brand, reference_code`;
const changes: Record<string, unknown>[] = [];
for (const row of rows) {
  const editedSince = row.updated_at >= new Date("2026-11-28T00:00:00Z");
  const due = row.price_status === "confirmed" && !editedSince;
  if (due && write) {
    // Bulk catalogue writes: one writer with a pause (AGENTS.md).
    await sql`select public.watch_catalogue_price_v1(${row.id}::uuid, '{"kind":"unconfirmed"}'::jsonb)`;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const [after] = await sql<{ price_status: string }[]>`
    select price_status from private.watch_catalogue where id = ${row.id}::uuid`;
  changes.push({
    id: row.id,
    brand: row.brand,
    reference: row.reference_code,
    price: `${row.price_amount} ${row.price_currency}`,
    before: row.price_status,
    after: after!.price_status,
    skipped: due
      ? null
      : editedSince
        ? "edited since 2026-11-27"
        : "not confirmed",
  });
  console.log(
    `${row.brand} ${row.reference_code}: ${row.price_status} -> ${after!.price_status}`,
  );
}
await sql.end();
if (write) {
  writeFileSync(
    "docs/reports/approximate-prices-2026-11-28.json",
    `${JSON.stringify({ at: new Date().toISOString(), decision: "OWNER_QUESTIONS #13, 2026-11-28", changes }, null, 2)}\n`,
  );
}
console.log(write ? "Written." : "Dry run: pass --write to apply.");
