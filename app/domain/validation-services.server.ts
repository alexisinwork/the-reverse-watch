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
    reserve: (key, count) => reserveValidationBudget(client, key, count),
    primary: calls.primary,
    secondary: calls.secondary,
    inspect: (watch, primary, secondary) =>
      validateCachedWatchFromSources(
        watch,
        primary.evidence,
        secondary.evidence,
        {
          fetchImpl: deps.fetchImpl,
          checkedAt: new Date(deps.now()).toISOString(),
        },
      ),
    settle: (attempt, costs) => settleValidationBudget(client, attempt, costs),
    publish: (attempt, watches, costs) =>
      publishValidatedSnapshot(client, attempt, watches, costs),
  };
}
