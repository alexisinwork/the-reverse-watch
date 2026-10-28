import type { FoundWatch } from "./ai-watch-types";
import type { ValidationDecision } from "./cached-result-validation";
import type { ProviderAssertion } from "./validation-provider-response.server";
import { uniqueWatchResults } from "./watch-result-dedup";
import { normalizeReference } from "./ai-watch-guardrails";

/** Only watch and publicly named subject constraints cross the provider boundary. */
export type ValidationBrief = {
  brand: string;
  model: string;
  referenceCode: string | null;
  person: string | null;
  work: string | null;
  missingFields?: ("caseDiameterMm" | "waterResistanceM" | "movementType")[];
};

type Reserve =
  | { state: "reserved"; attemptId: string }
  | {
      state:
        | "in_progress"
        | "monthly_limit"
        | "budget_halted"
        | "retry_later"
        | "valid";
    };

export type ValidationServices = {
  hydrate: (watches: FoundWatch[]) => Promise<FoundWatch[]>;
  hydrateVerified?: (watches: FoundWatch[]) => Promise<FoundWatch[]>;
  reserve: (key: string, count: number) => Promise<Reserve>;
  primary: (brief: ValidationBrief) => Promise<ProviderAssertion>;
  secondary: (brief: ValidationBrief) => Promise<ProviderAssertion>;
  inspect: (
    watch: FoundWatch,
    primary: ProviderAssertion,
    secondary: ProviderAssertion,
  ) => Promise<ValidationDecision>;
  settle: (attemptId: string, costs: (number | null)[]) => Promise<boolean>;
  reportOverrun: (
    attemptId: string,
    costs: (number | null)[],
  ) => Promise<boolean>;
  publish: (
    attemptId: string,
    watches: FoundWatch[],
    costs: (number | null)[],
  ) => Promise<boolean>;
};

export type ValidationRun =
  | { status: "verified"; watches: FoundWatch[]; rejected: number }
  | { status: "unavailable"; reason: string };

/** Validation is fail-closed: a result is never certified until every included
 * card passes both providers and the whole reservation has been settled. */
export async function validateCachedSearch(
  cacheKey: string,
  watches: FoundWatch[],
  services: ValidationServices,
): Promise<ValidationRun> {
  const unique = uniqueWatchResults(await services.hydrate(watches)).slice(
    0,
    8,
  );
  if (!unique.length) return { status: "unavailable", reason: "no candidates" };
  const reservation = await services.reserve(cacheKey, unique.length);
  if (reservation.state !== "reserved")
    return { status: "unavailable", reason: reservation.state };

  const results = await Promise.all(
    unique.map(async (watch) => {
      const brief: ValidationBrief = {
        brand: watch.brand.slice(0, 160),
        model: watch.model.slice(0, 200),
        referenceCode: watch.referenceCode?.slice(0, 120) ?? null,
        person: watch.details.person?.slice(0, 160) ?? null,
        work: watch.details.work?.slice(0, 200) ?? null,
        missingFields: [
          ...(watch.details.caseDiameterMm == null
            ? ["caseDiameterMm" as const]
            : []),
          ...(watch.details.waterResistanceM == null
            ? ["waterResistanceM" as const]
            : []),
          ...(watch.details.movement == null ? ["movementType" as const] : []),
        ],
      };
      const [primary, secondary] = await Promise.allSettled([
        services.primary(brief),
        services.secondary(brief),
      ]);
      const known = [primary, secondary].flatMap((response) =>
        response.status === "fulfilled" &&
        Number.isFinite(response.value.costUsd) &&
        response.value.costUsd >= 0
          ? [response.value.costUsd]
          : [],
      );
      const knownCost = known.reduce((total, value) => total + value, 0);
      if (knownCost > 0.025)
        return { decision: null, cost: knownCost, overrun: true };
      if (primary.status !== "fulfilled" || secondary.status !== "fulfilled")
        return { decision: null, cost: null };
      const cost = primary.value.costUsd + secondary.value.costUsd;
      if (!Number.isFinite(cost) || cost < 0)
        return { decision: null, cost: null };
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
    }),
  );
  if (results.some((result) => result.overrun)) {
    await services
      .reportOverrun(
        reservation.attemptId,
        results.map((result) => result.cost),
      )
      .catch(() => false);
    return {
      status: "unavailable",
      reason: "provider cost exceeded reservation",
    };
  }
  const checked = results.flatMap((result) =>
    result.decision?.status === "verified" ? [result.decision.watch] : [],
  );
  // Discovery may have supplied a reference absent during the first lookup.
  // Hydrate again using that exact identity, then remove newly visible duplicates.
  const accepted = uniqueWatchResults(
    checked.length
      ? await (services.hydrateVerified ?? services.hydrate)(checked).catch(
          () => checked,
        )
      : [],
  );
  const costs = results.map((result) => result.cost);
  if (!accepted.length) {
    const settled = await services.settle(reservation.attemptId, costs);
    return settled
      ? { status: "unavailable", reason: "no confirmed candidates" }
      : { status: "unavailable", reason: "settlement failed" };
  }
  const published = await services.publish(
    reservation.attemptId,
    accepted,
    costs,
  );
  if (!published)
    return { status: "unavailable", reason: "publication failed" };
  return {
    status: "verified",
    watches: accepted,
    rejected: unique.length - accepted.length,
  };
}
