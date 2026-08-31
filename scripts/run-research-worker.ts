import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  buildResearchPrompt,
  extractPerplexitySonarOutputText,
  extractPerplexitySonarSourceUrls,
  normalizeProposedFacts,
  parseExtractionText,
  PERPLEXITY_RESEARCH_CONTRACT_VERSION,
  perplexityResearchResponseFormat,
  perplexitySonarResponseSchema,
} from "../app/domain/perplexity-research";
import {
  researchJobSchema,
  researchManifestSchema,
} from "../app/domain/research";
import {
  indexResearchJobHistory,
  nextResearchAttempt,
  researchRetryDelayMilliseconds,
  retryAfterMilliseconds,
} from "../app/domain/research-jobs";
import { coverageCandidateListSchema } from "../app/domain/coverage";
import { planCoverageResearch } from "../app/domain/research-planning";
import type {
  ResearchJob,
  ResearchManifest,
  ResearchTarget,
} from "../app/domain/research";

const ROOT = process.cwd();
const MANIFEST_PATH = path.resolve(ROOT, "data/research/brand-manifest.json");
const COVERAGE_PATH = path.resolve(
  ROOT,
  "data/coverage/reference-variants.json",
);
const JOB_DIR = path.resolve(ROOT, "data/research/jobs");
const RAW_DIR = path.resolve(ROOT, "data/research/raw");
const NORMALIZED_DIR = path.resolve(ROOT, "data/research/normalized");
const CONTRACT_VERSION = PERPLEXITY_RESEARCH_CONTRACT_VERSION;
const DEFAULT_CONCURRENCY = 1;
const DEFAULT_ATTEMPTS = 3;

type ResearchSelection = {
  target: ResearchTarget;
  brandName: string;
};

type WorkerOptions = {
  targetIds: string[];
  limit: number | null;
  concurrency: number;
  attempts: number;
  dryRun: boolean;
  force: boolean;
  model: string;
};

function integerArgument(name: string, fallback: number | null) {
  const index = process.argv.indexOf(name);
  const inline = process.argv.find((argument) =>
    argument.startsWith(`${name}=`),
  );
  if (index === -1 && inline === undefined) return fallback;
  const rawValue =
    inline !== undefined
      ? inline.slice(name.length + 1)
      : process.argv[index + 1];
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive integer.`);
  }
  return value;
}

function stringArguments(name: string) {
  const values: string[] = [];
  process.argv.forEach((argument, index) => {
    const value = process.argv[index + 1];
    if (argument === name && value) values.push(value);
    if (argument.startsWith(`${name}=`)) {
      const inline = argument.slice(name.length + 1);
      if (inline) values.push(inline);
    }
  });
  return values;
}

function stringArgument(name: string, fallback: string) {
  const values = stringArguments(name);
  if (values.length > 1) {
    throw new RangeError(`${name} may be provided only once.`);
  }
  return values[0] ?? fallback;
}

function optionsFromArguments(): WorkerOptions {
  return {
    targetIds: stringArguments("--target"),
    limit: integerArgument("--limit", null),
    concurrency: integerArgument("--concurrency", DEFAULT_CONCURRENCY)!,
    attempts: integerArgument("--attempts", DEFAULT_ATTEMPTS)!,
    dryRun: process.argv.includes("--dry-run"),
    force: process.argv.includes("--force"),
    model: stringArgument(
      "--model",
      process.env.PERPLEXITY_RESEARCH_MODEL || "sonar-pro",
    ),
  };
}

function loadManifest() {
  return researchManifestSchema.parse(
    JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")),
  );
}

function loadCoverageCandidates() {
  return coverageCandidateListSchema.parse(
    JSON.parse(fs.readFileSync(COVERAGE_PATH, "utf8")),
  );
}

function selectTargets(
  manifest: ResearchManifest,
  options: WorkerOptions,
): ResearchSelection[] {
  const available = manifest.brands.flatMap((brand) =>
    brand.targets.flatMap((target) =>
      target.state === "planned" ? [{ target, brandName: brand.name }] : [],
    ),
  );
  const availableById = new Map(
    available.map((selection) => [selection.target.id, selection]),
  );
  const selected =
    options.targetIds.length === 0
      ? planCoverageResearch(manifest, loadCoverageCandidates()).map(
          ({ targetId }) => availableById.get(targetId)!,
        )
      : options.targetIds.map((targetId) => {
          const match = availableById.get(targetId);
          if (!match) {
            throw new Error(`Planned target does not exist: ${targetId}.`);
          }
          return match;
        });
  return options.limit === null ? selected : selected.slice(0, options.limit);
}

function requestFingerprint(target: ResearchTarget, model: string) {
  const input = JSON.stringify({
    contractVersion: CONTRACT_VERSION,
    provider: "perplexity",
    model,
    targetId: target.id,
    prompt: buildResearchPrompt(target),
  });
  return createHash("sha256").update(input).digest("hex");
}

function relative(absolutePath: string) {
  return path.relative(ROOT, absolutePath);
}

function ensureDirectories() {
  [JOB_DIR, RAW_DIR, NORMALIZED_DIR].forEach((directory) =>
    fs.mkdirSync(directory, { recursive: true }),
  );
}

function writeJsonExclusive(absolutePath: string, value: unknown) {
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, {
    flag: "wx",
  });
}

function writeJob(job: ResearchJob) {
  fs.writeFileSync(
    path.join(JOB_DIR, `${job.jobId}.json`),
    `${JSON.stringify(researchJobSchema.parse(job), null, 2)}\n`,
  );
}

function loadJobHistory() {
  const jobs = fs.existsSync(JOB_DIR)
    ? fs
        .readdirSync(JOB_DIR)
        .filter((file) => file.endsWith(".json"))
        .map((file) =>
          researchJobSchema.parse(
            JSON.parse(fs.readFileSync(path.join(JOB_DIR, file), "utf8")),
          ),
        )
    : [];
  return indexResearchJobHistory(jobs);
}

function writeManifest(manifest: ResearchManifest) {
  const validated = researchManifestSchema.parse(manifest);
  const temporaryPath = `${MANIFEST_PATH}.tmp-${process.pid}`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(validated, null, 2)}\n`);
  fs.renameSync(temporaryPath, MANIFEST_PATH);
}

function moveTargetToReview(manifest: ResearchManifest, targetId: string) {
  const target = manifest.brands
    .flatMap((brand) => brand.targets)
    .find((candidate) => candidate.id === targetId);
  if (!target) throw new Error(`Cannot update missing target: ${targetId}.`);
  if (target.state === "needs_review") return;
  if (target.state !== "planned") {
    throw new Error(
      `Cannot move ${targetId} from ${target.state} to needs_review.`,
    );
  }
  target.state = "needs_review";
  manifest.updatedAt = new Date().toISOString();
  writeManifest(manifest);
}

function newJob({
  target,
  fingerprint,
  model,
  attempt,
}: {
  target: ResearchTarget;
  fingerprint: string;
  model: string;
  attempt: number;
}): ResearchJob {
  return researchJobSchema.parse({
    jobId: randomUUID(),
    targetId: target.id,
    status: "queued",
    attempt,
    requestFingerprint: fingerprint,
    provider: "perplexity",
    preset: model,
    queuedAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    rawArtifactPath: null,
    normalizedArtifactPath: null,
    sourceUrls: [],
    costUsd: null,
    inputTokens: null,
    outputTokens: null,
    error: null,
  });
}

async function callPerplexity(
  target: ResearchTarget,
  model: string,
  correction: string | null,
) {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error("PERPLEXITY_API_KEY is not configured.");
  }
  const response = await fetch("https://api.perplexity.ai/v1/sonar", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: buildResearchPrompt(target, correction),
        },
      ],
      max_tokens: 12_000,
      web_search_options: { search_context_size: "high" },
      response_format: perplexityResearchResponseFormat,
    }),
    signal: AbortSignal.timeout(180_000),
  });
  const text = await response.text();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    raw = {
      httpStatus: response.status,
      contentType: response.headers.get("content-type"),
      nonJsonBody: text,
    };
  }
  return {
    raw,
    ok: response.ok,
    status: response.status,
    retryAfter: response.headers.get("retry-after"),
  };
}

async function waitBeforeRetry(
  attempt: number,
  requestedDelayMs: number | null,
) {
  const delayMs = researchRetryDelayMilliseconds(attempt, requestedDelayMs);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

function errorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "issues" in error &&
    Array.isArray(error.issues)
  ) {
    const issues = error.issues as Array<{
      path?: PropertyKey[];
      message?: string;
    }>;
    const summary = issues
      .slice(0, 12)
      .map(
        (issue) =>
          `${issue.path?.map(String).join(".") || "response"}: ${issue.message ?? "invalid value"}`,
      )
      .join("; ");
    const remaining = Math.max(0, issues.length - 12);
    return remaining > 0 ? `${summary}; ${remaining} more issue(s)` : summary;
  }
  return error instanceof Error ? error.message : String(error);
}

async function researchTarget(
  selection: ResearchSelection,
  options: WorkerOptions,
  manifest: ResearchManifest,
  successfulFingerprints: Map<string, ResearchJob>,
  maximumAttemptByFingerprint: Map<string, number>,
  latestFailureByFingerprint: Map<string, ResearchJob>,
) {
  const { target, brandName } = selection;
  const fingerprint = requestFingerprint(target, options.model);
  const reusable = successfulFingerprints.get(fingerprint);
  if (reusable && !options.force) {
    console.log(
      `[reuse] ${target.id}: ${reusable.normalizedArtifactPath ?? reusable.jobId}`,
    );
    moveTargetToReview(manifest, target.id);
    return;
  }
  if (options.dryRun) {
    console.log(`[dry-run] ${target.id} — ${brandName}`);
    return;
  }

  const firstAttempt = nextResearchAttempt(
    maximumAttemptByFingerprint,
    fingerprint,
  );
  let correction: string | null =
    latestFailureByFingerprint.get(fingerprint)?.error ?? null;
  for (let offset = 0; offset < options.attempts; offset += 1) {
    const attempt = firstAttempt + offset;
    let retryDelayMs: number | null = null;
    const job = newJob({
      target,
      fingerprint,
      model: options.model,
      attempt,
    });
    writeJob(job);
    job.status = "running";
    job.startedAt = new Date().toISOString();
    writeJob(job);

    try {
      const providerResponse = await callPerplexity(
        target,
        options.model,
        correction,
      );
      const { raw } = providerResponse;
      const rawPath = path.join(RAW_DIR, `${job.jobId}.json`);
      writeJsonExclusive(rawPath, raw);
      job.rawArtifactPath = relative(rawPath);
      writeJob(job);
      if (!providerResponse.ok) {
        if (providerResponse.status === 429) {
          retryDelayMs =
            retryAfterMilliseconds(providerResponse.retryAfter) ?? 10_000;
        }
        const error =
          typeof raw === "object" && raw !== null && "error" in raw
            ? JSON.stringify(raw.error)
            : `HTTP ${providerResponse.status}`;
        throw new Error(`Perplexity request failed: ${error}`);
      }
      const parsed = perplexitySonarResponseSchema.parse(raw);
      const completedAt = new Date().toISOString();
      const extraction = parseExtractionText(
        extractPerplexitySonarOutputText(parsed),
      );
      if (extraction.targetId !== target.id) {
        throw new Error(
          `Perplexity target mismatch: expected ${target.id}, received ${extraction.targetId}.`,
        );
      }
      const facts = normalizeProposedFacts({
        extraction,
        provider: "perplexity",
        preset: options.model,
        jobId: job.jobId,
        retrievedAt: completedAt,
      });
      const normalizedPath = path.join(NORMALIZED_DIR, `${job.jobId}.json`);
      writeJsonExclusive(normalizedPath, {
        contractVersion: CONTRACT_VERSION,
        targetId: target.id,
        candidateIdentity: extraction.candidateIdentity,
        exactVariantFound: extraction.exactVariantFound,
        facts,
        unresolvedFields: extraction.unresolvedFields,
        sourceAssessment: extraction.sourceAssessment,
      });
      job.status = "succeeded";
      job.completedAt = completedAt;
      job.normalizedArtifactPath = relative(normalizedPath);
      job.sourceUrls = [
        ...new Set([
          ...extractPerplexitySonarSourceUrls(parsed),
          ...facts.map((fact) => fact.sourceUrl),
        ]),
      ].sort();
      job.costUsd = parsed.usage?.cost?.total_cost ?? null;
      job.inputTokens = parsed.usage?.prompt_tokens ?? null;
      job.outputTokens = parsed.usage?.completion_tokens ?? null;
      writeJob(job);
      successfulFingerprints.set(fingerprint, job);
      maximumAttemptByFingerprint.set(fingerprint, attempt);
      moveTargetToReview(manifest, target.id);
      console.log(
        `[succeeded] ${target.id}: ${facts.length} provisional facts, ${extraction.unresolvedFields.length} unresolved`,
      );
      return;
    } catch (error) {
      job.status = "failed";
      job.completedAt = new Date().toISOString();
      job.error = errorMessage(error);
      correction = job.error;
      writeJob(job);
      maximumAttemptByFingerprint.set(fingerprint, attempt);
      console.error(
        `[failed ${offset + 1}/${options.attempts}; attempt ${attempt}] ${target.id}: ${job.error}`,
      );
      if (offset + 1 < options.attempts) {
        await waitBeforeRetry(offset + 1, retryDelayMs);
      }
    }
  }
  throw new Error(`${target.id}: all research attempts failed.`);
}

async function mapConcurrent<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
) {
  let nextIndex = 0;
  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex]!;
        nextIndex += 1;
        await worker(item);
      }
    },
  );
  await Promise.all(runners);
}

const options = optionsFromArguments();
const manifest = loadManifest();
const selections = selectTargets(manifest, options);
if (selections.length === 0) {
  console.log("No planned research targets selected.");
  process.exit(0);
}
ensureDirectories();
const {
  successfulFingerprints,
  maximumAttemptByFingerprint,
  latestFailureByFingerprint,
} = loadJobHistory();
const failures: string[] = [];
await mapConcurrent(selections, options.concurrency, async (selection) => {
  try {
    await researchTarget(
      selection,
      options,
      manifest,
      successfulFingerprints,
      maximumAttemptByFingerprint,
      latestFailureByFingerprint,
    );
  } catch (error) {
    failures.push(errorMessage(error));
  }
});
if (failures.length > 0) {
  console.error(`${failures.length} research target(s) exhausted all retries.`);
  failures.forEach((failure) => console.error(`  ${failure}`));
  process.exitCode = 1;
}
