import { describe, expect, it } from "vitest";

import {
  parseAllergyRisk,
  parseCaseShape,
  parseMicroAdjustment,
  parseMovementConstruction,
  parsePriceUsdMinor,
  parseSheetRow,
  parseWaterResistanceM,
  parseYesNo,
} from "./sheet-intake";

describe("parseMicroAdjustment", () => {
  it("parses a present system with a range", () => {
    expect(parseMicroAdjustment("Easylink (+5 мм)")).toEqual({
      present: true,
      systemName: "Easylink",
      rangeMm: 5,
    });
  });

  it("parses a range expressed as an upper bound", () => {
    expect(parseMicroAdjustment("Glidelock (до 20 мм)")).toEqual({
      present: true,
      systemName: "Glidelock",
      rangeMm: 20,
    });
  });

  it("parses a compound system with no numeric range", () => {
    expect(parseMicroAdjustment("Glidelock + Fliplock")).toEqual({
      present: true,
      systemName: "Glidelock + Fliplock",
      rangeMm: null,
    });
  });

  it("parses an absent system and keeps its clasp name", () => {
    expect(parseMicroAdjustment("нет (Crownclasp)")).toEqual({
      present: false,
      systemName: "Crownclasp",
      rangeMm: null,
    });
  });

  it("parses a bare absence", () => {
    expect(parseMicroAdjustment("нет (пряжка)")).toEqual({
      present: false,
      systemName: "пряжка",
      rangeMm: null,
    });
  });
});

describe("parseWaterResistanceM", () => {
  it("parses a metric depth", () => {
    expect(parseWaterResistanceM("100 м")).toBe(100);
    expect(parseWaterResistanceM("1220 м")).toBe(1220);
  });

  it("returns null for an unparseable cell", () => {
    expect(parseWaterResistanceM("")).toBeNull();
    expect(parseWaterResistanceM("нет данных")).toBeNull();
  });
});

describe("parseCaseShape", () => {
  it("parses a plain round case", () => {
    expect(parseCaseShape("круглая")).toEqual({
      shape: "round",
      integratedHint: false,
    });
  });

  it("parses a round case with an integrated marker", () => {
    expect(parseCaseShape("круглая (интегрир.)")).toEqual({
      shape: "round",
      integratedHint: true,
    });
  });

  it("returns a null shape for an unknown value", () => {
    expect(parseCaseShape("неизвестная")).toEqual({
      shape: null,
      integratedHint: false,
    });
  });
});

describe("parseMovementConstruction", () => {
  it("splits construction from the caliber", () => {
    expect(parseMovementConstruction("мануфактурный (Cal. 7135)")).toEqual({
      construction: "manufacture",
      caliber: "Cal. 7135",
    });
  });

  it("parses construction with no caliber", () => {
    expect(parseMovementConstruction("мануфактурный")).toEqual({
      construction: "manufacture",
      caliber: null,
    });
  });

  it("parses mass-produced construction", () => {
    expect(parseMovementConstruction("массовый (ETA 2824-2)")).toEqual({
      construction: "mass_produced",
      caliber: "ETA 2824-2",
    });
  });

  it("returns nulls for an unrecognised cell", () => {
    expect(parseMovementConstruction("")).toEqual({
      construction: null,
      caliber: null,
    });
  });
});

describe("parsePriceUsdMinor", () => {
  it("parses a formatted dollar amount into minor units", () => {
    expect(parsePriceUsdMinor("$16,500")).toBe(1_650_000);
  });

  it("parses an amount with no separators", () => {
    expect(parsePriceUsdMinor("$450000")).toBe(45_000_000);
  });

  it("returns null for an empty cell", () => {
    expect(parsePriceUsdMinor("")).toBeNull();
  });
});

describe("parseAllergyRisk", () => {
  it("maps TRUE to a possible nickel contact risk", () => {
    expect(parseAllergyRisk("TRUE")).toBe("possible");
  });

  it("maps FALSE to no known risk", () => {
    expect(parseAllergyRisk("FALSE")).toBe("none_known");
  });

  it("returns null when the cell is blank", () => {
    expect(parseAllergyRisk("")).toBeNull();
  });
});

describe("parseYesNo", () => {
  it("parses Russian affirmatives and negatives", () => {
    expect(parseYesNo("да")).toBe(true);
    expect(parseYesNo("нет")).toBe(false);
    expect(parseYesNo("")).toBeNull();
  });
});

const LAND_DWELLER = [
  "Rolex Land-Dweller 40 White Rolesor M127334-0001",
  "https://www.rolex.com/watches/land-dweller",
  "47.4",
  "10.5",
  "40",
  "круглая (интегрир.)",
  "да",
  "да",
  "automatic",
  "мануфактурный (Cal. 7135)",
  "100 м",
  "сапфир",
  "21",
  "Easylink (+5 мм)",
  "офис / спорт-шик / smart casual",
  "авангардный флагман с открытым калибром",
  "Дата",
  "$16,500",
  "TRUE",
];

describe("parseSheetRow", () => {
  it("parses a complete row", () => {
    const result = parseSheetRow(LAND_DWELLER, 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.referenceCode).toBe("127334-0001");
    expect(result.row.caseDiameterMm).toBe(40);
    expect(result.row.caseShape).toBe("round");
    expect(result.row.integratedBracelet).toBe(true);
    expect(result.row.displayCaseback).toBe(true);
    expect(result.row.movementType).toBe("automatic");
    expect(result.row.movementConstruction).toBe("manufacture");
    expect(result.row.caliber).toBe("Cal. 7135");
    expect(result.row.waterResistanceM).toBe(100);
    expect(result.row.crystal).toBe("sapphire");
    expect(result.row.microAdjustment.present).toBe(true);
    expect(result.row.wearingScenarios).toEqual([
      "office",
      "sport_chic",
      "smart_casual",
    ]);
    expect(result.row.complications).toEqual(["date"]);
    expect(result.row.positioningGroup).toBe("avant_garde");
    expect(result.row.positioningLine).toBe(
      "авангардный флагман с открытым калибром",
    );
    expect(result.row.priceUsdMinor).toBe(1_650_000);
    expect(result.row.nickelContactRisk).toBe("possible");
  });

  it("rejects a row with the wrong column count", () => {
    const result = parseSheetRow(LAND_DWELLER.slice(0, 5), 3);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reasons[0]).toContain("19 columns");
  });

  it("rejects a row with an unmapped scenario token", () => {
    const cells = [...LAND_DWELLER];
    cells[14] = "офис / марсоход";
    const result = parseSheetRow(cells, 4);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reasons.join(" ")).toContain("марсоход");
  });

  it("rejects a row with an unmapped complication token", () => {
    const cells = [...LAND_DWELLER];
    cells[16] = "Дата, вечный двигатель";
    const result = parseSheetRow(cells, 5);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reasons.join(" ")).toContain("вечный двигатель");
  });

  it("accepts an unmapped positioning phrase but leaves the group null", () => {
    const cells = [...LAND_DWELLER];
    cells[15] = "совершенно новая формулировка";
    const result = parseSheetRow(cells, 6);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.positioningGroup).toBeNull();
    expect(result.row.positioningLine).toBe("совершенно новая формулировка");
  });
});
