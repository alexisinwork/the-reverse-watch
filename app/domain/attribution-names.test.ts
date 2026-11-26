import { describe, expect, it } from "vitest";

import {
  brandNames,
  distinctiveModelWords,
  sameBrand,
  passageTiesSighting,
  personNames,
  roleAttribution,
  samePerson,
  sameWork,
} from "./attribution-names";

describe("personNames", () => {
  it("lists every name a provider's wearer attribution contains", () => {
    expect(personNames("James Bond (Daniel Craig)")).toEqual([
      "james bond daniel craig",
      "daniel craig",
      "james bond",
    ]);
    expect(personNames("Mads Mikkelsen as Le Chiffre")).toEqual([
      "mads mikkelsen as le chiffre",
      "mads mikkelsen",
      "le chiffre",
    ]);
    expect(personNames("Colonel Walter E. Kurtz")).toContain("walter e kurtz");
    expect(personNames(null)).toEqual([]);
  });

  it("treats one shared name as the same wearer, and none as a conflict", () => {
    expect(samePerson("Daniel Craig", "James Bond (Daniel Craig)")).toBe(true);
    expect(samePerson("Naomie Harris", "Daniel Craig")).toBe(false);
  });
});

describe("distinctiveModelWords", () => {
  it("drops brand, reference, colours, materials and bare sizes", () => {
    expect(
      distinctiveModelWords({
        brand: "Omega",
        model:
          "Seamaster Planet Ocean 600M Co-Axial 45.5 Stainless Steel / Black / Rubber",
        referenceCode: "2900.50.91",
      }),
    ).toEqual(["seamaster", "planet", "ocean", "600m"]);
  });
});

describe("passageTiesSighting", () => {
  const planetOcean = {
    brand: "Omega",
    model: "Seamaster Planet Ocean 600M",
    referenceCode: "2900.50.91",
    details: { person: "James Bond (Daniel Craig)", work: "Casino Royale" },
  };

  it("accepts a passage naming the brand, model, one name of the wearer and the film", () => {
    expect(
      passageTiesSighting(
        "Daniel Craig wore the Omega Seamaster Planet Ocean in Casino Royale.",
        planetOcean,
      ),
    ).toBe(true);
  });

  it("accepts the exact reference in place of the model name", () => {
    expect(
      passageTiesSighting(
        "In Casino Royale, Daniel Craig wears Omega 2900.50.91.",
        planetOcean,
      ),
    ).toBe(true);
  });

  it("rejects a passage that names only the brand", () => {
    expect(
      passageTiesSighting(
        "Daniel Craig wore an Omega in Casino Royale.",
        planetOcean,
      ),
    ).toBe(false);
  });

  it("rejects a passage about another model of the same family", () => {
    expect(
      passageTiesSighting(
        "Daniel Craig wore the Omega Seamaster Aqua Terra in Casino Royale.",
        planetOcean,
      ),
    ).toBe(false);
  });

  it("rejects a passage about another wearer (the Skyfall correction)", () => {
    expect(
      passageTiesSighting(
        "Eve wears an Omega Seamaster Aqua Terra 231.10.30.20.06.001 in Skyfall.",
        {
          brand: "Omega",
          model: "Seamaster Aqua Terra",
          referenceCode: "231.10.30.20.06.001",
          details: { person: "Daniel Craig", work: "Skyfall" },
        },
      ),
    ).toBe(false);
  });
});

describe("sameWork", () => {
  it("matches a title with or without its year and leading article", () => {
    expect(sameWork("Casino Royale (2006)", "Casino Royale")).toBe(true);
    expect(sameWork("The Martian", "Martian")).toBe(true);
    expect(sameWork("Casino Royale", "Casino")).toBe(false);
    expect(sameWork(null, "Casino")).toBe(false);
  });

  it("lets a character search accept the provider's fuller attribution", () => {
    expect(samePerson("John Wick (Keanu Reeves)", "John Wick")).toBe(true);
    expect(samePerson("Keanu Reeves as John Wick", "John Wick")).toBe(true);
    expect(samePerson("Keanu Reeves", "John Wick")).toBe(false);
  });
});

describe("brand spellings", () => {
  it("knows Bulgari's house spelling and ignores spaces", () => {
    expect(brandNames("Bvlgari")).toEqual(["bvlgari", "bulgari"]);
    expect(sameBrand("Bulgari", "BVLGARI")).toBe(true);
    expect(sameBrand("TAGHeuer", "TAG Heuer")).toBe(true);
    expect(sameBrand("Omega", "Longines")).toBe(false);
    expect(sameBrand("Casio G-Shock", "Casio")).toBe(true);
    expect(sameBrand("Heuer", "TAG Heuer")).toBe(true);
    expect(sameBrand("Grand Seiko", "Seiko")).toBe(false);
    expect(sameBrand(null, "Omega")).toBe(false);
  });
});

describe("a role on an actor's card", () => {
  it("keeps the role only beside a film, and only for the person searched", () => {
    expect(
      roleAttribution(
        "Matthew McConaughey",
        "Mark Hanna (Matthew McConaughey)",
        "The Wolf of Wall Street",
      ),
    ).toEqual({
      person: "Mark Hanna (Matthew McConaughey)",
      work: "The Wolf of Wall Street",
    });
    expect(
      roleAttribution(
        "Mark Hanna",
        "Mark Hanna (Matthew McConaughey)",
        "The Wolf of Wall Street",
      ),
    ).toEqual({
      person: "Mark Hanna (Matthew McConaughey)",
      work: "The Wolf of Wall Street",
    });
    expect(
      roleAttribution(
        "Matthew McConaughey",
        "Mark Hanna (Matthew McConaughey)",
        null,
      ),
    ).toEqual({ person: "Matthew McConaughey", work: null });
    expect(
      roleAttribution(
        "Matthew McConaughey",
        "Matthew McConaughey",
        "Interstellar",
      ),
    ).toEqual({ person: "Matthew McConaughey", work: null });
    expect(
      roleAttribution("Heath Ledger", "Joaquin Phoenix as the Joker", "Joker"),
    ).toEqual({ person: "Heath Ledger", work: null });
    expect(
      roleAttribution(
        "Heath Ledger",
        "The Joker (Heath Ledger)",
        "https://example.com",
      ),
    ).toEqual({ person: "Heath Ledger", work: null });
  });

  it("lets a passage name the role, together with the film", () => {
    const card = {
      brand: "Rolex",
      model: "16233",
      referenceCode: "16233",
      details: {
        person: "Mark Hanna (Matthew McConaughey)",
        work: "The Wolf of Wall Street",
      },
    };
    expect(
      passageTiesSighting(
        "Rolex Datejust 16233 - Mark Hanna in The Wolf of Wall Street",
        card,
      ),
    ).toBe(true);
    expect(
      passageTiesSighting(
        "Hanna wears a two-tone Rolex Datejust 16233 through all of it.",
        card,
      ),
    ).toBe(false);
    expect(
      passageTiesSighting("Mark Hanna wears a Rolex Datejust 16233.", card),
    ).toBe(false);
  });
});
