import { action } from "./internal-discovery-research-run";

describe("internal discovery research worker route", () => {
  it("fails closed when worker configuration is absent", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("PERPLEXITY_API_KEY", "");
    vi.stubEnv("DISCOVERY_RESEARCH_WORKER_SECRET", "");
    vi.stubEnv("DISCOVERY_RESEARCH_MAX_JOBS_PER_RUN", "");
    vi.stubEnv("DISCOVERY_RESEARCH_MAX_OUTPUT_TOKENS", "");
    vi.stubEnv("DISCOVERY_RESEARCH_DAILY_COST_USD", "");
    const response = await action({
      request: new Request(
        "https://example.test/internal/discovery-research/run",
        {
          method: "POST",
        },
      ),
    } as Parameters<typeof action>[0]);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      reason: "worker_not_configured",
    });
  });

  it("does not reveal whether a configured worker secret is correct", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
    vi.stubEnv("PERPLEXITY_API_KEY", "provider-key");
    vi.stubEnv("DISCOVERY_RESEARCH_WORKER_SECRET", "worker-secret");
    vi.stubEnv("DISCOVERY_RESEARCH_MAX_JOBS_PER_RUN", "1");
    vi.stubEnv("DISCOVERY_RESEARCH_MAX_OUTPUT_TOKENS", "2000");
    vi.stubEnv("DISCOVERY_RESEARCH_DAILY_COST_USD", "1");
    const response = await action({
      request: new Request(
        "https://example.test/internal/discovery-research/run",
        {
          method: "POST",
          headers: { Authorization: "Bearer wrong" },
        },
      ),
    } as Parameters<typeof action>[0]);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ ok: false });
  });
});
