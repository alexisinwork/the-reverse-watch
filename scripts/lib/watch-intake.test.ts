import { describe, expect, it } from "vitest";
import {
  compareIntake,
  dimension,
  normalizeBrand,
  splitReference,
  type ExistingWatch,
} from "./watch-intake";

const intake = (ref = "SKX007J", diameter = "42.00 mm") =>
  normalizeBrand(
    {
      brand_slug: "seiko",
      collections: [
        {
          references: [
            {
              slug: ref,
              url: "/seiko/test",
              specs: { Brand: "Seiko", Reference: ref, Diameter: diameter },
            },
          ],
        },
      ],
    },
    "commit",
  );
const existing = (
  ref: string,
  diameter: number | null = 42,
): ExistingWatch => ({
  id: "existing-id",
  brand: "Seiko",
  referenceCode: ref,
  caseDiameterMm: diameter,
  caseThicknessMm: null,
  waterResistanceM: null,
  reviewStatus: "approved",
});

describe("local watch intake safety", () => {
  it("keeps market suffixes distinct", () => {
    expect(compareIntake(intake(), [existing("SKX007K1")])[0]?.status).toBe(
      "new_candidate",
    );
  });
  it("keeps explicit aliases separate and requires review to link", () => {
    const rows = intake("SKX007 (aka: SKX007K1)");
    expect(rows[0]?.reference).toBe("SKX007");
    expect(rows[0]?.aliases).toEqual(["SKX007K1"]);
    expect(compareIntake(rows, [existing("SKX007K1")])[0]?.status).toBe(
      "alias_or_format_candidate",
    );
  });
  it("does not parse ranges, wrong units or descriptive numbers as facts", () => {
    for (const raw of [
      "40-42 mm",
      "42",
      "42 cm",
      "approx. 42 mm",
      "42 mm / 49 mm",
    ])
      expect(dimension(raw, "mm")).toBeNull();
    expect(dimension("42.50 mm", "mm")).toBe(42.5);
  });
  it("preserves field evidence and null facts without images/defaults", () => {
    const row = intake()[0]!;
    expect(row.waterResistanceM).toBeNull();
    expect(row.referenceConfirmed).toBe(false);
    expect(row.eligibility).toBe("research_only");
    expect(row.evidence.find((e) => e.field === "Diameter")?.pointer).toBe(
      "/collections/0/references/0/specs/Diameter",
    );
    expect(row).not.toHaveProperty("imageUrl");
    expect(row).not.toHaveProperty("priceAmount");
  });
  it("reports numeric conflicts without changing either input", () => {
    const rows = intake();
    const old = existing("SKX007J", 41);
    expect(compareIntake(rows, [old])[0]?.status).toBe("conflict");
    expect(rows[0]?.caseDiameterMm).toBe(42);
    expect(old.caseDiameterMm).toBe(41);
  });
  it("marks duplicate source identity and duplicate existing matches ambiguous", () => {
    expect(
      compareIntake([...intake(), ...intake()], [existing("SKX007J")])[0]
        ?.status,
    ).toBe("ambiguous");
    expect(
      compareIntake(intake(), [existing("SKX007J"), existing("SKX007J")])[0]
        ?.status,
    ).toBe("ambiguous");
  });
  it("requires identity and keeps formatting matches out of exact matches", () => {
    expect(splitReference(null).reference).toBeNull();
    expect(compareIntake(intake(""), [existing("SKX007J")])[0]?.status).toBe(
      "missing_identity",
    );
    expect(
      compareIntake(intake("T137.210"), [existing("T137210")])[0]?.status,
    ).toBe("alias_or_format_candidate");
    expect(compareIntake(intake(), [existing("skx007j")])[0]?.status).toBe(
      "exact_candidate",
    );
  });
});
