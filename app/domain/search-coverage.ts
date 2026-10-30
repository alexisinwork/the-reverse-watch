import type { AiSearchView, FoundWatch } from "./ai-watch-types";
import { uniqueSearchView, uniqueWatchResults } from "./watch-result-dedup";

export const SEARCH_RESULT_MINIMUM = 10;
export const SEARCH_RESULT_TARGET = 10;

export function unverifiedCandidate(
  watch: FoundWatch,
  note: string,
): FoundWatch {
  const details = { ...watch.details };
  delete details.validationEvidence;
  delete details.validationFacts;
  delete details.priceObservation;
  const reference = watch.referenceCode?.trim();
  return {
    ...watch,
    referenceCode:
      reference && !/^(null|none|unknown|unavailable)$/i.test(reference)
        ? reference
        : null,
    details: {
      ...details,
      verificationStatus: "unverified",
      verificationNote: note,
    },
  };
}

/** A display/result envelope, separate from immutable two-source snapshots.
 * Never pad with invented watches or describe additional candidates as verified. */
export function coverSearchResults(
  base: AiSearchView,
  candidates: readonly FoundWatch[] = [],
): AiSearchView {
  const checked = uniqueSearchView(base);
  const main = checked.status === "found" ? checked.watches : [];
  const other = checked.status === "found" ? (checked.alsoWorth ?? []) : [];
  const existing = [...main, ...other].sort(
    (a, b) =>
      Number(Boolean(a.details.misses?.length)) -
      Number(Boolean(b.details.misses?.length)),
  );
  const selected = uniqueWatchResults([
    ...existing,
    ...candidates.filter((watch) => watch.details.reviewStatus !== "rejected"),
  ]).slice(0, SEARCH_RESULT_TARGET);
  if (!selected.length)
    return base.status === "found"
      ? {
          ...base,
          fromCache: false,
          coverage: {
            minimum: SEARCH_RESULT_MINIMUM,
            target: SEARCH_RESULT_TARGET,
            total: 0,
            additionalCandidates: 0,
            status: "partial",
          },
        }
      : base;
  const alsoWorth = selected.filter((watch) => other.includes(watch));
  const watches = selected.filter((watch) => !other.includes(watch));
  const added = selected.filter((watch) => !existing.includes(watch));
  const total = selected.length;
  const status =
    total >= SEARCH_RESULT_TARGET
      ? "target_met"
      : total >= SEARCH_RESULT_MINIMUM
        ? "minimum_met"
        : "partial";
  const note = added.length
    ? ` ${added.length} additional ${added.length === 1 ? "candidate needs" : "candidates need"} further checking; see the labels on each card.`
    : "";
  return {
    ...(checked.status === "found"
      ? checked
      : { status: "found" as const, fromCache: true }),
    status: "found",
    // Reusable evidence is not a completed answer. Shortlists remain open.
    fromCache:
      total >= SEARCH_RESULT_TARGET &&
      checked.status === "found" &&
      checked.fromCache,
    watches,
    ...(checked.status === "found" && checked.alsoWorth ? { alsoWorth } : {}),
    summary:
      (checked.status === "found"
        ? checked.summary
        : "Watch options from available research.") + note,
    coverage: {
      minimum: SEARCH_RESULT_MINIMUM,
      target: SEARCH_RESULT_TARGET,
      total,
      additionalCandidates: selected.filter(
        (watch) => watch.details.verificationStatus === "unverified",
      ).length,
      status,
    },
  };
}
