import { Link, useLoaderData } from "react-router";

import type { Route } from "./+types/watch-story";
import { findPublishedDiscoveryStory } from "../domain/discovery-public";
import "../styles/discovery.css";

export function loader({ params }: Route.LoaderArgs) {
  const story = findPublishedDiscoveryStory(params.storySlug ?? "");
  // React Router uses thrown Responses to preserve HTTP status boundaries.
  // eslint-disable-next-line @typescript-eslint/only-throw-error
  if (!story) throw new Response("Discovery record not found", { status: 404 });
  return { story };
}

export function meta({ data: loaderData }: Route.MetaArgs) {
  return [
    {
      title: loaderData
        ? `${loaderData.story.headline} · The Reserve`
        : "Watch attribution · The Reserve",
    },
  ];
}

export default function WatchStory() {
  const { story } = useLoaderData<typeof loader>();
  const identity = [
    story.attribution.brand,
    story.attribution.model,
    story.attribution.reference,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <main className="discovery-shell discovery-detail">
      <nav className="discovery-nav" aria-label="Discovery navigation">
        <Link to="/watches">All stories</Link>
        <Link to={`/watches/people/${story.entity.slug}`}>
          {story.entity.name}
        </Link>
        {story.work ? (
          <Link to={`/watches/works/${story.work.slug}`}>
            {story.work.title}
          </Link>
        ) : null}
      </nav>
      <article>
        <span
          className={`confidence confidence-${story.attribution.confidence}`}
        >
          {story.attribution.confidenceLabel}
        </span>
        <h1>{story.headline}</h1>
        <p className="discovery-lede">{story.summary}</p>
        <dl className="discovery-facts">
          <div>
            <dt>Identification</dt>
            <dd>{identity || "Not identified"}</dd>
          </div>
          <div>
            <dt>Claim</dt>
            <dd>{story.attribution.claimType.replaceAll("_", " ")}</dd>
          </div>
          <div>
            <dt>Precision</dt>
            <dd>{story.attribution.precision.replaceAll("_", " ")}</dd>
          </div>
          {story.work ? (
            <div>
              <dt>Work</dt>
              <dd>{story.work.title}</dd>
            </div>
          ) : null}
          {story.event ? (
            <div>
              <dt>Event</dt>
              <dd>{story.event.title}</dd>
            </div>
          ) : null}
        </dl>
        {story.attribution.sceneLocator ? (
          <p>{story.attribution.sceneLocator}</p>
        ) : null}
        {story.attribution.note ? (
          <p className="editorial-note">{story.attribution.note}</p>
        ) : null}
        <section className="citation-panel" aria-labelledby="sources-heading">
          <h2 id="sources-heading">Reviewed sources</h2>
          <ul>
            {story.citations.map((citation) => (
              <li key={citation.url}>
                <a href={citation.url} rel="noreferrer" target="_blank">
                  {citation.title ?? citation.publisher ?? "Source record"}
                </a>
                {citation.publisher ? <span>{citation.publisher}</span> : null}
              </li>
            ))}
          </ul>
        </section>
        <section
          className="correction-panel"
          aria-labelledby="corrections-heading"
        >
          <h2 id="corrections-heading">Corrections</h2>
          {story.corrections.length ? (
            story.corrections.map((correction) => (
              <p key={correction.note}>{correction.note}</p>
            ))
          ) : (
            <p>No open correction is recorded for this attribution.</p>
          )}
        </section>
      </article>
      <aside className="discovery-cta">
        <h2>Find the right equivalent for you</h2>
        <Link to="/quiz">Start the reference diagnostic</Link>
      </aside>
    </main>
  );
}
