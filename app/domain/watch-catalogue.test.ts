import { describe, expect, it } from "vitest";

import { profileV4Schema, type ProfileV4 } from "./questionnaire-v4";
import {
  catalogueIdentityKey,
  catalogueRuleFailures,
  catalogueToFoundWatch,
  matchCatalogue,
  stylesForScenarios,
  wristFitLabel,
  type CatalogueWatch,
} from "./watch-catalogue";

const fx = {
  date: "2026-09-29",
  perEur: { EUR: 1, USD: 1.1, GBP: 0.85, CHF: 0.95 },
};

function watch(overrides: Partial<CatalogueWatch> = {}): CatalogueWatch {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    identityKey: "tissot|r:t1234",
    brand: "Tissot",
    model: "PRX Powermatic 80",
    referenceCode: "T137.407.11.041.00",
    referenceConfirmed: true,
    styles: ["everyday", "sport"],
    caseDiameterMm: 40,
    caseThicknessMm: 10.9,
    caseShape: "round",
    waterResistanceM: 100,
    movement: "automatic",
    inHouseCalibre: false,
    crystal: "sapphire",
    displayCaseback: true,
    complications: ["date"],
    caseMaterial: "stainless steel",
    casebackMaterial: "stainless steel",
    strapMaterial: "stainless steel bracelet",
    priceAmount: 725,
    priceCurrency: "USD",
    priceStatus: "confirmed",
    priceCheckedAt: "2026-09-30T00:00:00Z",
    priceEvidence: {},
    priceChange: null,
    sourceUrl: "https://www.tissotwatches.com/en-us/t1374071104100.html",
    sourceKind: "manufacturer",
    imageUrl: "https://images.example/prx.jpg",
    rationale: null,
    foundIn: [],
    reviewStatus: "pending",
    reviewedAt: null,
    createdAt: "2026-09-30T00:00:00Z",
    updatedAt: "2026-09-30T00:00:00Z",
    ...overrides,
  };
}

const profile: ProfileV4 = {
  version: 4,
  budgetCurrency: "USD",
  priceRange: "500_1000",
  wristCm: 17.5,
  wearingScenarios: ["office"],
  minimumWaterResistanceM: 50,
  movementTypes: ["automatic"],
  requiredComplications: [],
  allergyConstraint: "none",
};

describe("stylesForScenarios", () => {
  it("maps quiz scenarios onto wearing styles", () => {
    expect(stylesForScenarios(["diving", "black_tie"])).toEqual([
      "dress",
      "dive",
    ]);
    expect(stylesForScenarios(["something_new"])).toEqual(["everyday"]);
  });
});

describe("catalogueRuleFailures", () => {
  it("passes a watch that fits every answer", () => {
    expect(catalogueRuleFailures(watch(), profile, fx)).toEqual([]);
  });

  it("never lets a missing or unconfirmed fact satisfy a filter", () => {
    expect(
      catalogueRuleFailures(
        watch({
          priceStatus: "unconfirmed",
          priceAmount: null,
          priceCurrency: null,
        }),
        profile,
        fx,
      ),
    ).toContain("price");
    expect(
      catalogueRuleFailures(watch({ caseDiameterMm: null }), profile, fx),
    ).toContain("diameter");
    expect(
      catalogueRuleFailures(watch({ waterResistanceM: null }), profile, fx),
    ).toContain("water_resistance");
    expect(
      catalogueRuleFailures(
        watch(),
        { ...profile, crystal: "sapphire", maxCaseThicknessMm: 9 },
        fx,
      ),
    ).toEqual(["thickness"]);
  });

  it("converts the confirmed price into the budget currency", () => {
    // USD 725 is about EUR 659: inside EUR 500-1k.
    expect(
      catalogueRuleFailures(watch(), { ...profile, budgetCurrency: "EUR" }, fx),
    ).toEqual([]);
    expect(
      catalogueRuleFailures(
        watch({ priceAmount: 1_150 }),
        { ...profile, budgetCurrency: "EUR" },
        fx,
      ),
    ).toContain("price");
  });

  it("enforces the edited diameter range over the wrist suggestion", () => {
    const edited = { ...profile, caseDiameterMinMm: 36, caseDiameterMaxMm: 38 };
    expect(catalogueRuleFailures(watch(), edited, fx)).toEqual(["diameter"]);
    expect(
      catalogueRuleFailures(watch({ caseDiameterMm: 37 }), edited, fx),
    ).toEqual([]);
  });

  it("applies the nickel rule and required functions", () => {
    expect(
      catalogueRuleFailures(
        watch(),
        { ...profile, allergyConstraint: "nickel_contact" },
        fx,
      ),
    ).toContain("nickel");
    expect(
      catalogueRuleFailures(
        watch(),
        { ...profile, requiredComplications: ["gmt"] },
        fx,
      ),
    ).toContain("complications");
  });
});

describe("matchCatalogue", () => {
  it("splits confirmed references from 'also worth a look' and skips rejected ones", () => {
    const result = matchCatalogue(
      [
        watch(),
        watch({
          id: "2",
          identityKey: "b",
          brand: "Hamilton",
          referenceConfirmed: false,
        }),
        watch({
          id: "3",
          identityKey: "c",
          brand: "Seiko",
          reviewStatus: "rejected",
        }),
      ],
      profile,
      fx,
    );
    expect(result.main.map((entry) => entry.brand)).toEqual(["Tissot"]);
    expect(result.alsoWorth.map((entry) => entry.brand)).toEqual(["Hamilton"]);
  });

  it("puts reviewed watches first and mixes brands", () => {
    const result = matchCatalogue(
      [
        watch({ id: "1", identityKey: "a1", model: "A" }),
        watch({ id: "2", identityKey: "a2", model: "B" }),
        watch({
          id: "3",
          identityKey: "h",
          brand: "Hamilton",
          reviewStatus: "approved",
        }),
      ],
      profile,
      fx,
    );
    expect(result.main.map((entry) => `${entry.brand} ${entry.model}`)).toEqual(
      ["Hamilton PRX Powermatic 80", "Tissot A", "Tissot B"],
    );
  });
});

describe("catalogue helpers", () => {
  it("keys a watch by brand and reference, or model without one", () => {
    expect(catalogueIdentityKey("Nomos Glashütte", "Tangente", "164")).toBe(
      "nomosglashutte|r:164",
    );
    expect(catalogueIdentityKey("Nomos", "Tangente 38", null)).toBe(
      "nomos|m:tangente38",
    );
  });

  it("shows only a confirmed price and carries the review status", () => {
    const found = catalogueToFoundWatch(
      watch({
        priceStatus: "unconfirmed",
        priceAmount: null,
        priceCurrency: null,
      }),
    )!;
    expect(found.details.price).toBeNull();
    expect(found.details.reviewStatus).toBe("pending");
    expect(catalogueToFoundWatch(watch({ sourceUrl: null }))).toBeNull();
  });

  it("describes the wrists a case suits", () => {
    expect(wristFitLabel(40)).toBe("16–19 cm");
    expect(wristFitLabel(46)).toBe("20 cm and up");
    expect(wristFitLabel(null)).toBe("unknown");
  });
});

describe("edited diameter range", () => {
  const base = { ...profile };
  it("requires both ends and the smallest first", () => {
    expect(
      profileV4Schema.safeParse({ ...base, caseDiameterMinMm: 38 }).success,
    ).toBe(false);
    expect(
      profileV4Schema.safeParse({
        ...base,
        caseDiameterMinMm: 42,
        caseDiameterMaxMm: 38,
      }).success,
    ).toBe(false);
    expect(
      profileV4Schema.safeParse({
        ...base,
        caseDiameterMinMm: 36,
        caseDiameterMaxMm: 40,
      }).success,
    ).toBe(true);
  });
});
