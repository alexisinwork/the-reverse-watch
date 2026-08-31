import type { ResearchJob } from "./research";

export type ResearchJobHistory = {
  successfulFingerprints: Map<string, ResearchJob>;
  maximumAttemptByFingerprint: Map<string, number>;
  latestFailureByFingerprint: Map<string, ResearchJob>;
};

export function indexResearchJobHistory(
  jobs: readonly ResearchJob[],
): ResearchJobHistory {
  const successfulFingerprints = new Map<string, ResearchJob>();
  const maximumAttemptByFingerprint = new Map<string, number>();
  const latestFailureByFingerprint = new Map<string, ResearchJob>();

  for (const job of jobs) {
    const maximumAttempt = maximumAttemptByFingerprint.get(
      job.requestFingerprint,
    );
    if (maximumAttempt === undefined || job.attempt > maximumAttempt) {
      maximumAttemptByFingerprint.set(job.requestFingerprint, job.attempt);
    }

    if (job.status !== "succeeded") continue;
    const reusable = successfulFingerprints.get(job.requestFingerprint);
    if (reusable === undefined || job.attempt > reusable.attempt) {
      successfulFingerprints.set(job.requestFingerprint, job);
    }
  }

  for (const job of jobs) {
    if (job.status !== "failed") continue;
    const latest = latestFailureByFingerprint.get(job.requestFingerprint);
    if (latest === undefined || job.attempt > latest.attempt) {
      latestFailureByFingerprint.set(job.requestFingerprint, job);
    }
  }

  return {
    successfulFingerprints,
    maximumAttemptByFingerprint,
    latestFailureByFingerprint,
  };
}

export function nextResearchAttempt(
  maximumAttemptByFingerprint: ReadonlyMap<string, number>,
  fingerprint: string,
) {
  return (maximumAttemptByFingerprint.get(fingerprint) ?? 0) + 1;
}

export function retryAfterMilliseconds(value: string | null, now = Date.now()) {
  if (value === null) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - now);
}

export function researchRetryDelayMilliseconds(
  attempt: number,
  requestedDelayMs: number | null,
) {
  const exponentialDelay = Math.min(8_000, 500 * 2 ** (attempt - 1));
  return Math.min(60_000, Math.max(exponentialDelay, requestedDelayMs ?? 0));
}
