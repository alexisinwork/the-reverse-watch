import {
  DISCOVERY_SEARCH_RPC,
  fallbackDiscoverySearch,
  searchAcceptedDiscoveryRecords,
} from "./discovery-search.server";

const environment = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
};

describe("accepted discovery search", () => {
  it("searches only bounded anchor/query RPC arguments", async () => {
    const payload = [
      {
        anchor: "work",
        slug: "interstellar-2014",
        label: "Interstellar",
        descriptor: "2014 · film",
      },
    ];
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(payload));
    await expect(
      searchAcceptedDiscoveryRecords(
        { anchor: "work", query: "inter" },
        { env: environment, fetchImpl },
      ),
    ).resolves.toEqual(payload);
    const [input, init] = fetchImpl.mock.calls[0]!;
    const url = input instanceof Request ? input.url : input.toString();
    expect(url).toContain(`/rpc/${DISCOVERY_SEARCH_RPC}`);
    expect(JSON.parse(init?.body as string)).toEqual({
      p_anchor: "work",
      p_query: "inter",
    });
  });

  it("uses only canonical reviewed fixture values in its fallback", () => {
    expect(fallbackDiscoverySearch({ anchor: "work", query: "inter" })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slug: "interstellar-2014" }),
      ]),
    );
    expect(
      fallbackDiscoverySearch({ anchor: "public_figure", query: "murph" }),
    ).toEqual([]);
  });
});
