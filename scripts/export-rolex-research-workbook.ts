import fs from "node:fs";
import path from "node:path";

import ExcelJS from "exceljs";

import {
  RESEARCH_FACT_FIELDS,
  researchJobSchema,
  researchReviewSchema,
  researchWorkbookIntakeSchema,
} from "../app/domain/research";

const ROOT = process.cwd();
const inputArgument = process.argv[2];
const outputArgument = process.argv[3];
if (!inputArgument || !outputArgument) {
  throw new Error(
    "Usage: tsx scripts/export-rolex-research-workbook.ts <input.xlsx> <output.xlsx>",
  );
}

const inputPath = path.resolve(inputArgument);
const outputPath = path.resolve(outputArgument);
const intake = researchWorkbookIntakeSchema.parse(
  JSON.parse(
    fs.readFileSync(
      path.resolve(ROOT, "data/research/rolex-workbook-intake.json"),
      "utf8",
    ),
  ),
);
const jobs = fs
  .readdirSync(path.resolve(ROOT, "data/research/jobs"))
  .filter((file) => file.endsWith(".json"))
  .map((file) =>
    researchJobSchema.parse(
      JSON.parse(
        fs.readFileSync(path.resolve(ROOT, "data/research/jobs", file), "utf8"),
      ),
    ),
  );
const reviews = new Map(
  fs
    .readdirSync(path.resolve(ROOT, "data/research/reviewed"))
    .filter(
      (file) => file.startsWith("rolex-workbook-") && file.endsWith(".json"),
    )
    .map((file) => {
      const review = researchReviewSchema.parse(
        JSON.parse(
          fs.readFileSync(
            path.resolve(ROOT, "data/research/reviewed", file),
            "utf8",
          ),
        ),
      );
      return [review.targetId, review] as const;
    }),
);

function latestSuccessfulJob(targetId: string) {
  const job = jobs
    .filter(
      (candidate) =>
        candidate.targetId === targetId && candidate.status === "succeeded",
    )
    .sort(
      (left, right) =>
        Date.parse(right.completedAt!) - Date.parse(left.completedAt!),
    )[0];
  if (!job?.normalizedArtifactPath) {
    throw new Error(`No normalized research exists for ${targetId}.`);
  }
  return job;
}

function displayValue(value: unknown) {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? value : JSON.stringify(value);
}

function styleWorksheet(worksheet: ExcelJS.Worksheet) {
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: worksheet.rowCount, column: worksheet.columnCount },
  };
  const header = worksheet.getRow(1);
  header.height = 30;
  header.font = { bold: true, color: { argb: "FFEDEDE8" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF08090B" },
  };
  header.alignment = { vertical: "middle", wrapText: true };
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.alignment = { vertical: "top", wrapText: true };
  });
}

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(inputPath);
for (const name of [
  "Research Summary",
  "Exact Reference Research",
  "Field Evidence",
]) {
  const existing = workbook.getWorksheet(name);
  if (existing) workbook.removeWorksheet(existing.id);
}

const researchRows: Array<Record<string, unknown>> = [];
const evidenceRows: Array<Record<string, unknown>> = [];
let totalCost = 0;
for (const target of intake.targets) {
  const job = latestSuccessfulJob(target.id);
  const normalized = JSON.parse(
    fs.readFileSync(path.resolve(ROOT, job.normalizedArtifactPath!), "utf8"),
  ) as {
    candidateIdentity: {
      brand: string;
      model: string;
      referenceCode: string;
      variantName: string;
    } | null;
    facts: Array<{
      fieldName: string;
      value: unknown;
      sourceUrl: string;
      sourceType: string;
      evidenceKind: string;
      observedAt: string;
      retrievedAt: string;
      reviewStatus: string;
      note: string | null;
    }>;
    unresolvedFields: string[];
    sourceAssessment: string;
  };
  if (!normalized.candidateIdentity) {
    throw new Error(`${target.id} has no candidate identity.`);
  }
  const review = reviews.get(target.id);
  totalCost += job.costUsd ?? 0;
  const row: Record<string, unknown> = {
    sourceRow: target.sourceRow,
    targetId: target.id,
    reviewOutcome: review?.outcome ?? "not_reviewed",
    missingM1Fields: review?.missingM1Fields.join(", ") ?? null,
    independentVerifiedFields:
      review === undefined
        ? null
        : [
            ...review.verifiedProvisionalFields,
            ...review.additionalVerifiedFacts.map((fact) => fact.fieldName),
          ].join(", "),
    rejectedProvisionalFields:
      review?.rejectedProvisionalFields
        .map((field) => field.fieldName)
        .join(", ") ?? null,
    brand: normalized.candidateIdentity.brand,
    model: normalized.candidateIdentity.model,
    exactReference: normalized.candidateIdentity.referenceCode,
    variantName: normalized.candidateIdentity.variantName,
    unresolvedFields: normalized.unresolvedFields.join(", "),
    sourceAssessment: normalized.sourceAssessment,
    retrievedAt: job.completedAt,
    modelOrPreset: job.preset,
    costUsd: job.costUsd,
  };
  for (const fieldName of RESEARCH_FACT_FIELDS) {
    const fact = normalized.facts.find((candidate) => {
      return candidate.fieldName === fieldName;
    });
    row[fieldName] = displayValue(fact?.value);
  }
  for (const fact of review?.additionalVerifiedFacts ?? []) {
    row[fact.fieldName] = displayValue(fact.value);
  }
  researchRows.push(row);

  normalized.facts.forEach((fact) => {
    evidenceRows.push({
      sourceRow: target.sourceRow,
      targetId: target.id,
      exactReference: normalized.candidateIdentity!.referenceCode,
      fieldName: fact.fieldName,
      value: displayValue(fact.value),
      evidenceKind: fact.evidenceKind,
      sourceType: fact.sourceType,
      sourceUrl: fact.sourceUrl,
      observedAt: fact.observedAt,
      retrievedAt: fact.retrievedAt,
      providerReviewStatus: fact.reviewStatus,
      independentReviewOutcome: review?.outcome ?? "not_reviewed",
      note: fact.note,
    });
  });
  review?.additionalVerifiedFacts.forEach((fact) => {
    evidenceRows.push({
      sourceRow: target.sourceRow,
      targetId: target.id,
      exactReference: normalized.candidateIdentity!.referenceCode,
      fieldName: fact.fieldName,
      value: displayValue(fact.value),
      evidenceKind: "independently_verified",
      sourceType: "independent_review",
      sourceUrl: fact.sourceUrl,
      observedAt: review.reviewedAt,
      retrievedAt: review.reviewedAt,
      providerReviewStatus: "verified",
      independentReviewOutcome: review.outcome,
      note: fact.note,
    });
  });
}

const reviewCounts = [...reviews.values()].reduce(
  (counts, review) => {
    counts[review.outcome] += 1;
    return counts;
  },
  {
    ready_for_migration: 0,
    needs_more_evidence: 0,
    excluded: 0,
  },
);

const summary = workbook.addWorksheet("Research Summary");
summary.columns = [
  { header: "Metric", key: "metric", width: 34 },
  { header: "Value", key: "value", width: 90 },
];
summary.addRows([
  { metric: "Source workbook", value: intake.sourceWorkbookName },
  { metric: "Source SHA-256", value: intake.sourceSha256 },
  { metric: "Workbook rows covered", value: 34 },
  { metric: "Exact-reference targets", value: intake.targets.length },
  {
    metric: "Independent review outcome",
    value: `${reviewCounts.ready_for_migration} ready for migration; ${reviewCounts.needs_more_evidence} need more evidence; ${reviewCounts.excluded} excluded.`,
  },
  { metric: "Research provider", value: "Perplexity Sonar Pro" },
  { metric: "Provider cost (USD)", value: Number(totalCost.toFixed(5)) },
  { metric: "Retrieval date", value: "2026-08-31" },
  {
    metric: "Catalogue rule",
    value:
      "Only exact, materially homogeneous, M1-complete variants with verified field evidence may be migrated as accepted catalogue rows. Missing facts remain null.",
  },
]);
styleWorksheet(summary);

const research = workbook.addWorksheet("Exact Reference Research");
research.columns = [
  { header: "Source Workbook Row", key: "sourceRow", width: 12 },
  { header: "Research Target ID", key: "targetId", width: 42 },
  { header: "Independent Review Outcome", key: "reviewOutcome", width: 22 },
  { header: "Missing M1 Fields", key: "missingM1Fields", width: 58 },
  {
    header: "Independently Verified Fields",
    key: "independentVerifiedFields",
    width: 72,
  },
  {
    header: "Rejected Provisional Fields",
    key: "rejectedProvisionalFields",
    width: 52,
  },
  { header: "Brand", key: "brand", width: 14 },
  { header: "Model", key: "model", width: 26 },
  { header: "Exact Reference", key: "exactReference", width: 20 },
  { header: "Variant Name", key: "variantName", width: 48 },
  { header: "Provider Unresolved Fields", key: "unresolvedFields", width: 58 },
  { header: "Provider Source Assessment", key: "sourceAssessment", width: 72 },
  { header: "Retrieved At", key: "retrievedAt", width: 24 },
  { header: "Model / Preset", key: "modelOrPreset", width: 16 },
  { header: "Cost USD", key: "costUsd", width: 12 },
  ...RESEARCH_FACT_FIELDS.map((fieldName) => ({
    header: fieldName,
    key: fieldName,
    width: fieldName === "productUrl" ? 46 : 24,
  })),
];
research.addRows(researchRows);
styleWorksheet(research);

const evidence = workbook.addWorksheet("Field Evidence");
evidence.columns = [
  { header: "Source Workbook Row", key: "sourceRow", width: 12 },
  { header: "Research Target ID", key: "targetId", width: 42 },
  { header: "Exact Reference", key: "exactReference", width: 20 },
  { header: "Field Name", key: "fieldName", width: 38 },
  { header: "Value", key: "value", width: 42 },
  { header: "Evidence Kind", key: "evidenceKind", width: 18 },
  { header: "Source Type", key: "sourceType", width: 24 },
  { header: "Source URL", key: "sourceUrl", width: 72 },
  { header: "Observed At", key: "observedAt", width: 24 },
  { header: "Retrieved At", key: "retrievedAt", width: 24 },
  { header: "Provider Status", key: "providerReviewStatus", width: 18 },
  {
    header: "Independent Review Outcome",
    key: "independentReviewOutcome",
    width: 24,
  },
  { header: "Note", key: "note", width: 72 },
];
evidence.addRows(evidenceRows);
styleWorksheet(evidence);
evidence.getColumn("sourceUrl").eachCell((cell, rowNumber) => {
  if (rowNumber === 1 || typeof cell.value !== "string") return;
  const url = cell.value;
  cell.value = { text: url, hyperlink: url, tooltip: url };
  cell.font = { color: { argb: "FF0563C1" }, underline: true };
});

workbook.modified = new Date();
await workbook.xlsx.writeFile(outputPath);
console.log(
  `Wrote ${researchRows.length} exact-reference rows and ${evidenceRows.length} field-evidence rows to ${outputPath}.`,
);
