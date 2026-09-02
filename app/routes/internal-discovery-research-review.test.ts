import { action } from "./internal-discovery-research-review";

describe("internal discovery review route", () => {
  it("stays disabled until the review secret and service credential exist", async () => {
    const response = await action({
      request: new Request(
        "https://example.com/internal/discovery-research/review",
        {
          method: "POST",
          body: "{}",
        },
      ),
      params: {},
      context: undefined,
    } as unknown as Parameters<typeof action>[0]);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      reason: "review_not_configured",
    });
  });

  it("rejects unauthenticated review requests", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
    vi.stubEnv("DISCOVERY_RESEARCH_REVIEW_SECRET", "review-secret");
    const response = await action({
      request: new Request(
        "https://example.com/internal/discovery-research/review",
        {
          method: "POST",
          body: JSON.stringify({ candidateId: 1, decision: "rejected" }),
        },
      ),
      params: {},
      context: undefined,
    } as unknown as Parameters<typeof action>[0]);
    expect(response.status).toBe(401);
  });
});
