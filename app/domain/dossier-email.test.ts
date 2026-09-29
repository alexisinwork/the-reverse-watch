import { renderDossierEmail } from "./dossier-email";
import { normalizeProfileV3, QUESTIONNAIRE_V3_VERSION } from "./questionnaire-v3";

const profile = normalizeProfileV3({
  version: QUESTIONNAIRE_V3_VERSION,
  budgetCurrency: "EUR",
  budgetMax: 4000,
  wearingScenarios: ["office"],
  minimumWaterResistanceM: 100,
  caseDiameterMinMm: 38,
  caseDiameterMaxMm: 41,
  movementTypes: ["automatic"],
  requiredComplications: [],
  allergyConstraint: "none",
});

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
          },
        ],
      },
    });

    expect(email.subject).toBe("Your Reserve reference diagnostic dossier");
    expect(email.text).toContain("Budget ceiling: EUR 4,000.");
    expect(email.text).toContain("1. Longines Conquest 38 (ref. L3.720.4.92.6)");
    expect(email.text).toContain("Source: https://www.longines.com/conquest");
    expect(email.html).toContain('<img src="https://images.example/conquest.jpg"');
    expect(email.html).toContain('<a href="https://www.longines.com/conquest">');
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
          },
        ],
      },
    });

    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("A&lt;b&gt;");
    expect(email.html).toContain("https://example.com/?a=1&amp;b=2");
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
