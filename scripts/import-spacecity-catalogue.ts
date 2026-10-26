// Public CC BY 4.0 per-brand snapshots. Listing aggregates are assertions,
// not manufacturer-confirmed dimensions or current retail prices.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import postgres from "postgres";
import { z } from "zod";
import { catalogueIdentityKey } from "../app/domain/watch-catalogue";
const dir = "data/watch-archive/spacecity";
await mkdir(dir, { recursive: true });
const indexSchema = z.object({
  license: z.string(),
  source: z.string(),
  totals: z.object({ brand_count: z.number(), ref_count: z.number() }),
  brands: z.array(
    z.object({ name: z.string(), slug: z.string(), api: z.string() }),
  ),
});
const reference = z
  .object({
    ref: z.string(),
    slug: z.string(),
    name: z.string(),
    sizes: z.array(z.string()).optional(),
  })
  .passthrough();
const brandSchema = z.object({
  name: z.string(),
  models: z.array(
    z.object({ name: z.string(), slug: z.string(), refs: z.array(reference) }),
  ),
});
async function get(url: string, file: string) {
  const target = new URL(url);
  if (
    target.origin !== "https://spacecitytimepiece.com" ||
    !target.pathname.startsWith("/api/v1/watches")
  )
    throw new Error("Unexpected feed URL");
  if (existsSync(file)) return readFile(file, "utf8");
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`Space City returned ${r.status}`);
  const text = await r.text();
  JSON.parse(text);
  await writeFile(file, text);
  return text;
}
const indexText = await get(
  "https://spacecitytimepiece.com/api/v1/watches.json",
  `${dir}/index.json`,
);
const index = indexSchema.parse(JSON.parse(indexText));
if (index.license !== "https://creativecommons.org/licenses/by/4.0/")
  throw new Error("Unexpected source licence");
const files = [];
const records: {
  sourceRecordId: string;
  brand: string;
  model: string;
  reference: string;
  sourcePage: string;
  observed: z.infer<typeof reference>;
}[] = [];
for (const item of index.brands) {
  if (!/^[a-z0-9-]+$/.test(item.slug)) throw new Error("Invalid brand slug");
  const text = await get(item.api, `${dir}/${item.slug}.json`);
  const brand = brandSchema.parse(JSON.parse(text));
  files.push({
    file: `${item.slug}.json`,
    sha256: createHash("sha256").update(text).digest("hex"),
  });
  for (const [mi, model] of brand.models.entries())
    for (const [ri, watch] of model.refs.entries()) {
      records.push({
        sourceRecordId: `${item.slug}:${mi}:${ri}`,
        brand: brand.name,
        model: model.name,
        reference: watch.ref,
        sourcePage: `https://spacecitytimepiece.com/watches/${item.slug}/${model.slug}/${watch.slug}`,
        observed: watch,
      });
    }
  console.log(`Read ${item.name}`);
  await new Promise((resolve) => setTimeout(resolve, 200));
}
const snapshot = createHash("sha256")
  .update(indexText + JSON.stringify(files))
  .digest("hex");
const groups = new Map<string, typeof records>();
for (const row of records) {
  if (!row.reference.trim()) continue;
  const key = catalogueIdentityKey(row.brand, row.model, row.reference);
  groups.set(key, [...(groups.get(key) ?? []), row]);
}
const plan = {
  source: "https://spacecitytimepiece.com/watches",
  retrievedAt: new Date().toISOString(),
  snapshot,
  license: index.license,
  upstream: index.source,
  brands: index.brands.length,
  declaredReferences: index.totals.ref_count,
  observedRecords: records.length,
  distinctIdentityKeys: groups.size,
  files,
};
await writeFile(`${dir}/manifest.json`, JSON.stringify(plan, null, 2));
if (!process.argv.includes("--write")) {
  console.log(JSON.stringify({ ...plan, files: files.length }));
  process.exit(0);
}
if (!process.env.DIRECT_DATABASE_URL)
  throw new Error("DIRECT_DATABASE_URL required");
const sql = postgres(process.env.DIRECT_DATABASE_URL, {
  max: 1,
  ssl: "require",
  connect_timeout: 10,
  onnotice: () => undefined,
});
try {
  const before = await sql<
    { id: string; identity_key: string }[]
  >`select id,identity_key from private.watch_catalogue`;
  const previous = new Set(before.map((row) => row.identity_key));
  const entries = [...groups]
    .map(([key, rows]) => ({
      identity_key: key,
      brand: rows[0]!.brand,
      model: rows[0]!.model,
      reference_code: rows[0]!.reference,
      import_source: "spacecity",
    }))
    .filter(
      (row) =>
        row.identity_key.length <= 400 &&
        row.brand.length <= 160 &&
        row.model.length <= 200 &&
        row.reference_code.length <= 120,
    );
  for (let n = 0; n < entries.length; n += 500)
    await sql`insert into private.watch_catalogue ${sql(entries.slice(n, n + 500))} on conflict(identity_key) do nothing`;
  const ids = await sql<
    { id: string; identity_key: string }[]
  >`select id,identity_key from private.watch_catalogue`;
  const byKey = new Map(ids.map((row) => [row.identity_key, row.id]));
  for (let n = 0; n < records.length; n += 250) {
    const batch = records.slice(n, n + 250).map((row) => {
      const key = catalogueIdentityKey(row.brand, row.model, row.reference),
        // Repeated historic listings for one exact brand/model/reference are
        // source observations of one catalogue identity, not separate watches.
        id = byKey.get(key) ?? null;
      return {
        source: "spacecity",
        snapshot,
        source_record_id: row.sourceRecordId,
        watch_id: id,
        state: id ? "pending" : "blocked_identity",
        priority: 10,
        payload: sql.json({
          ...row,
          licence: index.license,
          citation: row.sourcePage,
          upstream: index.source,
          eligibility: "research_only",
          verification: "secondary_market_aggregation",
        } as postgres.JSONValue),
      };
    });
    await sql`insert into private.watch_catalogue_intake ${sql(batch)}
      on conflict(source,snapshot,source_record_id) do update set
        watch_id=excluded.watch_id,
        state=excluded.state,
        payload=excluded.payload`;
  }
  const linked = [...groups.keys()].filter((key) => previous.has(key)).length;
  const added = ids.filter((row) => !previous.has(row.identity_key)).length;
  const result = {
    ...plan,
    linkedExistingIdentities: linked,
    addedIdentities: added,
    masterTotal: ids.length,
    policy:
      "Historical listing prices and conflicting size arrays retained as evidence only; no overwrites of primary facts, images or confirmed prices. CC BY attribution retained per source page.",
  };
  await writeFile(
    "docs/reports/spacecity-import.json",
    `${JSON.stringify(result, null, 2)}\n`,
  );
  console.log(JSON.stringify({ ...result, files: files.length }));
} finally {
  await sql.end();
}
