import fs from "node:fs";
import path from "node:path";

import { dedupeSheetRows, isWorkbookArtifact } from "../app/domain/sheet-dedup";
import { parseSheetRow, type SheetRow } from "../app/domain/sheet-intake";
import { seedCatalogue } from "../app/domain/seed-catalogue";

const input = process.argv[2];
if (!input) {
  console.error("Usage: npm run import:model-sheet -- <path-to-tsv>");
  process.exit(1);
}

const source = fs.readFileSync(path.resolve(input), "utf8");
const lines = source.split(/\r?\n/);
const parsed: SheetRow[] = [];
const rejected: { sourceLine: number; reasons: string[] }[] = [];
let artifacts = 0;

for (const [index, line] of lines.entries()) {
  const sourceLine = index + 1;
  if (line.trim().length === 0) continue;
  const cells = line.split("\t");
  if (cells[0]?.trim() === "Модель / reference") continue;
  if (isWorkbookArtifact(cells)) {
    artifacts += 1;
    continue;
  }
  const result = parseSheetRow(cells, sourceLine);
  if (result.ok) parsed.push(result.row);
  else rejected.push({ sourceLine, reasons: result.reasons });
}

const { accepted, collapsed, conflicts } = dedupeSheetRows(parsed);

console.log(`Parsed ${parsed.length} rows; dropped ${artifacts} artifacts.`);
console.log(`Accepted ${accepted.length} unique references.`);
console.log(`Collapsed ${collapsed.length} exact duplicate groups.`);
for (const group of collapsed) {
  console.log(
    `  ${group.referenceCode}: lines ${group.sourceLines.join(", ")}`,
  );
}
console.log(`Rejected ${conflicts.length} conflicting duplicate groups.`);
for (const conflict of conflicts) {
  console.log(
    `  ${conflict.referenceCode}: lines ${conflict.sourceLines.join(", ")} differ in ${conflict.fields.join(", ")}`,
  );
}
console.log(`Rejected ${rejected.length} unparseable rows.`);
for (const rejection of rejected) {
  for (const reason of rejection.reasons) console.log(`  ${reason}`);
}

const reviewed = new Map(
  seedCatalogue.variants.map((variant) => [
    variant.referenceCode.toLocaleUpperCase("en-US"),
    variant.id,
  ]),
);
const superseding = accepted.filter((row) =>
  reviewed.has(row.referenceCode.toLocaleUpperCase("en-US")),
);
console.log(
  `${superseding.length} sheet rows supersede an already-reviewed variant:`,
);
for (const row of superseding) {
  console.log(
    `  ${row.referenceCode} supersedes ${reviewed.get(row.referenceCode.toLocaleUpperCase("en-US"))}`,
  );
}

const output = path.join(
  process.cwd(),
  "data/research/model-sheet-intake.json",
);
fs.writeFileSync(
  output,
  `${JSON.stringify({ importedAt: new Date().toISOString(), accepted }, null, 2)}\n`,
);
console.log(`Wrote ${accepted.length} rows to ${output}.`);

if (conflicts.length > 0 || rejected.length > 0) process.exitCode = 1;
