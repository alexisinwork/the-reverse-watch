// Restore into transaction-local temporary copies, verify, then roll back.
// Never restore over application tables or delete production data.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import postgres from "postgres";
import { snapshotSchema } from "./local-snapshot";

const directory = process.argv[2];
if (!directory || !process.env.DIRECT_DATABASE_URL)
  throw new Error(
    "Pass a snapshot directory and configure DIRECT_DATABASE_URL",
  );
const manifest = snapshotSchema.parse(
  JSON.parse(
    await readFile(join(directory, "manifest.json"), "utf8"),
  ) as unknown,
);
const sql = postgres(process.env.DIRECT_DATABASE_URL, {
  max: 1,
  ssl: "require",
  onnotice: () => undefined,
});
const rollback = new Error("expected rollback");
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const restored = new Map<string, string>();
let totalRows = 0;
let checkedForeignKeys = 0;
let currentTable = "metadata";
try {
  try {
    await sql.begin(async (tx) => {
      await tx`set local timezone='UTC'`;
      await tx`set local statement_timeout='120s'`;
      for (const [index, file] of manifest.files.entries()) {
        currentTable = `${file.schema}.${file.table}`;
        const temporary = `snapshot_restore_${index}`;
        await tx`create temporary table ${tx(temporary)} (like ${tx(file.schema)}.${tx(file.table)} including all) on commit drop`;
        restored.set(`${file.schema}.${file.table}`, temporary);
        const stream = createReadStream(join(resolve(directory), file.file), {
          encoding: "utf8",
        });
        const fileHash = createHash("sha256");
        stream.on("data", (chunk) => fileHash.update(chunk));
        const lines = createInterface({ input: stream, crlfDelay: Infinity });
        let batch: string[] = [];
        let rows = 0;
        const insert = async () => {
          if (!batch.length) return;
          const payload = `[${batch.join(",")}]`;
          const records = await tx<{ record_text: string }[]>`
            insert into ${tx("pg_temp")}.${tx(temporary)} as restored (${tx(file.insertColumns)}) overriding system value
            select ${tx(file.insertColumns)} from jsonb_populate_recordset(null::${tx("pg_temp")}.${tx(temporary)},${payload}::text::jsonb)
            returning to_jsonb(restored)::text as record_text`;
          assert.deepEqual(
            records.map((r) => hash(r.record_text)).sort(),
            batch.map(hash).sort(),
            `Round-trip hashes differ: ${file.file}`,
          );
          rows += records.length;
          batch = [];
        };
        for await (const line of lines) {
          batch.push(line);
          if (batch.length === 250) await insert();
        }
        await insert();
        assert.equal(
          fileHash.digest("hex"),
          file.sha256,
          `File integrity: ${file.file}`,
        );
        assert.equal(rows, file.rows, `Row count: ${file.file}`);
        totalRows += rows;
        console.log(`Rehearsed ${file.file}: ${rows} rows`);
      }
      // LIKE excludes foreign keys; check restored relationships separately.
      const foreignKeys = await tx<
        {
          child_schema: string;
          child_table: string;
          parent_schema: string;
          parent_table: string;
          child_columns: string[];
          parent_columns: string[];
        }[]
      >`
        select cn.nspname as child_schema,c.relname as child_table,pn.nspname as parent_schema,p.relname as parent_table,
          array(select a.attname from unnest(f.conkey) with ordinality k(num,ord) join pg_attribute a on a.attrelid=f.conrelid and a.attnum=k.num order by k.ord) as child_columns,
          array(select a.attname from unnest(f.confkey) with ordinality k(num,ord) join pg_attribute a on a.attrelid=f.confrelid and a.attnum=k.num order by k.ord) as parent_columns
        from pg_constraint f join pg_class c on c.oid=f.conrelid join pg_namespace cn on cn.oid=c.relnamespace
          join pg_class p on p.oid=f.confrelid join pg_namespace pn on pn.oid=p.relnamespace
        where f.contype='f' and cn.nspname in ('public','private')`;
      for (const fk of foreignKeys) {
        const child = restored.get(`${fk.child_schema}.${fk.child_table}`);
        const parent = restored.get(`${fk.parent_schema}.${fk.parent_table}`);
        if (!child || !parent) continue;
        const comparisons = fk.child_columns.map(
          (column, index) =>
            tx`c.${tx(column)}=p.${tx(fk.parent_columns[index]!)}`,
        );
        const present = fk.child_columns.map(
          (column) => tx`c.${tx(column)} is not null`,
        );
        const and = (parts: typeof comparisons) =>
          parts.reduce((a, b) => tx`${a} and ${b}`);
        const [result] = await tx<
          { missing: number }[]
        >`select count(*)::int as missing from ${tx("pg_temp")}.${tx(child)} c where ${and(present)} and not exists(select 1 from ${tx("pg_temp")}.${tx(parent)} p where ${and(comparisons)})`;
        assert.equal(
          result!.missing,
          0,
          `Foreign key: ${fk.child_schema}.${fk.child_table}`,
        );
        checkedForeignKeys++;
      }
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  const report = {
    at: new Date().toISOString(),
    snapshotId: manifest.snapshotId,
    formatVersion: 2,
    tables: manifest.files.length,
    rows: totalRows,
    foreignKeys: checkedForeignKeys,
    exactRowHashes: true,
    fileHashes: true,
    temporaryRestoreRolledBack: true,
    scope:
      "Application data only; no Supabase auth/storage/roles or full project disaster recovery rehearsal.",
  };
  await writeFile(
    join(directory, "restore-rehearsal.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  await writeFile(
    "docs/reports/local-backup-rehearsal.json",
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report));
} catch (error) {
  console.error({
    table: currentTable,
    category: error instanceof Error ? error.name : "unknown",
    code: error instanceof postgres.PostgresError ? error.code : null,
    assertion:
      error instanceof assert.AssertionError
        ? error.message.split("\n")[0]
        : null,
  });
  console.error("Snapshot rehearsal failed; production data was not changed.");
  process.exitCode = 1;
} finally {
  await sql.end();
}
