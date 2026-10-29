import { loader } from "./internal-catalogue-recheck-prices";
import {
  defaultDeps,
  loadAiWatchFinderConfig,
} from "../domain/ai-providers.server";
import { catalogueClient } from "../domain/watch-catalogue.server";
import { runPriceRefresh } from "../domain/catalogue-price-refresh.server";

vi.mock("../domain/ai-providers.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../domain/ai-providers.server")>()),
  defaultDeps: vi.fn(),
}));
vi.mock("../domain/watch-catalogue.server", () => ({
  catalogueClient: vi.fn(),
}));
vi.mock("../domain/catalogue-price-refresh.server", () => ({
  priceRefreshServices: vi.fn(),
  runPriceRefresh: vi.fn(),
}));
const secret = "test-secret-123456789";
function request(
  headers: Record<string, string> = { Authorization: `Bearer ${secret}` },
) {
  return {
    request: new Request(
      "https://example.test/internal/catalogue/recheck-prices",
      { headers },
    ),
  } as Parameters<typeof loader>[0];
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", secret);
  vi.mocked(catalogueClient).mockReturnValue({
    config: { supabaseUrl: "https://db.example", serviceKey: "test" },
    fetchImpl: vi.fn(),
  });
  vi.mocked(defaultDeps).mockReturnValue({
    config: loadAiWatchFinderConfig({
      PERPLEXITY_API_KEY: "test",
      MUSE_SPARK_API_KEY: "test",
    }),
    fetchImpl: vi.fn(),
    now: Date.now,
    sleep: async () => {},
    loadFx: async () => null,
  });
  vi.mocked(runPriceRefresh).mockResolvedValue({
    ok: true,
    skipped: true,
    reason: "no_due",
  });
});
describe("metered price cron", () => {
  it("authenticates before touching the budget or providers", async () => {
    const cases: Record<string, string>[] = [
      {},
      { Authorization: "Bearer wrong" },
      { Authorization: `Bearer ${secret}`, Origin: "https://example.test" },
    ];
    for (const headers of cases)
      expect((await loader(request(headers))).status).toBe(401);
    expect(runPriceRefresh).not.toHaveBeenCalled();
    expect(catalogueClient).not.toHaveBeenCalled();
  });
  it("returns an explicit empty daily batch without uncapped legacy calls", async () => {
    const response = await loader(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      ok: true,
      skipped: true,
      reason: "no_due",
    });
    expect(runPriceRefresh).toHaveBeenCalledTimes(1);
  });
  it("fails before admission if the second provider is missing", async () => {
    vi.mocked(defaultDeps).mockReturnValue({
      config: loadAiWatchFinderConfig({ PERPLEXITY_API_KEY: "test" }),
      fetchImpl: vi.fn(),
      now: Date.now,
      sleep: async () => {},
      loadFx: async () => null,
    });
    expect((await loader(request())).status).toBe(503);
    expect(runPriceRefresh).not.toHaveBeenCalled();
  });
  it("reports database failures without logging upstream bodies", async () => {
    vi.mocked(runPriceRefresh).mockRejectedValue(
      new Error("private upstream body"),
    );
    const response = await loader(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private upstream body");
  });
});
