import { readFile, writeFile } from "node:fs/promises";
import postgres from "postgres";
import { z } from "zod";
import { catalogueIdentityKey } from "../app/domain/watch-catalogue";
const dir = "data/watch-archive/spacecity";
const brandSchema = z.object({
  name: z.string(),
  models: z.array(
    z.object({
      name: z.string(),
      refs: z.array(z.object({ ref: z.string(), name: z.string() })),
    }),
  ),
});
const wanted = new Set([
  "cartier",
  "rolex",
  "omega",
  "iwc",
  "tudor",
  "panerai",
  "vacheron constantin",
  "breitling",
  "tag heuer",
  "zenith",
]);
const files = await readFile(`${dir}/manifest.json`, "utf8");
const manifest = JSON.parse(files) as { files: { file: string }[] };
const records: { brand: string; model: string; reference: string }[] = [];
for (const file of manifest.files) {
  const b = brandSchema.parse(
    JSON.parse(await readFile(`${dir}/${file.file}`, "utf8")),
  );
  if (!wanted.has(b.name.toLowerCase())) continue;
  for (const m of b.models)
    for (const r of m.refs)
      records.push({ brand: b.name, model: m.name, reference: r.ref });
}
const url = process.env.DIRECT_DATABASE_URL;
if (!url) throw new Error("DIRECT_DATABASE_URL required");
const sql = postgres(url, {
  max: 1,
  ssl: "require",
  connect_timeout: 10,
  onnotice: () => undefined,
});
try {
  const db = await sql<
    { identity_key: string; brand: string }[]
  >`select identity_key,brand from private.watch_catalogue`;
  const keys = new Set(db.map((x) => x.identity_key));
  const rows = records.map((r) => ({
    ...r,
    key: catalogueIdentityKey(r.brand, r.model, r.reference),
  }));
  const grouped = new Map<string, typeof rows>();
  for (const r of rows) grouped.set(r.key, [...(grouped.get(r.key) ?? []), r]);
  const summary = [...new Set(records.map((r) => r.brand))].map((brand) => {
    const source = rows.filter((r) => r.brand === brand),
      unique = [
        ...new Map(
          source
            .filter((r) => grouped.get(r.key)?.length === 1)
            .map((r) => [r.key, r]),
        ).values(),
      ];
    return {
      brand,
      sourceRows: source.length,
      uniqueReferenceIdentities: unique.length,
      presentInMaster: unique.filter((r) => keys.has(r.key)).length,
      missingFromMaster: unique.filter((r) => !keys.has(r.key)).length,
      ambiguousSourceRows: source.length - unique.length,
    };
  });
  const report = {
    at: new Date().toISOString(),
    spaceCityMasterTotal: db.length,
    brands: summary,
    totalUniqueIdentities: summary.reduce(
      (s, r) => s + r.uniqueReferenceIdentities,
      0,
    ),
    totalPresent: summary.reduce((s, r) => s + r.presentInMaster, 0),
    totalMissing: summary.reduce((s, r) => s + r.missingFromMaster, 0),
    scope:
      "Exact brand/model/reference identity coverage against local master. Presence is not manufacturer verification.",
  };
  await writeFile(
    "docs/reports/spacecity-luxury-coverage.json",
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await sql.end();
}
