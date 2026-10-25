import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
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
} from "./lib/watch-intake";

const root = path.resolve("data/watch-archive");
const source = path.join(root, "timepiecepedia");
const output = path.join(root, "pilot");
await mkdir(output, { recursive: true });
const snapshotFile = path.join(output, "existing-catalogue.json");
if (process.argv.includes("--refresh-catalogue")) {
  const client = catalogueClient();
  if (!client)
    throw new Error(
      "Catalogue read credentials are missing; use a prior local snapshot instead.",
    );
  const rows = await listCatalogue(client, true);
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
for (const brand of ["tissot", "seiko", "casio", "omega"]) {
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
const matches = compareIntake(normalized, existingSnapshot.rows);
await writeFile(
  path.join(output, "normalized.json"),
  JSON.stringify(normalized, null, 2),
);
await writeFile(
  path.join(output, "matches.json"),
  JSON.stringify(matches, null, 2),
);
const brands = manifests.map((manifest) => {
  const rows = normalized.filter((r) => r.sourceFile === manifest.file);
  const statuses: Record<string, number> = {};
  for (const row of matches.filter((m) =>
    rows.some((r) => r.sourceRecordId === m.sourceRecordId),
  ))
    statuses[row.status] = (statuses[row.status] ?? 0) + 1;
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
  brands,
  policy:
    "Research only. No DB writes, image work, price imports or automatic merges. Exact candidates are not verified identities.",
  conflictCount: matches.filter((m) => m.conflicts.length).length,
  conflictExamples: matches.filter((m) => m.conflicts.length).slice(0, 12),
};
await writeFile(
  "docs/reports/local-watch-intake-pilot.json",
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(
  JSON.stringify(
    { records: normalized.length, brands, conflictCount: report.conflictCount },
    null,
    2,
  ),
);
