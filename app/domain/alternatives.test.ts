import {
  budgetWindow,
  isHomageBrand,
  rankAlternatives,
  strictFailures,
} from "./alternatives";
import type { DesignTraits } from "./design-traits";
import { catalogueWatchSchema, type CatalogueWatch } from "./watch-catalogue";

const fx = { date: "2026-10-01", perEur: { EUR: 1, USD: 1.1 } };

const vintageDiver: DesignTraits = {
  dialColour: "black",
  dialTexture: "plain",
  dialLayout: "time_only",
  numerals: "indices",
  handStyle: "snowflake",
  lume: "cream",
  bezel: "dive",
  bezelColour: "black",
  caseShape: "round",
  strap: "bracelet",
  era: "vintage_inspired",
  crownGuards: false,
};

let next = 0;
function watch(overrides: Record<string, unknown> = {}): CatalogueWatch {
  next += 1;
  return catalogueWatchSchema.parse({
    id: `00000000-0000-0000-0000-${String(next).padStart(12, "0")}`,
    identityKey: `brand${next}|r:ref${next}`,
    brand: `Brand${next}`,
    model: `Diver ${next}`,
    referenceCode: `REF${next}`,
    referenceConfirmed: true,
    styles: ["dive", "sport"],
    caseDiameterMm: 39,
    caseThicknessMm: null,
    caseShape: "round",
    waterResistanceM: 200,
    movement: "automatic",
    inHouseCalibre: null,
    crystal: null,
    displayCaseback: null,
    complications: ["dive_bezel"],
    caseMaterial: "steel",
    casebackMaterial: "steel",
    strapMaterial: "steel",
    priceAmount: 1_500,
    priceCurrency: "USD",
    priceStatus: "approximate",
    priceCheckedAt: null,
    priceEvidence: {},
    priceChange: null,
    sourceUrl: `https://brand${next}.example/`,
    sourceKind: "manufacturer",
    imageUrl: null,
    rationale: null,
    foundIn: [],
    reviewStatus: "approved",
    reviewedAt: null,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    designTraits: vintageDiver,
    preownedPrice: null,
    ...overrides,
  });
}

const blackBay = () =>
  watch({ brand: "Tudor", model: "Black Bay 58", priceAmount: 4_175 });
const around2k = { kind: "exact", amount: 2_000, currency: "USD" } as const;

describe("budgetWindow", () => {
  it("reads an exact price as that price ± 1,000, and a range as itself", () => {
    expect(budgetWindow(around2k)).toEqual({
      currency: "USD",
      minimum: 1_000,
      maximum: 3_000,
    });
    expect(
      budgetWindow({ kind: "exact", amount: 600, currency: "EUR" }),
    ).toEqual({ currency: "EUR", minimum: 0, maximum: 1_600 });
    expect(
      budgetWindow({ kind: "range", rangeId: "1000_2000", currency: "USD" }),
    ).toEqual({ currency: "USD", minimum: 1_000, maximum: 2_000 });
  });
});

describe("strict rules", () => {
  it("never offers a homage brand", () => {
    expect(isHomageBrand("Steinhart")).toBe(true);
    expect(isHomageBrand("San Martin")).toBe(true);
    expect(isHomageBrand("Baltic")).toBe(false);
    expect(
      strictFailures(blackBay(), watch({ brand: "Steinhart" }), false),
    ).toContain("homage");
  });

  it("keeps the role, functions, size and water resistance", () => {
    const target = blackBay();
    expect(strictFailures(target, watch(), false)).toEqual([]);
    expect(
      strictFailures(target, watch({ styles: ["dress"] }), false),
    ).toContain("style");
    expect(
      strictFailures(
        target,
        watch({ complications: ["dive_bezel", "chronograph"] }),
        false,
      ),
    ).toContain("chronograph");
    expect(
      strictFailures(target, watch({ caseDiameterMm: 42 }), false),
    ).toContain("size");
    expect(
      strictFailures(target, watch({ waterResistanceM: 100 }), false),
    ).toContain("water_resistance");
  });

  it("offers quartz or solar only when the subscriber allows them", () => {
    const solar = watch({ movement: "solar" });
    expect(strictFailures(blackBay(), solar, false)).toContain("movement");
    expect(strictFailures(blackBay(), solar, true)).toEqual([]);
  });

  it("keeps a rectangular watch rectangular", () => {
    const tank = watch({
      styles: ["dress"],
      complications: [],
      waterResistanceM: 30,
      caseShape: "rectangular",
      designTraits: {
        ...vintageDiver,
        caseShape: "rectangular",
        bezel: "plain",
      },
    });
    const round = watch({
      styles: ["dress"],
      complications: [],
      waterResistanceM: 30,
    });
    const square = watch({
      styles: ["dress"],
      complications: [],
      waterResistanceM: 30,
      caseShape: "square",
    });
    expect(strictFailures(tank, round, true)).toContain("shape");
    expect(strictFailures(tank, square, true)).toEqual([]);
  });
});

describe("rankAlternatives", () => {
  it("ranks by how alike they look and explains it", () => {
    const target = blackBay();
    const alike = watch({ brand: "Baltic", model: "Aquascaphe" });
    const unlike = watch({
      brand: "Vaer",
      model: "D5",
      designTraits: {
        ...vintageDiver,
        dialColour: "white",
        handStyle: "baton",
        lume: "white",
        era: "modern",
      },
    });
    const ranked = rankAlternatives(
      target,
      [target, unlike, alike],
      around2k,
      false,
      fx,
    );
    expect(ranked.map((entry) => entry.watch.brand)).toEqual([
      "Baltic",
      "Vaer",
    ]);
    expect(ranked[0]!.shares).toEqual(
      expect.arrayContaining([
        "black dial",
        "snowflake hands",
        "vintage-inspired",
      ]),
    );
    expect(ranked[1]!.differs).toEqual(
      expect.arrayContaining(["white dial", "baton hands"]),
    );
  });

  it("lets the same brand's cheaper model in only when it looks alike", () => {
    const target = blackBay();
    const ranger = watch({
      brand: "Tudor",
      model: "Pelagos FXD",
      designTraits: {
        ...vintageDiver,
        dialColour: "blue",
        handStyle: "baton",
        lume: "white",
        bezelColour: "blue",
        era: "modern",
        dialLayout: "date",
      },
    });
    const lookalike = watch({ brand: "Tudor", model: "Black Bay 54" });
    const ranked = rankAlternatives(
      target,
      [ranger, lookalike],
      around2k,
      false,
      fx,
    );
    expect(ranked.map((entry) => entry.watch.model)).toEqual(["Black Bay 54"]);
  });

  it("uses an established-dealer pre-owned price when the new one is above budget", () => {
    const target = blackBay();
    const dearNew = watch({
      brand: "Oris",
      model: "Divers Sixty-Five",
      priceAmount: 3_600,
      preownedPrice: {
        currency: "USD",
        low: 2_300,
        median: 2_600,
        high: 2_900,
        listings: 4,
        checkedAt: "2026-10-01T00:00:00Z",
      },
    });
    const [entry] = rankAlternatives(target, [dearNew], around2k, false, fx);
    expect(entry!.price).toMatchObject({
      condition: "pre-owned",
      amount: 2_600,
    });
  });

  it("shows at most two watches per brand", () => {
    const target = blackBay();
    const many = [1, 2, 3].map((n) =>
      watch({ brand: "Lorier", model: `Hydra ${n}` }),
    );
    expect(rankAlternatives(target, many, around2k, false, fx)).toHaveLength(2);
  });
});
