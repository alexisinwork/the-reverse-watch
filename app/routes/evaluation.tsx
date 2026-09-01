import { data, Link, useLoaderData } from "react-router";

import type { Route } from "./+types/evaluation";
import { loadDiscoveryFunnelSummary } from "../domain/discovery-funnel-store.server";
import { loadFunnelSummary } from "../domain/funnel-store.server";
import "../styles/quiz.css";

export async function loader() {
  const until = new Date();
  const since = new Date(until.getTime() - 30 * 24 * 60 * 60 * 1_000);
  try {
    const [summary, discoverySummary] = await Promise.all([
      loadFunnelSummary(since.toISOString(), until.toISOString()),
      loadDiscoveryFunnelSummary(since.toISOString(), until.toISOString()),
    ]);
    return data({
      summary,
      discoverySummary,
      error: null,
    });
  } catch {
    return data(
      {
        summary: null,
        discoverySummary: null,
        error: "The evaluation store is temporarily unavailable.",
      },
      { status: 503 },
    );
  }
}

function percentage(numerator: number, denominator: number) {
  if (denominator === 0) return "Insufficient sample";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

export function meta(): ReturnType<Route.MetaFunction> {
  return [
    { title: "Evaluation · The Reserve" },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

export default function EvaluationDashboard() {
  const { summary, discoverySummary, error } = useLoaderData<typeof loader>();

  return (
    <main className="quiz-shell">
      <nav className="quiz-nav" aria-label="Evaluation navigation">
        <Link to="/">The Reserve</Link>
        <span>Product evaluation</span>
      </nav>
      <section className="profile-summary" aria-labelledby="evaluation-heading">
        <span className="eyebrow">Aggregate-only · trailing 30 days</span>
        <h1 id="evaluation-heading">Product evaluation dashboard</h1>
        <p>
          No profile answers, email addresses, IP addresses, or request
          identifiers are stored in this evaluation surface.
        </p>
        {error ? <p role="alert">{error}</p> : null}
        {!error && !summary ? (
          <p>Evaluation data is not available yet.</p>
        ) : null}
        {summary ? (
          <>
            <dl className="profile-grid">
              <div>
                <dt>Meaningful starts</dt>
                <dd>{summary.starts}</dd>
              </div>
              <div>
                <dt>Core completions</dt>
                <dd>{summary.coreEvaluations}</dd>
              </div>
              <div>
                <dt>Completion</dt>
                <dd>{percentage(summary.coreEvaluations, summary.starts)}</dd>
              </div>
              <div>
                <dt>Refinement use</dt>
                <dd>
                  {percentage(
                    summary.refineEvaluations,
                    summary.coreEvaluations,
                  )}
                </dd>
              </div>
              <div>
                <dt>Hard-filter violations</dt>
                <dd>{summary.hardFilterViolations}</dd>
              </div>
              <div>
                <dt>Average evaluation</dt>
                <dd>
                  {summary.averageEvaluationDurationMs === null
                    ? "No sample"
                    : `${summary.averageEvaluationDurationMs.toFixed(2)} ms`}
                </dd>
              </div>
              <div>
                <dt>Analysis cost</dt>
                <dd>${summary.providerCostUsd.toFixed(6)}</dd>
              </div>
              <div>
                <dt>Average top score</dt>
                <dd>{summary.averageTopRecommendationScore ?? "No sample"}</dd>
              </div>
              <div>
                <dt>Average confirmed score</dt>
                <dd>{summary.averageMeanRecommendationScore ?? "No sample"}</dd>
              </div>
            </dl>
            <h2>Subscription outcomes</h2>
            {Object.keys(summary.subscriptionStatuses).length === 0 ? (
              <p>No subscription requests in this window.</p>
            ) : (
              <dl className="profile-grid">
                {Object.entries(summary.subscriptionStatuses).map(
                  ([status, count]) => (
                    <div key={status}>
                      <dt>{status.replaceAll("_", " ")}</dt>
                      <dd>{count}</dd>
                    </div>
                  ),
                )}
              </dl>
            )}
          </>
        ) : null}
        {discoverySummary ? (
          <section aria-labelledby="discovery-evaluation-heading">
            <h2 id="discovery-evaluation-heading">Discovery funnel</h2>
            <dl className="profile-grid">
              <div>
                <dt>Discovery page views</dt>
                <dd>{discoverySummary.pageViews}</dd>
              </div>
              <div>
                <dt>Archetype starts</dt>
                <dd>{discoverySummary.archetypeStarts}</dd>
              </div>
              <div>
                <dt>Archetype completions</dt>
                <dd>{discoverySummary.archetypeCompletions}</dd>
              </div>
              <div>
                <dt>Archetype completion</dt>
                <dd>
                  {percentage(
                    discoverySummary.archetypeCompletions,
                    discoverySummary.archetypeStarts,
                  )}
                </dd>
              </div>
              <div>
                <dt>Share rate</dt>
                <dd>
                  {percentage(
                    discoverySummary.shares,
                    discoverySummary.archetypeCompletions,
                  )}
                </dd>
              </div>
              <div>
                <dt>Core handoff rate</dt>
                <dd>
                  {percentage(
                    discoverySummary.coreHandoffs,
                    discoverySummary.archetypeCompletions,
                  )}
                </dd>
              </div>
              <div>
                <dt>Qualified recommendation conversion</dt>
                <dd>
                  {percentage(
                    discoverySummary.qualifiedRecommendations,
                    discoverySummary.coreHandoffs,
                  )}
                </dd>
              </div>
              <div>
                <dt>Discovery-attributed opt-ins</dt>
                <dd>{discoverySummary.optIns}</dd>
              </div>
              <div>
                <dt>Outbound market clicks</dt>
                <dd>{discoverySummary.outboundMarketClicks}</dd>
              </div>
            </dl>
          </section>
        ) : null}
      </section>
    </main>
  );
}
