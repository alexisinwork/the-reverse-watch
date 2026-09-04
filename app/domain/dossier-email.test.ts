import { normalizeProfileV3, profileV3Schema } from "./questionnaire-v3";
import { recommendWatchesV3 } from "./recommendation";
import { seedCatalogue } from "./seed-catalogue";
import { renderDossierEmailV3 } from "./dossier-email";

const parsed = profileV3Schema.parse({
  version: 3,
  budgetCurrency: "USD",
  budgetMax: 1_000_000,
  wearingScenarios: [
    "everyday",
    "office",
    "smart_casual",
    "suit",
    "evening",
    "reception",
    "sport",
    "field",
    "diving",
  ],
  minimumWaterResistanceM: 0,
  caseDiameterMinMm: 20,
  caseDiameterMaxMm: 60,
  movementTypes: [
    "automatic",
    "manual",
    "quartz",
    "solar",
    "spring_drive",
    "hybrid",
  ],
  requiredComplications: [],
  allergyConstraint: "none",
});
const profile = normalizeProfileV3(parsed);

describe("source-backed dossier renderer", () => {
  it("renders deterministic facts, source links, and an explicit narrative boundary", () => {
    const recommendation = recommendWatchesV3(parsed, seedCatalogue, {
      asOf: "2026-08-28T20:00:00Z",
    });
    const first = renderDossierEmailV3({ profile, recommendation });

    expect(first.subject).toBe("Your Reserve reference diagnostic dossier");
    expect(first.text).toContain(
      "No reviewed historical narrative is attached",
    );
    expect(first.text).toContain("The Watch");
    expect(first.text).toContain("The Mechanism");
    expect(first.text).toContain("The Historical Reality");
    expect(first.text).toContain("The Psychological Fit");
    expect(first.text).toContain("Wearing scenarios:");
    expect(first.text).toContain("https://");
    expect(first.html).toContain("<a href=");
    expect(first.html).not.toContain("undefined");
    expect(`${first.text} ${first.html}`).not.toMatch(
      /supabase|bundled_seed|engine v|catalogue v|intent core/i,
    );
    expect(first).toEqual(renderDossierEmailV3({ profile, recommendation }));
  });
});
