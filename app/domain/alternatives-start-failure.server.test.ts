import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  run: vi.fn(),
  meter: vi.fn(),
}));
vi.mock("./watch-catalogue.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./watch-catalogue.server")>()),
  catalogueClient: () => ({
    config: { supabaseUrl: "https://db.test", serviceKey: "test" },
    fetchImpl: fetch,
  }),
  loadCatalogueCached: mocks.load,
}));
vi.mock("./alternatives.server", () => ({
  findAlternatives: mocks.run,
  resolveNamedWatch: vi.fn(),
}));
vi.mock("./partner-embed.server", () => ({ meterPartnerUse: mocks.meter }));
import {
  startAlternativesSearch,
  readAlternativesForm,
} from "./alternatives-search.server";
describe("alternatives catalogue failure", () => {
  it("returns a recoverable error before metering or paid research", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.load.mockRejectedValueOnce(new Error("database timeout"));
    const form = readAlternativesForm(
      new URLSearchParams({
        name: "Tudor Black Bay Fifty Eight",
        ref: "M79030N-0001",
        mode: "exact",
        amount: "2000",
        currency: "USD",
        quartz: "no",
      }),
    );
    await expect(
      startAlternativesSearch(form, { rateKey: "test" }),
    ).resolves.toMatchObject({
      kind: "error",
      code: "unavailable",
      error: expect.stringContaining("try again"),
    });
    expect(mocks.meter).not.toHaveBeenCalled();
    expect(mocks.run).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
