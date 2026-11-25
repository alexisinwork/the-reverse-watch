/**
 * Short links for video descriptions: thereserve.watch/e/35 leads to the
 * page set for episode 35 in app/data/episode-links.json, tagged so the
 * site's analytics can tell each episode's viewers apart (owner decision,
 * 2026-11-25). Nothing is stored about the visitor: the existing anonymous
 * analytics reads the utm_* parameters on the page the link opens.
 */
import { z } from "zod";

import episodeLinks from "../data/episode-links.json";

const linksSchema = z.object({
  episodes: z.record(
    z.string().regex(/^\d+$/),
    z.object({ title: z.string().nullable(), target: z.string() }),
  ),
});

const links = linksSchema.parse(episodeLinks).episodes;

export const EPISODE_MAX = 999;

/** A target must be a path on this site, never another website. */
export function isSitePath(target: string) {
  return (
    target.startsWith("/") &&
    !target.startsWith("//") &&
    !target.includes("\\") &&
    !/[\r\n]/.test(target)
  );
}

/** Where an episode's short link leads, with its campaign tags, or null for
 * something that is not an episode number. Unknown episodes go home. */
export function episodeDestination(raw: string | undefined) {
  if (!raw || !/^\d{1,3}$/.test(raw)) {
    return null;
  }
  const episode = Number(raw);
  if (episode < 1 || episode > EPISODE_MAX) {
    return null;
  }
  const configured = links[String(episode)]?.target ?? "/";
  const target = isSitePath(configured) ? configured : "/";
  const url = new URL(target, "https://thereserve.watch");
  url.searchParams.set("utm_source", "youtube");
  url.searchParams.set("utm_medium", "video");
  url.searchParams.set("utm_campaign", `ep${episode}`);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function episodeLinkList() {
  return Object.entries(links).map(([episode, link]) => ({
    episode: Number(episode),
    title: link.title,
    target: link.target,
  }));
}
