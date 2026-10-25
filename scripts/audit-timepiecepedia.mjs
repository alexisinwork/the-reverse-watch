import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";

// Read local snapshots only. Never fetch images or write to the application DB.
const root = path.resolve(
  process.argv[2] ?? "data/watch-archive/timepiecepedia",
);
const hashes = [];
async function read(relative) {
  const buffer = await readFile(path.join(root, relative));
  hashes.push({
    file: relative,
    sha256: createHash("sha256").update(buffer).digest("hex"),
  });
  return buffer.toString("utf8");
}
const brands = JSON.parse(await read("brands.json"));
await read("LICENSE");
await read("references.csv");
const csv = await new ExcelJS.Workbook().csv.readFile(
  path.join(root, "references.csv"),
);
const keys = new Set();
const counts = [];
let records = 0;
let missingReference = 0;
let duplicateBrandReference = 0;
for (const file of (await readdir(path.join(root, "catalog"))).sort()) {
  if (!file.endsWith("_full.json")) continue;
  const brand = JSON.parse(await read(`catalog/${file}`));
  let count = 0;
  for (const collection of brand.collections ?? []) {
    for (const watch of collection.references ?? []) {
      count++;
      records++;
      const reference = watch.specs?.Reference?.trim();
      if (!reference) {
        missingReference++;
        continue;
      }
      // Diagnostic exact identity only: do not strip meaningful suffixes/aliases.
      const key = `${brand.brand_slug}|${reference.toLowerCase()}`;
      if (keys.has(key)) duplicateBrandReference++;
      keys.add(key);
    }
  }
  counts.push({ brand: brand.brand_slug, records: count });
}
const report = {
  source: "https://github.com/timepiecepedia/timepiecepedia-data",
  commit: execFileSync("git", ["-C", root, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  auditedAt: new Date().toISOString(),
  declaredLicense: "CC0-1.0; upstream rights not independently established",
  images: "Excluded: no image fetches, processing or publication",
  brandMetadataRows: brands.length,
  detailedBrandFiles: counts.length,
  detailedRecords: records,
  csvRecords: csv.actualRowCount - 1,
  missingReference,
  duplicateExactBrandReference: duplicateBrandReference,
  distinctExactBrandReference: keys.size,
  countingRule:
    "Only catalog/*_full.json; family files and index files are overlapping representations, not additive",
  brands: counts,
  files: hashes,
};
await mkdir("docs/reports", { recursive: true });
await writeFile(
  "docs/reports/timepiecepedia-snapshot.json",
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(
  JSON.stringify({
    detailedRecords: records,
    csvRecords: report.csvRecords,
    brands: counts.length,
    missingReference,
    duplicateBrandReference,
  }),
);
