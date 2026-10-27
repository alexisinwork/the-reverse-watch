import type { FoundWatch } from "./ai-watch-types";
import type { ValidationDecision } from "./cached-result-validation";
import type { ProviderAssertion } from "./validation-provider-response.server";
import { uniqueWatchResults } from "./watch-result-dedup";

/** Only watch and publicly named subject constraints cross the provider boundary. */
export type ValidationBrief = {
  brand: string;
  model: string;
  referenceCode: string | null;
  person: string | null;
  work: string | null;
};

type Reserve =
  | { state: "reserved"; attemptId: string }
  | { state: "in_progress" | "monthly_limit" };

export type ValidationServices = {
  hydrate: (watches: FoundWatch[]) => Promise<FoundWatch[]>;
  reserve: (key: string, count: number) => Promise<Reserve>;
  primary: (brief: ValidationBrief) => Promise<ProviderAssertion>;
  secondary: (brief: ValidationBrief) => Promise<ProviderAssertion>;
  inspect: (
    watch: FoundWatch,
    primary: ProviderAssertion,
    secondary: ProviderAssertion,
  ) => Promise<ValidationDecision>;
  settle: (attemptId: string, costs: (number | null)[]) => Promise<boolean>;
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
      if (!watch.referenceCode) return { decision: null, cost: 0 };
      const brief: ValidationBrief = {
        brand: watch.brand.slice(0, 160),
        model: watch.model.slice(0, 200),
        referenceCode: watch.referenceCode.slice(0, 120),
        person: watch.details.person?.slice(0, 160) ?? null,
        work: watch.details.work?.slice(0, 200) ?? null,
      };
      const [primary, secondary] = await Promise.allSettled([
        services.primary(brief),
        services.secondary(brief),
      ]);
      if (primary.status !== "fulfilled" || secondary.status !== "fulfilled")
        return { decision: null, cost: null };
      const cost = primary.value.costUsd + secondary.value.costUsd;
      if (!Number.isFinite(cost) || cost < 0)
        return { decision: null, cost: null };
      // Never silently settle a known overrun as the smaller reserved amount.
      // Retain the entire reservation for operator reconciliation.
      if (cost > 0.025) return { decision: null, cost, overrun: true };
      const decision = await services
        .inspect(watch, primary.value, secondary.value)
        .catch(() => null);
      return { decision, cost };
    }),
  );
  if (results.some((result) => result.overrun))
    return {
      status: "unavailable",
      reason: "provider cost exceeded reservation",
    };
  const settled = await services.settle(
    reservation.attemptId,
    results.map((result) => result.cost),
  );
  if (!settled) return { status: "unavailable", reason: "settlement failed" };
  const accepted = results.flatMap((result) =>
    result.decision?.status === "verified" ? [result.decision.watch] : [],
  );
  return accepted.length
    ? {
        status: "verified",
        watches: accepted,
        rejected: unique.length - accepted.length,
      }
    : { status: "unavailable", reason: "no confirmed candidates" };
}
