/**
 * GET /yt, /tt, /ig — a profile's bio link — and /ys/:episode, /tt/:episode,
 * /ig/:episode — a YouTube Short's, TikTok clip's or Instagram reel's link.
 * Each redirects with its platform's campaign tags, like /e/:episode does
 * for YouTube videos; the CDN keeps the redirect for a day. See
 * domain/episode-links.ts.
 */
import { redirect } from "react-router";

import type { Route } from "./+types/social-link";
import {
  episodeDestination,
  profileDestination,
  type ProfilePrefix,
  type ShortLinkPrefix,
} from "../domain/episode-links";

export function loader({ request, params }: Route.LoaderArgs) {
  const prefix = new URL(request.url).pathname.split("/")[1] ?? "";
  const episode = params.episode;
  const destination =
    episode === undefined
      ? ["yt", "tt", "ig"].includes(prefix)
        ? profileDestination(prefix as ProfilePrefix)
        : null
      : ["ys", "tt", "ig"].includes(prefix)
        ? episodeDestination(episode, prefix as ShortLinkPrefix)
        : null;
  if (!destination) {
    // React Router uses thrown Responses to preserve HTTP status boundaries.
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw new Response("Not a short link", { status: 404 });
  }
  return redirect(destination, {
    status: 302,
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=86400",
    },
  });
}
