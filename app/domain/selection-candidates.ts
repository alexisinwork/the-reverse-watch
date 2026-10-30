import type { FoundWatch } from "./ai-watch-types";
import type { SelectionDiscoveryProfile } from "./validation-provider-request.server";
import { convert, type FxTable } from "./fx";
import { isHomageBrand } from "./alternatives";
import { unverifiedCandidate } from "./search-coverage";

/** New discovered identities are suggestions, never certified technical fits. */
export function selectionCandidate(
  watch: FoundWatch,
  profile: SelectionDiscoveryProfile,
  fx: FxTable | null,
) {
  if (watch.details.reviewStatus === "rejected" || isHomageBrand(watch.brand))
    return null;
  if (
    profile.target &&
    watch.brand.toLowerCase() === profile.target.brand.toLowerCase() &&
    watch.referenceCode === profile.target.referenceCode
  )
    return null;
  const misses: string[] = [];
  const price = watch.details.price;
  const amount =
    price?.currency === profile.price.currency
      ? price.amount
      : price && fx
        ? convert(price.amount, price.currency, profile.price.currency, fx)
        : null;
  if (
    amount !== null &&
    (amount < profile.price.minimum ||
      (profile.price.maximum !== null && amount > profile.price.maximum))
  )
    return null;
  if (amount === null) misses.push("Price or budget fit not confirmed");
  const movement = watch.details.movement;
  if (
    movement &&
    profile.movements.length &&
    !profile.movements.includes(
      movement as SelectionDiscoveryProfile["movements"][number],
    )
  )
    return null;
  if (!movement) misses.push("Movement not confirmed");
  const size = watch.details.caseDiameterMm;
  if (profile.diameter) {
    if (size == null) misses.push("Case size not confirmed");
    else if (
      size < profile.diameter.minimumMm - 3 ||
      size > profile.diameter.maximumMm + 3
    )
      return null;
    else if (
      size < profile.diameter.minimumMm ||
      size > profile.diameter.maximumMm
    )
      misses.push("Case size outside your range");
  }
  misses.push("Technical and visual fit needs checking");
  return unverifiedCandidate(
    { ...watch, details: { ...watch.details, misses } },
    "Sourced suggestion — similarity and specifications not fully verified",
  );
}
