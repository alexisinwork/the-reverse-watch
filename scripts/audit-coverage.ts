import fs from "node:fs";
import path from "node:path";

import {
  auditCoverage,
  coverageCandidateListSchema,
} from "../app/domain/coverage";

const args = process.argv.slice(2);
const strict = args.includes("--strict");
const json = args.includes("--json");
const positional = args.filter((arg) => !arg.startsWith("--"));
const inputPath = path.resolve(
  process.cwd(),
  positional[0] ?? "data/coverage/reference-variants.json",
);

if (!fs.existsSync(inputPath)) {
  console.error(`Coverage projection not found: ${inputPath}`);
  process.exit(2);
}

let raw: unknown;
try {
  raw = JSON.parse(fs.readFileSync(inputPath, "utf8"));
} catch {
  console.error(`Coverage projection is not valid JSON: ${inputPath}`);
  process.exit(2);
}

const parsed = coverageCandidateListSchema.safeParse(raw);
if (!parsed.success) {
  console.error("Coverage projection failed schema validation.");
  for (const issue of parsed.error.issues.slice(0, 20)) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(2);
}

const audit = auditCoverage(parsed.data);

if (json) {
  console.log(JSON.stringify(audit, null, 2));
} else {
  console.log(
    `Coverage projection: ${path.relative(process.cwd(), inputPath)}`,
  );
  console.log(`Reference variants: ${audit.candidateCount}`);
  console.log(`Core-axis cells: ${audit.totalCells}`);
  console.log(`Covered: ${audit.coveredCells}`);
  console.log(`Empty: ${audit.emptyCells}`);
  console.log(`Single-candidate: ${audit.singleCandidateCells}`);
  console.log(`Under-diversified (<3 brands): ${audit.underDiversifiedCells}`);
  console.log(`Under-evidenced: ${audit.underEvidencedCells}`);
  console.log(`Coverage ratio: ${(audit.coverageRatio * 100).toFixed(2)}%`);
}

if (strict && (audit.emptyCells > 0 || audit.underEvidencedCells > 0)) {
  process.exit(1);
}
