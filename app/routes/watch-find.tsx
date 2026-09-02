import { createHash } from "node:crypto";

import { Form, Link, redirect, useLoaderData } from "react-router";

import type { Route } from "./+types/watch-find";
import {
  discoveryAnchorSchema,
  discoverySearchSchema,
  parseDiscoveryHandoff,
} from "../domain/discovery-selection";
import {
  fallbackDiscoverySearch,
  searchAcceptedDiscoveryRecords,
} from "../domain/discovery-search.server";
import { enqueueDiscoveryResearch } from "../domain/discovery-research-store.server";
import { persistDiscoveryFunnelEvent } from "../domain/discovery-funnel-store.server";
import {
  consumeRateLimit,
  parseDiscoveryResearchRateLimitPolicy,
  type RateLimitDecision,
} from "../domain/rate-limit.server";
import { DiscoveryAnalytics } from "../components/discovery-analytics";
import "../styles/discovery.css";

export async function loader({ request }: Route.LoaderArgs) {
  const searchParams = new URL(request.url).searchParams;
  const anchor = discoveryAnchorSchema.safeParse(searchParams.get("anchor"));
  const parsedSearch = discoverySearchSchema.safeParse({
    anchor: anchor.success ? anchor.data : undefined,
    query: searchParams.get("q") ?? undefined,
  });
  const results = parsedSearch.success
    ? ((await searchAcceptedDiscoveryRecords(parsedSearch.data)) ??
      fallbackDiscoverySearch(parsedSearch.data))
    : [];
  return {
    handoff: parseDiscoveryHandoff(searchParams),
    anchor: anchor.success ? anchor.data : null,
    query: searchParams.get("q") ?? "",
    results,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  if (form.get("website")) return new Response(null, { status: 204 });
  const anchor = discoveryAnchorSchema.safeParse(form.get("anchor"));
  const rawQuery = form.get("query");
  const query = typeof rawQuery === "string" ? rawQuery : "";
  if (!anchor.success) return new Response("Invalid request", { status: 400 });
  const rateLimitPolicy = parseDiscoveryResearchRateLimitPolicy();
  if (!rateLimitPolicy.configured) {
    return new Response("Research intake is temporarily unavailable", {
      status: 503,
    });
  }
  const rateLimitDecision = consumeRateLimit(
    researchRateLimitKey(request),
    rateLimitPolicy,
  );
  if (!rateLimitDecision.allowed) {
    return new Response("Too many research requests. Please try again later.", {
      status: 429,
      headers: rateLimitHeaders(rateLimitDecision),
    });
  }
  try {
    const topic = await enqueueDiscoveryResearch({
      anchor: anchor.data,
      displayText: query,
      releaseYear: null,
    });
    if (!topic)
      return new Response("Research intake is unavailable", { status: 503 });
    void persistDiscoveryFunnelEvent({
      name: "research_request_submitted",
      anchor: anchor.data,
    }).catch(() => undefined);
    return redirect(`/watches/research/${topic.token}`);
  } catch {
    return new Response("Invalid request", { status: 400 });
  }
}

function researchRateLimitKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const address =
    forwarded?.split(",", 1)[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown";
  return `discovery-research:${createHash("sha256").update(address).digest("hex")}`;
}

function rateLimitHeaders(decision: RateLimitDecision) {
  const headers = new Headers();
  if (decision.limit !== null) {
    headers.set("X-RateLimit-Limit", String(decision.limit));
    headers.set("X-RateLimit-Remaining", String(decision.remaining));
    headers.set(
      "X-RateLimit-Reset",
      String(Math.ceil((decision.resetAt ?? Date.now()) / 1_000)),
    );
  }
  if (decision.retryAfterSeconds !== null) {
    headers.set("Retry-After", String(decision.retryAfterSeconds));
  }
  return headers;
}

export default function WatchFind() {
  const { handoff, anchor, query, results } = useLoaderData<typeof loader>();
  return (
    <main className="discovery-shell">
      {anchor ? (
        <DiscoveryAnalytics
          event={{ name: "cultural_anchor_selected", anchor }}
        />
      ) : null}
      <nav className="discovery-nav" aria-label="Discovery navigation">
        <Link to="/watches/archetype">Watch archetype</Link>
        <Link to="/watches">Browse the archive</Link>
      </nav>
      <header className="discovery-header">
        <span className="eyebrow">Film and culture</span>
        <h1>Find a watch through a story</h1>
        <p>
          Choose a film or television work, a public figure, or a fictional
          character. This archive shows reviewed claims only.
        </p>
      </header>
      <section className="discovery-cta" aria-labelledby="find-anchor-heading">
        <h2 id="find-anchor-heading">Choose an anchor</h2>
        <Form method="get" className="archetype-next-actions">
          <button name="anchor" type="submit" value="work">
            Film or TV
          </button>
          <button name="anchor" type="submit" value="public_figure">
            Actor or public figure
          </button>
          <button name="anchor" type="submit" value="character">
            Fictional character
          </button>
        </Form>
        {anchor ? (
          <Form method="get" className="discovery-search-form">
            <input name="anchor" type="hidden" value={anchor} />
            <label htmlFor="discovery-query">
              Search accepted{" "}
              {anchor === "work"
                ? "works"
                : anchor === "character"
                  ? "characters"
                  : "public figures"}
            </label>
            <input
              defaultValue={query}
              id="discovery-query"
              maxLength={160}
              minLength={2}
              name="q"
              required
              type="search"
            />
            <button type="submit">Search archive</button>
          </Form>
        ) : null}
        {anchor && query.length > 0 && query.trim().length < 2 ? (
          <p>Enter at least two characters to search the reviewed archive.</p>
        ) : null}
        {results.length > 0 ? (
          <ul className="discovery-search-results">
            {results.map((result) => (
              <li key={`${result.anchor}:${result.slug}`}>
                <Link
                  to={
                    result.anchor === "work"
                      ? `/watches/works/${result.slug}`
                      : `/watches/people/${result.slug}`
                  }
                >
                  {result.label}
                </Link>
                {result.descriptor ? <span>{result.descriptor}</span> : null}
              </li>
            ))}
          </ul>
        ) : anchor && query.trim().length >= 2 ? (
          <>
            <p>No accepted record matches that search.</p>
            <Form method="post">
              <input name="anchor" type="hidden" value={anchor} />
              <input name="query" type="hidden" value={query} />
              <input
                aria-hidden="true"
                name="website"
                tabIndex={-1}
                type="text"
              />
              <button type="submit">Research this subject</button>
            </Form>
          </>
        ) : null}
        {handoff ? (
          <p className="archetype-boundary">
            Your editorial direction is available as optional context; it is not
            a watch recommendation or a hard constraint.
          </p>
        ) : null}
      </section>
    </main>
  );
}
