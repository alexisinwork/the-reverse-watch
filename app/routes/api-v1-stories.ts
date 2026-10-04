/**
 * GET /api/v1/stories — the published, reviewed film and celebrity watch
 * stories; GET /api/v1/stories/:slug — one story with its sources.
 */
import type { Route } from "./+types/api-v1-stories";
import {
  findPublishedDiscoveryStory,
  listPublishedDiscoveryStories,
} from "../domain/discovery-public";
import type { PublishedDiscoveryStory } from "../domain/discovery-public";
import { loadPublishedDiscoveryStories } from "../domain/discovery-store.server";
import {
  apiCallAllowed,
  apiError,
  apiJson,
  apiPreflight,
  authenticateApiRequest,
} from "../domain/partner-api.server";
import { meterPartnerUse } from "../domain/partner-embed.server";
import type { RateLimitPolicy } from "../domain/rate-limit.server";

const VISITOR_POLICY: RateLimitPolicy = {
  configured: true,
  maxRequests: 120,
  windowMs: 10 * 60 * 1_000,
};

/** Sources are named, not linked (owner decision), here as on the site. */
function publicStory(story: PublishedDiscoveryStory) {
  return {
    ...story,
    citations: story.citations.map((citation) => ({
      title: citation.title,
      publisher: citation.publisher,
    })),
  };
}

export async function loader({ request, params }: Route.LoaderArgs) {
  if (request.method === "OPTIONS") return apiPreflight(request);
  const caller = await authenticateApiRequest(request);
  if (caller instanceof Response) return caller;
  const { origin } = caller;
  if (!(await apiCallAllowed(caller, "stories", request, VISITOR_POLICY))) {
    return apiError(
      429,
      "rate_limited",
      "Too many requests in a short time. Try again in a few minutes.",
      origin,
    );
  }

  const stories =
    (await loadPublishedDiscoveryStories()) ?? listPublishedDiscoveryStories();
  // Stories cost nothing to serve: counted, never refused.
  await meterPartnerUse(caller.site, "stories");
  if (params.storySlug) {
    const story =
      stories.find((entry) => entry.slug === params.storySlug) ??
      findPublishedDiscoveryStory(params.storySlug);
    return story
      ? apiJson({ story: publicStory(story) }, 200, origin)
      : apiError(404, "not_found", "No published story has that slug.", origin);
  }
  return apiJson({ stories: stories.map(publicStory) }, 200, origin);
}
