import { Link, useLoaderData } from "react-router";

import type { Route } from "./+types/watch-work";
import { DiscoveryAnalytics } from "../components/discovery-analytics";
import { DiscoveryStoryList } from "../components/discovery-story-list";
import { findPublishedDiscoveryWork } from "../domain/discovery-public";
import { loadPublishedDiscoveryStories } from "../domain/discovery-store.server";
import "../styles/discovery.css";

export async function loader({ params }: Route.LoaderArgs) {
  const stories = await loadPublishedDiscoveryStories();
  const result = stories
    ? (() => {
        const matches = stories.filter(
          (story) => story.work?.slug === params.workSlug,
        );
        const work = matches[0]?.work;
        return work ? { work, stories: matches } : null;
      })()
    : findPublishedDiscoveryWork(params.workSlug ?? "");
  // React Router uses thrown Responses to preserve HTTP status boundaries.
  // eslint-disable-next-line @typescript-eslint/only-throw-error
  if (!result) throw new Response("Discovery work not found", { status: 404 });
  return result;
}

export function meta({ data: loaderData }: Route.MetaArgs) {
  return [
    {
      title: loaderData
        ? `${loaderData.work.title} watches · The Reserve`
        : "Screen watches · The Reserve",
    },
  ];
}

export default function WatchWork() {
  const { work, stories } = useLoaderData<typeof loader>();
  return (
    <main className="discovery-shell">
      <DiscoveryAnalytics event={{ name: "page_view", surface: "work" }} />
      <nav className="discovery-nav">
        <Link to="/watches">All stories</Link>
      </nav>
      <header className="discovery-header">
        <span className="eyebrow">{work.kind.replaceAll("_", " ")}</span>
        <h1>{work.title}</h1>
        <p>
          {stories.length} reviewed{" "}
          {stories.length === 1 ? "attribution" : "attributions"}.
        </p>
      </header>
      <DiscoveryStoryList stories={stories} />
    </main>
  );
}
