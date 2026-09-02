import { Link, useLoaderData } from "react-router";

import type { Route } from "./+types/watch-entity";
import { DiscoveryAnalytics } from "../components/discovery-analytics";
import { DiscoveryStoryList } from "../components/discovery-story-list";
import { findPublishedDiscoveryEntity } from "../domain/discovery-public";
import { loadPublishedDiscoveryStories } from "../domain/discovery-store.server";
import "../styles/discovery.css";

export async function loader({ params }: Route.LoaderArgs) {
  const stories = await loadPublishedDiscoveryStories();
  const result = stories
    ? (() => {
        const matches = stories.filter(
          (story) => story.entity.slug === params.entitySlug,
        );
        return matches.length === 0
          ? null
          : { entity: matches[0]!.entity, stories: matches };
      })()
    : findPublishedDiscoveryEntity(params.entitySlug ?? "");
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
      <DiscoveryAnalytics event={{ name: "page_view", surface: "entity" }} />
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
