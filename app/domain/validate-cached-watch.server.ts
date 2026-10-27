import type { FoundWatch } from "./ai-watch-types";
import {
  validateCachedWatch,
  type ValidationDecision,
  type ValidationEvidence,
} from "./cached-result-validation";
import { inspectCachedResultSource } from "./cached-result-source-check.server";

/** Check both cited pages ourselves before reconciling the two assertions.
 * Matching text is necessary evidence, not proof that the page associates the
 * person with that watch; the provider must explicitly assert that relation. */
export async function validateCachedWatchFromSources(
  watch: FoundWatch,
  primary: ValidationEvidence,
  secondary: ValidationEvidence,
  options: { fetchImpl?: typeof fetch; checkedAt?: string } = {},
): Promise<ValidationDecision> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const [first, second] = await Promise.all([
    inspectCachedResultSource(
      watch,
      primary.sourceUrl,
      fetchImpl,
      primary.sourceQuote,
    ),
    inspectCachedResultSource(
      watch,
      secondary.sourceUrl,
      fetchImpl,
      secondary.sourceQuote,
    ),
  ]);
  return validateCachedWatch(
    watch,
    {
      ...primary,
      sourceVerified: first.status === "matched",
      sourceUrl: first.finalUrl ?? primary.sourceUrl,
    },
    {
      ...secondary,
      sourceVerified: second.status === "matched",
      sourceUrl: second.finalUrl ?? secondary.sourceUrl,
    },
    options.checkedAt ?? new Date().toISOString(),
  );
}
