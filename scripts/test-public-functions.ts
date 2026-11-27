// Migration 0125: the publishable key can run exactly the three functions the
// site's server reads with it, and none of the archived recommender's. Runs
// in a transaction that always rolls back; without --applied the migration
// is applied inside it first.
//
//   node --env-file=.env --import tsx scripts/test-public-functions.ts [--applied]
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import postgres from "postgres";

import { databaseTls } from "./database-tls";

const url = process.env.DIRECT_DATABASE_URL;
if (!url) throw new Error("DIRECT_DATABASE_URL required");
const migration = await readFile(
  "db/migrations/0125_close_unused_public_functions.sql",
  "utf8",
);
const sql = postgres(url, {
  max: 1,
  ssl: databaseTls(),
  onnotice: () => undefined,
});
const rollback = new Error("expected rollback");
try {
  await sql.begin(async (tx) => {
    if (!process.argv.includes("--applied")) await tx.unsafe(migration);
    const rows = await tx<{ name: string }[]>`
      select p.proname as name
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.prosecdef
        and pg_catalog.has_function_privilege('anon', p.oid, 'execute')
      order by 1`;
    assert.deepEqual(
      rows.map((row) => row.name),
      [
        "catalogue_vocabulary_v1",
        "discovery_published_stories_v1",
        "discovery_story_context_v1",
      ],
    );
    const [kept] = await tx<{ ok: boolean }[]>`
      select pg_catalog.has_function_privilege('service_role',
        'public.recommendation_catalogue_v4()', 'execute') as ok`;
    assert.equal(
      kept!.ok,
      true,
      "the server role keeps the archived functions",
    );
    throw rollback;
  });
} catch (error) {
  if (error !== rollback) throw error;
} finally {
  await sql.end();
}
console.log(
  "PASS: the publishable key runs only the three functions the site reads with it.",
);
