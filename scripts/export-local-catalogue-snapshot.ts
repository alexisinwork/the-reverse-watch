// Export the canonical catalogue and saved result cache to a local, immutable
// JSONL snapshot. This is a data backup, not a runtime database replacement.
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { once } from "node:events";
import postgres from "postgres";

const databaseUrl = process.env.DIRECT_DATABASE_URL;
if (!databaseUrl) throw new Error("DIRECT_DATABASE_URL required");
const root = "data/watch-archive/local-snapshots";
const snapshotId = new Date().toISOString().replace(/[:.]/g, "-");
const directory = `${root}/${snapshotId}`;
await mkdir(directory, { recursive: true });

const sql = postgres(databaseUrl, {
  max: 1,
  ssl: "require",
  connect_timeout: 10,
  onnotice: () => undefined,
});

type ExportRow = { cursor: string; record: unknown };
type ExportSummary = {
  file: string;
  rows: number;
  sha256: string;
};

async function writeRows(
  name: string,
  fetchRows: (after: string | null, limit: number) => Promise<ExportRow[]>,
) {
  const file = `${directory}/${name}.jsonl`;
  const output = createWriteStream(file, { flags: "wx", encoding: "utf8" });
  const hash = createHash("sha256");
  let after: string | null = null;
  let rowsWritten = 0;
  try {
    while (true) {
      const rows = await fetchRows(after, 500);
      if (!rows.length) break;
      for (const row of rows) {
        const line = `${JSON.stringify(row.record)}\n`;
        hash.update(line);
        if (!output.write(line)) await once(output, "drain");
        after = row.cursor;
        rowsWritten++;
      }
    }
    output.end();
    await once(output, "finish");
  } catch (error) {
    output.destroy();
    throw error;
  }
  return {
    file: `${name}.jsonl`,
    rows: rowsWritten,
    sha256: hash.digest("hex"),
  } satisfies ExportSummary;
}

try {
  const files: ExportSummary[] = [];
  files.push(
    await writeRows("watch-catalogue", async (after, limit) => {
      const rows = await sql<ExportRow[]>`
        select id::text as cursor,to_jsonb(w) as record
        from private.watch_catalogue w
        where ${after}::uuid is null or w.id > ${after}::uuid
        order by w.id limit ${limit}`;
      return rows;
    }),
  );

  files.push(
    await writeRows("ai-watches", async (after, limit) => {
      const rows = await sql<ExportRow[]>`
        select id::text as cursor,to_jsonb(w) as record
        from private.ai_watches w
        where ${after}::uuid is null or w.id > ${after}::uuid
        order by w.id limit ${limit}`;
      return rows;
    }),
  );

  let offset = 0;
  const cachedResults = await writeRows(
    "cached-results",
    async (_after, limit) => {
      const rows = await sql<{ cursor: string; record: unknown }[]>`
      select (r.search_id::text || '|' || r.rank::text) as cursor,
        jsonb_build_object(
          'search',to_jsonb(s),
          'rank',r.rank,
          'watch',to_jsonb(w),
          'priceNote',r.price_note,
          'rationale',r.rationale,
          'details',r.details
        ) as record
      from private.ai_watch_search_results r
      join private.ai_watches w on w.id=r.watch_id
      join private.ai_watch_searches s on s.id=r.search_id
      order by r.search_id,r.rank offset ${offset} limit ${limit}`;
      offset += rows.length;
      return rows;
    },
  );
  files.push(cachedResults);

  const manifest = {
    snapshotId,
    createdAt: new Date().toISOString(),
    database: "connected catalogue database; credentials are not included",
    files,
    note: "JSONL data snapshot for local safekeeping. The application runtime still uses its configured database.",
  };
  await writeFile(
    `${directory}/manifest.json`,
    `${JSON.stringify(manifest, null, 2)}\n`,
    { flag: "wx" },
  );
  console.log(JSON.stringify(manifest, null, 2));
} finally {
  await sql.end();
}
