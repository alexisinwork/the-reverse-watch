import { Form, Link, useLoaderData, useNavigation } from "react-router";

import type { Route } from "./+types/watch-find";
import { WatchResults } from "../components/watch-results";
import { visitorKey } from "../domain/visitor-key.server";
import {
  normalizeFilmQuery,
  searchFilmWatches,
} from "../domain/film-search.server";
import { searchWithStore } from "../domain/ai-watch-store.server";
import {
  FILM_SUBJECT_KINDS,
  FILM_SUBJECT_LABELS,
  parseFilmSubjectKind,
  type FilmSubjectKind,
} from "../domain/film-subject";
import { createProgressFeed } from "../domain/progress-feed";
import { fillPhotosFromCatalogue } from "../domain/watch-catalogue.server";
import { parseDiscoveryHandoff } from "../domain/discovery-selection";
import type { RateLimitPolicy } from "../domain/rate-limit.server";
import { consumeSharedRateLimit } from "../domain/rate-limit-upstash.server";
import "../styles/discovery.css";

const QUERY_MAX = 120;

// Stored answers are free; only fresh searches spend provider credit.
const NEW_SEARCH_POLICY: RateLimitPolicy = {
  configured: true,
  maxRequests: 12,
  windowMs: 10 * 60 * 1_000,
};

const EXAMPLES: { query: string; kind: FilmSubjectKind }[] = [
  { query: "Daniel Craig", kind: "actor" },
  { query: "James Bond", kind: "character" },
  { query: "Succession", kind: "series" },
  { query: "Heat", kind: "movie" },
  { query: "Roger Federer", kind: "celebrity" },
  { query: "The Bear", kind: "series" },
];

export function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, QUERY_MAX);
  const kind = parseFilmSubjectKind(url.searchParams.get("type"));
  const handoff = parseDiscoveryHandoff(url.searchParams);
  // Both the text and the type are required before anything is searched.
  if (query.length < 2 || !kind) {
    return {
      query,
      kind,
      handoff,
      result: null,
      progress: null,
      needsType: query.length >= 2 && !kind,
    };
  }

  const key = visitorKey("film-search", request);
  // Streamed: the page renders immediately and the watches arrive after.
  const progress = createProgressFeed();
  const search = searchWithStore({
    kind: "film",
    cacheInput: { query: normalizeFilmQuery(query), kind },
    run: async () => {
      if (!(await consumeSharedRateLimit(key, NEW_SEARCH_POLICY)).allowed) {
        return {
          status: "no_match",
          summary:
            "You have run a lot of new searches in a short time. Please try again in a few minutes; searches others already made still load instantly.",
        };
      }
      return searchFilmWatches(query, { report: progress.report }, kind);
    },
  });
  // Sightings without a photo borrow the catalogue's photo of that watch.
  const result = search.then(async (view) =>
    view.status === "found"
      ? { ...view, watches: await fillPhotosFromCatalogue(view.watches) }
      : view,
  );
  void result.finally(progress.close);
  return {
    query,
    kind,
    handoff,
    result,
    progress: progress.feed,
    needsType: false,
  };
}

export function meta({ data }: Route.MetaArgs) {
  const query = data?.query;
  return [
    {
      title: query
        ? `Watches in “${query}” · The Reserve`
        : "Find a watch from the screen · The Reserve",
    },
    {
      name: "description",
      content:
        "Search any film, series, actor, character or public figure and see the watches they wore, each with its source.",
    },
  ];
}

export default function WatchFind() {
  const { query, kind, handoff, result, progress, needsType } =
    useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const searching =
    navigation.state === "loading" &&
    navigation.location?.pathname === "/watches/find";

  return (
    <main className="discovery-shell find-shell">
      <nav className="discovery-nav" aria-label="Discovery navigation">
        <Link to="/">The Reserve</Link>
        <div className="discovery-nav__links">
          <Link to="/watches">Reviewed archive</Link>
          <Link to="/watches/archetype">Watch archetype</Link>
          <Link to="/quiz">Reference diagnostic</Link>
        </div>
      </nav>

      <header className="find-hero">
        <span className="eyebrow">Film · Television · People</span>
        <h1>Find the watch from the screen</h1>
        <p>
          Choose what you are looking for, then type its name. We search the
          live web and show each watch with who wore it and where.
        </p>
        <Form className="find-form" method="get" role="search">
          <label className="sr-only" htmlFor="find-type">
            What are you searching for?
          </label>
          <label className="sr-only" htmlFor="find-query">
            Name of the movie, series, actor, character or celebrity
          </label>
          <div className="search-box">
            <select
              className="search-box__type"
              defaultValue={kind ?? ""}
              id="find-type"
              name="type"
              required
            >
              <option disabled value="">
                Search for…
              </option>
              {FILM_SUBJECT_KINDS.map((option) => (
                <option key={option} value={option}>
                  {FILM_SUBJECT_LABELS[option]}
                </option>
              ))}
            </select>
            <svg
              aria-hidden="true"
              className="search-box__icon"
              viewBox="0 0 24 24"
            >
              <circle
                cx="11"
                cy="11"
                r="7"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <path
                d="m20 20-4.2-4.2"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.8"
              />
            </svg>
            <input
              autoComplete="off"
              defaultValue={query}
              id="find-query"
              maxLength={QUERY_MAX}
              minLength={2}
              name="q"
              placeholder="e.g. Daniel Craig, Succession, James Bond"
              required
              type="search"
            />
            <button
              className="button button--primary"
              disabled={searching}
              type="submit"
            >
              {searching ? "Searching…" : "Search"}
            </button>
          </div>
        </Form>
        {needsType ? (
          <p className="find-error" role="alert">
            Choose whether you are searching for a movie, series, actor,
            character or celebrity.
          </p>
        ) : null}
        <div className="find-examples" aria-label="Example searches">
          <span>Try</span>
          {EXAMPLES.map((example) => (
            <Link
              className="chip"
              key={example.query}
              to={`/watches/find?type=${example.kind}&q=${encodeURIComponent(example.query)}`}
            >
              {example.query}
              <span className="chip__hint">
                {" "}
                · {FILM_SUBJECT_LABELS[example.kind]}
              </span>
            </Link>
          ))}
        </div>
      </header>

      {result ? (
        <WatchResults
          eyebrow="Live search · documented sightings"
          footnote="Found with a live web search. Identifications from films can be disputed."
          fx={null}
          heading={`Watches in “${query}”`}
          key={`${kind}:${query}`}
          mode="film"
          progress={progress}
          result={result}
        />
      ) : (
        <section className="find-empty" aria-label="How it works">
          <div>
            <strong>1</strong>
            <p>
              Choose Movie, Series, Actor, Character or Celebrity, then type the
              name. Spelling doesn&apos;t need to be perfect.
            </p>
          </div>
          <div>
            <strong>2</strong>
            <p>We gather documented sightings from the live web in parallel.</p>
          </div>
          <div>
            <strong>3</strong>
            <p>
              Searches are saved, so anyone searching the same name later gets
              the answer instantly.
            </p>
          </div>
        </section>
      )}

      {handoff?.socialSignal || handoff?.aestheticDna ? (
        <p className="archetype-boundary">
          Your archetype is kept as optional context; it is not a watch
          recommendation or a hard constraint.
        </p>
      ) : null}
    </main>
  );
}
