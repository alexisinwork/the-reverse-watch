import { Link, useLoaderData } from "react-router";

import type { Route } from "./+types/watch-find";
import { parseDiscoveryHandoff } from "../domain/discovery-selection";
import "../styles/discovery.css";

export function loader({ request }: Route.LoaderArgs) {
  return { handoff: parseDiscoveryHandoff(new URL(request.url).searchParams) };
}

export default function WatchFind() {
  const { handoff } = useLoaderData<typeof loader>();
  return (
    <main className="discovery-shell">
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
        <div className="archetype-next-actions">
          <button type="button" disabled>
            Film or TV
          </button>
          <button type="button" disabled>
            Actor or public figure
          </button>
          <button type="button" disabled>
            Fictional character
          </button>
        </div>
        <p>
          Accepted-record search arrives in the next packet. This page does not
          send a research request or call an external service.
        </p>
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
