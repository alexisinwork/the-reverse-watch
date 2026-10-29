import type { FoundWatch } from "./ai-watch-types";
import type { ValidationDecision } from "./cached-result-validation";
import { type ProviderAssertion } from "./validation-provider-response.server";
import { uniqueWatchResults } from "./watch-result-dedup";
import { checkWatchWithProviders } from "./validate-one-watch.server";

/** Only watch and publicly named subject constraints cross the provider boundary. */
export type ValidationBrief = {
  brand: string;
  model: string;
  referenceCode: string | null;
  person: string | null;
  work: string | null;
  missingFields?: (
    "caseDiameterMm" | "waterResistanceM" | "movementType" | "price"
  )[];
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
    unique.map((watch) => checkWatchWithProviders(watch, services)),
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
