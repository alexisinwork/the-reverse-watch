import { defaultDeps, type Deps } from "./ai-providers.server";
import {
  catalogueClient,
  type CatalogueClient,
} from "./watch-catalogue.server";
import { validationServicesWithFilmDiscovery } from "./validation-services.server";
import { validateCachedSearch } from "./validate-cached-search.server";
import { validateNewFilmSearch } from "./validate-new-film-search.server";
import type { FoundWatch, ProgressEvent } from "./ai-watch-types";
import type { FilmDiscoverySubject } from "./validate-new-film-search.server";

/** The only visitor-facing entry into paid validation. Every callback reaches
 * the durable reservation before a provider; valid snapshots bypass it. */
export function meteredSearchOptions({
  client = catalogueClient(),
  deps = defaultDeps(),
  allowPaid = () => Promise.resolve(true),
  report,
}: {
  client?: CatalogueClient | null;
  deps?: Deps;
  allowPaid?: () => Promise<boolean>;
  report?: (event: ProgressEvent) => void;
} = {}) {
  if (!client || !deps.config.perplexity || !deps.config.museSpark) return {};
  const services = validationServicesWithFilmDiscovery(client, deps);
  const unavailable = { status: "unavailable" as const, reason: "retry_later" };
  return {
    store: client.config,
    fetchImpl: client.fetchImpl,
    validateDraft: async (key: string, watches: FoundWatch[]) => {
      if (!(await allowPaid())) return unavailable;
      report?.({
        text: "Checking the saved references against independent sources…",
      });
      return validateCachedSearch(key, watches, services);
    },
    validateMissingFilm: async (key: string, subject: FilmDiscoverySubject) => {
      if (!(await allowPaid())) return unavailable;
      report?.({
        text: "Finding documented references and checking each candidate…",
      });
      return validateNewFilmSearch(key, subject, services);
    },
  };
}
