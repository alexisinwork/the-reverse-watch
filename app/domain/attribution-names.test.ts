import { describe, expect, it } from "vitest";

import {
  distinctiveModelWords,
  passageTiesSighting,
  personNames,
  samePerson,
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
