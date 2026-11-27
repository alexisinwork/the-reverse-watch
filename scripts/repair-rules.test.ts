import { describe, expect, it } from "vitest";

import type { CatalogueWatch } from "../app/domain/watch-catalogue";
import {
  anotherWatch,
  checkField,
  modelCheck,
  pageKind,
  plain,
  registrableDomain,
  specText,
} from "./repair-rules";

// Each case is one the calibration against Opus found (2026-11-27).
const watch = (facts: Partial<CatalogueWatch>) =>
  ({
    brand: "Alpina",
    model: "Alpiner Extreme Automatic Chronograph",
    referenceCode: "AL-730NS4AE6B",
    caseDiameterMm: null,
    caseThicknessMm: null,
    movement: null,
    inHouseCalibre: null,
    waterResistanceM: null,
    caseMaterial: null,
    casebackMaterial: null,
    strapMaterial: null,
    crystal: null,
    ...facts,
  }) as CatalogueWatch;
const field = (value: string | number | boolean, passage: string) => ({
  value,
  passage,
});

describe("which pages may give a fact", () => {
  it("reads the site's own name, not a shop's subdomain", () => {
    expect(registrableDomain("us.alpinawatches.com")).toBe("alpinawatches.com");
    expect(registrableDomain("grandseiko.hrd-web.com")).toBe("hrd-web.com");
    expect(registrableDomain("citizenwatches.com.au")).toBe(
      "citizenwatches.com.au",
    );
    expect(
      pageKind(
        "https://us.alpinawatches.com/product/AL-730NS4AE6B.html",
        "Alpina",
      ),
    ).toBe("maker");
    expect(
      pageKind(
        "https://grandseiko.hrd-web.com/product/9f-quartz/SBGX295",
        "Grand Seiko",
      ),
    ).toBe("retailer");
    expect(
      pageKind(
        "https://www.muehle-glashuette.de/en/watch/s-a-r-rescue-timer/",
        "Mühle Glashütte",
      ),
    ).toBe("maker");
  });

  it("never takes a fact from an auction, a pre-owned dealer, a forum, a magazine or a marketplace", () => {
    for (const url of [
      "https://www.sothebys.com/en/buy/auction/2026/lot-12",
      "https://zenluxe.jp/products/omega-386",
      "https://omegaforums.net/threads/excelsior-park-ep95000.188426",
      "https://www.hodinkee.com/articles/nodus-sector-deep",
      "https://www.chrono24.com/cartier/tank--id1.htm",
      "https://spacecitytimepiece.com/watches/a-lange-s-hne/1815/238-026e",
    ])
      expect(pageKind(url, "Omega")).toBeNull();
  });
});

describe("a passage confirms, corrects or fills a stored fact", () => {
  const alpina = plain(
    "Brushed and polished stainless steel 41mm, 3-part case. Water Resistance WR100/10Bar/333ft [Swimming, Showering & Snorkeling]",
  );

  it("corrects from the maker's page", () => {
    const stored = watch({ caseDiameterMm: 42.5, waterResistanceM: 200 });
    expect(
      checkField(
        stored,
        "caseDiameterMm",
        field(41, "Brushed and polished stainless steel 41mm, 3-part case."),
        alpina,
      ),
    ).toMatchObject({ status: "corrected", value: 41 });
    expect(
      checkField(
        stored,
        "waterResistanceM",
        field(100, "Water Resistance WR100/10Bar/333ft"),
        alpina,
      ),
    ).toMatchObject({ status: "corrected", value: 100 });
  });

  it("counts nothing the page does not say", () => {
    const stored = watch({ caseDiameterMm: 42.5 });
    expect(
      checkField(
        stored,
        "caseDiameterMm",
        field(40, "Case diameter 40 mm"),
        alpina,
      ).status,
    ).toBe("unconfirmed");
    expect(
      checkField(
        stored,
        "movement",
        field("automatic", "Quartz"),
        plain("Movement: Quartz"),
      ).status,
    ).toBe("unconfirmed");
  });

  it("never takes a case length for a diameter", () => {
    const page = plain("Case Length 40 mm");
    expect(
      checkField(
        watch({ caseDiameterMm: 40.5 }),
        "caseDiameterMm",
        field(40, "Case Length 40 mm"),
        page,
      ).status,
    ).toBe("unconfirmed");
  });

  it("never lets a rounded number correct a precise one", () => {
    const page = plain("Case Diameter 41 mm");
    expect(
      checkField(
        watch({ caseDiameterMm: 41.8 }),
        "caseDiameterMm",
        field(41, "Case Diameter 41 mm"),
        page,
      ).status,
    ).toBe("unconfirmed");
    const omega = plain("35.5 mm, steel - yellow gold on steel");
    expect(
      checkField(
        watch({ caseDiameterMm: 35 }),
        "caseDiameterMm",
        field(35.5, "35.5 mm, steel - yellow gold on steel"),
        omega,
      ),
    ).toMatchObject({ status: "corrected", value: 35.5 });
  });

  it("reads water resistance in bar and atmospheres, and movements in words", () => {
    expect(
      checkField(
        watch({}),
        "waterResistanceM",
        field(200, "Water Resistance 20 bar"),
        plain("Water Resistance 20 bar"),
      ),
    ).toMatchObject({ status: "filled", value: 200 });
    expect(
      checkField(
        watch({ waterResistanceM: 100 }),
        "waterResistanceM",
        field(50, "water resistant up to 5 ATM"),
        plain("water resistant up to 5 ATM"),
      ),
    ).toMatchObject({ status: "corrected", value: 50 });
    expect(
      checkField(
        watch({ movement: "automatic" }),
        "movement",
        field("quartz", "Movement : quartz + battery"),
        plain("Movement : quartz + battery"),
      ),
    ).toMatchObject({ status: "corrected", value: "quartz" });
  });
});

describe("the watch's name", () => {
  it("finds a reference that belongs to another model", () => {
    const laco = watch({
      brand: "Laco",
      model: "Classic Halle 38",
      referenceCode: "862100",
    });
    expect(
      modelCheck(
        laco,
        "Augsburg Blaue Stunde 42",
        "Augsburg Blaue Stunde 42 | 862100",
      ),
    ).toMatchObject({
      status: "corrected",
      value: "Augsburg Blaue Stunde 42",
    });
  });

  it("confirms the same name in another order", () => {
    expect(
      modelCheck(
        watch({}),
        "Alpiner Extreme Chronograph Automatic",
        "Alpiner Extreme Chronograph Automatic AL-730NS4AE6B",
      ),
    ).toMatchObject({ status: "confirmed" });
  });

  it("changes nothing when the page names the watch by its number or in another script", () => {
    const omega = watch({
      brand: "Omega",
      model: "Seamaster",
      referenceCode: "2990",
    });
    expect(modelCheck(omega, "CK 2990", "CK 2990").status).toBe("unconfirmed");
    const seiko = watch({
      brand: "Grand Seiko",
      model: "Heritage Quartz 37mm Black",
      referenceCode: "SBGX295",
    });
    expect(
      modelCheck(
        seiko,
        "ヘリテージコレクション クオーツ",
        "SBGX295 グランドセイコー ヘリテージコレクション クオーツ",
      ).status,
    ).toBe("unconfirmed");
  });

  it("calls a sibling model ambiguous, so nothing is changed from its page", () => {
    const glycine = watch({
      brand: "Glycine",
      model: "Combat Classic 40 Automatic",
      referenceCode: "GL1012",
    });
    expect(
      modelCheck(
        glycine,
        "Combat Sub 42 Sport Quartz",
        "Combat Sub 42 Sport Quartz",
      ),
    ).toMatchObject({
      status: "unconfirmed",
      ambiguous: true,
    });
  });
});

describe("the lines a page is read from", () => {
  it("keeps the title area, every specification line and the reference", () => {
    const text = [
      "Alpina Alpiner Extreme",
      ...Array.from({ length: 40 }, (_, index) => `Menu item ${index}`),
      "Reference AL-730NS4AE6B",
      "Water Resistance 10 bar",
      "Subscribe to our newsletter",
    ].join(" \n ");
    const lines = specText(text, "AL-730NS4AE6B");
    expect(lines).toContain("Alpina Alpiner Extreme");
    expect(lines).toContain("Reference AL-730NS4AE6B");
    expect(lines).toContain("Water Resistance 10 bar");
    expect(lines).not.toContain("Subscribe to our newsletter");
  });
});

describe("another watch behind the reference", () => {
  it("needs another name and a different hard fact", () => {
    expect(
      anotherWatch({
        model: {
          status: "corrected",
          stored: "Classic Halle 38",
          value: "Augsburg Blaue Stunde 42",
        },
        caseDiameterMm: { status: "corrected", stored: 38, value: 42 },
      }),
    ).toBe(true);
    // The same watch written differently keeps its stored name.
    expect(
      anotherWatch({
        model: {
          status: "corrected",
          stored: "Sky-Dweller White Rolesor",
          value: "SKYDWELLER",
        },
        caseDiameterMm: { status: "confirmed", stored: 42, value: 42 },
        movement: {
          status: "confirmed",
          stored: "automatic",
          value: "automatic",
        },
      }),
    ).toBe(false);
    expect(
      anotherWatch({
        model: {
          status: "corrected",
          stored: "Heritage Quartz",
          value: "Sport Quartz",
        },
        caseDiameterMm: { status: "corrected", stored: 40.5, value: 40 },
      }),
    ).toBe(false);
  });
});
