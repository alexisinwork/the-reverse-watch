import { describe, expect, it } from "vitest";

import episodesFile from "../data/youtube-episodes.json";
import {
  nextReleaseAt,
  parseEpisodesFile,
  releasedEpisodes,
  startPageCacheControl,
  startPageEpisodes,
} from "./youtube-episodes.server";

const schedule = parseEpisodesFile(episodesFile);
const at = (iso: string) => new Date(iso);
const numbers = (now: Date) =>
  releasedEpisodes(now).map((episode) => episode.episode);

/** Every ID and title of an episode not yet out at `now`. */
function secretsAt(now: Date) {
  return schedule.episodes
    .filter((episode) => Date.parse(episode.publishAt) > now.getTime())
    .flatMap((episode) => [episode.youtubeId, episode.title]);
}

describe("the episode schedule file", () => {
  it("is valid, with one entry per episode and per video", () => {
    expect(schedule.episodes.length).toBeGreaterThanOrEqual(11);
    const episodes = schedule.episodes.map((episode) => episode.episode);
    const ids = schedule.episodes.map((episode) => episode.youtubeId);
    expect(new Set(episodes).size).toBe(episodes.length);
    expect(new Set(ids).size).toBe(ids.length);
    expect(schedule.channelUrl).toBe(
      "https://www.youtube.com/@TheReserveWatch",
    );
  });

  it("refuses a release time without its time-zone offset", () => {
    expect(() =>
      parseEpisodesFile({
        channelUrl: "https://www.youtube.com/@TheReserveWatch",
        episodes: [
          {
            episode: 1,
            title: "A title",
            youtubeId: "gjr3aGjZDug",
            publishAt: "2026-12-06T16:00:00",
          },
        ],
      }),
    ).toThrow();
  });
});

describe("which episodes /start shows", () => {
  it("shows no episode before 6 December 16:00, only the first one's day", () => {
    for (const now of [
      at("2026-11-27T12:00:00+01:00"),
      at("2026-12-06T15:59:59+01:00"),
    ]) {
      const page = startPageEpisodes(now);
      expect(page.latest).toBeNull();
      expect(page.episodes).toEqual([]);
      expect(page.firstEpisodeDay).toBe("Sunday 6 December");
    }
  });

  it("shows episode 1 from its release time", () => {
    expect(numbers(at("2026-12-06T16:00:00+01:00"))).toEqual([1]);
    const page = startPageEpisodes(at("2026-12-06T16:05:00+01:00"));
    expect(page.latest).toEqual({
      episode: 1,
      title: "Switzerland Built the Future. Then Couldn't Afford to Sell It.",
      youtubeId: "gjr3aGjZDug",
    });
    expect(page.firstEpisodeDay).toBeNull();
  });

  it("puts episode 2 on top on 9 December, with episode 1 below", () => {
    const page = startPageEpisodes(at("2026-12-09T16:05:00+01:00"));
    expect(page.latest?.episode).toBe(2);
    expect(page.episodes.map((episode) => episode.episode)).toEqual([2, 1]);
  });

  it("shows episode 11 with its re-uploaded video on 7 February 2027", () => {
    const page = startPageEpisodes(at("2027-02-07T16:05:00+01:00"));
    expect(page.latest?.episode).toBe(11);
    expect(page.latest?.youtubeId).toBe("BJ8fKyFUUoQ");
    expect(page.episodes.map((episode) => episode.episode)).toEqual([
      11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
    ]);
  });

  it("never carries an episode that is not out yet", () => {
    for (const iso of [
      "2026-11-27T12:00:00+01:00",
      "2026-12-06T16:05:00+01:00",
      "2026-12-09T16:05:00+01:00",
      "2027-01-10T15:59:59+01:00",
    ]) {
      const now = at(iso);
      const sent = JSON.stringify(startPageEpisodes(now));
      const secrets = secretsAt(now);
      expect(secrets.length).toBeGreaterThan(0);
      for (const secret of secrets) {
        expect(sent, `${iso}: ${secret}`).not.toContain(secret);
      }
      // Only what the page shows: no release times at all.
      expect(sent).not.toContain("publishAt");
    }
  });
});

describe("how long the CDN keeps /start", () => {
  it("keeps it five minutes at most", () => {
    expect(startPageCacheControl(at("2026-11-27T12:00:00+01:00"))).toBe(
      "public, max-age=0, s-maxage=300",
    );
    // After the last scheduled episode: still five minutes.
    expect(startPageCacheControl(at("2030-01-01T00:00:00Z"))).toBe(
      "public, max-age=0, s-maxage=300",
    );
  });

  it("lets the copy expire at the next release", () => {
    expect(startPageCacheControl(at("2026-12-06T15:58:00+01:00"))).toBe(
      "public, max-age=0, s-maxage=120",
    );
    expect(startPageCacheControl(at("2026-12-06T15:59:59.500+01:00"))).toBe(
      "public, max-age=0, s-maxage=1",
    );
    expect(nextReleaseAt(at("2026-12-06T16:00:00+01:00"))?.toISOString()).toBe(
      "2026-12-09T15:00:00.000Z",
    );
  });
});
