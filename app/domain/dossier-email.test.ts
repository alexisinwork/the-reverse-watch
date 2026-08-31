import { normalizeProfile, QUESTIONNAIRE_VERSION } from "./questionnaire";
import { recommendWatches } from "./recommendation";
import { seedCatalogue } from "./seed-catalogue";
import { renderDossierEmail } from "./dossier-email";

const profile = normalizeProfile({
  core: {
    version: QUESTIONNAIRE_VERSION,
    budgetCurrency: "USD",
    budgetMax: 4_000,
    wristCircumferenceMm: 170,
    deploymentEnvironment: "field_water_abuse",
    ownershipFriction: "zero_maintenance",
    accuracyTolerance: "seconds_per_month",
    weightLimit: "under_160_g",
    requiredComplications: ["gmt"],
    datePreference: "required",
  },
});

describe("source-backed dossier renderer", () => {
  it("renders deterministic facts, source links, and an explicit narrative boundary", () => {
    const recommendation = recommendWatches(profile, seedCatalogue, {
      asOf: "2026-08-28T20:00:00Z",
    });
    const first = renderDossierEmail({
      profile,
      recommendation,
    });

    expect(first.subject).toBe("Your Reserve reference diagnostic dossier");
    expect(first.text).toContain(
      "No reviewed historical narrative is attached",
    );
    expect(first.text).toContain("The Watch");
    expect(first.text).toContain("The Mechanism");
    expect(first.text).toContain("The Historical Reality");
    expect(first.text).toContain("The Psychological Fit");
    expect(first.text).toContain("Grand Seiko");
    expect(first.text).toContain("https://");
    expect(first.html).toContain("<a href=");
    expect(first.html).not.toContain("undefined");
    expect(`${first.text} ${first.html}`).not.toMatch(
      /supabase|bundled_seed|engine v|catalogue v|intent core/i,
    );
    expect(first).toEqual(
      renderDossierEmail({
        profile,
        recommendation,
      }),
    );
  });
});
