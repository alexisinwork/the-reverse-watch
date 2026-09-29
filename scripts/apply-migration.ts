// Applies one additive SQL migration from db/migrations inside a transaction
// and records it in Supabase's migration history, as the MCP-applied
// migrations were. Usage:
//   npx tsx --env-file=.env scripts/apply-migration.ts 0070_add_ai_watch_search_cache.sql
import { readFileSync } from "node:fs";
import path from "node:path";

import postgres from "postgres";

const file = process.argv[2];
if (!file || !/^\d{4}_[a-z0-9_]+\.sql$/.test(file)) {
  console.error("Pass a migration file name such as 0070_add_ai_watch_search_cache.sql");
  process.exit(2);
}
const url = process.env.DIRECT_DATABASE_URL?.trim();
if (!url) {
  console.error("DIRECT_DATABASE_URL is not set.");
  process.exit(2);
}

const sqlText = readFileSync(path.resolve("db/migrations", file), "utf8");
const [version, ...nameParts] = file.replace(/\.sql$/, "").split("_");
const name = nameParts.join("_");

const sql = postgres(url, {
  max: 1,
  ssl: "require",
  connect_timeout: 10,
  onnotice: () => undefined,
});
try {
  const history = await sql<{ exists: boolean }[]>`
    select to_regclass('supabase_migrations.schema_migrations') is not null as exists`;
  const tracked = history[0]?.exists ?? false;
  if (tracked) {
    const applied = await sql`
      select 1 from supabase_migrations.schema_migrations where name = ${name}`;
    if (applied.length > 0) {
      console.log(`${file} is already recorded as applied; nothing to do.`);
      process.exit(0);
    }
  }
  await sql.begin(async (transaction) => {
    await transaction.unsafe(sqlText);
    if (tracked) {
      await transaction`
        insert into supabase_migrations.schema_migrations (version, name, statements)
        values (${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}, ${name}, ${[sqlText]})`;
    }
  });
  console.log(`Applied ${file}${tracked ? " and recorded it in the migration history" : ""}.`);
} finally {
  await sql.end();
}
void version;
