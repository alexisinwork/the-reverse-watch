import { createHash } from "node:crypto";

import { Form, Link, useLoaderData, useNavigation } from "react-router";

import type { Route } from "./+types/watch-find";
import { WatchResults } from "../components/watch-results";
import { normalizeFilmQuery, searchFilmWatches } from "../domain/film-search.server";
import { searchWithStore } from "../domain/ai-watch-store.server";
import { parseDiscoveryHandoff } from "../domain/discovery-selection";
import { consumeRateLimit, type RateLimitPolicy } from "../domain/rate-limit.server";
import "../styles/discovery.css";

const QUERY_MAX = 120;

// Stored answers are free; only fresh searches spend provider credit.
const NEW_SEARCH_POLICY: RateLimitPolicy = {
  configured: true,
  maxRequests: 12,
  windowMs: 10 * 60 * 1_000,
};

const EXAMPLES = [
  "Daniel Craig",
  "James Bond",
  "Succession",
  "Paul Newman",
  "The Bear",
  "Ryan Gosling in Drive",
];

function visitorKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const address =
    forwarded?.split(",", 1)[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "unknown";
  // Only a hash of the address is kept, in memory, for the rate limit.
  return `film-search:${createHash("sha256").update(address).digest("hex")}`;
}

export function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim().replace(/\s+/g, " ").slice(0, QUERY_MAX);
  const handoff = parseDiscoveryHandoff(url.searchParams);
  if (query.length < 2) return { query, handoff, result: null };

  const key = visitorKey(request);
  // Streamed: the page renders immediately and the watches arrive after.
  const result = searchWithStore({
    kind: "film",
    cacheInput: { query: normalizeFilmQuery(query) },
    run: async () => {
      if (!consumeRateLimit(key, NEW_SEARCH_POLICY).allowed) {
        return {
          status: "no_match",
          summary:
            "You have run a lot of new searches in a short time. Please try again in a few minutes; searches others already made still load instantly.",
        };
      }
      return searchFilmWatches(query);
    },
  });
  return { query, handoff, result };
}

export function meta({ data }: Route.MetaArgs) {
  const query = data?.query;
  return [
    {
      title: query ? `Watches in “${query}” · The Reserve` : "Find a watch from the screen · The Reserve",
    },
    {
      name: "description",
      content:
        "Search any film, series, actor, character or public figure and see the watches they wore, each with its source.",
    },
  ];
}

export default function WatchFind() {
  const { query, handoff, result } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const searching = navigation.state === "loading" && navigation.location?.pathname === "/watches/find";

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
          Type a film, series, actor, character or public figure. We search the live web and
          show each watch with who wore it, where, and the page that proves it.
        </p>
        <Form className="find-form" method="get" role="search">
          <label className="sr-only" htmlFor="find-query">
            Film, series, actor or public figure
          </label>
          <div className="search-box">
            <svg aria-hidden="true" className="search-box__icon" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path d="m20 20-4.2-4.2" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
            </svg>
            <input
              autoComplete="off"
              defaultValue={query}
              id="find-query"
              maxLength={QUERY_MAX}
              minLength={2}
              name="q"
              placeholder="e.g. Daniel Craig, Succession, Steve McQueen"
              required
              type="search"
            />
            <button className="button button--primary" disabled={searching} type="submit">
              {searching ? "Searching…" : "Search"}
            </button>
          </div>
        </Form>
        <div className="find-examples" aria-label="Example searches">
          <span>Try</span>
          {EXAMPLES.map((example) => (
            <Link className="chip" key={example} to={`/watches/find?q=${encodeURIComponent(example)}`}>
              {example}
            </Link>
          ))}
        </div>
      </header>

      {result ? (
        <WatchResults
          eyebrow="Live search · documented sightings"
          footnote="Found with a live Perplexity web search and ranked by Muse Spark. Each sighting links to the page that documents it; attributions from films can be disputed."
          fx={null}
          heading={`Watches in “${query}”`}
          key={query}
          mode="film"
          result={result}
        />
      ) : (
        <section className="find-empty" aria-label="How it works">
          <div>
            <strong>1</strong>
            <p>Search a title or a name. Spelling doesn&apos;t need to be perfect.</p>
          </div>
          <div>
            <strong>2</strong>
            <p>We gather documented sightings from the live web in parallel.</p>
          </div>
          <div>
            <strong>3</strong>
            <p>Every watch links to its evidence. Searches are saved, so repeats are instant.</p>
          </div>
        </section>
      )}

      {handoff?.socialSignal || handoff?.aestheticDna ? (
        <p className="archetype-boundary">
          Your archetype is kept as optional context; it is not a watch recommendation or a hard
          constraint.
        </p>
      ) : null}
    </main>
  );
}
