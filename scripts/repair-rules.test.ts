import { describe, expect, it } from "vitest";

import type { CatalogueWatch } from "../app/domain/watch-catalogue";
import {
  anotherWatch,
  checkField,
  makerName,
  modelCheck,
  pageKind,
  plain,
  registrableDomain,
  specText,
  titleArea,
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

describe("pages over plain http", () => {
  it("give no fact", () => {
    expect(pageKind("http://shop.example/omega-2990", "Omega")).toBeNull();
  });
});

// Cases the judge found after the repair (2026-11-27).
describe("the second read", () => {
  it("keeps a specification table's label with its value", () => {
    const text = [
      "Tissot Chemin des Tourelles 42mm | Model T1394071604100 | Tissot® United States",
      ...Array.from({ length: 30 }, (_, index) => `Menu item ${index}`),
      "Case length (mm)",
      "42.00",
      "Case width (mm)",
      "42.00",
      "Water Resistance",
      "300m",
      "Water Resistance 10 bar",
      "Subscribe to our newsletter",
    ].join(" \n ");
    const lines = specText(text, "T139.407.16.041.00");
    expect(lines).toContain("Case width (mm): 42.00");
    expect(lines).toContain("Water Resistance: 300m");
    expect(lines).toContain("Water Resistance 10 bar");
    expect(lines).not.toContain("Subscribe to our newsletter");
  });

  it("reads a table's diameter, never its case length", () => {
    const tissot = watch({
      brand: "Tissot",
      model: "Chemin des Tourelles Powermatic 80",
      referenceCode: "T139.407.16.041.00",
      caseDiameterMm: 39,
    });
    const page = plain(
      "Case length (mm) \n 42.00 \n Case width (mm) \n 42.00 \n Water Resistance \n 50 m",
    );
    expect(
      checkField(
        tissot,
        "caseDiameterMm",
        field(42, "Case width (mm): 42.00"),
        page,
      ),
    ).toMatchObject({ status: "corrected", value: 42 });
    expect(
      checkField(
        tissot,
        "caseDiameterMm",
        field(42, "Case length (mm): 42.00"),
        page,
      ).status,
    ).toBe("unconfirmed");
  });

  it("takes the maker's name when the stored one carries another size or names another model", () => {
    const hamilton = watch({
      brand: "Hamilton",
      model: "Khaki Navy Frogman Automatic 41",
      referenceCode: "H77725335",
    });
    const hamiltonTitle = titleArea(
      "Khaki Navy Frogman Auto - Dial color:Black - H77725335 | Hamilton Watch \n Khaki Navy Frogman Auto",
    );
    expect(
      makerName(
        hamilton,
        field("Khaki Navy Frogman Auto", "Khaki Navy Frogman Auto"),
        hamiltonTitle,
        {
          diameterMm: 42,
          text: plain("Khaki Navy Frogman Auto H77725335 Case size 42mm"),
          hardFactDiffers: false,
        },
      ),
    ).toMatchObject({
      status: "corrected",
      value: "Khaki Navy Frogman Auto",
      makerTitle: true,
    });
    const certina = watch({
      brand: "Certina",
      model: "DS Action Day-Date",
      referenceCode: "C032.607.11.051.00",
    });
    expect(
      makerName(
        certina,
        field(
          "DS Action Diver 43mm Powermatic 80",
          "Men Automatic DS Action Diver 43mm Powermatic 80 watch by Certina",
        ),
        titleArea(
          "Men Automatic DS Action Diver 43mm Powermatic 80 watch by Certina",
        ),
        {
          diameterMm: 43,
          text: plain(
            "Men Automatic DS Action Diver 43mm Powermatic 80 watch by Certina",
          ),
          hardFactDiffers: false,
        },
      ),
    ).toMatchObject({
      status: "corrected",
      value: "DS Action Diver 43mm Powermatic 80",
    });
  });

  it("keeps a stored name the maker's shorter name does not contradict", () => {
    const seiko = watch({
      brand: "Seiko",
      model: "Prospex 1965 Heritage Diver's Watch",
      referenceCode: "SPB451",
    });
    expect(
      makerName(
        seiko,
        field("Prospex", "Prospex SPB451"),
        titleArea("Prospex SPB451 | Seiko Watch Corporation"),
        {
          diameterMm: 40,
          text: plain("Prospex SPB451 Seiko Watch Corporation"),
          hardFactDiffers: false,
        },
      ),
    ).toBeNull();
  });

  it("never takes a name from outside the page's title area", () => {
    const hamilton = watch({
      brand: "Hamilton",
      model: "Khaki Navy Frogman Automatic 41",
      referenceCode: "H77725335",
    });
    expect(
      makerName(
        hamilton,
        field("Khaki Field Mechanical", "Khaki Field Mechanical"),
        titleArea(
          "Khaki Navy Frogman Auto - H77725335 | Hamilton Watch \n Khaki Navy Frogman Auto",
        ),
        {
          diameterMm: 42,
          text: plain("Khaki Navy Frogman Auto Khaki Field Mechanical"),
          hardFactDiffers: false,
        },
      ),
    ).toBeNull();
  });
});

describe("the second read's limits", () => {
  it("takes nothing from a general remark", () => {
    const omega = watch({
      brand: "Omega",
      model: "Seamaster Aqua Terra 150M",
      referenceCode: "231.10.39.22.02.001",
    });
    const passage =
      "A transparent caseback - frequently made of sapphire - makes the movement visible";
    expect(
      checkField(
        omega,
        "casebackMaterial",
        field("sapphire", passage),
        plain(passage),
      ).status,
    ).toBe("unconfirmed");
  });

  it("keeps a stored name whose words the title area gives", () => {
    const grandSeiko = watch({
      brand: "Grand Seiko",
      model: "Elegance Collection GMT",
      referenceCode: "SBGM221",
    });
    expect(
      makerName(
        grandSeiko,
        field(
          "Automatic 3-Day Power Reserve GMT",
          "Automatic 3-Day Power Reserve GMT",
        ),
        titleArea(
          "SBGM221 | Elegance Collection | Grand Seiko \n Automatic 3-Day Power Reserve GMT",
        ),
        {
          diameterMm: 39,
          text: plain(
            "SBGM221 Elegance Collection Grand Seiko Automatic 3-Day Power Reserve GMT",
          ),
          hardFactDiffers: false,
        },
      ),
    ).toBeNull();
  });
});

describe("another model behind a stored name", () => {
  it("needs the stored word gone from the page, or a hard fact that differs", () => {
    const citizen = watch({
      brand: "Citizen",
      model: "Promaster Mechanical Diver 1976",
      referenceCode: "NB6021-68L",
    });
    const title = titleArea(
      "Promaster Fujitsubo Blue Dial Super Titanium Bracelet | NB6021-68L | CITIZEN",
    );
    const answer = field(
      "Promaster Fujitsubo Blue Dial Super Titanium Bracelet",
      "Promaster Fujitsubo Blue Dial Super Titanium Bracelet",
    );
    // The page also calls it the Promaster Mechanical Diver: nothing changes.
    expect(
      makerName(citizen, answer, title, {
        diameterMm: 41,
        text: plain(
          "That history has inspired our new Promaster Mechanical Diver",
        ),
        hardFactDiffers: false,
      }),
    ).toBeNull();
    // A different movement or size on the maker's page: it is another model.
    expect(
      makerName(citizen, answer, title, {
        diameterMm: 41,
        text: plain(
          "That history has inspired our new Promaster Mechanical Diver",
        ),
        hardFactDiffers: true,
      }),
    ).toMatchObject({ status: "corrected" });
  });
});

describe("the maker's name as written", () => {
  it("keeps the stored spelling of a word the maker writes in capitals", () => {
    const longines = watch({
      brand: "Longines",
      model: "HydroConquest GMT 41 Green",
      referenceCode: "L3.790.4.56.6",
    });
    expect(
      makerName(
        longines,
        field("HYDROCONQUEST GMT", "HYDROCONQUEST GMT L3.790.4.56.6 black"),
        titleArea("HYDROCONQUEST GMT L3.790.4.56.6 black | Longines"),
        {
          diameterMm: 41,
          text: plain("HYDROCONQUEST GMT"),
          hardFactDiffers: false,
        },
      ),
    ).toMatchObject({ status: "corrected", value: "HydroConquest GMT" });
  });
});

describe("pages that never give a fact, 2026-11-27", () => {
  it("covers a watch magazine, a watch blog and a grey dealer", () => {
    for (const url of [
      "https://en.worldtempus.com/watch/longines/conquest",
      "https://www.watchanchor.com/review/seiko",
      "https://wristaficionado.com/products/rolex-126334",
    ])
      expect(pageKind(url, "Rolex")).toBeNull();
  });
});
