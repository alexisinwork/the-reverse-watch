import { z } from "zod";

import { listPublishedDiscoveryStories } from "./discovery-public";
import { normalizeDiscoveryTopic } from "./discovery-selection";
import type { discoverySearchSchema } from "./discovery-selection";

export const DISCOVERY_SEARCH_RPC = "discovery_search_v1" as const;
const STORE_TIMEOUT_MS = 2_000;

export const discoverySearchResultSchema = z
  .object({
    anchor: z.enum(["work", "public_figure", "character"]),
    slug: z.string().min(1),
    label: z.string().min(1),
    descriptor: z.string().nullable(),
  })
  .strict();
const discoverySearchResultsSchema = z
  .array(discoverySearchResultSchema)
  .max(12);

type Search = z.infer<typeof discoverySearchSchema>;
type SearchOptions = {
  env?: Partial<
    Pick<NodeJS.ProcessEnv, "SUPABASE_URL" | "SUPABASE_PUBLISHABLE_KEY">
  >;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export function fallbackDiscoverySearch({ anchor, query }: Search) {
  const normalizedQuery = normalizeDiscoveryTopic(query);
  const results = new Map<
    string,
    z.infer<typeof discoverySearchResultSchema>
  >();
  for (const story of listPublishedDiscoveryStories()) {
    if (anchor === "work" && story.work) {
      const matches = normalizeDiscoveryTopic(story.work.title).includes(
        normalizedQuery,
      );
      if (matches) {
        results.set(story.work.slug, {
          anchor,
          slug: story.work.slug,
          label: story.work.title,
          descriptor: [
            story.work.releaseDate?.slice(0, 4),
            story.work.kind.replaceAll("_", " "),
          ]
            .filter(Boolean)
            .join(" · "),
        });
      }
    }
    const entityKind =
      anchor === "character" ? "fictional_character" : "public_figure";
    if (anchor !== "work" && story.entity.kind === entityKind) {
      if (
        normalizeDiscoveryTopic(story.entity.name).includes(normalizedQuery)
      ) {
        results.set(story.entity.slug, {
          anchor,
          slug: story.entity.slug,
          label: story.entity.name,
          descriptor:
            anchor === "character"
              ? [story.work?.title, story.work?.releaseDate?.slice(0, 4)]
                  .filter(Boolean)
                  .join(" · ") || null
              : story.entity.disambiguation,
        });
      }
    }
  }
  return [...results.values()]
    .sort((left, right) => left.label.localeCompare(right.label))
    .slice(0, 12);
}

export async function searchAcceptedDiscoveryRecords(
  search: Search,
  {
    env = process.env,
    fetchImpl = fetch,
    timeoutMs = STORE_TIMEOUT_MS,
  }: SearchOptions = {},
) {
  const supabaseUrl = env.SUPABASE_URL?.trim();
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!supabaseUrl || !publishableKey) return null;
  try {
    const response = await fetchImpl(
      new URL(`/rest/v1/rpc/${DISCOVERY_SEARCH_RPC}`, supabaseUrl),
      {
        method: "POST",
        headers: { apikey: publishableKey, "content-type": "application/json" },
        body: JSON.stringify({
          p_anchor: search.anchor,
          p_query: search.query,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (!response.ok) return null;
    return (
      discoverySearchResultsSchema.safeParse(await response.json()).data ?? null
    );
  } catch {
    return null;
  }
}
