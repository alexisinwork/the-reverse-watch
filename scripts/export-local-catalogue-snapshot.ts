// Consistent local data backup. Keep this ignored archive private: application
// tables can contain partner credentials. Supabase auth/storage are excluded.
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { once } from "node:events";
import postgres from "postgres";
import type { SnapshotFile } from "./local-snapshot";

if (!process.env.DIRECT_DATABASE_URL)
  throw new Error("DIRECT_DATABASE_URL required");
const snapshotId = new Date().toISOString().replace(/[:.]/g, "-");
const directory = `data/watch-archive/local-snapshots/${snapshotId}`;
await mkdir(directory, { recursive: true });
const sql = postgres(process.env.DIRECT_DATABASE_URL, {
  max: 1,
  ssl: "require",
  connect_timeout: 10,
  onnotice: () => undefined,
});
try {
  await sql.begin("isolation level repeatable read read only", async (tx) => {
    await tx`set local timezone='UTC'`;
    await tx`set local statement_timeout='120s'`;
    await tx`set local idle_in_transaction_session_timeout='120s'`;
    const tables = await tx<
      {
        schema: "public" | "private";
        table: string;
        insert_columns: string[];
      }[]
    >`
      select n.nspname as schema,c.relname as table,
        array(select a.attname from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped and a.attgenerated='' order by a.attnum) as insert_columns
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname in ('public','private') and c.relkind='r'
        and not exists(select 1 from pg_depend d where d.classid='pg_class'::regclass and d.objid=c.oid and d.deptype='e')
      order by n.nspname,c.relname`;
    const migrations = await tx<
      { name: string }[]
    >`select name from supabase_migrations.schema_migrations order by version`;
    const files: SnapshotFile[] = [];
    for (const table of tables) {
      const file = `${table.schema}.${table.table}.jsonl`;
      const output = createWriteStream(`${directory}/${file}`, {
        flags: "wx",
        encoding: "utf8",
      });
      const hash = createHash("sha256");
      let rows = 0;
      try {
        // Preserve PostgreSQL JSON text: JS numbers can round bigint/numeric.
        for await (const batch of tx<
          { record_text: string }[]
        >`select to_jsonb(t)::text as record_text from ${tx(table.schema)}.${tx(table.table)} t`.cursor(
          250,
        )) {
          for (const row of batch) {
            const line = `${row.record_text}\n`;
            hash.update(line);
            if (!output.write(line)) await once(output, "drain");
            rows++;
          }
        }
        output.end();
        await once(output, "finish");
      } catch (error) {
        output.destroy();
        console.error({
          category: error instanceof Error ? error.name : "unknown",
          code: error instanceof postgres.PostgresError ? error.code : null,
        });
        throw new Error(
          `Snapshot export failed for ${table.schema}.${table.table}`,
        );
      }
      files.push({
        schema: table.schema,
        table: table.table,
        file,
        insertColumns: table.insert_columns,
        rows,
        sha256: hash.digest("hex"),
      });
      console.log(`${file}: ${rows} rows`);
    }
    await writeFile(
      `${directory}/manifest.json`,
      `${JSON.stringify(
        {
          formatVersion: 2,
          snapshotId,
          createdAt: new Date().toISOString(),
          migrations: migrations.map((m) => m.name),
          files,
          scope:
            "Repeatable-read application-owned public/private data. Schema is versioned in db/migrations. Supabase auth/storage and roles are excluded. Keep this ignored archive private.",
        },
        null,
        2,
      )}\n`,
      { flag: "wx" },
    );
  });
  console.log(`Consistent snapshot completed: ${directory}`);
} finally {
  await sql.end();
}
