import { describe, expect, it } from "vitest";

import {
  episodeDestination,
  episodeLinkList,
  isSitePath,
} from "../domain/episode-links";
import { loader } from "./episode-link";

const run = (episode: string) =>
  loader({ params: { episode } } as unknown as Parameters<typeof loader>[0]);

describe("episode short links", () => {
  it("redirects a known episode with its campaign tags", () => {
    const response = run("35");
    expect(response.status).toBe(302);
    const location = response.headers.get("Location")!;
    const url = new URL(location, "https://thereserve.watch");
    expect(url.pathname).toBe("/");
    expect(url.searchParams.get("utm_source")).toBe("youtube");
    expect(url.searchParams.get("utm_medium")).toBe("video");
    expect(url.searchParams.get("utm_campaign")).toBe("ep35");
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=");
  });

  it("sends an unknown episode home, still tagged", () => {
    expect(episodeDestination("512")).toBe(
      "/?utm_source=youtube&utm_medium=video&utm_campaign=ep512",
    );
  });

  it("refuses anything that is not an episode number", () => {
    for (const value of ["0", "abc", "1000", "-1", "3.5", ""]) {
      expect(episodeDestination(value)).toBeNull();
    }
    let status = 0;
    try {
      run("abc");
    } catch (error) {
      status = (error as Response).status;
    }
    expect(status).toBe(404);
  });

  it("never leads to another website", () => {
    for (const target of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "/ok\r\nLocation: x",
    ]) {
      expect(isSitePath(target)).toBe(false);
    }
    expect(isSitePath("/watches/find?q=Heat&type=movie")).toBe(true);
    // Every configured target is a path on this site.
    for (const link of episodeLinkList()) {
      expect(isSitePath(link.target)).toBe(true);
    }
  });

  it("covers episodes 1 to 80", () => {
    const episodes = episodeLinkList().map((link) => link.episode);
    for (let episode = 1; episode <= 80; episode++) {
      expect(episodes).toContain(episode);
    }
  });
});
