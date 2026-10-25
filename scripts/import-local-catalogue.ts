// Imports every source assertion, keeping existing accepted facts/IDs unchanged.
// node --env-file=.env --import tsx scripts/import-local-catalogue.ts [--write]
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import postgres from "postgres";
import { z } from "zod";
import { catalogueIdentityKey } from "../app/domain/watch-catalogue";

const rowSchema = z
  .object({
    sourceRecordId: z.string(),
    snapshot: z.string(),
    brand: z.string().nullable(),
    model: z.string().nullable(),
    reference: z.string().nullable(),
    sourcePage: z.string(),
  })
  .passthrough();
const bytes = await readFile("data/watch-archive/full/normalized.json");
const records = z.array(rowSchema).parse(JSON.parse(bytes.toString()));
const report = z
  .object({ records: z.number(), commit: z.string() })
  .parse(
    JSON.parse(
      await readFile("docs/reports/local-watch-intake-full.json", "utf8"),
    ),
  );
if (
  records.length !== report.records ||
  records.some((r) => r.snapshot !== report.commit)
)
  throw new Error("Intake manifest mismatch");
const groups = new Map<string, typeof records>();
for (const row of records) {
  if (!row.brand || !row.reference || !row.model) continue;
  const key = catalogueIdentityKey(row.brand, row.model, row.reference);
  groups.set(key, [...(groups.get(key) ?? []), row]);
}
const planned = {
  records: records.length,
  identities: groups.size,
  duplicateGroups: [...groups.values()].filter((rows) => rows.length > 1)
    .length,
};
console.log(JSON.stringify(planned));
if (!process.argv.includes("--write")) process.exit(0);
const url = process.env.DIRECT_DATABASE_URL;
if (!url) throw new Error("DIRECT_DATABASE_URL required");
const sql = postgres(url, {
  max: 1,
  ssl: "require",
  connect_timeout: 10,
  onnotice: () => undefined,
});
try {
  // No ON CONFLICT UPDATE: existing reviewed/rejected facts and images survive.
  const entries = [...groups]
    .filter(([, rows]) => rows.length === 1)
    .map(([key, rows]) => ({
      identity_key: key,
      brand: rows[0]!.brand!,
      model: rows[0]!.model!,
      reference_code: rows[0]!.reference!,
      source_url: null as string | null,
      import_source: "timepiecepedia",
    }))
    .filter(
      (row) =>
        row.brand.length <= 160 &&
        row.model.length <= 200 &&
        row.reference_code.length <= 120 &&
        row.identity_key.length <= 400,
    );
  for (let i = 0; i < entries.length; i += 500) {
    await sql`insert into private.watch_catalogue ${sql(entries.slice(i, i + 500))} on conflict (identity_key) do nothing`;
  }
  const ids = await sql<
    { id: string; identity_key: string; import_source: string | null }[]
  >`select id,identity_key,import_source from private.watch_catalogue`;
  const byKey = new Map(ids.map((r) => [r.identity_key, r.id]));
  const existingKeys = new Set(
    ids
      .filter((row) => row.import_source === null)
      .map((row) => row.identity_key),
  );
  for (let i = 0; i < records.length; i += 250) {
    const batch = records.slice(i, i + 250).map((row) => {
      const key =
        row.brand && row.model && row.reference
          ? catalogueIdentityKey(row.brand, row.model, row.reference)
          : null;
      const unique = key !== null && groups.get(key)?.length === 1;
      const id = unique ? (byKey.get(key) ?? null) : null;
      return {
        source: "timepiecepedia",
        snapshot: row.snapshot,
        source_record_id: row.sourceRecordId,
        watch_id: id,
        payload: sql.json(row as postgres.JSONValue),
        state: id ? "pending" : "blocked_identity",
        priority: key && existingKeys.has(key) ? 100 : 0,
      };
    });
    await sql`insert into private.watch_catalogue_intake ${sql(batch)} on conflict (source,snapshot,source_record_id) do nothing`;
    if (i % 5000 === 0)
      console.log(
        `Archived ${Math.min(i + 250, records.length)}/${records.length}`,
      );
  }
  const states =
    await sql`select state,count(*)::int as count from private.watch_catalogue_intake group by state order by state`;
  const totals =
    await sql`select count(*)::int as total,count(*) filter(where import_source='timepiecepedia')::int as imported from private.watch_catalogue`;
  const evidence = {
    ...planned,
    inputSha256: createHash("sha256").update(bytes).digest("hex"),
    snapshot: report.commit,
    at: new Date().toISOString(),
    states,
    totals,
  };
  await writeFile(
    "docs/reports/catalogue-import.json",
    `${JSON.stringify(evidence, null, 2)}\n`,
  );
  console.log(JSON.stringify(evidence));
} finally {
  await sql.end();
}
