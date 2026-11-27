import { listPublishedDiscoveryStories } from "../domain/discovery-public";
import { loadPublishedDiscoveryStories } from "../domain/discovery-store.server";
import {
  SEO_FILE_CACHE_CONTROL,
  SITEMAP_PATHS,
  sitemapXml,
  storyPaths,
} from "../domain/seo";

export async function loader() {
  // The database's published stories, or the bundled list when it does not
  // answer (the same fallback as /api/v1/stories).
  const stories =
    (await loadPublishedDiscoveryStories()) ?? listPublishedDiscoveryStories();
  return new Response(sitemapXml([...SITEMAP_PATHS, ...storyPaths(stories)]), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": SEO_FILE_CACHE_CONTROL,
    },
  });
}
