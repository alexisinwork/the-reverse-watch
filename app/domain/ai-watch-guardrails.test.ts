import {
  allowedMovement,
  classifySource,
  fitsDiameter,
  fitsPrice,
  meetsWaterResistance,
  nickelSafe,
  pageMentionsReference,
} from "./ai-watch-guardrails";

describe("classifySource", () => {
  it("recognises manufacturer domains from the brand name", () => {
    expect(
      classifySource(
        "https://www.tudorwatch.com/en/watches/black-bay",
        "Tudor",
      ),
    ).toBe("manufacturer");
    expect(
      classifySource("https://www.longines.com/en-us/p/L3.810", "Longines"),
    ).toBe("manufacturer");
    expect(
      classifySource(
        "https://www.tagheuer.com/us/en/carrera.html",
        "TAG Heuer",
      ),
    ).toBe("manufacturer");
    expect(classifySource("https://www.iwc.com/en/watches.html", "IWC")).toBe(
      "manufacturer",
    );
    expect(
      classifySource(
        "https://www.nomos-glashuette.com/en/tangente",
        "NOMOS Glashütte",
      ),
    ).toBe("manufacturer");
    expect(
      classifySource(
        "https://www.alange-soehne.com/en/timepieces",
        "A. Lange & Söhne",
      ),
    ).toBe("manufacturer");
  });

  it("accepts authorised retailers and rejects marketplaces and reviews", () => {
    expect(
      classifySource("https://www.watchesofswitzerland.com/tudor", "Tudor"),
    ).toBe("retailer");
    expect(
      classifySource("https://www.chrono24.com/tudor/x.htm", "Tudor"),
    ).toBeNull();
    expect(
      classifySource("https://www.jomashop.com/tudor.html", "Tudor"),
    ).toBeNull();
    expect(
      classifySource("https://www.gearpatrol.com/watches/longines", "Longines"),
    ).toBeNull();
    expect(classifySource(null, "Tudor")).toBeNull();
  });
});

describe("pageMentionsReference", () => {
  it("matches references regardless of dots, dashes, and spacing", () => {
    expect(
      pageMentionsReference(
        "L3.810.4.53.6",
        "<b>Ref L3 810 4 53 6</b>",
        "https://x",
      ),
    ).toBe(true);
    expect(
      pageMentionsReference("M79640-0004", "", "https://tudor/m79640-0004"),
    ).toBe(true);
    expect(pageMentionsReference("SPB143", "nothing here", "https://x")).toBe(
      false,
    );
    expect(pageMentionsReference(null, "SPB143", "https://x")).toBe(false);
  });
});

describe("numeric hard checks", () => {
  it("treats unknown water resistance as failing a real minimum", () => {
    expect(meetsWaterResistance(0, null)).toBe(true);
    expect(meetsWaterResistance(100, 100)).toBe(true);
    expect(meetsWaterResistance(100, 50)).toBe(false);
    expect(meetsWaterResistance(100, null)).toBe(false);
  });

  it("allows half a millimetre of rounding on diameter", () => {
    const range = { minimumMm: 38, maximumMm: 42 };
    expect(fitsDiameter(range, 42.5)).toBe(true);
    expect(fitsDiameter(range, 43)).toBe(false);
    expect(fitsDiameter(range, null)).toBe(false);
  });

  it("keeps prices inside the range, including the open top range", () => {
    expect(fitsPrice({ minimum: 3_000, maximum: 4_000 }, 3_500)).toBe(true);
    expect(fitsPrice({ minimum: 3_000, maximum: 4_000 }, 2_290)).toBe(false);
    expect(fitsPrice({ minimum: 1_000_000, maximum: null }, 2_500_000)).toBe(
      true,
    );
    expect(fitsPrice({ minimum: 3_000, maximum: 4_000 }, null)).toBe(false);
  });

  it("maps movement wording onto the quiz movement types", () => {
    expect(allowedMovement(["automatic"], "Self-winding mechanical")).toBe(
      true,
    );
    expect(allowedMovement(["manual"], "Hand-wound")).toBe(true);
    expect(allowedMovement(["automatic"], "Quartz")).toBe(false);
    expect(allowedMovement(["automatic"], null)).toBe(false);
    // A Spring Drive watch is not an automatic in the quiz's terms.
    expect(allowedMovement(["automatic"], "Automatic (Spring Drive)")).toBe(
      false,
    );
    expect(allowedMovement(["spring_drive"], "Automatic (Spring Drive)")).toBe(
      true,
    );
    expect(allowedMovement(["automatic"], "Solar quartz")).toBe(false);
  });
});

describe("nickelSafe", () => {
  it("rejects any steel or unknown material against the skin", () => {
    expect(
      nickelSafe({
        case: "Titanium",
        caseback: "Titanium",
        strap: "Titanium bracelet",
      }),
    ).toBe(true);
    expect(
      nickelSafe({ case: "Titanium", caseback: null, strap: "Rubber strap" }),
    ).toBe(true);
    expect(
      nickelSafe({
        case: "Stainless steel",
        caseback: "Stainless steel",
        strap: "Leather",
      }),
    ).toBe(false);
    expect(
      nickelSafe({
        case: "Titanium",
        caseback: "Titanium",
        strap: "316L steel bracelet",
      }),
    ).toBe(false);
    expect(
      nickelSafe({ case: "Titanium", caseback: "Titanium", strap: null }),
    ).toBe(false);
    expect(nickelSafe({ case: null, caseback: null, strap: "Leather" })).toBe(
      false,
    );
  });
});
