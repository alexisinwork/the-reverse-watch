import { listPublishedDiscoveryStories } from "./discovery-public";
import {
  DISCOVERY_PUBLISHED_STORIES_RPC,
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
});
