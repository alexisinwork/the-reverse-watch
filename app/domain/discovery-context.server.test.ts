import { findPublishedDiscoveryStory } from "./discovery-public";
import {
  discoverySoftPreferences,
  explainStoryConstraint,
  parseDiscoveryStorySlug,
} from "./discovery-context.server";
import { recommendWatchesV3 } from "./recommendation";
import { profileV3Schema } from "./questionnaire-v3";
import { seedCatalogue } from "./seed-catalogue";

const profile = profileV3Schema.parse({
  version: 3,
  budgetCurrency: "USD",
  budgetMax: 4_000,
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

describe("validated discovery story context", () => {
  it("accepts bounded slugs and rejects forged query values", () => {
    expect(parseDiscoveryStorySlug("don-draper-mad-men-omega")).toEqual({
      status: "valid",
      slug: "don-draper-mad-men-omega",
    });
    expect(parseDiscoveryStorySlug(null)).toEqual({
      status: "none",
      slug: null,
    });
    expect(parseDiscoveryStorySlug("../private").status).toBe("invalid");
    expect(parseDiscoveryStorySlug("DON-DRAPER").status).toBe("invalid");
    expect(parseDiscoveryStorySlug("a".repeat(121)).status).toBe("invalid");
  });

  it("keeps only reviewed traits as soft preferences", () => {
    expect(
      discoverySoftPreferences({
        socialSignal: "anti_luxury",
        aestheticDna: "structural_tool",
      }),
    ).toEqual({
      socialSignal: "anti_luxury",
      aestheticDna: "structural_tool",
    });
  });

  it("explains hard rejection without allowing story context to override it", () => {
    const story = structuredClone(
      findPublishedDiscoveryStory("don-draper-mad-men-omega")!,
    );
    story.attribution.reference = "SBGN029";
    const grandSeikoOnly = structuredClone(seedCatalogue);
    grandSeikoOnly.variants = grandSeikoOnly.variants.filter(
      (variant) => variant.id === "grand-seiko-sbgn029",
    );
    const recommendation = recommendWatchesV3(
      { ...profile, budgetMax: 500 },
      grandSeikoOnly,
    );

    const explanation = explainStoryConstraint(story, recommendation);
    expect(explanation.status).toBe("fails_hard_constraints");
    expect(explanation.hardReasons).toContain("over_budget");
  });

  it("reports family-only or stale attributions as outside the exact catalogue", () => {
    const story = findPublishedDiscoveryStory(
      "murph-cooper-interstellar-hamilton",
    )!;
    const recommendation = recommendWatchesV3(profile, seedCatalogue);
    expect(explainStoryConstraint(story, recommendation).status).toBe(
      "not_in_reviewed_catalogue",
    );
  });
});
