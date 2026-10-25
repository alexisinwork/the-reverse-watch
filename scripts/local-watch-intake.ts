import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import ExcelJS from "exceljs";
import {
  catalogueClient,
  listCatalogue,
} from "../app/domain/watch-catalogue.server";
import { catalogueWatchSchema } from "../app/domain/watch-catalogue";
import {
  compareIntake,
  normalizeBrand,
  sourceBrandSchema,
  type IntakeWatch,
  identity,
} from "./lib/watch-intake";

const root = path.resolve("data/watch-archive");
const source = path.join(root, "timepiecepedia");
const allBrands = process.argv.includes("--all");
const output = path.join(root, allBrands ? "full" : "pilot");
await mkdir(output, { recursive: true });
const snapshotFile = path.join(root, "pilot", "existing-catalogue.json");
if (process.argv.includes("--refresh-catalogue")) {
  const client = catalogueClient();
  if (!client)
    throw new Error(
      "Catalogue read credentials are missing; use a prior local snapshot instead.",
    );
  const rows = await listCatalogue(client, true);
  await mkdir(path.dirname(snapshotFile), { recursive: true });
  await writeFile(
    snapshotFile,
    JSON.stringify({ retrievedAt: new Date().toISOString(), rows }, null, 2),
  );
}
const existingBytes = await readFile(snapshotFile);
const existingSnapshot = z
  .object({ retrievedAt: z.string(), rows: z.array(catalogueWatchSchema) })
  .parse(JSON.parse(existingBytes.toString()));
const commit = execFileSync("git", ["-C", source, "rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const sourceAudit = z
  .object({
    commit: z.string(),
    auditedAt: z.string(),
    files: z.array(z.object({ file: z.string(), sha256: z.string() })),
  })
  .parse(
    JSON.parse(
      await readFile("docs/reports/timepiecepedia-snapshot.json", "utf8"),
    ),
  );
if (sourceAudit.commit !== commit)
  throw new Error("Source checkout changed; rerun its snapshot audit first.");
const manifests = [];
const normalized: IntakeWatch[] = [];
const selectedBrands = allBrands
  ? (await readdir(path.join(source, "catalog")))
      .filter((file) => file.endsWith("_full.json"))
      .sort()
      .map((file) => file.slice(0, -"_full.json".length))
  : ["tissot", "seiko", "casio", "omega"];
for (const brand of selectedBrands) {
  const file = `catalog/${brand}_full.json`;
  const bytes = await readFile(path.join(source, file));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sourceAudit.files.find((entry) => entry.file === file)?.sha256 !== sha256)
    throw new Error(
      `Source content changed: ${file}; rerun its snapshot audit first.`,
    );
  const parsed = sourceBrandSchema.parse(JSON.parse(bytes.toString()));
  if (parsed.brand_slug !== brand)
    throw new Error(`Unexpected brand in ${file}`);
  manifests.push({
    brand,
    file,
    sha256,
  });
  normalized.push(...normalizeBrand(parsed, commit));
}
// CSV and JSON overlap but differ in coverage. Keep CSV-only pages separately;
// a page match chooses the richer JSON representation, never merges its facts.
let csvCoverage: {
  rows: number;
  overlappingJsonPages: number;
  supplementalRows: number;
  sha256: string;
} | null = null;
if (allBrands) {
  const file = "references.csv";
  const bytes = await readFile(path.join(source, file));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sourceAudit.files.find((entry) => entry.file === file)?.sha256 !== sha256)
    throw new Error("CSV changed since snapshot audit.");
  const csv = await new ExcelJS.Workbook().csv.readFile(
    path.join(source, file),
    { map: (value: string) => value },
  );
  const pageKey = (url: string) =>
    new URL(url, "https://timepiecepedia.com").pathname.replace(/\/$/, "");
  const jsonPages = new Set(normalized.map((row) => pageKey(row.sourcePage)));
  const csvOnly: IntakeWatch[] = [];
  let overlappingJsonPages = 0;
  csv.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const cell = (index: number) => {
      const value = row.getCell(index).value;
      if (value === null || value === undefined) return "";
      if (typeof value !== "string")
        throw new Error(`Non-string CSV cell at row ${rowNumber}`);
      return value;
    };
    const url = cell(11);
    if (!url) throw new Error(`Missing CSV page at row ${rowNumber}`);
    if (jsonPages.has(pageKey(url))) {
      overlappingJsonPages++;
      return;
    }
    const slug = pageKey(url).split("/")[1];
    if (!slug || !selectedBrands.includes(slug))
      throw new Error(`Unknown CSV brand at row ${rowNumber}`);
    const specs = {
      Brand: cell(1),
      Family: cell(2),
      Reference: cell(3),
      Name: cell(4),
      Movement: cell(5),
      Material: cell(6),
      Diameter: cell(7) ? `${cell(7)} mm` : "",
      "W/R": cell(8),
      Produced: cell(9),
    };
    const watch = normalizeBrand(
      {
        brand_slug: slug,
        collections: [
          { references: [{ slug: `csv-${rowNumber}`, url, specs }] },
        ],
      },
      commit,
    )[0]!;
    watch.sourceRecordId = `csv:${rowNumber}`;
    watch.sourceFile = file;
    watch.pointer = `/rows/${rowNumber}`;
    watch.evidence = Object.entries(specs).map(([field, value]) => ({
      field,
      value,
      pointer: `/rows/${rowNumber}/${field.replace(/~/g, "~0").replace(/\//g, "~1")}`,
      status: "source_declared",
    }));
    csvOnly.push(watch);
  });
  await writeFile(
    path.join(output, "csv-only.json"),
    JSON.stringify(csvOnly, null, 2),
  );
  csvCoverage = {
    rows: csv.actualRowCount - 1,
    overlappingJsonPages,
    supplementalRows: csvOnly.length,
    sha256,
  };
  normalized.push(...csvOnly);
}
const matches = compareIntake(normalized, existingSnapshot.rows);
const matchesById = new Map(
  matches.map((match) => [match.sourceRecordId, match]),
);
await writeFile(
  path.join(output, "normalized.json"),
  JSON.stringify(normalized, null, 2),
);
await writeFile(
  path.join(output, "matches.json"),
  JSON.stringify(matches, null, 2),
);
const brands = manifests.map((manifest) => {
  const rows = normalized.filter(
    (r) =>
      r.sourceFile === manifest.file ||
      (r.sourceFile === "references.csv" &&
        new URL(r.sourcePage, "https://timepiecepedia.com").pathname.split(
          "/",
        )[1] === manifest.brand),
  );
  const statuses: Record<string, number> = {};
  for (const record of rows) {
    const row = matchesById.get(record.sourceRecordId)!;
    statuses[row.status] = (statuses[row.status] ?? 0) + 1;
  }
  return {
    ...manifest,
    records: rows.length,
    statuses,
    completeness: Object.fromEntries(
      (
        [
          "reference",
          "caseDiameterMm",
          "caseThicknessMm",
          "waterResistanceM",
        ] as const
      ).map((field) => [field, rows.filter((r) => r[field] !== null).length]),
    ),
  };
});
const report = {
  source: "https://github.com/timepiecepedia/timepiecepedia-data",
  commit,
  licence:
    "CC0-1.0 declared by publisher; upstream rights not independently established",
  sourceAuditAt: sourceAudit.auditedAt,
  catalogueRetrievedAt: existingSnapshot.retrievedAt,
  catalogueSha256: createHash("sha256").update(existingBytes).digest("hex"),
  catalogueRows: existingSnapshot.rows.length,
  records: normalized.length,
  distinctSourcePages: new Set(
    normalized.map((row) =>
      new URL(row.sourcePage, "https://timepiecepedia.com").pathname.replace(
        /\/$/,
        "",
      ),
    ),
  ).size,
  distinctFullBrandReferences: new Set(
    normalized
      .filter((row) => row.brand && row.reference)
      .map((row) => `${identity(row.brand!)}|${identity(row.reference!)}`),
  ).size,
  csvCoverage,
  statuses: matches.reduce<Record<string, number>>((totals, match) => {
    totals[match.status] = (totals[match.status] ?? 0) + 1;
    return totals;
  }, {}),
  brands,
  policy:
    "Research only. No DB writes, image work, price imports or automatic merges. Exact candidates are not verified identities.",
  conflictCount: matches.filter((m) => m.conflicts.length).length,
  conflictExamples: matches.filter((m) => m.conflicts.length).slice(0, 12),
};
await writeFile(
  `docs/reports/local-watch-intake-${allBrands ? "full" : "pilot"}.json`,
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(
  JSON.stringify(
    {
      records: normalized.length,
      brands: brands.length,
      statuses: report.statuses,
      conflictCount: report.conflictCount,
    },
    null,
    2,
  ),
);
