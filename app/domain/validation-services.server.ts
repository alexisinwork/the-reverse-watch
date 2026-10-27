import type { Deps } from "./ai-providers.server";
import { enrichResultWatches } from "./catalogue-result-enrichment.server";
import type { ValidationServices } from "./validate-cached-search.server";
import { validateCachedWatchFromSources } from "./validate-cached-watch.server";
import {
  reserveValidationBudget,
  settleValidationBudget,
} from "./validation-budget.server";
import { validationProviderCalls } from "./validation-provider-calls.server";
import { publishValidatedSnapshot } from "./validated-cache.server";
import type { CatalogueClient } from "./watch-catalogue.server";

/** This factory is not exposed to visitors until cost bounds and atomic cache
 * promotion are verified. validateCachedSearch owns the reservation lifecycle. */
export function validationServices(
  client: CatalogueClient,
  deps: Deps,
): ValidationServices {
  const calls = validationProviderCalls(deps);
  return {
    hydrate: (watches) => enrichResultWatches(watches, client),
    hydrateVerified: (watches) =>
      enrichResultWatches(watches, client, { preferCatalogueTitle: true }),
    reserve: (key, count) => reserveValidationBudget(client, key, count),
    primary: calls.primary,
    secondary: calls.secondary,
    inspect: async (watch, primary, secondary) => {
      const result = await validateCachedWatchFromSources(
        watch,
        primary.evidence,
        secondary.evidence,
        {
          fetchImpl: deps.fetchImpl,
          checkedAt: new Date(deps.now()).toISOString(),
        },
      );
      if (result.status !== "verified") return result;
      const verified = result.watch;
      // The two source checks establish only identity and, where supplied,
      // attribution. Old prices, specifications, photos and explanations
      // were not verified by those checks: hydrate them afresh from the
      // exact-reference catalogue rather than certifying stale cache fields.
      return {
        ...result,
        watch: {
          brand: verified.brand,
          model: verified.referenceCode!,
          referenceCode: verified.referenceCode,
          sourceUrl: result.evidence[0]!.sourceUrl,
          imageUrl: null,
          priceNote: null,
          rationale:
            "Reference and available attribution checked against cited sources.",
          details: {
            person: verified.details.person ?? null,
            work: verified.details.work ?? null,
            validationEvidence: verified.details.validationEvidence,
          },
        },
      };
    },
    settle: (attempt, costs) => settleValidationBudget(client, attempt, costs),
    publish: (attempt, watches, costs) =>
      publishValidatedSnapshot(client, attempt, watches, costs),
  };
}
