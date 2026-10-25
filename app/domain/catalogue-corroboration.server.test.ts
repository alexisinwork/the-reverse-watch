import { describe, expect, it, vi } from "vitest";
import {
  checkDialsReference,
  compareCatalogueFacts,
} from "./catalogue-corroboration.server";
describe("secondary specification corroboration", () => {
  it("does not match a truncated reference suffix", async () => {
    const mock = vi.fn().mockResolvedValue(
      Response.json({
        data: [
          {
            id: "one",
            slug: "spb153",
            referenceNumber: "SPB153",
            brand: { name: "Seiko", slug: "seiko" },
          },
        ],
      }),
    );
    expect(
      (
        await checkDialsReference(
          { brand: "Seiko", referenceCode: "SPB153J1" },
          mock,
        )
      ).status,
    ).toBe("not_found");
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it("reports conflict without replacing cached facts or treating missing facts as agreement", () => {
    const current = {
      caseDiameterMm: 42,
      caseThicknessMm: null,
      waterResistanceM: 200,
      movement: "automatic" as const,
    };
    const result = compareCatalogueFacts(current, {
      caseDiameterMm: 41,
      waterResistanceM: 200,
      movement: "automatic",
    });
    expect(result.status).toBe("conflict");
    expect(result.conflicts[0]?.field).toBe("caseDiameterMm");
    expect(result.unknown).toContain("caseThicknessMm");
    expect(current.caseDiameterMm).toBe(42);
  });
});
