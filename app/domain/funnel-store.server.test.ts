import {
  FUNNEL_EVENT_RPC,
  FUNNEL_SUMMARY_RPC,
  loadFunnelSummary,
  persistFunnelEvent,
} from "./funnel-store.server";

const environment = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  VERCEL_ENV: "production",
};

function fetchUrl(input: string | URL | Request) {
  return input instanceof Request ? input.url : input.toString();
}

function fetchBody(init: RequestInit | undefined) {
  if (typeof init?.body !== "string") {
    throw new TypeError("Expected a JSON request body.");
  }
  return init.body;
}

describe("durable funnel store", () => {
  it("does not write outside the production deployment", async () => {
    const fetchImpl = vi.fn<typeof fetch>();

    await expect(
      persistFunnelEvent(
        { name: "start" },
        { env: { ...environment, VERCEL_ENV: "preview" }, fetchImpl },
      ),
    ).resolves.toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("writes only aggregate evaluation fields through the narrow RPC", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));

    await expect(
      persistFunnelEvent(
        {
          name: "evaluation",
          intent: "core",
          catalogueOrigin: "supabase",
          recommendationCount: 1,
          verificationCount: 2,
          whyNotCount: 3,
          hardFilterViolationCount: 0,
          evaluationDurationMs: 42.5,
          providerCostUsd: 0,
          topRecommendationScore: 29.4,
          meanRecommendationScore: 29.4,
        },
        { env: environment, fetchImpl },
      ),
    ).resolves.toBe(true);

    const [url, init] = fetchImpl.mock.calls[0]!;
    const body = fetchBody(init);
    expect(fetchUrl(url)).toContain(`/rpc/${FUNNEL_EVENT_RPC}`);
    expect(JSON.parse(body)).toEqual({
      p_event_name: "evaluation",
      p_intent: "core",
      p_catalogue_origin: "supabase",
      p_recommendation_count: 1,
      p_verification_count: 2,
      p_why_not_count: 3,
      p_hard_filter_violation_count: 0,
      p_evaluation_duration_ms: 42.5,
      p_provider_cost_usd: 0,
      p_top_recommendation_score: 29.4,
      p_mean_recommendation_score: 29.4,
      p_subscription_status: null,
    });
    expect(body).not.toContain("email");
  });

  it("validates the aggregate summary response", async () => {
    const summary = {
      since: "2026-08-01T00:00:00+00:00",
      until: "2026-09-01T00:00:00+00:00",
      starts: 10,
      coreEvaluations: 5,
      refineEvaluations: 2,
      hardFilterViolations: 0,
      averageEvaluationDurationMs: 45.2,
      providerCostUsd: 0,
      averageTopRecommendationScore: 29.4,
      averageMeanRecommendationScore: 24.1,
      subscriptionStatuses: { sent: 2 },
    };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(summary));

    await expect(
      loadFunnelSummary(summary.since, summary.until, {
        env: environment,
        fetchImpl,
      }),
    ).resolves.toEqual(summary);
    expect(fetchUrl(fetchImpl.mock.calls[0]![0])).toContain(
      `/rpc/${FUNNEL_SUMMARY_RPC}`,
    );
  });
});
