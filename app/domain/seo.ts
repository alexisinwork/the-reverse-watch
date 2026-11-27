/**
 * Search-engine basics, added before the launch (2026-11-27): one canonical
 * address per page, robots.txt and a sitemap.
 *
 * The same pages also answer at the-reverse-watch.vercel.app. The canonical
 * link on every page names thereserve.watch, so search engines list the
 * site's own domain and not the copy. Preview deployments are kept out of
 * search engines by Vercel itself (it sends `X-Robots-Tag: noindex`).
 */
import { PUBLIC_PAGE_CACHE_CONTROL } from "./cache-policy";

export const CANONICAL_ORIGIN = "https://thereserve.watch";

/** Never indexed: the owner's pages, partner frames, APIs and internal
 * routes. robots.txt lists them; they carry no canonical link. */
export const PRIVATE_PREFIXES = [
  "/admin",
  "/embed",
  "/internal",
  "/api",
  "/analytics",
  "/evaluation",
] as const;

export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** The page's address on the site's own domain, without its query (utm
 * tags, quiz answers) or fragment. Null for a private path. */
export function canonicalUrl(pathname: string): string | null {
  if (isPrivatePath(pathname)) return null;
  const path = pathname.replace(/\/+$/, "") || "/";
  return `${CANONICAL_ORIGIN}${path}`;
}

/** The pages anyone can open without signing up; each answered 200 to an
 * anonymous visitor on 2026-11-27. The diagnostic (/quiz) and the cheaper
 * alternatives need the newsletter subscription and redirect, so they are
 * left out. */
export const SITEMAP_PATHS = [
  "/",
  "/watches",
  "/watches/find",
  "/watches/archetype",
  "/start",
  "/partners",
  "/privacy",
] as const;

type PublishedStory = {
  slug: string;
  entity: { slug: string };
  work: { slug: string } | null;
};

/** The story, person and film pages of the published stories. */
export function storyPaths(stories: readonly PublishedStory[]): string[] {
  return stories.flatMap((story) => [
    `/watches/stories/${story.slug}`,
    `/watches/people/${story.entity.slug}`,
    ...(story.work ? [`/watches/works/${story.work.slug}`] : []),
  ]);
}

export function robotsTxt(): string {
  return [
    "User-agent: *",
    ...PRIVATE_PREFIXES.map((prefix) => `Disallow: ${prefix}`),
    "",
    `Sitemap: ${CANONICAL_ORIGIN}/sitemap.xml`,
    "",
  ].join("\n");
}

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

export function sitemapXml(paths: readonly string[]): string {
  const urls = [...new Set(paths)].map(
    (path) =>
      `  <url><loc>${escapeXml(`${CANONICAL_ORIGIN}${encodeURI(path)}`)}</loc></url>`,
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}

/** Both files look the same to every visitor: the CDN keeps them for an
 * hour, like the public pages. */
export const SEO_FILE_CACHE_CONTROL = PUBLIC_PAGE_CACHE_CONTROL;
