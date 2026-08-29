import fs from "node:fs";
import path from "node:path";

import { knowledgeBaseIntakeSchema } from "../app/domain/knowledge-base";
import { researchManifestSchema } from "../app/domain/research";
import type { ResearchManifest } from "../app/domain/research";

const ROOT = process.cwd();
const MANIFEST_PATH = path.resolve(ROOT, "data/research/brand-manifest.json");
const INTAKE_PATH = path.resolve(
  ROOT,
  "data/research/knowledge-base-intake.json",
);
const SLUG_ALIASES: Record<string, string> = {
  "a-lange-sohne": "a-lange-soehne",
  "nomos-glashutte": "nomos-glashuette",
};

const manifest = researchManifestSchema.parse(
  JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")),
);
const originalSerialized = `${JSON.stringify(manifest, null, 2)}\n`;
const intake = knowledgeBaseIntakeSchema.parse(
  JSON.parse(fs.readFileSync(INTAKE_PATH, "utf8")),
);
const existingBySlug = new Map(
  manifest.brands.map((brand) => [brand.slug, brand]),
);

for (const dossier of intake.dossiers) {
  const slug = SLUG_ALIASES[dossier.slug] ?? dossier.slug;
  const link = {
    sourceFile: dossier.sourceFile,
    sourceSnapshotDate: dossier.sourceSnapshotDate,
    sha256: dossier.sha256,
    intakeState: "owner_reviewed_input" as const,
    recommendationEligibility: "research_only" as const,
    referenceFamilyCount: dossier.referenceFamilyCount,
    sourceUrlCount: dossier.sourceUrls.length,
  };
  const existing = existingBySlug.get(slug);
  if (existing) {
    existing.knowledgeDossier = link;
    if (existing.dossierState === "not_started") {
      existing.dossierState = "needs_review";
    }
    continue;
  }
  existingBySlug.set(slug, {
    slug,
    name: dossier.brand,
    priority: "P3",
    manifestRationale: `Owner-reviewed knowledge-pack dossier at position ${dossier.brandRank}; retained for M0/M2 review and future coverage selection.`,
    dossierState: "needs_review",
    knowledgeDossier: link,
    targets: [],
  });
}

const candidate: ResearchManifest = researchManifestSchema.parse({
  ...manifest,
  targetBrandCount: Math.max(manifest.targetBrandCount, existingBySlug.size),
  brands: [...existingBySlug.values()].sort((left, right) => {
    const leftRank = intake.dossiers.findIndex(
      (dossier) => (SLUG_ALIASES[dossier.slug] ?? dossier.slug) === left.slug,
    );
    const rightRank = intake.dossiers.findIndex(
      (dossier) => (SLUG_ALIASES[dossier.slug] ?? dossier.slug) === right.slug,
    );
    if (leftRank === -1) return 1;
    if (rightRank === -1) return -1;
    return leftRank - rightRank;
  }),
});

const candidateSerialized = `${JSON.stringify(candidate, null, 2)}\n`;
const changed = originalSerialized !== candidateSerialized;
const next = changed
  ? researchManifestSchema.parse({
      ...candidate,
      updatedAt: new Date().toISOString(),
    })
  : manifest;

if (changed) {
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(next, null, 2)}\n`);
}
console.log(
  `Research manifest ${changed ? "synchronized" : "already synchronized"}: ${next.brands.length} brands, ${intake.dossiers.length} linked knowledge dossiers.`,
);
