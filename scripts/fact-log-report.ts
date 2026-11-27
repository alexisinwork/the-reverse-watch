// What the catalogue repair wrote, read back from the database's own log
// (migration 0124), so the numbers come from what was applied, not from a
// run's plan. Read-only.
//
//   node --env-file=.env --import tsx scripts/fact-log-report.ts --runs repair-1,styles-1
//
// Writes docs/reports/fact-log-<date>.json: per run, every field's counts
// by status and method, how many watches changed, and a sample of
// corrections with the page and passage each rests on.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import postgres from "postgres";

import { databaseTls } from "./database-tls";

const at = process.argv.indexOf("--runs");
const runs = at > 0 ? process.argv[at + 1]?.split(",") : undefined;
if (!runs?.length || runs.some((run) => !/^[a-z0-9-]{1,60}$/.test(run)))
  throw new Error("--runs a,b is required.");
const url = process.env.DIRECT_DATABASE_URL?.trim();
if (!url) throw new Error("DIRECT_DATABASE_URL is not set.");
const sql = postgres(url, {
  max: 1,
  ssl: databaseTls(),
  connect_timeout: 15,
  onnotice: () => undefined,
});
try {
  const report = await sql.begin("read only", async (tx) => {
    const counts = await tx<
      {
        run: string;
        field: string;
        status: string;
        method: string;
        n: number;
        reverted: number;
      }[]
    >`
      select run, field, status, method, count(*)::int as n,
             count(*) filter (where reverted_at is not null)::int as reverted
      from private.watch_catalogue_fact_log
      where run in ${sql(runs)}
      group by 1, 2, 3, 4 order by 1, 2, 3, 4`;
    const watches = await tx<
      { run: string; checked: number; changed: number }[]
    >`
      select run, count(distinct watch_id)::int as checked,
             count(distinct watch_id) filter (where status in ('corrected', 'filled'))::int as changed
      from private.watch_catalogue_fact_log
      where run in ${sql(runs)}
      group by 1 order by 1`;
    const sample = await tx<
      {
        run: string;
        brand: string;
        reference: string | null;
        field: string;
        old_value: unknown;
        new_value: unknown;
        source_url: string | null;
        passage: string | null;
      }[]
    >`
      select l.run, w.brand, w.reference_code as reference, l.field, l.old_value, l.new_value,
             l.source_url, l.passage
      from private.watch_catalogue_fact_log l
      join private.watch_catalogue w on w.id = l.watch_id
      where l.run in ${sql(runs)} and l.status = 'corrected' and l.method in ('maker_page', 'retailer_page')
      order by md5(l.id::text) limit 40`;
    return { counts, watches, sample };
  });
  const byRun = Object.fromEntries(
    runs.map((run) => {
      const fields: Record<string, Record<string, number>> = {};
      for (const row of report.counts.filter((item) => item.run === run)) {
        fields[row.field] ??= {};
        fields[row.field]![`${row.status} (${row.method})`] = row.n;
      }
      const watches = report.watches.find((item) => item.run === run);
      return [
        run,
        {
          watchesLogged: watches?.checked ?? 0,
          watchesChanged: watches?.changed ?? 0,
          reverted: report.counts
            .filter((item) => item.run === run)
            .reduce((sum, item) => sum + item.reverted, 0),
          fields,
        },
      ];
    }),
  );
  const output = {
    at: new Date().toISOString(),
    runs: byRun,
    correctionSample: report.sample.map((row) => ({
      ...row,
      passage: row.passage?.replace(/\s+/g, " ").slice(0, 200) ?? null,
    })),
  };
  const path = resolve(`docs/reports/fact-log-${output.at.slice(0, 10)}.json`);
  writeFileSync(path, `${JSON.stringify(output, null, 2)}\n`);
  console.log(
    JSON.stringify(
      { ...output, correctionSample: output.correctionSample.length },
      null,
      2,
    ),
  );
  console.log(`Wrote ${path}`);
} finally {
  await sql.end();
}
