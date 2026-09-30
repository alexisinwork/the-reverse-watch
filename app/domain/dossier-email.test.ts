import { renderDossierEmail } from "./dossier-email";
import type { ProfileV4 } from "./questionnaire-v4";

const profile: ProfileV4 = {
  version: 4,
  budgetCurrency: "EUR",
  priceRange: "3000_4000",
  wristCm: 17.5,
  wearingScenarios: ["office"],
  minimumWaterResistanceM: 100,
  movementTypes: ["automatic"],
  requiredComplications: [],
  allergyConstraint: "none",
};

describe("renderDossierEmail", () => {
  it("lists the found watches with sources, images, and the search boundary", () => {
    const email = renderDossierEmail({
      profile,
      aiSearch: {
        status: "found",
        fromCache: false,
        summary: "Two strong fits.",
        watches: [
          {
            brand: "Longines",
            model: "Conquest 38",
            referenceCode: "L3.720.4.92.6",
            sourceUrl: "https://www.longines.com/conquest",
            imageUrl: "https://images.example/conquest.jpg",
            priceNote: "about EUR 2,300 new",
            rationale: "38 mm automatic with 100 m water resistance.",
            details: {},
          },
        ],
      },
    });

    expect(email.subject).toBe("Your Reserve reference diagnostic dossier");
    expect(email.text).toContain("Price range: EUR 3k–4k.");
    expect(email.text).toContain("Wrist: 17.5 cm (cases 38-42 mm).");
    expect(email.text).toContain(
      "1. Longines Conquest 38 (ref. L3.720.4.92.6)",
    );
    // Source links are never sent: they are often wrong (owner decision).
    expect(email.text).not.toContain("https://www.longines.com/conquest");
    expect(email.html).toContain(
      '<img src="https://images.example/conquest.jpg"',
    );
    expect(email.html).not.toContain("<a href=");
    expect(email.html).not.toContain("undefined");
  });

  it("escapes model output in the HTML body", () => {
    const email = renderDossierEmail({
      profile,
      aiSearch: {
        status: "found",
        fromCache: true,
        summary: "<script>alert(1)</script>",
        watches: [
          {
            brand: "A<b>",
            model: "M",
            referenceCode: null,
            sourceUrl: "https://example.com/?a=1&b=2",
            imageUrl: null,
            priceNote: null,
            rationale: "fits",
            details: {},
          },
        ],
      },
    });

    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("A&lt;b&gt;");
    expect(email.html).not.toContain("example.com");
  });

  it("explains an empty result instead of listing watches", () => {
    const email = renderDossierEmail({
      profile,
      aiSearch: { status: "unavailable" },
    });

    expect(email.text).toContain("The search was unavailable");
    expect(email.html).not.toContain("<article>");
  });
});
