import type { Deps } from "./ai-providers.server";
import { enrichResultWatches } from "./catalogue-result-enrichment.server";
import type { ValidationServices } from "./validate-cached-search.server";
import { validateCachedWatchFromSources } from "./validate-cached-watch.server";
import {
  reserveValidationBudget,
  reportValidationOverrun,
  settleValidationBudget,
} from "./validation-budget.server";
import { validationProviderCalls } from "./validation-provider-calls.server";
import { publishValidatedSnapshot } from "./validated-cache.server";
import type { CatalogueClient } from "./watch-catalogue.server";
import type {
  FilmDiscovery,
  FilmDiscoverySubject,
} from "./validate-new-film-search.server";

/** Shared provider/source/catalogue operations. validateCachedSearch and the
 * discovery coordinator own reservations; the runtime exposes their callbacks. */
export function validationServices(
  client: CatalogueClient,
  deps: Deps,
): ValidationServices {
  const calls = validationProviderCalls(deps);
  return {
    hydrate: (watches) =>
      enrichResultWatches(
        watches.map((watch) => ({
          ...watch,
          imageUrl: null,
          priceNote: null,
          details: {
            person: watch.details.person ?? null,
            work: watch.details.work ?? null,
          },
        })),
        client,
      ),
    hydrateVerified: (watches) =>
      enrichResultWatches(watches, client, { preferCatalogueTitle: true }),
    reserve: (key, count) => {
      deps.report?.({
        text: `Preparing source checks for up to ${count} candidate references…`,
      });
      return reserveValidationBudget(client, key, count);
    },
    primary: (brief) => {
      deps.report?.({
        text: `Looking up sources for ${brief.brand} ${brief.referenceCode ?? brief.model}…`,
      });
      return calls.primary(brief);
    },
    secondary: (brief) => {
      deps.report?.({
        text: `Independently checking ${brief.brand} ${brief.referenceCode ?? brief.model}…`,
      });
      return calls.secondary(brief);
    },
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
      if (result.status !== "verified") {
        console.info(
          JSON.stringify({
            event: "watch_validation_rejected",
            brand: watch.brand,
            reference: watch.referenceCode,
            reason: result.reason,
          }),
        );
        return result;
      }
      const verified = result.watch;
      deps.report?.({
        text: `Sources checked for ${verified.brand} ${verified.referenceCode}; comparing the specifications…`,
      });
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
          imageUrl: verified.details.imageEvidence ? verified.imageUrl : null,
          priceNote: verified.details.priceObservation
            ? verified.priceNote
            : null,
          rationale:
            "Reference and available attribution checked against cited sources.",
          details: {
            person: verified.details.person ?? null,
            work: verified.details.work ?? null,
            validationEvidence: verified.details.validationEvidence,
            ...(verified.details.imageEvidence
              ? { imageEvidence: verified.details.imageEvidence }
              : {}),
            ...(verified.details.priceObservation
              ? {
                  priceObservation: verified.details.priceObservation,
                  price: verified.details.price,
                  priceConfirmed: false,
                }
              : {}),
            ...(verified.details.validationFacts?.length
              ? {
                  validationFacts: verified.details.validationFacts,
                  ...(verified.details.validationFacts.some(
                    (fact) => fact.field === "caseDiameterMm",
                  )
                    ? { caseDiameterMm: verified.details.caseDiameterMm }
                    : {}),
                  ...(verified.details.validationFacts.some(
                    (fact) => fact.field === "waterResistanceM",
                  )
                    ? { waterResistanceM: verified.details.waterResistanceM }
                    : {}),
                  ...(verified.details.validationFacts.some(
                    (fact) => fact.field === "movementType",
                  )
                    ? { movement: verified.details.movement }
                    : {}),
                }
              : {}),
          },
        },
      };
    },
    settle: (attempt, costs) => settleValidationBudget(client, attempt, costs),
    reportOverrun: (attempt, costs) =>
      reportValidationOverrun(client, attempt, costs),
    publish: (attempt, watches, costs) => {
      deps.report?.({
        text: `${watches.length} references checked. Ranking the final ten options and labelled close fits…`,
      });
      return publishValidatedSnapshot(client, attempt, watches, costs);
    },
  };
}

/** Discovery uses the same provider and reservation contracts as cached checks. */
export function validationServicesWithFilmDiscovery(
  client: CatalogueClient,
  deps: Deps,
): ValidationServices & {
  discoverFilm: (subject: FilmDiscoverySubject) => Promise<FilmDiscovery>;
} {
  return {
    ...validationServices(client, deps),
    discoverFilm: validationProviderCalls(deps).discoverFilm,
  };
}
