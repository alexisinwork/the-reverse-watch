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
  /** Where a profile's own link (the bio link) leads, per platform. */
  profiles: z
    .object({
      youtube: z.string(),
      tiktok: z.string(),
      instagram: z.string(),
    })
    .partial()
    .default({}),
});

const parsed = linksSchema.parse(episodeLinks);
const links = parsed.episodes;
const profiles = parsed.profiles;

/**
 * Short links per platform (owner, 2026-11-27: "нужно нам чётко создать
 * ссылки под youtube/tiktok/insta чтобы мы знали откуда кто пришёл").
 * /e/35 is a YouTube video's link, /ys/35 a YouTube Short's, /tt/35 a
 * TikTok clip's and /ig/35 an Instagram reel's: each opens the tool episode
 * 35 names. /yt, /tt and /ig alone are the profiles' bio links.
 */
export const SHORT_LINK_PLATFORMS = {
  e: { source: "youtube", medium: "video" },
  ys: { source: "youtube", medium: "shorts" },
  tt: { source: "tiktok", medium: "short_video" },
  ig: { source: "instagram", medium: "short_video" },
} as const;
export type ShortLinkPrefix = keyof typeof SHORT_LINK_PLATFORMS;

export const PROFILE_LINKS = {
  yt: "youtube",
  tt: "tiktok",
  ig: "instagram",
} as const;
export type ProfilePrefix = keyof typeof PROFILE_LINKS;

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

function tagged(
  configured: string,
  tags: { source: string; medium: string; campaign: string },
) {
  const target = isSitePath(configured) ? configured : "/";
  const url = new URL(target, "https://thereserve.watch");
  url.searchParams.set("utm_source", tags.source);
  url.searchParams.set("utm_medium", tags.medium);
  url.searchParams.set("utm_campaign", tags.campaign);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Where an episode's short link leads, with its campaign tags, or null for
 * something that is not an episode number. Unknown episodes go home. */
export function episodeDestination(
  raw: string | undefined,
  prefix: ShortLinkPrefix = "e",
) {
  if (!raw || !/^\d{1,3}$/.test(raw)) {
    return null;
  }
  const episode = Number(raw);
  if (episode < 1 || episode > EPISODE_MAX) {
    return null;
  }
  return tagged(links[String(episode)]?.target ?? "/", {
    ...SHORT_LINK_PLATFORMS[prefix],
    campaign: `ep${episode}`,
  });
}

/** Where a profile's bio link leads, tagged with its platform. */
export function profileDestination(prefix: ProfilePrefix) {
  const source = PROFILE_LINKS[prefix];
  // The channel's tags for bio links (owner decision, 2026-11-27; the
  // channel folder's analysis/SITE_SOCIAL_LANDING.md).
  return tagged(profiles[source] ?? "/", {
    source,
    medium: "social",
    campaign: "bio",
  });
}

export function episodeLinkList() {
  return Object.entries(links).map(([episode, link]) => ({
    episode: Number(episode),
    title: link.title,
    target: link.target,
  }));
}
