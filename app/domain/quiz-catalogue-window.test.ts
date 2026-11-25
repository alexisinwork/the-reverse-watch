import { describe, expect, it } from "vitest";

import { convert, type FxTable } from "./fx";
import { PRICE_RANGES, type ProfileV4 } from "./questionnaire-v4";
import {
  broaderNearFits,
  matchCatalogue,
  nearFits,
  priceIn,
  QUIZ_WINDOW_COLUMNS,
  quizCatalogueWindow,
  type CatalogueMatchFacts,
  type QuizCatalogueWindow,
} from "./watch-catalogue";
import { loadQuizWindow, type CatalogueClient } from "./watch-catalogue.server";

const fx: FxTable = {
  date: "2026-11-25",
  perEur: { EUR: 1, USD: 1.08, GBP: 0.84, CHF: 0.94, JPY: 163 },
};

const baseProfile: ProfileV4 = {
  version: 4,
  budgetCurrency: "USD",
  priceRange: "1000_2000",
  wristCm: 17,
  wearingScenarios: ["office"],
  minimumWaterResistanceM: 50,
  movementTypes: ["automatic"],
  requiredComplications: [],
  allergyConstraint: "none",
};

/** The SQL predicate of watch_catalogue_quiz_window_v1, mirrored for tests.
 * The real query is checked against the database by
 * scripts/check-quiz-window-equivalence.ts. */
function inWindow(row: CatalogueMatchFacts, window: QuizCatalogueWindow) {
  if (row.reviewStatus === "rejected" || row.sourceUrl === null) return false;
  if (
    row.priceAmount === null ||
    row.priceStatus === "unconfirmed" ||
    row.priceCurrency === null
  )
    return false;
  if (
    row.caseDiameterMm === null ||
    row.caseDiameterMm < window.minDiameterMm ||
    row.caseDiameterMm > window.maxDiameterMm
  )
    return false;
  if (!row.movement?.trim()) return false;
  if (
    window.requireNickelFacts &&
    (!(row.casebackMaterial ?? row.caseMaterial) || !row.strapMaterial)
  )
    return false;
  const currency = row.priceCurrency.toUpperCase();
  return window.priceBounds.some(
    (bound) =>
      bound.currency === currency &&
      row.priceAmount! >= bound.minimum &&
      (bound.maximum === null || row.priceAmount! <= bound.maximum),
  );
}

/** A small deterministic random generator, so failures reproduce. */
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function one<T>(next: () => number, values: readonly T[]): T {
  return values[Math.floor(next() * values.length)]!;
}

function randomRow(next: () => number, index: number): CatalogueMatchFacts {
  const currency = one(next, ["USD", "USD", "USD", "EUR", "GBP", "CHF", "JPY"]);
  const amount = Math.round(next() * (currency === "JPY" ? 2_000_000 : 12_000));
  return {
    id: `00000000-0000-0000-0000-${String(index).padStart(12, "0")}`,
    identityKey: `brand${index % 23}|r:ref${index}`,
    brand: `Brand${index % 23}`,
    model: `Model ${index % 7}`,
    referenceCode: next() < 0.9 ? `REF${index}` : null,
    referenceConfirmed: next() < 0.7,
    styles: [
      one(next, ["everyday", "dress", "sport", "dive", "field"] as const),
    ],
    caseDiameterMm: next() < 0.95 ? 30 + Math.round(next() * 300) / 10 : null,
    caseThicknessMm: next() < 0.5 ? 8 + Math.round(next() * 80) / 10 : null,
    caseShape: next() < 0.5 ? one(next, ["round", "square"]) : null,
    waterResistanceM: next() < 0.8 ? one(next, [30, 50, 100, 200, 300]) : null,
    movement: one(next, [
      "automatic",
      "quartz",
      "solar",
      "hand-wound",
      null,
      " ",
    ]),
    inHouseCalibre: next() < 0.5 ? next() < 0.5 : null,
    crystal: next() < 0.5 ? one(next, ["sapphire", "mineral"]) : null,
    displayCaseback: next() < 0.5 ? next() < 0.5 : null,
    complications: next() < 0.4 ? ["date"] : [],
    caseMaterial: next() < 0.8 ? one(next, ["steel", "titanium"]) : null,
    casebackMaterial: next() < 0.5 ? one(next, ["steel", "titanium"]) : null,
    strapMaterial:
      next() < 0.8 ? one(next, ["steel", "rubber", "leather"]) : null,
    priceAmount: next() < 0.9 ? amount : null,
    priceCurrency: next() < 0.97 ? currency : null,
    priceStatus: one(next, [
      "confirmed",
      "approximate",
      "unconfirmed",
    ] as const),
    sourceUrl: next() < 0.95 ? `https://example.com/${index}` : null,
    imageUrl: next() < 0.3 ? `https://example.com/${index}.jpg` : null,
    reviewStatus: one(next, ["approved", "approved", "pending"] as const),
  };
}

/** A row near the answer, so the rules have real choices to make. */
function nearRow(
  next: () => number,
  index: number,
  profile: ProfileV4,
): CatalogueMatchFacts {
  const row = randomRow(next, index);
  const range = PRICE_RANGES.find((entry) => entry.id === profile.priceRange)!;
  const top = range.maximum ?? range.minimum * 2;
  const minimum =
    profile.caseDiameterMinMm ?? 36 + Math.round((profile.wristCm - 15) * 2);
  const maximum = profile.caseDiameterMaxMm ?? minimum + 4;
  return {
    ...row,
    priceAmount: Math.round(
      range.minimum * 0.9 + next() * (top - range.minimum) * 1.2,
    ),
    priceCurrency: next() < 0.8 ? profile.budgetCurrency : row.priceCurrency,
    priceStatus: next() < 0.9 ? "approximate" : row.priceStatus,
    caseDiameterMm:
      Math.round((minimum - 4 + next() * (maximum - minimum + 8)) * 2) / 2,
    movement: next() < 0.8 ? profile.movementTypes[0]! : row.movement,
    styles: next() < 0.7 ? ["everyday", "dress"] : row.styles,
    waterResistanceM:
      next() < 0.7
        ? profile.minimumWaterResistanceM + 50
        : row.waterResistanceM,
    casebackMaterial: next() < 0.5 ? "titanium" : row.casebackMaterial,
    strapMaterial: next() < 0.5 ? "rubber" : row.strapMaterial,
    sourceUrl:
      row.sourceUrl ?? (next() < 0.5 ? `https://example.com/n${index}` : null),
  };
}

function randomProfile(next: () => number): ProfileV4 {
  const withRange = next() < 0.5;
  const minimum = 34 + Math.round(next() * 8);
  return {
    ...baseProfile,
    budgetCurrency: one(next, ["USD", "EUR", "GBP", "CHF"] as const),
    priceRange: one(
      next,
      PRICE_RANGES.slice(0, 12).map((range) => range.id),
    ),
    wristCm: 14 + Math.round(next() * 70) / 10,
    ...(withRange
      ? { caseDiameterMinMm: minimum, caseDiameterMaxMm: minimum + 4 }
      : {}),
    wearingScenarios: [one(next, ["office", "everyday", "resort", "travel"])],
    minimumWaterResistanceM: one(next, [0, 50, 100, 200]),
    movementTypes: next() < 0.7 ? ["automatic"] : ["quartz", "solar"],
    allergyConstraint: next() < 0.2 ? "nickel_contact" : "none",
  };
}

const ids = (rows: readonly CatalogueMatchFacts[]) => rows.map((row) => row.id);

describe("quizCatalogueWindow", () => {
  it("converts the budget into every currency the rates cover", () => {
    const window = quizCatalogueWindow(baseProfile, fx);
    const usd = window.priceBounds.find((bound) => bound.currency === "USD")!;
    expect(usd.minimum).toBeLessThanOrEqual(1_000);
    expect(usd.maximum).toBeGreaterThanOrEqual(2_000);
    for (const bound of window.priceBounds) {
      // A price exactly at either end of the budget, in this currency.
      const low = convert(1_000, "USD", bound.currency, fx)!;
      const high = convert(2_000, "USD", bound.currency, fx)!;
      expect(bound.minimum).toBeLessThanOrEqual(low);
      expect(bound.maximum!).toBeGreaterThanOrEqual(high);
    }
    expect(window.priceBounds.map((bound) => bound.currency).sort()).toEqual([
      "CHF",
      "EUR",
      "GBP",
      "JPY",
      "USD",
    ]);
  });

  it("keeps only the budget currency without exchange rates", () => {
    const window = quizCatalogueWindow(
      { ...baseProfile, budgetCurrency: "EUR" },
      null,
    );
    expect(window.priceBounds.map((bound) => bound.currency)).toEqual(["EUR"]);
  });

  it("leaves an open budget open", () => {
    const window = quizCatalogueWindow(
      { ...baseProfile, priceRange: "1000000_plus" },
      fx,
    );
    expect(window.priceBounds.every((bound) => bound.maximum === null)).toBe(
      true,
    );
  });

  it("reaches 3 mm beyond the chosen case size and asks for materials only for a nickel allergy", () => {
    const window = quizCatalogueWindow(
      { ...baseProfile, caseDiameterMinMm: 38, caseDiameterMaxMm: 41 },
      fx,
    );
    expect(window.minDiameterMm).toBeLessThanOrEqual(35);
    expect(window.minDiameterMm).toBeGreaterThan(34.9);
    expect(window.maxDiameterMm).toBeGreaterThanOrEqual(44);
    expect(window.maxDiameterMm).toBeLessThan(44.1);
    expect(window.requireNickelFacts).toBe(false);
    expect(
      quizCatalogueWindow(
        { ...baseProfile, allergyConstraint: "nickel_contact" },
        fx,
      ).requireNickelFacts,
    ).toBe(true);
  });

  it("selects exactly what the whole catalogue selects, for random catalogues and answers", () => {
    const next = random(20261125);
    const selected = { main: 0, close: 0, broader: 0, outsideWindow: 0 };
    for (let trial = 0; trial < 300; trial++) {
      const profile = randomProfile(next);
      const rows = Array.from({ length: 160 }, (_, index) =>
        index % 5 < 3
          ? nearRow(next, trial * 1_000 + index, profile)
          : randomRow(next, trial * 1_000 + index),
      ).sort(
        (a, b) =>
          a.brand.localeCompare(b.brand) ||
          a.model.localeCompare(b.model) ||
          a.id.localeCompare(b.id),
      );
      const rates = next() < 0.9 ? fx : null;
      const window = quizCatalogueWindow(profile, rates);
      const windowRows = rows.filter((row) => inWindow(row, window));
      selected.outsideWindow += rows.length - windowRows.length;

      const whole = matchCatalogue(rows, profile, rates);
      const part = matchCatalogue(windowRows, profile, rates);
      expect(ids(part.main)).toEqual(ids(whole.main));
      expect(ids(part.alsoWorth)).toEqual(ids(whole.alsoWorth));

      const taken = new Set(
        [...whole.main, ...whole.alsoWorth].map((row) => row.identityKey),
      );
      const closeWhole = nearFits(rows, profile, rates, 30, taken);
      const closePart = nearFits(windowRows, profile, rates, 30, taken);
      expect(closePart).toEqual(closeWhole);
      const broaderWhole = broaderNearFits(rows, profile, rates, 30, taken);
      const broaderPart = broaderNearFits(
        windowRows,
        profile,
        rates,
        30,
        taken,
      );
      expect(broaderPart).toEqual(broaderWhole);

      // Every selected row is inside the window, so the database cannot
      // leave out a watch the rules would show.
      selected.main += whole.main.length + whole.alsoWorth.length;
      selected.close += closeWhole.length;
      selected.broader += broaderWhole.length;
      for (const row of [
        ...whole.main,
        ...whole.alsoWorth,
        ...closeWhole.map((entry) => entry.watch),
        ...broaderWhole.map((entry) => entry.watch),
      ]) {
        expect(inWindow(row, window)).toBe(true);
        expect(priceIn(row, profile.budgetCurrency, rates)).not.toBeNull();
      }
    }
    // The comparison must not pass vacuously: every kind of pick occurs, and
    // the window really leaves rows out.
    expect(selected.main).toBeGreaterThan(50);
    expect(selected.close).toBeGreaterThan(50);
    expect(selected.broader).toBeGreaterThan(50);
    expect(selected.outsideWindow).toBeGreaterThan(300 * 100);
  });
});

describe("loadQuizWindow", () => {
  const client = (payload: unknown): CatalogueClient => ({
    config: { supabaseUrl: "https://db.example", serviceKey: "sb_secret_test" },
    fetchImpl: async () => Response.json(payload),
  });
  const values = QUIZ_WINDOW_COLUMNS.map((column) => {
    switch (column) {
      case "id":
        return "00000000-0000-0000-0000-000000000001";
      case "identityKey":
        return "brand|r:ref1";
      case "brand":
        return "Brand";
      case "model":
        return "Model";
      case "referenceConfirmed":
        return true;
      case "styles":
        return ["everyday"];
      case "complications":
        return [];
      case "caseDiameterMm":
        return "40.5";
      case "priceAmount":
        return 1_500;
      case "priceCurrency":
        return "USD";
      case "priceStatus":
        return "approximate";
      case "reviewStatus":
        return "approved";
      default:
        return null;
    }
  });

  it("reads rows by column name", async () => {
    const [row] = await loadQuizWindow(
      client({ columns: QUIZ_WINDOW_COLUMNS, rows: [values] }),
      quizCatalogueWindow(baseProfile, fx),
    );
    expect(row).toMatchObject({
      brand: "Brand",
      caseDiameterMm: 40.5,
      priceAmount: 1_500,
      reviewStatus: "approved",
    });
  });

  it("fails loudly when the database sends other columns", async () => {
    await expect(
      loadQuizWindow(
        client({
          columns: [...QUIZ_WINDOW_COLUMNS].reverse(),
          rows: [values],
        }),
        quizCatalogueWindow(baseProfile, fx),
      ),
    ).rejects.toThrow("unexpected columns");
  });
});
