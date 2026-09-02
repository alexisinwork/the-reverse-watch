import {
  findPublishedDiscoveryStory,
  listPublishedDiscoveryStories,
} from "./discovery-public";
import {
  DISCOVERY_PUBLISHED_STORIES_RPC,
  DISCOVERY_STORY_CONTEXT_RPC,
  loadPublishedDiscoveryStoryContext,
  loadPublishedDiscoveryStories,
} from "./discovery-store.server";

const environment = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
};

describe("published discovery store", () => {
  it("reads only the narrow published-story RPC", async () => {
    const stories = listPublishedDiscoveryStories();
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(stories));

    await expect(
      loadPublishedDiscoveryStories({ env: environment, fetchImpl }),
    ).resolves.toEqual(stories);

    const [input, init] = fetchImpl.mock.calls[0]!;
    const requestUrl = input instanceof Request ? input.url : input.toString();
    expect(requestUrl).toContain(`/rpc/${DISCOVERY_PUBLISHED_STORIES_RPC}`);
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe("{}");
  });

  it("fails closed to the caller when configuration or a response is invalid", async () => {
    await expect(loadPublishedDiscoveryStories()).resolves.toBeNull();
    await expect(
      loadPublishedDiscoveryStories({
        env: environment,
        fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(Response.json([])),
      }),
    ).resolves.toEqual([]);
    await expect(
      loadPublishedDiscoveryStories({
        env: environment,
        fetchImpl: vi
          .fn<typeof fetch>()
          .mockResolvedValue(Response.json([{ slug: "forged" }])),
      }),
    ).resolves.toBeNull();
  });

  it("accepts only a schema-valid published story context", async () => {
    const story = findPublishedDiscoveryStory("don-draper-mad-men-omega");
    expect(story).not.toBeNull();
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        story,
        traits: {
          socialSignal: "discreet_competence",
          aestheticDna: "structural_tool",
          deploymentEnvironment: null,
          priceComfort: null,
        },
      }),
    );

    await expect(
      loadPublishedDiscoveryStoryContext("don-draper-mad-men-omega", {
        env: environment,
        fetchImpl,
      }),
    ).resolves.toMatchObject({
      story: { slug: "don-draper-mad-men-omega" },
      traits: {
        socialSignal: "discreet_competence",
        aestheticDna: "structural_tool",
      },
    });

    const [input, init] = fetchImpl.mock.calls[0]!;
    const requestUrl = input instanceof Request ? input.url : input.toString();
    expect(requestUrl).toContain(`/rpc/${DISCOVERY_STORY_CONTEXT_RPC}`);
    expect(init?.body).toBe(
      JSON.stringify({ p_story_slug: "don-draper-mad-men-omega" }),
    );
  });

  it("falls back to the bundled reviewed corpus without inventing traits", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("unavailable", { status: 503 }));

    await expect(
      loadPublishedDiscoveryStoryContext("don-draper-mad-men-omega", {
        env: environment,
        fetchImpl,
      }),
    ).resolves.toMatchObject({
      story: { slug: "don-draper-mad-men-omega" },
      traits: {
        socialSignal: null,
        aestheticDna: null,
        deploymentEnvironment: null,
        priceComfort: null,
      },
    });
    await expect(
      loadPublishedDiscoveryStoryContext("unpublished-story", {
        env: environment,
        fetchImpl,
      }),
    ).resolves.toBeNull();
  });
});
