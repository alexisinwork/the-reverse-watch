import type { FoundWatch, ProgressEvent } from "./ai-watch-types";
import { searchWithStore } from "./ai-watch-store.server";
import { meteredSearchOptions } from "./validation-runtime.server";
import { normalizeReference } from "./ai-watch-guardrails";

const identity = (watch: FoundWatch) =>
  `${watch.brand.toLowerCase().replace(/[^a-z0-9]/g, "")}|${normalizeReference(watch.referenceCode)}`;

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
  const view = await searchWithStore(
    {
      kind: "find",
      cacheInput: { feature, constraints, selectionPolicy: 1 },
      candidates: referenced.slice(0, 8),
    },
    meteredSearchOptions({ report }),
  );
  if (view.status !== "found") return view;
  const allowed = new Set(candidates.map(identity));
  const watches = view.watches.filter((watch) => allowed.has(identity(watch)));
  return watches.length
    ? { ...view, watches }
    : {
        status: "unavailable" as const,
        reason: "verification_failed" as const,
      };
}
