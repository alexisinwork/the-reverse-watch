import { matchRoutes } from "react-router";
import { describe, expect, it } from "vitest";

import routes from "../routes";
import { loader } from "./social-link";

const run = (path: string, episode?: string) =>
  loader({
    request: new Request(`https://thereserve.watch${path}`),
    params: episode === undefined ? {} : { episode },
  } as unknown as Parameters<typeof loader>[0]);
const tags = (response: Response) => {
  const url = new URL(
    response.headers.get("Location")!,
    "https://thereserve.watch",
  );
  return {
    path: url.pathname,
    source: url.searchParams.get("utm_source"),
    medium: url.searchParams.get("utm_medium"),
    campaign: url.searchParams.get("utm_campaign"),
  };
};
const status = (path: string, episode?: string) => {
  try {
    return run(path, episode).status;
  } catch (error) {
    return (error as Response).status;
  }
};

describe("platform short links", () => {
  it("opens an episode's tool from each platform's clip, tagged with that platform", () => {
    expect(tags(run("/tt/35", "35"))).toEqual({
      path: "/watches/alternatives",
      source: "tiktok",
      medium: "short_video",
      campaign: "ep35",
    });
    expect(tags(run("/ig/12", "12"))).toEqual({
      path: "/quiz",
      source: "instagram",
      medium: "short_video",
      campaign: "ep12",
    });
    expect(tags(run("/ys/13", "13"))).toEqual({
      path: "/watches/archetype",
      source: "youtube",
      medium: "shorts",
      campaign: "ep13",
    });
    expect(run("/tt/35", "35").headers.get("Cache-Control")).toContain(
      "s-maxage=",
    );
  });

  it("gives each profile its own bio link", () => {
    // TikTok and Instagram open the profile page (docs/social-landing.md).
    for (const [path, source, page] of [
      ["/yt", "youtube", "/"],
      ["/tt", "tiktok", "/start"],
      ["/ig", "instagram", "/start"],
    ] as const)
      expect(tags(run(path))).toEqual({
        path: page,
        source,
        medium: "social",
        campaign: "bio",
      });
  });

  it("refuses anything else", () => {
    expect(status("/tt/abc", "abc")).toBe(404);
    expect(status("/ys")).toBe(404);
    expect(status("/xx/3", "3")).toBe(404);
  });

  it("is reachable at every address it documents", () => {
    for (const [path, id] of [
      ["/yt", "social-link-yt"],
      ["/tt", "social-link-tt"],
      ["/tt/35", "social-link-tt"],
      ["/ig", "social-link-ig"],
      ["/ig/12", "social-link-ig"],
      ["/ys/13", "social-link-ys"],
    ] as const)
      expect(
        matchRoutes(
          routes as unknown as Parameters<typeof matchRoutes>[0],
          path,
        )?.at(-1)?.route.id,
        path,
      ).toBe(id);
  });
});
