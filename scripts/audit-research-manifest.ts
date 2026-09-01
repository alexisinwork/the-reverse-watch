import fs from "node:fs";
import path from "node:path";

import {
  researchManifestSchema,
  researchReviewSchema,
} from "../app/domain/research";
import { seedCatalogue } from "../app/domain/seed-catalogue";
import { knowledgeBaseIntakeSchema } from "../app/domain/knowledge-base";

const strict = process.argv.includes("--strict");
const manifestPath = path.resolve(
  process.cwd(),
  "data/research/brand-manifest.json",
);
const intakePath = path.resolve(
  process.cwd(),
  "data/research/knowledge-base-intake.json",
);
const reviewDirectory = path.resolve(process.cwd(), "data/research/reviewed");

let raw: unknown;
try {
  raw = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
} catch {
  console.error(
    `Research manifest is missing or invalid JSON: ${manifestPath}`,
  );
  process.exit(2);
}

const parsed = researchManifestSchema.safeParse(raw);
if (!parsed.success) {
  console.error("Research manifest failed schema validation.");
  for (const issue of parsed.error.issues.slice(0, 30)) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(2);
}

const manifest = parsed.data;
const intake = knowledgeBaseIntakeSchema.parse(
  JSON.parse(fs.readFileSync(intakePath, "utf8")),
);
const intakeByFile = new Map(
  intake.dossiers.map((dossier) => [dossier.sourceFile, dossier]),
);
const catalogueVariants = new Map(
  seedCatalogue.variants.map((variant) => [variant.id, variant]),
);
const integrityErrors: string[] = [];
const statusCounts = new Map<string, number>();
const priorityCounts = new Map<string, number>();
let plannedTargets = 0;
let coverageIntentTargets = 0;
let linkedKnowledgeDossiers = 0;
const targetsById = new Map(
  manifest.brands.flatMap((brand) =>
    brand.targets.map((target) => [target.id, target] as const),
  ),
);
const reviewedTargetIds = new Set<string>();
const reviewOutcomeCounts = new Map<string, number>();

for (const brand of manifest.brands) {
  priorityCounts.set(
    brand.priority,
    (priorityCounts.get(brand.priority) ?? 0) + 1,
  );
  if (brand.knowledgeDossier) {
    linkedKnowledgeDossiers += 1;
    const dossier = intakeByFile.get(brand.knowledgeDossier.sourceFile);
    if (!dossier) {
      integrityErrors.push(
        `${brand.slug}: linked knowledge dossier is missing from the intake`,
      );
    } else {
      const expectedLink = {
        sourceFile: dossier.sourceFile,
        sourceSnapshotDate: dossier.sourceSnapshotDate,
        sha256: dossier.sha256,
        intakeState: dossier.intakeState,
        recommendationEligibility: dossier.recommendationEligibility,
        referenceFamilyCount: dossier.referenceFamilyCount,
        sourceUrlCount: dossier.sourceUrls.length,
      };
      if (
        JSON.stringify(brand.knowledgeDossier) !== JSON.stringify(expectedLink)
      ) {
        integrityErrors.push(
          `${brand.slug}: knowledge dossier metadata is stale; run npm run sync:knowledge-manifest`,
        );
      }
    }
  }
  for (const target of brand.targets) {
    statusCounts.set(target.state, (statusCounts.get(target.state) ?? 0) + 1);
    if (target.state !== "accepted" && target.state !== "excluded") {
      plannedTargets += 1;
    }
    if (target.coverageIntent) coverageIntentTargets += 1;
    if (target.state === "accepted") {
      const variant = catalogueVariants.get(target.catalogueVariantId!);
      if (!variant) {
        integrityErrors.push(
          `${target.id}: accepted catalogue variant ${target.catalogueVariantId} is missing`,
        );
      } else if (variant.brand.slug !== brand.slug) {
        integrityErrors.push(
          `${target.id}: manifest brand ${brand.slug} does not match catalogue brand ${variant.brand.slug}`,
        );
      }
    }
  }
}

for (const dossier of intake.dossiers) {
  const linked = manifest.brands.some(
    (brand) => brand.knowledgeDossier?.sourceFile === dossier.sourceFile,
  );
  if (!linked) {
    integrityErrors.push(
      `${dossier.slug}: knowledge dossier is not in the manifest`,
    );
  }
}

const reviewFiles = fs.existsSync(reviewDirectory)
  ? fs.readdirSync(reviewDirectory).filter((file) => file.endsWith(".json"))
  : [];
for (const file of reviewFiles) {
  const reviewPath = path.join(reviewDirectory, file);
  let reviewRaw: unknown;
  try {
    reviewRaw = JSON.parse(fs.readFileSync(reviewPath, "utf8"));
  } catch {
    integrityErrors.push(`${file}: review artifact is not valid JSON`);
    continue;
  }
  const reviewResult = researchReviewSchema.safeParse(reviewRaw);
  if (!reviewResult.success) {
    integrityErrors.push(
      `${file}: review artifact failed schema validation: ${reviewResult.error.issues
        .slice(0, 3)
        .map((issue) => `${issue.path.join(".")} ${issue.message}`)
        .join("; ")}`,
    );
    continue;
  }
  const review = reviewResult.data;
  if (reviewedTargetIds.has(review.targetId)) {
    integrityErrors.push(`${review.targetId}: duplicate review artifact`);
  }
  reviewedTargetIds.add(review.targetId);
  reviewOutcomeCounts.set(
    review.outcome,
    (reviewOutcomeCounts.get(review.outcome) ?? 0) + 1,
  );
  const target = targetsById.get(review.targetId);
  if (!target) {
    integrityErrors.push(`${file}: review target is missing from the manifest`);
  } else if (
    review.outcome === "needs_more_evidence" &&
    target.state !== "needs_review"
  ) {
    integrityErrors.push(
      `${review.targetId}: needs_more_evidence review requires needs_review manifest state`,
    );
  } else if (
    review.outcome === "ready_for_migration" &&
    target.state !== "needs_review" &&
    target.state !== "accepted"
  ) {
    integrityErrors.push(
      `${review.targetId}: ready_for_migration review requires needs_review or accepted manifest state`,
    );
  } else if (
    review.outcome === "owner_approved_for_recommendation" &&
    target.state !== "accepted"
  ) {
    integrityErrors.push(
      `${review.targetId}: owner-approved recommendation review requires accepted manifest state`,
    );
  } else if (review.outcome === "excluded" && target.state !== "excluded") {
    integrityErrors.push(
      `${review.targetId}: excluded review requires excluded manifest state`,
    );
  } else if (
    target.state === "accepted" &&
    review.outcome !== "ready_for_migration" &&
    review.outcome !== "owner_approved_for_recommendation"
  ) {
    integrityErrors.push(
      `${review.targetId}: accepted reviewed target requires a migration-ready or owner-approved recommendation outcome`,
    );
  }
}

for (const [targetId, target] of targetsById) {
  if (target.state === "needs_review" && !reviewedTargetIds.has(targetId)) {
    integrityErrors.push(
      `${targetId}: needs_review target has no review artifact`,
    );
  }
}

for (const variant of seedCatalogue.variants) {
  const linked = manifest.brands.some((brand) =>
    brand.targets.some((target) => target.catalogueVariantId === variant.id),
  );
  if (!linked)
    integrityErrors.push(
      `${variant.id}: accepted seed row is not in the manifest`,
    );
}

if (integrityErrors.length > 0) {
  console.error("Research manifest integrity failed.");
  integrityErrors.forEach((error) => console.error(`  ${error}`));
  process.exit(2);
}

const targetGap = Math.max(
  0,
  manifest.targetBrandCount - manifest.brands.length,
);
console.log(`Research manifest: ${path.relative(process.cwd(), manifestPath)}`);
console.log(
  `Brands planned: ${manifest.brands.length}/${manifest.targetBrandCount}`,
);
console.log(`Brand slots remaining: ${targetGap}`);
console.log(
  `Priorities: ${["P0", "P1", "P2", "P3"]
    .map((priority) => `${priority}=${priorityCounts.get(priority) ?? 0}`)
    .join(", ")}`,
);
console.log(
  `Target states: ${[...statusCounts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([status, count]) => `${status}=${count}`)
    .join(", ")}`,
);
console.log(`Active research targets: ${plannedTargets}`);
console.log(`Targets with explicit coverage intent: ${coverageIntentTargets}`);
console.log(`Accepted catalogue links: ${statusCounts.get("accepted") ?? 0}`);
console.log(
  `Knowledge dossiers linked: ${linkedKnowledgeDossiers}/${intake.dossiers.length}`,
);
console.log(
  `Review artifacts: ${reviewFiles.length} (${[...reviewOutcomeCounts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([outcome, count]) => `${outcome}=${count}`)
    .join(", ")})`,
);

if (strict && targetGap > 0) process.exit(1);
