import { Link, useLoaderData } from "react-router";

import type { Route } from "./+types/watch-research-status";
import { loadDiscoveryResearchStatus } from "../domain/discovery-research-store.server";
import { DiscoveryAnalytics } from "../components/discovery-analytics";

export async function loader({ params }: Route.LoaderArgs) {
  const token = params.requestToken ?? "";
  const status = await loadDiscoveryResearchStatus(token).catch(() => null);
  if (!status) {
    // React Router uses thrown Responses to preserve HTTP status boundaries.
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw new Response("Research request not found", { status: 404 });
  }
  return status;
}

export default function WatchResearchStatus() {
  const { status } = useLoaderData<typeof loader>();
  return (
    <main className="discovery-shell">
      <DiscoveryAnalytics event={{ name: "research_status_seen", status }} />
      <nav className="discovery-nav">
        <Link to="/watches/find">Back to search</Link>
      </nav>
      <header className="discovery-header">
        <span className="eyebrow">Research request</span>
        <h1>Archive status</h1>
        <p>{status.replaceAll("_", " ")}</p>
        <p>
          This page does not reveal the submitted query, internal identifiers,
          or reviewer notes.
        </p>
      </header>
    </main>
  );
}
