import { Form, useLoaderData } from "react-router";

import type { Route } from "./+types/watches";
import { DiscoveryAnalytics } from "../components/discovery-analytics";
import { DiscoveryStoryList } from "../components/discovery-story-list";
import {
  EmbedThemeFields,
  SurfaceLink,
  useEmbed,
  useSurfaceHref,
} from "../components/surface";
import { listPublishedDiscoveryStories } from "../domain/discovery-public";
import { loadPublishedDiscoveryStories } from "../domain/discovery-store.server";
import {
  meterPartnerUse,
  partnerSiteFrom,
} from "../domain/partner-embed.server";
import "../styles/discovery.css";

export async function loader({ context }: Route.LoaderArgs) {
  // Stories cost nothing to serve: a partner's views are counted, never
  // refused.
  await meterPartnerUse(partnerSiteFrom(context), "stories");
  return {
    stories:
      (await loadPublishedDiscoveryStories()) ??
      listPublishedDiscoveryStories(),
  };
}

export function meta() {
  return [
    { title: "Watches of Celebrity & Cinema · The Reserve" },
    {
      name: "description",
      content:
        "Source-led watch identifications from cinema, television, and public life.",
    },
  ];
}

export default function WatchesIndex() {
  const { stories } = useLoaderData<typeof loader>();
  const embed = useEmbed();
  const href = useSurfaceHref();
  return (
    <main className="discovery-shell">
      <DiscoveryAnalytics event={{ name: "page_view", surface: "index" }} />
      {embed ? null : (
        <nav className="discovery-nav" aria-label="Discovery navigation">
          <SurfaceLink to="/">The Reserve</SurfaceLink>
          <div className="discovery-nav__links">
            <SurfaceLink to="/watches/find">Search the screen</SurfaceLink>
            <SurfaceLink to="/quiz">Reference diagnostic</SurfaceLink>
          </div>
        </nav>
      )}
      <header className="discovery-header">
        <span className="eyebrow">Watches from movies</span>
        <h1>Watches of Celebrity &amp; Cinema</h1>
        <p>
          Reviewed identifications with explicit uncertainty. A screen prop is
          not evidence of an actor&apos;s private collection, and an inspired
          retail watch is not silently substituted for a custom prop.
        </p>
        <Form
          action={href("/watches/find")}
          className="find-form"
          method="get"
          role="search"
        >
          <EmbedThemeFields />
          <label className="sr-only" htmlFor="archive-search">
            Search any film, series, actor or public figure
          </label>
          <div className="search-box">
            <input
              id="archive-search"
              maxLength={120}
              minLength={2}
              name="q"
              placeholder="Search any film, series, actor or public figure"
              required
              type="search"
            />
            <button className="button button--primary" type="submit">
              Search
            </button>
          </div>
        </Form>
      </header>
      <aside
        className="archetype-invitation"
        aria-labelledby="archetype-heading"
      >
        <span className="eyebrow">Four-question diversion</span>
        <h2 id="archetype-heading">Find your watch disposition</h2>
        <p>
          A shareable editorial archetype, followed by the full evidence-led
          diagnostic when you want a real shortlist.
        </p>
        <SurfaceLink to="/watches/archetype">
          Take the archetype quiz
        </SurfaceLink>
      </aside>
      <DiscoveryStoryList stories={stories} />
      <aside className="discovery-cta" aria-labelledby="discovery-cta-heading">
        <h2 id="discovery-cta-heading">Find the right equivalent for you</h2>
        <p>Use real budget, wrist, operating, and personal constraints.</p>
        <SurfaceLink to="/quiz">Start the reference diagnostic</SurfaceLink>
      </aside>
    </main>
  );
}
