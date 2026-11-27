import { describe, expect, it } from "vitest";

import { listPublishedDiscoveryStories } from "./discovery-public";
import {
  canonicalUrl,
  robotsTxt,
  SITEMAP_PATHS,
  sitemapXml,
  storyPaths,
} from "./seo";

describe("canonicalUrl", () => {
  it("names the site's own domain without the query", () => {
    expect(canonicalUrl("/")).toBe("https://thereserve.watch/");
    expect(canonicalUrl("/watches/find")).toBe(
      "https://thereserve.watch/watches/find",
    );
    expect(canonicalUrl("/watches/find/")).toBe(
      "https://thereserve.watch/watches/find",
    );
  });

  it("gives private pages no canonical link", () => {
    for (const path of [
      "/admin",
      "/admin/catalogue",
      "/embed/pk_x/quiz",
      "/internal/spend-alert",
      "/api/v1/quiz",
      "/analytics/interactions",
      "/evaluation",
    ]) {
      expect(canonicalUrl(path)).toBeNull();
    }
    // Only whole path segments count.
    expect(canonicalUrl("/administrator")).toBe(
      "https://thereserve.watch/administrator",
    );
  });
});

describe("robotsTxt", () => {
  it("keeps crawlers out of private paths and names the sitemap", () => {
    const text = robotsTxt();
    expect(text).toContain("User-agent: *");
    expect(text).toContain("Disallow: /admin\n");
    expect(text).toContain("Disallow: /embed\n");
    expect(text).toContain("Disallow: /api\n");
    expect(text).not.toMatch(/Disallow: \/\n/);
    expect(text).toContain("Sitemap: https://thereserve.watch/sitemap.xml");
  });
});

describe("sitemapXml", () => {
  it("lists every public page and story page once, escaped", () => {
    const stories = listPublishedDiscoveryStories();
    const paths = [...SITEMAP_PATHS, ...storyPaths(stories), "/"];
    const xml = sitemapXml(paths);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(
      xml.match(/<loc>https:\/\/thereserve\.watch\/<\/loc>/g),
    ).toHaveLength(1);
    expect(xml).toContain("<loc>https://thereserve.watch/watches/find</loc>");
    expect(xml).not.toContain("/quiz<");
    expect(sitemapXml(["/a&b"])).toContain(
      "<loc>https://thereserve.watch/a&amp;b</loc>",
    );
  });

  it("adds the person and film pages of a story", () => {
    expect(
      storyPaths([
        { slug: "s", entity: { slug: "p" }, work: { slug: "w" } },
        { slug: "t", entity: { slug: "q" }, work: null },
      ]),
    ).toEqual([
      "/watches/stories/s",
      "/watches/people/p",
      "/watches/works/w",
      "/watches/stories/t",
      "/watches/people/q",
    ]);
  });
});
