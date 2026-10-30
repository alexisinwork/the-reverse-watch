import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  run: vi.fn(),
  meter: vi.fn(),
  resolve: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("./watch-catalogue.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./watch-catalogue.server")>()),
  catalogueClient: () => ({
    config: { supabaseUrl: "https://db.test", serviceKey: "test" },
    fetchImpl: fetch,
  }),
  loadCatalogueCached: mocks.load,
  rpc: mocks.rpc,
}));
vi.mock("./alternatives.server", () => ({
  findAlternatives: mocks.run,
  resolveNamedWatch: mocks.resolve,
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
  it("explains an incomplete explicit target before metering or claiming no matches", async () => {
    mocks.load.mockResolvedValueOnce([]);
    mocks.rpc.mockResolvedValueOnce([]);
    mocks.resolve.mockReturnValueOnce({
      status: "found",
      watch: {
        brand: "Rolex",
        model: "Submariner",
        referenceCode: "93153",
        styles: [],
      },
    });
    const result = await startAlternativesSearch(
      readAlternativesForm(
        new URLSearchParams({
          name: "Rolex Submariner",
          ref: "93153",
          mode: "range",
          range: "1000_2000",
          currency: "USD",
          quartz: "no",
        }),
      ),
      { rateKey: "incomplete-target" },
    );
    expect(result).toMatchObject({
      kind: "error",
      code: "unavailable",
      error: expect.stringContaining(
        "comparison specifications are incomplete",
      ),
    });
    expect(mocks.meter).not.toHaveBeenCalled();
    expect(mocks.run).not.toHaveBeenCalled();
  });
});
