import {
  DISCOVERY_FUNNEL_EVENT_RPC,
  DISCOVERY_FUNNEL_SUMMARY_RPC,
  loadDiscoveryFunnelSummary,
  persistDiscoveryFunnelEvent,
} from "./discovery-funnel-store.server";

const environment = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  VERCEL_ENV: "production",
};

function requestBody(init: RequestInit | undefined) {
  if (typeof init?.body !== "string") throw new TypeError("Expected JSON body");
  return JSON.parse(init.body) as unknown;
}

function requestUrl(input: string | URL | Request) {
  return input instanceof Request ? input.url : input.toString();
}

describe("discovery funnel store", () => {
  it("writes only allowlisted aggregate dimensions through the narrow RPC", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));

    await expect(
      persistDiscoveryFunnelEvent(
        {
          name: "archetype_completion",
          archetypeId: "quiet_custodian",
        },
        { env: environment, fetchImpl },
      ),
    ).resolves.toBe(true);

    const [input, init] = fetchImpl.mock.calls[0]!;
    expect(requestUrl(input)).toContain(`/rpc/${DISCOVERY_FUNNEL_EVENT_RPC}`);
    expect(requestBody(init)).toEqual({
      p_event_name: "archetype_completion",
      p_surface: null,
      p_archetype_id: "quiet_custodian",
    });
    expect(JSON.stringify(requestBody(init))).not.toMatch(
      /email|url|answer|ip/i,
    );
  });

  it("does not persist client events outside production", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(
      persistDiscoveryFunnelEvent(
        { name: "archetype_start" },
        { env: { ...environment, VERCEL_ENV: "preview" }, fetchImpl },
      ),
    ).resolves.toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("strictly validates the bounded summary", async () => {
    const summary = {
      since: "2026-08-01T00:00:00+00:00",
      until: "2026-09-01T00:00:00+00:00",
      pageViews: 120,
      pageViewsBySurface: { index: 60, story: 60 },
      archetypeStarts: 40,
      archetypeCompletions: 30,
      shares: 6,
      coreHandoffs: 12,
      qualifiedRecommendations: 5,
      optIns: 2,
      outboundMarketClicks: 0,
      archetypeCompletionsByType: { quiet_custodian: 30 },
    };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(summary));

    await expect(
      loadDiscoveryFunnelSummary(summary.since, summary.until, {
        env: environment,
        fetchImpl,
      }),
    ).resolves.toEqual(summary);
    expect(requestUrl(fetchImpl.mock.calls[0]![0])).toContain(
      `/rpc/${DISCOVERY_FUNNEL_SUMMARY_RPC}`,
    );
  });
});
