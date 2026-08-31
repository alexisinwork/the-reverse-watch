import fs from "node:fs";
import path from "node:path";

import {
  researchManifestSchema,
  researchWorkbookIntakeSchema,
} from "../app/domain/research";

const ROOT = process.cwd();
const MANIFEST_PATH = path.resolve(ROOT, "data/research/brand-manifest.json");

const intakeArgument = process.argv[2];
if (!intakeArgument) {
  throw new Error(
    "Usage: tsx scripts/sync-research-workbook-intake.ts <intake.json>",
  );
}

const intakePath = path.resolve(ROOT, intakeArgument);
const intake = researchWorkbookIntakeSchema.parse(
  JSON.parse(fs.readFileSync(intakePath, "utf8")),
);
const manifest = researchManifestSchema.parse(
  JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")),
);
const brand = manifest.brands.find(
  (candidate) => candidate.slug === intake.brandSlug,
);
if (!brand) {
  throw new Error(`Manifest brand does not exist: ${intake.brandSlug}.`);
}

const existingIds = new Set(brand.targets.map((target) => target.id));
for (const target of intake.targets) {
  if (existingIds.has(target.id)) continue;
  brand.targets.push({
    id: target.id,
    referenceLabel: target.referenceLabel,
    state: "planned",
    coverageIntent: target.coverageIntent,
    coverageRationale: target.coverageRationale,
  });
  existingIds.add(target.id);
}

brand.priority = "P1";
brand.dossierState = "researching";
brand.manifestRationale =
  "Owner-directed exact-reference research for every Rolex family/size row in the 2026-08-31 workbook intake; material and commercial variants remain separate.";
manifest.updatedAt = intake.importedAt;

const validated = researchManifestSchema.parse(manifest);
fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(validated, null, 2)}\n`);
console.log(
  `Synchronized ${intake.targets.length} workbook targets; Rolex now has ${brand.targets.length} total targets.`,
);
