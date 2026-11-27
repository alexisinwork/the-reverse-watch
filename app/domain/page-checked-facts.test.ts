import { describe, expect, it } from "vitest";

import type { FoundWatch } from "./ai-watch-types";
import { withPageCheckedFacts } from "./page-checked-facts";
import { catalogueWatchSchema, pageCheckedFacts } from "./watch-catalogue";

const saved: FoundWatch = {
  brand: "Citizen",
  model: "Promaster Mechanical",
  referenceCode: "NB6004-08E",
  sourceUrl: "https://www.citizen.co.jp/release/news/detail/25",
  imageUrl: null,
  priceNote: "USD 1,050",
  rationale: "Checked",
  details: {
    caseDiameterMm: 41,
    waterResistanceM: 200,
    movement: "automatic",
    validationFacts: [
      {
        field: "caseDiameterMm",
        value: 41,
        sources: [
          {
            provider: "perplexity",
            sourceUrl: "https://shop.example/a",
            quote: "41 mm",
            checkedAt: "2026-11-01T00:00:00Z",
          },
          {
            provider: "muse",
            sourceUrl: "https://shop.example/b",
            quote: "41 mm",
            checkedAt: "2026-11-01T00:00:00Z",
          },
        ],
      },
    ],
  },
};

describe("facts read on the maker's page", () => {
  it("replace a saved answer's older value and drop the check of it", () => {
    const card = withPageCheckedFacts(
      saved,
      {
        model: "Promaster Mechanical",
        caseDiameterMm: 46,
        waterResistanceM: 200,
      },
      ["caseDiameterMm"],
    );
    expect(card.details.caseDiameterMm).toBe(46);
    expect(card.details.waterResistanceM).toBe(200);
    expect(card.details.validationFacts).toBeUndefined();
    expect(card.details.pageCheckedFacts).toEqual(["caseDiameterMm"]);
    expect(card.priceNote).toBe("USD 1,050");
  });

  it("leave a card alone when the catalogue read nothing on a page", () => {
    expect(
      withPageCheckedFacts(saved, { model: "Other", caseDiameterMm: 46 }, []),
    ).toBe(saved);
  });

  it("take the maker's name only when the name itself was checked", () => {
    const renamed = withPageCheckedFacts(
      { ...saved, model: "DS Action Day-Date" },
      { model: "DS Action Diver 43mm Powermatic 80" },
      ["model"],
    );
    expect(renamed.model).toBe("DS Action Diver 43mm Powermatic 80");
    expect(
      withPageCheckedFacts(
        { ...saved, model: "DS Action Day-Date" },
        { model: "DS Action Diver 43mm Powermatic 80" },
        ["caseDiameterMm"],
      ).model,
    ).toBe("DS Action Day-Date");
  });
});

describe("which catalogue facts were read on a page", () => {
  it("counts the maker's and shops' pages, not model guesses or derived marks", () => {
    const row = catalogueWatchSchema.parse({
      id: "id",
      identityKey: "citizen|nb600408e",
      brand: "Citizen",
      model: "Promaster Mechanical",
      referenceCode: "NB6004-08E",
      referenceConfirmed: true,
      styles: [],
      caseDiameterMm: 46,
      caseThicknessMm: null,
      caseShape: null,
      waterResistanceM: 200,
      movement: "automatic",
      inHouseCalibre: null,
      crystal: null,
      displayCaseback: null,
      complications: [],
      caseMaterial: null,
      casebackMaterial: null,
      strapMaterial: null,
      priceAmount: null,
      priceCurrency: null,
      priceStatus: "unconfirmed",
      priceCheckedAt: null,
      priceEvidence: {},
      priceChange: null,
      sourceUrl: "https://www.citizen.co.jp/release/news/detail/25",
      sourceKind: "manufacturer",
      imageUrl: null,
      rationale: null,
      foundIn: [],
      reviewStatus: "approved",
      reviewedAt: null,
      createdAt: "2026-10-25",
      updatedAt: "2026-11-27",
      sourceDetails: {
        factCheck: {
          caseDiameterMm: "corrected · maker_page · citizen.co.jp · 2026-11-27",
          waterResistanceM:
            "confirmed · retailer_page · shop.example · 2026-11-27",
          priceStatus: "corrected · derived · 2026-11-27",
        },
      },
    });
    expect(pageCheckedFacts(row).sort()).toEqual([
      "caseDiameterMm",
      "waterResistanceM",
    ]);
  });
});
