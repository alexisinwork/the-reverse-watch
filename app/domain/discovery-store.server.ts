import {
  findPublishedDiscoveryStory,
  publishedDiscoveryStoryContextSchema,
  publishedDiscoveryStoriesSchema,
} from "./discovery-public";

export const DISCOVERY_PUBLISHED_STORIES_RPC =
  "discovery_published_stories_v1" as const;
export const DISCOVERY_STORY_CONTEXT_RPC =
  "discovery_story_context_v1" as const;

const STORE_TIMEOUT_MS = 2_000;

type StoreOptions = {
  env?: Partial<
    Pick<NodeJS.ProcessEnv, "SUPABASE_URL" | "SUPABASE_PUBLISHABLE_KEY">
  >;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export async function loadPublishedDiscoveryStories({
  env = process.env,
  fetchImpl = fetch,
  timeoutMs = STORE_TIMEOUT_MS,
}: StoreOptions = {}) {
  const supabaseUrl = env.SUPABASE_URL?.trim();
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!supabaseUrl || !publishableKey) return null;

  try {
    const response = await fetchImpl(
      new URL(`/rest/v1/rpc/${DISCOVERY_PUBLISHED_STORIES_RPC}`, supabaseUrl),
      {
        method: "POST",
        headers: {
          apikey: publishableKey,
          "content-type": "application/json",
        },
        body: "{}",
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (!response.ok) return null;
    return (
      publishedDiscoveryStoriesSchema.safeParse(await response.json()).data ??
      null
    );
  } catch {
    return null;
  }
}

export async function loadPublishedDiscoveryStoryContext(
  storySlug: string,
  {
    env = process.env,
    fetchImpl = fetch,
    timeoutMs = STORE_TIMEOUT_MS,
  }: StoreOptions = {},
) {
  const supabaseUrl = env.SUPABASE_URL?.trim();
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (supabaseUrl && publishableKey) {
    try {
      const response = await fetchImpl(
        new URL(`/rest/v1/rpc/${DISCOVERY_STORY_CONTEXT_RPC}`, supabaseUrl),
        {
          method: "POST",
          headers: {
            apikey: publishableKey,
            "content-type": "application/json",
          },
          body: JSON.stringify({ p_story_slug: storySlug }),
          signal: AbortSignal.timeout(timeoutMs),
        },
      );
      if (response.ok) {
        const parsed = publishedDiscoveryStoryContextSchema.safeParse(
          await response.json(),
        );
        if (parsed.success) return parsed.data;
      }
    } catch {
      // The bundled reviewed stories remain the all-or-nothing fallback.
    }
  }
  const story = findPublishedDiscoveryStory(storySlug);
  return story
    ? {
        story,
        traits: {
          socialSignal: null,
          aestheticDna: null,
          deploymentEnvironment: null,
          priceComfort: null,
        },
      }
    : null;
}
