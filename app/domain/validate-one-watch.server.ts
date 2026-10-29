import type { FoundWatch } from "./ai-watch-types";
import type {
  ValidationBrief,
  ValidationServices,
} from "./validate-cached-search.server";
import { normalizeReference } from "./ai-watch-guardrails";
import { ProviderCostError } from "./validation-provider-response.server";

/** One call to each provider, retaining charges even for rejected assertions.
 * The caller must already own a durable reservation for this card. */
export async function checkWatchWithProviders(
  watch: FoundWatch,
  services: Pick<ValidationServices, "primary" | "secondary" | "inspect">,
  requestedFields?: ValidationBrief["missingFields"],
) {
  const brief: ValidationBrief = {
    brand: watch.brand.slice(0, 160),
    model: watch.model.slice(0, 200),
    referenceCode: watch.referenceCode?.slice(0, 120) ?? null,
    person: watch.details.person?.slice(0, 160) ?? null,
    work: watch.details.work?.slice(0, 200) ?? null,
    missingFields: requestedFields ?? [
      ...(watch.details.caseDiameterMm == null
        ? ["caseDiameterMm" as const]
        : []),
      ...(watch.details.waterResistanceM == null
        ? ["waterResistanceM" as const]
        : []),
      ...(watch.details.movement == null ? ["movementType" as const] : []),
      ...(watch.details.price == null ? ["price" as const] : []),
    ],
  };
  const [primary, secondary] = await Promise.allSettled([
    services.primary(brief),
    services.secondary(brief),
  ]);
  const known = [primary, secondary].flatMap((response) => {
    const amount =
      response.status === "fulfilled"
        ? response.value.costUsd
        : response.reason instanceof ProviderCostError
          ? response.reason.costUsd
          : null;
    return amount !== null && Number.isFinite(amount) && amount >= 0
      ? [amount]
      : [];
  });
  const knownCost = known.reduce((total, value) => total + value, 0);
  if (knownCost > 0.025)
    return { decision: null, cost: knownCost, overrun: true };
  if (primary.status !== "fulfilled" || secondary.status !== "fulfilled")
    return { decision: null, cost: known.length === 2 ? knownCost : null };
  const cost = primary.value.costUsd + secondary.value.costUsd;
  if (!Number.isFinite(cost) || cost < 0) return { decision: null, cost: null };
  // Never silently settle a known overrun as the smaller reserved amount.
  // Retain the entire reservation for operator reconciliation.
  if (cost > 0.025) return { decision: null, cost, overrun: true };
  // A previously unreferenced sighting is eligible only when both
  // independently report the same exact reference. Perplexity supplies
  // the candidate; Muse cannot introduce a different one.
  const primaryReference = normalizeReference(
    primary.value.evidence.referenceCode,
  );
  const secondaryReference = normalizeReference(
    secondary.value.evidence.referenceCode,
  );
  if (
    !primaryReference ||
    ["unknown", "none", "null", "unavailable", "notavailable"].includes(
      primaryReference,
    ) ||
    primaryReference !== secondaryReference
  )
    return { decision: null, cost };
  const candidate = watch.referenceCode
    ? watch
    : { ...watch, referenceCode: primary.value.evidence.referenceCode };
  const decision = await services
    .inspect(candidate, primary.value, secondary.value)
    .catch(() => null);
  return { decision, cost };
}
