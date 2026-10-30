import { defaultDeps, type Deps } from "./ai-providers.server";
import {
  catalogueClient,
  type CatalogueClient,
} from "./watch-catalogue.server";
import { validationServicesWithFilmDiscovery } from "./validation-services.server";
import { validateCachedSearch } from "./validate-cached-search.server";
import {
  validateNewFilmSearch,
  validateDiscoveredSearch,
} from "./validate-new-film-search.server";
import { validationProviderCalls } from "./validation-provider-calls.server";
import type { ProfileV4 } from "./questionnaire-v4";
import type { searchWithStore } from "./ai-watch-store.server";
import type { FoundWatch, ProgressEvent } from "./ai-watch-types";
import type { FilmDiscoverySubject } from "./validate-new-film-search.server";
import { storeSearch } from "./ai-watch-store.server";
import { quizCacheInput } from "./quiz-live-search.server";
import type {
  SelectionDiscoveryProfile,
  DiscoveryExclusions,
} from "./validation-provider-request.server";

/** The only visitor-facing entry into paid validation. Every callback reaches
 * the durable reservation before a provider; valid snapshots bypass it. */
export function meteredSearchOptions({
  client = catalogueClient(),
  deps = defaultDeps(),
  allowPaid = () => Promise.resolve(true),
  report,
  quizProfile,
  selectionProfile,
}: {
  client?: CatalogueClient | null;
  deps?: Deps;
  allowPaid?: () => Promise<boolean>;
  report?: (event: ProgressEvent) => void;
  quizProfile?: ProfileV4;
  selectionProfile?: SelectionDiscoveryProfile;
} = {}): NonNullable<Parameters<typeof searchWithStore>[1]> {
  if (!client || !deps.config.perplexity || !deps.config.museSpark) return {};
  const services = validationServicesWithFilmDiscovery(client, {
    ...deps,
    report: report ?? deps.report,
  });
  const unavailable = { status: "unavailable" as const, reason: "retry_later" };
  return {
    store: client.config,
    fetchImpl: client.fetchImpl,
    ...(quizProfile || selectionProfile
      ? {
          validateMissing: async (
            key: string,
            exclude: DiscoveryExclusions = [],
          ) => {
            if (!(await allowPaid())) return unavailable;
            report?.({
              text: "Searching the web for additional models to complete ten options, then checking the sources…",
            });
            return validateDiscoveredSearch(key, {
              ...services,
              captureCandidates: (watches) =>
                storeSearch(
                  client.config,
                  {
                    kind: quizProfile ? "quiz" : "find",
                    cacheKey: key,
                    cacheInput: quizProfile
                      ? quizCacheInput(quizProfile)
                      : selectionProfile,
                    summary:
                      "Additional candidates from cited research; not fully verified.",
                    watches,
                  },
                  client.fetchImpl,
                ),
              discover: () =>
                quizProfile
                  ? validationProviderCalls(deps).discoverQuiz(
                      quizProfile,
                      exclude,
                    )
                  : validationProviderCalls(deps).discoverSelection(
                      selectionProfile!,
                      exclude,
                    ),
              accepts: (evidence) => !evidence.person && !evidence.work,
            });
          },
        }
      : {}),
    validateDraft: async (key: string, watches: FoundWatch[]) => {
      if (!(await allowPaid())) return unavailable;
      report?.({
        text: "Checking the saved references against independent sources…",
      });
      return validateCachedSearch(key, watches, services);
    },
    validateMissingFilm: async (
      key: string,
      subject: FilmDiscoverySubject,
      exclude: DiscoveryExclusions = [],
    ) => {
      if (!(await allowPaid())) return unavailable;
      report?.({
        text: "Finding documented references and checking each candidate…",
      });
      return validateNewFilmSearch(key, subject, {
        ...services,
        discoverFilm: (value) =>
          validationProviderCalls(deps).discoverFilm(value, exclude),
        captureCandidates: (watches) =>
          storeSearch(
            client.config,
            {
              kind: "film",
              cacheKey: key,
              cacheInput: subject,
              summary:
                "Additional candidates from cited research; not fully verified.",
              watches,
            },
            client.fetchImpl,
          ),
      });
    },
  };
}
