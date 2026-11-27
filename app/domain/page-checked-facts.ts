import type { FoundWatch, WatchDetails } from "./ai-watch-types";

/** The saved two-source check that covers each card fact. */
const SAVED_CHECK: Record<
  string,
  "caseDiameterMm" | "waterResistanceM" | "movementType"
> = {
  caseDiameterMm: "caseDiameterMm",
  waterResistanceM: "waterResistanceM",
  movement: "movementType",
};

type CurrentFacts = {
  model: string;
  caseDiameterMm?: number | null;
  waterResistanceM?: number | null;
  movement?: string | null;
  materials?: {
    case: string | null;
    caseback: string | null;
    strap: string | null;
  };
};

/**
 * A card with the catalogue's page-checked facts in place of older ones.
 *
 * Saved answers keep the facts they were checked with, so a catalogue
 * correction read on the maker's page (pageCheckedFacts in
 * watch-catalogue.ts) did not reach them: on 2026-11-27, 15 of 279 cards
 * showed values the repair had already corrected. A fact the repair read on
 * a page our server opened wins (owner, 2026-11-27: a fact changes only from
 * such a page); every other fact and source of the card stays, and a saved
 * check of a value the card no longer shows is dropped.
 */
export function withPageCheckedFacts(
  card: FoundWatch,
  current: CurrentFacts,
  checked: readonly string[],
): FoundWatch {
  if (!checked.length) return card;
  const has = (field: string) => checked.includes(field);
  const details: WatchDetails = {
    ...card.details,
    pageCheckedFacts: [...checked],
  };
  const replaced = new Set<string>();
  for (const field of [
    "caseDiameterMm",
    "waterResistanceM",
    "movement",
  ] as const) {
    const value = current[field];
    if (!has(field) || value === null || value === undefined) continue;
    if (details[field] !== value) replaced.add(field);
    details[field] = value as never;
  }
  if (current.materials) {
    const materials = {
      case: details.materials?.case ?? null,
      caseback: details.materials?.caseback ?? null,
      strap: details.materials?.strap ?? null,
    };
    if (has("caseMaterial") && current.materials.case)
      materials.case = current.materials.case;
    if (has("casebackMaterial") && current.materials.caseback)
      materials.caseback = current.materials.caseback;
    if (has("strapMaterial") && current.materials.strap)
      materials.strap = current.materials.strap;
    details.materials = materials;
  }
  if (details.validationFacts && replaced.size) {
    const stale = new Set([...replaced].map((field) => SAVED_CHECK[field]));
    const kept = details.validationFacts.filter(
      (fact) => !stale.has(fact.field),
    );
    if (kept.length) details.validationFacts = kept;
    else delete details.validationFacts;
  }
  const model =
    has("model") && current.model.trim() ? current.model : card.model;
  return { ...card, model, details };
}
