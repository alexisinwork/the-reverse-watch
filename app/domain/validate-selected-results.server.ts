import type { FoundWatch, ProgressEvent } from "./ai-watch-types";
import { searchWithCoverage } from "./coverage-search.server";
import { coverSearchResults, unverifiedCandidate } from "./search-coverage";
import { meteredSearchOptions } from "./validation-runtime.server";
import { normalizeReference } from "./ai-watch-guardrails";
import type { SelectionDiscoveryProfile } from "./validation-provider-request.server";
import { selectionCandidate } from "./selection-candidates";
import { loadFxTable } from "./fx.server";
import { cacheCompleteSearch } from "./complete-search-cache.server";
import { withPageCheckedFacts } from "./page-checked-facts";
import { markPageCheckedFacts } from "./catalogue-result-enrichment.server";
import { withCompleteCatalogueChecks } from "./coverage-catalogue.server";

const identity = (watch: FoundWatch) =>
  `${watch.brand.toLowerCase().replace(/[^a-z0-9]/g, "")}|${normalizeReference(watch.referenceCode) ?? `m:${watch.model.toLowerCase().replace(/[^a-z0-9]/g, "")}`}`;

/**
 * A checked card keeps the reference and sources it was checked with. A
 * check with no catalogue record behind it shows the reference as the title
 * and drops every other fact, so the title and the facts it lacks come back
 * from the local record that selected it (the catalogue or the editorial
 * list), never from an older AI draft; a price taken back this way stays
 * unconfirmed. A card still without a price cannot claim the visitor's
 * budget, so it is labelled.
 */
export function withSelectedFacts(
  checked: FoundWatch,
  selected: FoundWatch,
): FoundWatch {
  const titleIsReference =
    normalizeReference(checked.model) !== null &&
    normalizeReference(checked.model) ===
      normalizeReference(checked.referenceCode);
  const own = checked.details;
  const local = selected.details;
  // The local record selected the card with its current facts; those the
  // catalogue repair read on a page our server opened are shown in place of
  // the saved check's older ones (withPageCheckedFacts).
  const merged: FoundWatch = withPageCheckedFacts(
    {
      ...checked,
      model: titleIsReference ? selected.model : checked.model,
      rationale: selected.rationale,
      details: {
        ...own,
        price: own.price ?? local.price ?? null,
        priceConfirmed: own.price
          ? own.priceConfirmed
          : local.price
            ? (local.priceConfirmed ?? false)
            : own.priceConfirmed,
        caseDiameterMm: own.caseDiameterMm ?? local.caseDiameterMm ?? null,
        movement: own.movement ?? local.movement ?? null,
        waterResistanceM:
          own.waterResistanceM ?? local.waterResistanceM ?? null,
        misses: local.misses,
      },
    },
    {
      model: selected.model,
      caseDiameterMm: local.caseDiameterMm,
      waterResistanceM: local.waterResistanceM,
      movement: local.movement,
      ...(local.materials ? { materials: local.materials } : {}),
    },
    local.pageCheckedFacts ?? [],
  );
  // A card already labelled keeps its own, more specific note.
  return merged.details.price ||
    merged.details.verificationStatus === "unverified"
    ? merged
    : unverifiedCandidate(
        merged,
        "Price unavailable — budget fit not confirmed",
      );
}

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
  // Which of the local records' facts the catalogue repair read on a page:
  // those are shown in place of the saved check's (withSelectedFacts).
  const marked = await markPageCheckedFacts(candidates);
  const allowed = new Map(marked.map((watch) => [identity(watch), watch]));
  const shown = view.watches.flatMap((watch) => {
    const selected = allowed.get(identity(watch));
    // This explanation was computed from the current local ranking, so it can
    // accompany the checked identity without retaining an old AI explanation.
    if (selected) return [withSelectedFacts(watch, selected)];
    const additional = additionalCandidate?.(watch);
    return additional ? [additional] : [];
  });
  // A sourced suggestion carries the search's own facts; the catalogue's
  // page-checked ones take their place, and a rejected watch drops out
  // (2026-11-27: Citizen NB6004-08E still read 41 mm, its page gives 46).
  const watches = await withCompleteCatalogueChecks(shown);
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
