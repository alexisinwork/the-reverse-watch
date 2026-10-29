import { describe, expect, it, vi } from "vitest";
import { operationsHealth } from "./operations-health.server";
const token = "operations-test-token-with-32-characters";
const environment = {
  OPERATIONS_TOKEN: token,
  ADMIN_PASSWORD: "test-admin-password",
  SESSION_SECRET: "test-session-secret-at-least-32-characters",
  MUSE_SPARK_API_KEY: "test",
  PERPLEXITY_API_KEY: "test",
  UPSTASH_REDIS_REST_URL: "https://redis.example",
  UPSTASH_REDIS_REST_TOKEN: "test",
  BEEHIIV_API_KEY: "test",
  BEEHIIV_PUBLICATION_ID: "pub_test",
  SENTRY_DSN: "configured",
};
const healthy = {
  catalogueAvailable: true,
  validationContractReady: true,
  tableAccessProtected: true,
  analyticsAccessProtected: true,
  priceRefreshContractReady: true,
  priceRefreshLastRunAt: "2026-10-29T00:00:00Z",
  priceRefreshOverdue: false,
  staleReservations: 0,
  stalePricesPresent: false,
  budget: { halted: false, remainingUsd: 99 },
};
function fixture(body: unknown = healthy) {
  const fetchImpl = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json(body));
  return {
    fetchImpl,
    client: {
      config: { supabaseUrl: "https://db.example", serviceKey: "test" },
      fetchImpl,
    },
  };
}
const request = (headers: Record<string, string> = {}) =>
  new Request("https://example.test/internal/operations/health", { headers });
describe("operations readiness", () => {
  it("rejects missing/wrong/browser credentials before accessing the database", async () => {
    const { client, fetchImpl } = fixture();
    const cases: Record<string, string>[] = [
      {},
      { authorization: "Bearer wrong" },
      { authorization: `Bearer ${token}`, origin: "https://example.test" },
    ];
    for (const headers of cases)
      expect(
        (await operationsHealth(request(headers), { client, environment }))
          .status,
      ).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("requires the independently configured operations token", async () => {
    const { client, fetchImpl } = fixture();
    expect(
      (await operationsHealth(request(), { client, environment: {} })).status,
    ).toBe(503);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("checks real dependencies without exposing credentials or calling providers", async () => {
    const { client, fetchImpl } = fixture();
    const response = await operationsHealth(
      request({ authorization: `Bearer ${token}` }),
      { client, environment },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const text = await response.text();
    expect(text).not.toContain(token);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain(
      "application_readiness_v3",
    );
  });
  it.each([
    { ...healthy, staleReservations: 1 },
    { ...healthy, validationContractReady: false },
    { ...healthy, analyticsAccessProtected: false },
    { ...healthy, priceRefreshContractReady: false },
    { ...healthy, priceRefreshOverdue: true },
    { ...healthy, budget: { halted: true, remainingUsd: 99 } },
  ])("signals failed dependencies and stuck/halted research", async (body) => {
    const { client } = fixture(body);
    expect(
      (
        await operationsHealth(request({ authorization: `Bearer ${token}` }), {
          client,
          environment,
        })
      ).status,
    ).toBe(503);
  });
  it("keeps the free service ready when the normal monthly paid allowance is exhausted", async () => {
    const { client } = fixture({
      ...healthy,
      budget: { halted: false, remainingUsd: 0 },
      priceRefreshOverdue: true,
    });
    const response = await operationsHealth(
      request({ authorization: `Bearer ${token}` }),
      { client, environment },
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("monthly_research_limit_reached");
  });
});
