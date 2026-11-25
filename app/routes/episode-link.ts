/**
 * GET /e/:episode — the short link in a video description. Redirects to the
 * episode's page with campaign tags; the CDN keeps the redirect for a day,
 * so a busy premiere costs no function calls. See domain/episode-links.ts.
 */
import { redirect } from "react-router";

import type { Route } from "./+types/episode-link";
import { episodeDestination } from "../domain/episode-links";

export function loader({ params }: Route.LoaderArgs) {
  const destination = episodeDestination(params.episode);
  if (!destination) {
    // React Router uses thrown Responses to preserve HTTP status boundaries.
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw new Response("Not an episode link", { status: 404 });
  }
  return redirect(destination, {
    status: 302,
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=86400",
    },
  });
}
