import type { AiSearchView, FoundWatch } from "./ai-watch-types";
import {
  aiSearchCacheKey,
  loadAiWatchStoreConfig,
  loadStoredSearch,
  searchWithStore,
} from "./ai-watch-store.server";
import { hydrateCoverageCandidates } from "./coverage-catalogue.server";
import { safeHttpUrl } from "./source-pages.server";
import {
  coverSearchResults,
  SEARCH_RESULT_TARGET,
  unverifiedCandidate,
} from "./search-coverage";
import { uniqueWatchResults } from "./watch-result-dedup";
import {
  cacheCompleteSearch,
  completeSearchInput,
} from "./complete-search-cache.server";
import { loadValidatedSnapshot } from "./validated-cache.server";

const fold = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
type Request = Parameters<typeof searchWithStore>[0];
type Options = NonNullable<Parameters<typeof searchWithStore>[1]>;

/** Checked snapshots stay untouched. Incomplete saved research is a labelled
 * supplement, not a source-v1 snapshot and never a new trusted master fact. */
export async function searchWithCoverage(
  request: Request,
  options: Options = {},
  deps: {
    search?: typeof searchWithStore;
    enrich?: (watches: FoundWatch[]) => Promise<FoundWatch[]>;
    localCandidates?: FoundWatch[];
    additionalCandidate?: (watch: FoundWatch) => FoundWatch | null;
  } = {},
): Promise<AiSearchView> {
  const search = deps.search ?? searchWithStore;
  const store =
    options.store === undefined ? loadAiWatchStoreConfig() : options.store;
  const fetchImpl = options.fetchImpl ?? fetch;
  const enrich = deps.enrich ?? hydrateCoverageCandidates;
  const input = request.cacheInput;
  const subject =
    request.kind === "film" &&
    input &&
    typeof input === "object" &&
    "query" in input &&
    typeof input.query === "string" &&
    "kind" in input &&
    typeof input.kind === "string"
      ? { query: input.query, kind: input.kind }
      : null;
  const supplementInput = {
    ...(input && typeof input === "object" ? input : {}),
    coveragePolicy: 1,
  };
  const read = async (cacheInput: unknown) => {
    if (!store) return [];
    try {
      const stored = await loadStoredSearch(
        store,
        aiSearchCacheKey(request.kind, cacheInput),
        fetchImpl,
      );
      return stored?.watches ?? [];
    } catch {
      return [];
    }
  };
  const bind = (watches: FoundWatch[]) =>
    watches.filter((watch) => {
      if (!subject) return true;
      const field =
        subject.kind === "movie" || subject.kind === "series"
          ? "work"
          : "person";
      const value = watch.details[field];
      return typeof value === "string" && fold(value) === fold(subject.query);
    });
  const localCandidates = deps.localCandidates ?? request.candidates ?? [];
  const identity = (
    watch: Pick<FoundWatch, "brand" | "model" | "referenceCode">,
  ) => `${fold(watch.brand)}|${fold(watch.referenceCode ?? watch.model)}`;
  const allowed = deps.localCandidates
    ? new Set(localCandidates.map(identity))
    : null;
  const eligible = (watches: FoundWatch[]) =>
    bind(watches).flatMap((watch) => {
      if (!allowed || allowed.has(identity(watch))) return [watch];
      const additional = deps.additionalCandidate?.(watch);
      return additional ? [additional] : [];
    });
  const screen = (view: AiSearchView): AiSearchView =>
    view.status === "found"
      ? {
          ...view,
          watches: eligible(view.watches),
          alsoWorth: eligible(view.alsoWorth ?? []),
        }
      : view;
  const completed = await read(completeSearchInput(input));
  if (
    (request.kind !== "quiz" || deps.localCandidates) &&
    uniqueWatchResults(eligible(completed)).length >= SEARCH_RESULT_TARGET
  ) {
    const current = await enrich(
      eligible(completed).map((watch) => ({
        ...watch,
        imageUrl: null,
        priceNote: null,
        details: { person: watch.details.person, work: watch.details.work },
      })),
    ).catch(() => []);
    const snapshot = store
      ? await loadValidatedSnapshot(
          { config: store, fetchImpl },
          aiSearchCacheKey(request.kind, input),
        ).catch(() => null)
      : null;
    const cached = coverSearchResults(
      snapshot
        ? screen({
            status: "found",
            fromCache: true,
            summary: snapshot.summary,
            watches: snapshot.watches,
          })
        : { status: "unavailable" },
      eligible(current).map((watch) =>
        unverifiedCandidate(
          watch,
          subject
            ? "Association not fully verified"
            : "Additional candidate — not fully verified",
        ),
      ),
    );
    if (
      cached.status === "found" &&
      cached.coverage?.total === SEARCH_RESULT_TARGET
    )
      return { ...cached, fromCache: true };
  }
  const prior = uniqueWatchResults(eligible(await read(input)));
  const primaryRequest =
    !request.candidates?.length &&
    prior.length > 0 &&
    prior.length < SEARCH_RESULT_TARGET
      ? {
          ...request,
          discoveryExclusions: prior.map(({ brand, model, referenceCode }) => ({
            brand,
            model,
            referenceCode,
          })),
        }
      : request;
  let result = screen(await search(primaryRequest, options));
  const primaryWasFree = result.status === "found" && result.fromCache;
  const pools = await Promise.all([
    read(input),
    subject ? read({ query: subject.query }) : Promise.resolve([]),
    read(supplementInput),
    read(completeSearchInput(input)),
  ]);
  // Reuse supplementary certified facts without starting another validation.
  if (store) {
    const saved = await loadValidatedSnapshot(
      { config: store, fetchImpl },
      aiSearchCacheKey(request.kind, supplementInput),
    ).catch(() => null);
    if (saved) {
      const extra = eligible(saved.watches);
      if (extra.length)
        result =
          result.status === "found"
            ? {
                ...result,
                watches: uniqueWatchResults([...result.watches, ...extra]),
              }
            : {
                status: "found",
                watches: extra,
                summary: saved.summary,
                fromCache: true,
              };
    }
  }
  const prepare = (watches: FoundWatch[]) =>
    uniqueWatchResults(eligible(watches))
      .slice(0, 60)
      .flatMap((watch) => {
        const local = localCandidates.includes(watch);
        if (!safeHttpUrl(watch.sourceUrl) && !local) return [];
        return [
          {
            ...watch,
            ...(local
              ? {}
              : {
                  imageUrl: null,
                  priceNote: null,
                  rationale:
                    "Possible match from saved research; the association still needs checking.",
                  details: {
                    person: watch.details.person,
                    work: watch.details.work,
                  },
                }),
          },
        ];
      });
  const label = (watches: FoundWatch[]) =>
    watches.map((watch) =>
      unverifiedCandidate(
        watch,
        subject
          ? "Association not fully verified"
          : (watch.details.verificationNote ??
              "Additional candidate — not fully verified"),
      ),
    );
  let candidates = label(
    await enrich(prepare([...localCandidates, ...pools.flat()])).catch(
      () => [],
    ),
  );
  let initial = coverSearchResults(result, candidates);
  // Walk reusable partial research, but make at most one new paid discovery.
  // Each pass excludes the identities already found so a scarce saved draft
  // cannot become a permanent stopping point below ten distinct options.
  for (let pass = 0; pass < 3; pass++) {
    if (!(
      result.status === "found" &&
      primaryWasFree &&
      initial.status === "found" &&
      (initial.coverage?.total ?? 0) < SEARCH_RESULT_TARGET &&
      (subject ? options.validateMissingFilm : options.validateMissing)
    ))
      break;
    const excluded = [...initial.watches, ...(initial.alsoWorth ?? [])]
      .map(({ brand, model, referenceCode }) => ({
        brand,
        model,
        referenceCode,
      }))
      .sort((a, b) => identity(a).localeCompare(identity(b)));
    const topupInput = {
      ...supplementInput,
      coveragePolicy: 2,
      excluding: excluded,
    };
    const extra = screen(
      await search(
        {
          kind: request.kind,
          cacheInput: topupInput,
          discoveryExclusions: excluded,
        },
        options,
      ),
    );
    if (extra.status === "found") {
      result = {
        ...result,
        watches: uniqueWatchResults([...result.watches, ...extra.watches]),
        fromCache: result.fromCache && extra.fromCache,
      };
    }
    candidates = [
      ...candidates,
      ...label(await enrich(prepare(await read(topupInput))).catch(() => [])),
    ];
    const next = coverSearchResults(result, candidates);
    if (
      extra.status !== "found" ||
      !extra.fromCache ||
      next.status !== "found" ||
      next.coverage?.total === initial.coverage?.total
    ) {
      initial = next;
      break;
    }
    initial = next;
  }
  if (
    result.status === "found" &&
    uniqueWatchResults([...result.watches, ...(result.alsoWorth ?? [])])
      .length >= SEARCH_RESULT_TARGET
  )
    return request.kind === "quiz"
      ? coverSearchResults(result)
      : cacheCompleteSearch(
          request.kind,
          input,
          coverSearchResults(result),
          store ? { config: store, fetchImpl } : null,
        );
  return request.kind === "quiz"
    ? coverSearchResults(result, candidates)
    : cacheCompleteSearch(
        request.kind,
        input,
        coverSearchResults(result, candidates),
        store ? { config: store, fetchImpl } : null,
      );
}
