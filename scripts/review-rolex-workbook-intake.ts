import fs from "node:fs";
import path from "node:path";

import {
  M1_REVIEW_FIELDS,
  researchJobSchema,
  researchReviewSchema,
  researchWorkbookIntakeSchema,
} from "../app/domain/research";

const ROOT = process.cwd();
const INTAKE_PATH = path.resolve(
  ROOT,
  "data/research/rolex-workbook-intake.json",
);
const JOB_DIR = path.resolve(ROOT, "data/research/jobs");
const REVIEW_DIR = path.resolve(ROOT, "data/research/reviewed");

const intake = researchWorkbookIntakeSchema.parse(
  JSON.parse(fs.readFileSync(INTAKE_PATH, "utf8")),
);
const jobs = fs
  .readdirSync(JOB_DIR)
  .filter((file) => file.endsWith(".json"))
  .map((file) =>
    researchJobSchema.parse(
      JSON.parse(fs.readFileSync(path.join(JOB_DIR, file), "utf8")),
    ),
  );

function latestSuccessfulJob(targetId: string) {
  const job = jobs
    .filter((candidate) => {
      return (
        candidate.targetId === targetId && candidate.status === "succeeded"
      );
    })
    .sort(
      (left, right) =>
        Date.parse(right.completedAt!) - Date.parse(left.completedAt!),
    )[0];
  if (!job?.normalizedArtifactPath) {
    throw new Error(`No successful normalized job exists for ${targetId}.`);
  }
  return job;
}

function normalizedReference(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function validateIdentityUrl(url: string, referenceCode: string) {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "TheReserveResearchReview/1.0" },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    const body = await response.text();
    const exactReferenceFound = normalizedReference(body).includes(
      normalizedReference(referenceCode),
    );
    if (!response.ok || !exactReferenceFound) {
      return {
        status: "fetch_blocked" as const,
        note: `Independent retrieval returned HTTP ${response.status}; exact reference ${referenceCode} was ${exactReferenceFound ? "present" : "not detectable"}. Identity remains provisional.`,
      };
    }
    const primary = new URL(response.url).hostname.endsWith("rolex.com");
    return {
      status: primary
        ? ("validated_primary" as const)
        : ("validated_secondary" as const),
      note: `${primary ? "Manufacturer" : "Secondary"} page independently returned HTTP ${response.status} and contained exact reference ${referenceCode}. This validates candidate identity and URL only; all other provider-extracted fields require separate field-level review.`,
    };
  } catch (error) {
    return {
      status: "fetch_blocked" as const,
      note: `Independent retrieval failed (${error instanceof Error ? error.name : "unknown error"}); identity and all extracted facts remain provisional.`,
    };
  }
}

fs.mkdirSync(REVIEW_DIR, { recursive: true });
let validatedIdentityCount = 0;
let existingReviewCount = 0;

for (const target of intake.targets) {
  const reviewPath = path.join(REVIEW_DIR, `${target.id}.json`);
  if (fs.existsSync(reviewPath)) {
    researchReviewSchema.parse(JSON.parse(fs.readFileSync(reviewPath, "utf8")));
    existingReviewCount += 1;
    continue;
  }
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
    facts: Array<{ fieldName: string; value: unknown }>;
  };
  if (!normalized.candidateIdentity) {
    throw new Error(`${target.id} has no exact candidate identity.`);
  }
  const productUrl = normalized.facts.find(
    (fact) => fact.fieldName === "productUrl" && typeof fact.value === "string",
  )?.value;
  if (typeof productUrl !== "string") {
    throw new Error(`${target.id} has no productUrl fact.`);
  }
  const identityCheck = await validateIdentityUrl(
    productUrl,
    normalized.candidateIdentity.referenceCode,
  );
  const identityValidated = identityCheck.status.startsWith("validated_");
  if (identityValidated) validatedIdentityCount += 1;

  const review = researchReviewSchema.parse({
    reviewVersion: 1,
    targetId: target.id,
    jobId: job.jobId,
    reviewedAt: new Date().toISOString(),
    reviewer: "codex-source-review",
    outcome: "needs_more_evidence",
    candidateIdentity: normalized.candidateIdentity,
    sourceChecks: [
      {
        url: productUrl,
        status: identityCheck.status,
        note: identityCheck.note,
      },
    ],
    verifiedProvisionalFields: identityValidated
      ? ["identity", "referenceCode", "productUrl"]
      : [],
    additionalVerifiedFacts: [],
    rejectedProvisionalFields: [],
    missingM1Fields: identityValidated
      ? M1_REVIEW_FIELDS.filter((field) => field !== "identity")
      : [...M1_REVIEW_FIELDS],
    note: "Initial independent identity review of the owner-supplied Rolex workbook intake. Sonar Pro output is retained as provisional field-level evidence in the extended workbook, but no non-identity decision fact is promoted by this pass. Price, homogeneous configuration, physical fit, full configured weight, normalized movement accuracy, categorical lume, attachment semantics, and date state must be independently checked before migration.",
  });
  fs.writeFileSync(reviewPath, `${JSON.stringify(review, null, 2)}\n`);
}

console.log(
  `Created ${intake.targets.length - existingReviewCount} initial Rolex workbook reviews; preserved ${existingReviewCount} existing reviews; ${validatedIdentityCount} exact identity URLs validated independently.`,
);
