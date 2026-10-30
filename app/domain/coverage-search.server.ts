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
  SEARCH_RESULT_MINIMUM,
  SEARCH_RESULT_TARGET,
  unverifiedCandidate,
} from "./search-coverage";
import { uniqueWatchResults } from "./watch-result-dedup";
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
  const identity = (watch: FoundWatch) =>
    `${fold(watch.brand)}|${fold(watch.referenceCode ?? watch.model)}`;
  const allowed = deps.localCandidates
    ? new Set(localCandidates.map(identity))
    : null;
  const eligible = (watches: FoundWatch[]) =>
    bind(watches).filter((watch) => !allowed || allowed.has(identity(watch)));
  const screen = (view: AiSearchView): AiSearchView =>
    view.status === "found"
      ? {
          ...view,
          watches: eligible(view.watches),
          alsoWorth: eligible(view.alsoWorth ?? []),
        }
      : view;
  let result = screen(await search(request, options));
  const primaryWasFree = result.status === "found" && result.fromCache;
  const pools = await Promise.all([
    read(input),
    subject ? read({ query: subject.query }) : Promise.resolve([]),
    read(supplementInput),
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
    eligible(watches)
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
  const initial = coverSearchResults(result, candidates);
  // A checked-cache read spent nothing. Only this branch may make one new paid
  // attempt to fill a genuinely short result; never chain two reservations in
  // one issuance. Positive saved coverage is reused even if sources are scarce.
  if (
    result.status === "found" &&
    primaryWasFree &&
    initial.status === "found" &&
    (initial.coverage?.total ?? 0) < SEARCH_RESULT_MINIMUM &&
    !pools[2].length &&
    (subject ? options.validateMissingFilm : options.validateMissing)
  ) {
    const extra = screen(
      await search(
        { kind: request.kind, cacheInput: supplementInput },
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
      ...label(
        await enrich(prepare(await read(supplementInput))).catch(() => []),
      ),
    ];
  }
  if (
    result.status === "found" &&
    uniqueWatchResults([...result.watches, ...(result.alsoWorth ?? [])])
      .length >= SEARCH_RESULT_TARGET
  )
    return coverSearchResults(result);
  return coverSearchResults(result, candidates);
}
