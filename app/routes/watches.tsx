import { Link, useLoaderData } from "react-router";

import { DiscoveryStoryList } from "../components/discovery-story-list";
import { listPublishedDiscoveryStories } from "../domain/discovery-public";
import "../styles/discovery.css";

export function loader() {
  return { stories: listPublishedDiscoveryStories() };
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
  return (
    <main className="discovery-shell">
      <nav className="discovery-nav" aria-label="Discovery navigation">
        <Link to="/">The Reserve</Link>
        <Link to="/quiz">Reference diagnostic</Link>
      </nav>
      <header className="discovery-header">
        <span className="eyebrow">Source-led archive</span>
        <h1>Watches of Celebrity &amp; Cinema</h1>
        <p>
          Reviewed identifications with explicit uncertainty. A screen prop is
          not evidence of an actor&apos;s private collection, and an inspired
          retail watch is not silently substituted for a custom prop.
        </p>
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
        <Link to="/watches/archetype">Take the archetype quiz</Link>
      </aside>
      <DiscoveryStoryList stories={stories} />
      <aside className="discovery-cta" aria-labelledby="discovery-cta-heading">
        <h2 id="discovery-cta-heading">Find the right equivalent for you</h2>
        <p>Use real budget, wrist, operating, and personal constraints.</p>
        <Link to="/quiz">Start the reference diagnostic</Link>
      </aside>
    </main>
  );
}
