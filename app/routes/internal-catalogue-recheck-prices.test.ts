import { loader } from "./internal-catalogue-recheck-prices";

describe("catalogue price refresh budget guard", () => {
  it("stops authorized legacy refresh before any provider call", async () => {
    vi.stubEnv("CRON_SECRET", "test-secret-123456789");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await loader({
      request: new Request(
        "https://example.test/internal/catalogue/recheck-prices",
        { headers: { Authorization: "Bearer test-secret-123456789" } },
      ),
    } as Parameters<typeof loader>[0]);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      skipped: true,
      reason: "legacy_paid_research_paused",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
