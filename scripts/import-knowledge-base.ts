import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  KNOWLEDGE_BASE_SCHEMA_VERSION,
  knowledgeBaseIntakeSchema,
  knowledgeVectorTagsSchema,
  parseCsvRows,
  extractSourceUrls,
  requiresVariantSplit,
} from "../app/domain/knowledge-base";
import type {
  KnowledgeBaseIntake,
  KnowledgeDossier,
  KnowledgeReferenceFamily,
} from "../app/domain/knowledge-base";

const ROOT = process.cwd();
const KNOWLEDGE_DIR = path.resolve(
  ROOT,
  "data/knowledge base/The Reserve — база знаний, 200 брендов/watch_kb",
);
const INDEX_PATH = path.join(KNOWLEDGE_DIR, "_INDEX.csv");
const OUTPUT_PATH = path.resolve(
  ROOT,
  "data/research/knowledge-base-intake.json",
);
const SOURCE_SNAPSHOT_DATE = "2026-08-28";
const EXPECTED_HEADERS = [
  "brand",
  "brand_rank",
  "model",
  "diameter_mm",
  "thickness_mm",
  "lug_to_lug_mm",
  "caliber",
  "price_tier",
  "market_momentum",
  "data_confidence",
  "production_status",
  "source_file",
] as const;

function sha256(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

function extractVectorTags(markdown: string, sourceFile: string) {
  const section = markdown.match(
    /## 6\. ВЕКТОРНЫЕ ТЕГИ[\s\S]*?```json\s*([\s\S]*?)\s*```/,
  );
  if (!section)
    throw new Error(`${sourceFile}: section 6 JSON block is missing.`);
  const jsonText = section[1];
  if (!jsonText)
    throw new Error(`${sourceFile}: section 6 JSON block is empty.`);

  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(
      `${sourceFile}: section 6 JSON is invalid: ${String(error)}`,
    );
  }
  return knowledgeVectorTagsSchema.parse(raw);
}

function parseReferenceFamilies() {
  const rows = parseCsvRows(fs.readFileSync(INDEX_PATH, "utf8"));
  const headers = rows.shift();
  if (JSON.stringify(headers) !== JSON.stringify(EXPECTED_HEADERS)) {
    throw new Error(
      "Knowledge CSV headers do not match the versioned contract.",
    );
  }

  return rows.map((row, index): KnowledgeReferenceFamily => {
    if (row.length !== EXPECTED_HEADERS.length) {
      throw new Error(
        `_INDEX.csv row ${index + 2}: expected ${EXPECTED_HEADERS.length} columns, received ${row.length}.`,
      );
    }
    const [
      brand,
      rank,
      model,
      diameterRaw,
      thicknessRaw,
      lugToLugRaw,
      caliberRaw,
      priceTier,
      marketMomentum,
      dataConfidenceRaw,
      productionStatus,
      sourceFile,
    ] = row as [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];

    return {
      brand,
      brandRank: Number(rank),
      model,
      diameterRaw,
      thicknessRaw,
      lugToLugRaw,
      caliberRaw,
      priceTier: priceTier as KnowledgeReferenceFamily["priceTier"],
      marketMomentum:
        marketMomentum as KnowledgeReferenceFamily["marketMomentum"],
      dataConfidenceRaw,
      productionStatus:
        productionStatus as KnowledgeReferenceFamily["productionStatus"],
      sourceFile,
      variantSplitRequired: requiresVariantSplit({
        model,
        diameterRaw,
        thicknessRaw,
        lugToLugRaw,
      }),
      recommendationEligibility: "research_only",
    };
  });
}

function parseDossiers(referenceFamilies: KnowledgeReferenceFamily[]) {
  const rankByFile = new Map<string, number>();
  const rowsByFile = new Map<string, number>();
  for (const family of referenceFamilies) {
    const priorRank = rankByFile.get(family.sourceFile);
    if (priorRank !== undefined && priorRank !== family.brandRank) {
      throw new Error(
        `${family.sourceFile}: conflicting brand ranks in index.`,
      );
    }
    rankByFile.set(family.sourceFile, family.brandRank);
    rowsByFile.set(
      family.sourceFile,
      (rowsByFile.get(family.sourceFile) ?? 0) + 1,
    );
  }

  const files = fs
    .readdirSync(KNOWLEDGE_DIR)
    .filter((file) => file.endsWith(".md") && !file.startsWith("_"))
    .sort();

  return files.map((sourceFile): KnowledgeDossier => {
    const absolutePath = path.join(KNOWLEDGE_DIR, sourceFile);
    const markdown = fs.readFileSync(absolutePath, "utf8");
    const numberedSections = markdown.match(/^## [1-7]\./gm) ?? [];
    if (numberedSections.length !== 7) {
      throw new Error(
        `${sourceFile}: expected seven numbered H2 sections, received ${numberedSections.length}.`,
      );
    }
    const rank = rankByFile.get(sourceFile);
    if (rank === undefined) {
      throw new Error(
        `${sourceFile}: no indexed reference family or brand rank.`,
      );
    }
    const tags = extractVectorTags(markdown, sourceFile);
    const questionnaireCoverage = /Q1[–-]Q16/.test(markdown)
      ? "Q1-Q16"
      : /Q1[–-]Q9/.test(markdown)
        ? "Q1-Q9"
        : null;
    if (questionnaireCoverage === null) {
      throw new Error(`${sourceFile}: questionnaire coverage is not declared.`);
    }

    return {
      slug: sourceFile.replace(/\.md$/, ""),
      brand: tags.brand,
      brandRank: rank,
      sourceFile: path.relative(ROOT, absolutePath),
      sourceSnapshotDate: SOURCE_SNAPSHOT_DATE,
      sha256: sha256(markdown),
      sectionCount: 7,
      questionnaireCoverage,
      referenceFamilyCount: rowsByFile.get(sourceFile) ?? 0,
      sourceUrls: extractSourceUrls(markdown),
      tags,
      intakeState: "owner_reviewed_input",
      recommendationEligibility: "research_only",
    };
  });
}

function buildIntake(existing?: KnowledgeBaseIntake): KnowledgeBaseIntake {
  const referenceFamilies = parseReferenceFamilies();
  const dossiers = parseDossiers(referenceFamilies).sort(
    (left, right) => left.brandRank - right.brandRank,
  );
  return knowledgeBaseIntakeSchema.parse({
    schemaVersion: KNOWLEDGE_BASE_SCHEMA_VERSION,
    sourceSnapshotDate: SOURCE_SNAPSHOT_DATE,
    generatedAt: existing?.generatedAt ?? new Date().toISOString(),
    recommendationEligibility: "research_only",
    dossiers,
    referenceFamilies,
  });
}

let existing: KnowledgeBaseIntake | undefined;
if (fs.existsSync(OUTPUT_PATH)) {
  existing = knowledgeBaseIntakeSchema.parse(
    JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8")),
  );
}

const intake = buildIntake(existing);
const serialized = `${JSON.stringify(intake, null, 2)}\n`;

if (process.argv.includes("--write")) {
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, serialized);
} else if (!existing) {
  console.error("Knowledge intake is missing. Run npm run import:knowledge.");
  process.exit(2);
} else if (fs.readFileSync(OUTPUT_PATH, "utf8") !== serialized) {
  console.error("Knowledge intake is stale. Run npm run import:knowledge.");
  process.exit(2);
}

const splitRequired = intake.referenceFamilies.filter(
  (family) => family.variantSplitRequired,
).length;
const q16 = intake.dossiers.filter(
  (dossier) => dossier.questionnaireCoverage === "Q1-Q16",
).length;
const sourceUrls = new Set(
  intake.dossiers.flatMap((dossier) => dossier.sourceUrls),
).size;

console.log(`Knowledge dossiers: ${intake.dossiers.length}`);
console.log(`Indexed reference families: ${intake.referenceFamilies.length}`);
console.log(`Families requiring an explicit split: ${splitRequired}`);
console.log(`Dossiers mapped through Q1-Q16: ${q16}`);
console.log(`Unique dossier source links: ${sourceUrls}`);
console.log("Recommendation eligibility: research_only");
