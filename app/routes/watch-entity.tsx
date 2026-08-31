import { Link, useLoaderData } from "react-router";

import type { Route } from "./+types/watch-entity";
import { DiscoveryStoryList } from "../components/discovery-story-list";
import { findPublishedDiscoveryEntity } from "../domain/discovery-public";
import "../styles/discovery.css";

export function loader({ params }: Route.LoaderArgs) {
  const result = findPublishedDiscoveryEntity(params.entitySlug ?? "");
  if (!result) {
    // React Router uses thrown Responses to preserve HTTP status boundaries.
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw new Response("Discovery entity not found", { status: 404 });
  }
  return result;
}

export function meta({ data: loaderData }: Route.MetaArgs) {
  return [
    {
      title: loaderData
        ? `${loaderData.entity.name} watches · The Reserve`
        : "Person watches · The Reserve",
    },
  ];
}

export default function WatchEntity() {
  const { entity, stories } = useLoaderData<typeof loader>();
  return (
    <main className="discovery-shell">
      <nav className="discovery-nav">
        <Link to="/watches">All stories</Link>
      </nav>
      <header className="discovery-header">
        <span className="eyebrow">{entity.kind.replaceAll("_", " ")}</span>
        <h1>{entity.name}</h1>
        {entity.disambiguation ? <p>{entity.disambiguation}</p> : null}
      </header>
      <DiscoveryStoryList stories={stories} />
    </main>
  );
}
