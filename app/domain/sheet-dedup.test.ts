import { describe, expect, it } from "vitest";

import { dedupeSheetRows, isWorkbookArtifact } from "./sheet-dedup";
import type { SheetRow } from "./sheet-intake";

function row(overrides: Partial<SheetRow> & { sourceLine: number }): SheetRow {
  return {
    identity: "Rolex Submariner Date 126610LN Oystersteel",
    referenceCode: "126610LN",
    productUrl: "https://www.rolex.com/en-us/watches/submariner",
    lugToLugMm: 47.6,
    caseThicknessMm: 12.5,
    caseDiameterMm: 41,
    caseShape: "round",
    displayCaseback: false,
    integratedBracelet: false,
    movementType: "automatic",
    movementConstruction: "manufacture",
    caliber: "Cal. 3235",
    waterResistanceM: 300,
    crystal: "sapphire",
    lugWidthMm: 21,
    microAdjustment: { present: true, systemName: "Glidelock", rangeMm: 20 },
    wearingScenarios: ["sport", "office"],
    positioningLine: "мировой эталон дайвера",
    positioningGroup: "instrument",
    complications: ["date", "dive_bezel"],
    priceUsdMinor: 1_440_000,
    nickelContactRisk: "possible",
    ...overrides,
  };
}

describe("isWorkbookArtifact", () => {
  it("detects a needs-research complications cell", () => {
    const cells = Array.from({ length: 19 }, () => "");
    cells[16] = "needs research";
    expect(isWorkbookArtifact(cells)).toBe(true);
  });

  it("detects the seed-catalogue placeholder note", () => {
    const cells = Array.from({ length: 19 }, () => "");
    cells[18] =
      "Нет точного варианта в seed-catalogue; заполнить по первичному источнику";
    expect(isWorkbookArtifact(cells)).toBe(true);
  });

  it("passes a normal row through", () => {
    const cells = Array.from({ length: 19 }, () => "x");
    expect(isWorkbookArtifact(cells)).toBe(false);
  });
});

describe("dedupeSheetRows", () => {
  it("keeps a single row untouched", () => {
    const result = dedupeSheetRows([row({ sourceLine: 2 })]);
    expect(result.accepted).toHaveLength(1);
    expect(result.collapsed).toHaveLength(0);
    expect(result.conflicts).toHaveLength(0);
  });

  it("collapses exact duplicates and records their lines", () => {
    const result = dedupeSheetRows([
      row({ sourceLine: 2 }),
      row({ sourceLine: 40 }),
    ]);
    expect(result.accepted).toHaveLength(1);
    expect(result.collapsed).toEqual([
      { referenceCode: "126610LN", sourceLines: [2, 40] },
    ]);
    expect(result.conflicts).toHaveLength(0);
  });

  it("collapses duplicates that differ only in the identity label", () => {
    const result = dedupeSheetRows([
      row({ sourceLine: 2, identity: "Explorer 124270 steel" }),
      row({ sourceLine: 90, identity: "Rolex Explorer 36 124270 M1 Geometry" }),
    ]);
    expect(result.accepted).toHaveLength(1);
    expect(result.collapsed).toHaveLength(1);
  });

  it("rejects a conflicting duplicate and names the fields", () => {
    const result = dedupeSheetRows([
      row({ sourceLine: 2, priceUsdMinor: 1_440_000 }),
      row({ sourceLine: 55, priceUsdMinor: 1_590_000 }),
    ]);
    expect(result.accepted).toHaveLength(0);
    expect(result.conflicts).toEqual([
      {
        referenceCode: "126610LN",
        sourceLines: [2, 55],
        fields: ["priceUsdMinor"],
      },
    ]);
  });

  it("reports every differing field in a conflict", () => {
    const result = dedupeSheetRows([
      row({ sourceLine: 2 }),
      row({ sourceLine: 55, priceUsdMinor: 1, caseDiameterMm: 40 }),
    ]);
    expect(result.conflicts[0]?.fields).toEqual([
      "caseDiameterMm",
      "priceUsdMinor",
    ]);
  });

  it("keeps distinct references separate", () => {
    const result = dedupeSheetRows([
      row({ sourceLine: 2 }),
      row({ sourceLine: 3, referenceCode: "126610LV" }),
    ]);
    expect(result.accepted).toHaveLength(2);
  });
});
