/**
 * The Reserve's YouTube episodes for /start, the page the Instagram and
 * TikTok profiles link to (owner decision, 2026-11-27).
 *
 * Every episode is scheduled in YouTube Studio ahead of time and stays
 * private until its `publishAt`. So the selection happens here, on the
 * server: the page and the data sent to the browser hold only episodes whose
 * time has come. This file ends in `.server.ts`, so the full list, with the
 * IDs and titles of episodes not yet out, never reaches the browser bundle.
 *
 * The data is a copy of the channel folder's
 * `analysis/site_youtube_episodes.json`; how to update it:
 * `docs/social-landing.md`.
 */
import { z } from "zod";

import episodesFile from "../data/youtube-episodes.json";

const episodesSchema = z.object({
  channelUrl: z.url(),
  episodes: z.array(
    z.object({
      episode: z.number().int().positive(),
      title: z.string().trim().min(1),
      // A YouTube video ID: eleven letters, digits, "-" or "_".
      youtubeId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
      // With its Warsaw offset, e.g. 2026-12-06T16:00:00+01:00.
      publishAt: z.iso.datetime({ offset: true }),
    }),
  ),
});

export type ScheduledEpisode = z.infer<
  typeof episodesSchema
>["episodes"][number];

/** What the browser receives about an episode that is out. */
export type ReleasedEpisode = Pick<
  ScheduledEpisode,
  "episode" | "title" | "youtubeId"
>;

export function parseEpisodesFile(value: unknown) {
  return episodesSchema.parse(value);
}

const schedule = parseEpisodesFile(episodesFile);

export const YOUTUBE_CHANNEL_URL = schedule.channelUrl;

/** The CDN keeps /start for at most five minutes, so an episode appears on
 * its release day within five minutes without anyone touching the site. */
export const START_PAGE_MAX_CACHE_SECONDS = 300;

const releaseTime = (episode: ScheduledEpisode) =>
  Date.parse(episode.publishAt);

/** Episodes whose release time has passed, newest first. */
export function releasedEpisodes(
  now: Date,
  episodes: readonly ScheduledEpisode[] = schedule.episodes,
): ReleasedEpisode[] {
  return episodes
    .filter((episode) => releaseTime(episode) <= now.getTime())
    .sort((a, b) => releaseTime(b) - releaseTime(a) || b.episode - a.episode)
    .map(({ episode, title, youtubeId }) => ({ episode, title, youtubeId }));
}

/** The next release time after `now`, or null when every episode is out. */
export function nextReleaseAt(
  now: Date,
  episodes: readonly ScheduledEpisode[] = schedule.episodes,
): Date | null {
  const upcoming = episodes
    .map(releaseTime)
    .filter((time) => time > now.getTime())
    .sort((a, b) => a - b);
  return upcoming.length > 0 ? new Date(upcoming[0]!) : null;
}

/** "Sunday 6 December", in Warsaw time, where the channel schedules. */
export function releaseDayLabel(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Warsaw",
  }).format(date);
}

/**
 * How long the CDN may keep the page: five minutes, or less when the next
 * episode comes out sooner, so the copy expires at the release itself.
 * No stale-while-revalidate: an expired copy must not be served again.
 */
export function startPageCacheControl(
  now: Date,
  episodes: readonly ScheduledEpisode[] = schedule.episodes,
) {
  const next = nextReleaseAt(now, episodes);
  const untilNext = next
    ? Math.ceil((next.getTime() - now.getTime()) / 1_000)
    : START_PAGE_MAX_CACHE_SECONDS;
  const seconds = Math.max(
    1,
    Math.min(START_PAGE_MAX_CACHE_SECONDS, untilNext),
  );
  return `public, max-age=0, s-maxage=${seconds}`;
}

/** Everything /start shows, and nothing about episodes not yet out. */
export function startPageEpisodes(
  now: Date,
  episodes: readonly ScheduledEpisode[] = schedule.episodes,
) {
  const released = releasedEpisodes(now, episodes);
  const next = nextReleaseAt(now, episodes);
  return {
    latest: released[0] ?? null,
    episodes: released,
    // Only before the first release: its day, never its title.
    firstEpisodeDay:
      released.length === 0 && next ? releaseDayLabel(next) : null,
    channelUrl: YOUTUBE_CHANNEL_URL,
  };
}
