import { describe, expect, it } from "vitest";

import {
  dialsFacts,
  dialsIdentityKey,
  dialsModelSchema,
  dialsMovement,
  dialsSupplementalDetails,
  dialsStyles,
} from "./dials-catalogue-import";

const model = dialsModelSchema.parse({
  id: "example",
  slug: "seamaster-diver-300m-21030422001001",
  name: "Seamaster Diver 300M",
  referenceNumber: "210.30.42.20.01.001",
  brand: { name: "Omega", slug: "omega" },
  series: { name: "Seamaster", slug: "seamaster" },
  diameter: 42,
  thickness: 13.5,
  waterResistance: 300,
  caseMaterials: ["Stainless Steel"],
  bandMaterials: ["Stainless Steel"],
  glass: "Sapphire",
  back: "Open",
  caliber: {
    name: "Omega caliber 8800",
    reference: "8800",
    movement: "Automatic",
    powerReserve: 48,
    complications: [{ name: "Date", slug: "date", type: "DATE" }],
  },
  pictures: [{ url: "https://images.dials.co/no-hotlink.png" }],
});

describe("Dials local catalogue normalization", () => {
  it("uses exact brand and reference identities", () => {
    expect(dialsIdentityKey(model)).toBe("omega|r:21030422001001");
  });

  it("normalizes only supported movement values", () => {
    expect(dialsMovement("Handwound")).toBe("manual");
    expect(dialsMovement("Meca-quartz")).toBe("hybrid");
    expect(dialsMovement("Unknown drive")).toBeNull();
  });

  it("retains usable specs but excludes image URLs from mapped facts", () => {
    expect(dialsFacts(model)).toMatchObject({
      caseDiameterMm: 42,
      waterResistanceM: 300,
      movement: "automatic",
      displayCaseback: true,
    });
    expect(dialsFacts(model)).not.toHaveProperty("imageUrl");
    expect(dialsSupplementalDetails(model)).toMatchObject({
      Series: "Seamaster",
      "Calibre reference": "8800",
      "Power reserve (hours)": 48,
      Complications: "Date",
    });
    expect(dialsSupplementalDetails(model)).not.toHaveProperty("pictures");
  });

  it("uses explicit strong style cues only", () => {
    expect(dialsStyles(model)).toEqual(["dive"]);
    expect(
      dialsStyles(
        dialsModelSchema.parse({
          ...model,
          name: "Reference 123",
          series: null,
          description: null,
          waterResistance: null,
        }),
      ),
    ).toEqual([]);
  });
});
