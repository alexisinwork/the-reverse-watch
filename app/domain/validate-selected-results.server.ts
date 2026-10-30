import type { FoundWatch, ProgressEvent } from "./ai-watch-types";
import { searchWithCoverage } from "./coverage-search.server";
import { coverSearchResults } from "./search-coverage";
import { meteredSearchOptions } from "./validation-runtime.server";
import { normalizeReference } from "./ai-watch-guardrails";

const identity = (watch: FoundWatch) =>
  `${watch.brand.toLowerCase().replace(/[^a-z0-9]/g, "")}|${normalizeReference(watch.referenceCode) ?? `m:${watch.model.toLowerCase().replace(/[^a-z0-9]/g, "")}`}`;

/** Validate an editorial/deterministic selection once. Current local selection
 * still controls eligibility when an older valid snapshot is reused. */
export async function validateSelectedResults(
  feature: "archetype" | "alternatives",
  constraints: unknown,
  candidates: FoundWatch[],
  report?: (event: ProgressEvent) => void,
) {
  // Imported catalogues sometimes put a model name in the reference field.
  // Keep such records in the archive, but do not spend a card's validation
  // allowance treating that name as a documented manufacturer reference.
  const referenced = candidates.filter(
    (watch) => watch.referenceCode && /\d/.test(watch.referenceCode),
  );
  if (!candidates.length)
    return {
      status: "no_match" as const,
      summary: "No matching catalogue watches.",
    };
  const view = await searchWithCoverage(
    {
      kind: "find",
      cacheInput: { feature, constraints, selectionPolicy: 1 },
      candidates: referenced.slice(0, 8),
    },
    meteredSearchOptions({ report }),
    { localCandidates: candidates },
  );
  if (view.status !== "found") return view;
  const allowed = new Map(candidates.map((watch) => [identity(watch), watch]));
  const watches = view.watches.flatMap((watch) => {
    const selected = allowed.get(identity(watch));
    // This explanation was computed from the current local ranking, so it can
    // accompany the checked identity without retaining an old AI explanation.
    return selected ? [{ ...watch, rationale: selected.rationale }] : [];
  });
  return watches.length
    ? coverSearchResults({ ...view, watches })
    : {
        status: "unavailable" as const,
        reason: "verification_failed" as const,
      };
}
