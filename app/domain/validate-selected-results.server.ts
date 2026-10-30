import type { FoundWatch, ProgressEvent } from "./ai-watch-types";
import { searchWithCoverage } from "./coverage-search.server";
import { coverSearchResults } from "./search-coverage";
import { meteredSearchOptions } from "./validation-runtime.server";
import { normalizeReference } from "./ai-watch-guardrails";
import type { SelectionDiscoveryProfile } from "./validation-provider-request.server";
import { selectionCandidate } from "./selection-candidates";
import { loadFxTable } from "./fx.server";
import { cacheCompleteSearch } from "./complete-search-cache.server";

const identity = (watch: FoundWatch) =>
  `${watch.brand.toLowerCase().replace(/[^a-z0-9]/g, "")}|${normalizeReference(watch.referenceCode) ?? `m:${watch.model.toLowerCase().replace(/[^a-z0-9]/g, "")}`}`;

/** Validate an editorial/deterministic selection once. Current local selection
 * still controls eligibility when an older valid snapshot is reused. */
export async function validateSelectedResults(
  feature: "archetype" | "alternatives",
  constraints: unknown,
  candidates: FoundWatch[],
  report?: (event: ProgressEvent) => void,
  discovery?: SelectionDiscoveryProfile,
) {
  const fx = discovery ? await loadFxTable() : null;
  const additionalCandidate = discovery
    ? (watch: FoundWatch) => selectionCandidate(watch, discovery, fx)
    : undefined;
  // Imported catalogues sometimes put a model name in the reference field.
  // Keep such records in the archive, but do not spend a card's validation
  // allowance treating that name as a documented manufacturer reference.
  const referenced = candidates.filter(
    (watch) => watch.referenceCode && /\d/.test(watch.referenceCode),
  );
  if (!candidates.length && !discovery)
    return {
      status: "no_match" as const,
      summary: "No matching catalogue watches.",
    };
  const view = await searchWithCoverage(
    {
      kind: "find",
      cacheInput: { feature, constraints, selectionPolicy: 1 },
      candidates: referenced.slice(0, 8),
      ...(discovery && candidates.length < 10
        ? {
            discoveryExclusions: candidates.map(
              ({ brand, model, referenceCode }) => ({
                brand,
                model,
                referenceCode,
              }),
            ),
          }
        : {}),
    },
    meteredSearchOptions({ report, selectionProfile: discovery }),
    { localCandidates: candidates, additionalCandidate },
  );
  if (view.status !== "found") return view;
  const allowed = new Map(candidates.map((watch) => [identity(watch), watch]));
  const watches = view.watches.flatMap((watch) => {
    const selected = allowed.get(identity(watch));
    // This explanation was computed from the current local ranking, so it can
    // accompany the checked identity without retaining an old AI explanation.
    if (selected)
      return [
        {
          ...watch,
          rationale: selected.rationale,
          details: { ...watch.details, misses: selected.details.misses },
        },
      ];
    const additional = additionalCandidate?.(watch);
    return additional ? [additional] : [];
  });
  return watches.length
    ? cacheCompleteSearch(
        "find",
        { feature, constraints, selectionPolicy: 1 },
        coverSearchResults({ ...view, watches }),
      )
    : {
        status: "unavailable" as const,
        reason: "verification_failed" as const,
      };
}
