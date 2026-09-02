import {
  DISCOVERY_RESEARCH_ENQUEUE_RPC,
  DISCOVERY_RESEARCH_STATUS_RPC,
  enqueueDiscoveryResearch,
  loadDiscoveryResearchStatus,
} from "./discovery-research-store.server";

const environment = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
};

function requestBody(init: RequestInit | undefined) {
  if (typeof init?.body !== "string") throw new TypeError("Expected JSON body");
  return JSON.parse(init.body) as Record<string, unknown>;
}

function requestUrl(input: string | URL | Request) {
  return input instanceof Request ? input.url : input.toString();
}

describe("discovery research store", () => {
  it("uses the bounded enqueue RPC and never sends identity fields", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        token: "a".repeat(48),
        status: "queued",
      }),
    );

    await expect(
      enqueueDiscoveryResearch(
        { anchor: "work", displayText: "Arrival", releaseYear: 2016 },
        { env: environment, fetchImpl },
      ),
    ).resolves.toEqual({ token: "a".repeat(48), status: "queued" });

    const [input, init] = fetchImpl.mock.calls[0]!;
    expect(requestUrl(input)).toContain(
      `/rpc/${DISCOVERY_RESEARCH_ENQUEUE_RPC}`,
    );
    expect(requestBody(init)).toEqual({
      p_anchor_kind: "work",
      p_display_text: "Arrival",
      p_release_year: 2016,
    });
    expect(JSON.stringify(requestBody(init))).not.toMatch(
      /email|profile|ip|user/i,
    );
  });

  it("rejects URLs before contacting Supabase", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(
      enqueueDiscoveryResearch(
        {
          anchor: "work",
          displayText: "https://example.test",
          releaseYear: null,
        },
        { env: environment, fetchImpl },
      ),
    ).rejects.toThrow(/URL/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns only the allowlisted status from the opaque status RPC", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ status: "review_pending" }));
    await expect(
      loadDiscoveryResearchStatus("b".repeat(48), {
        env: environment,
        fetchImpl,
      }),
    ).resolves.toEqual({ status: "review_pending" });
    expect(requestUrl(fetchImpl.mock.calls[0]![0])).toContain(
      `/rpc/${DISCOVERY_RESEARCH_STATUS_RPC}`,
    );
    expect(requestBody(fetchImpl.mock.calls[0]![1])).toEqual({
      p_token: "b".repeat(48),
    });
  });
});
