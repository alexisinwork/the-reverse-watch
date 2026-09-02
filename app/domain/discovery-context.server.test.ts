import { findPublishedDiscoveryStory } from "./discovery-public";
import {
  discoverySoftPreferences,
  explainStoryConstraint,
  parseDiscoveryStorySlug,
} from "./discovery-context.server";
import { recommendWatches } from "./recommendation";
import type { QuestionnaireProfile } from "./questionnaire";
import { seedCatalogue } from "./seed-catalogue";

const profile: QuestionnaireProfile = {
  core: {
    version: 2,
    budgetCurrency: "USD" as const,
    budgetMax: 4_000,
    wristCircumferenceMm: 170,
    deploymentEnvironment: "studio_desk_daily" as const,
    ownershipFriction: "workhorse_mechanical" as const,
    accuracyTolerance: "no_requirement" as const,
    weightLimit: "no_limit" as const,
    requiredComplications: [],
    datePreference: "either" as const,
  },
};

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
    const recommendation = recommendWatches(
      {
        ...profile,
        core: { ...profile.core, budgetMax: 500 },
      },
      grandSeikoOnly,
      {
        storyContext: {
          socialSignal: "discreet_competence",
          aestheticDna: "structural_tool",
        },
      },
    );

    const explanation = explainStoryConstraint(story, recommendation);
    expect(explanation.status).toBe("fails_hard_constraints");
    expect(explanation.hardReasons).toContain("over_budget");
  });

  it("reports family-only or stale attributions as outside the exact catalogue", () => {
    const story = findPublishedDiscoveryStory(
      "murph-cooper-interstellar-hamilton",
    )!;
    const recommendation = recommendWatches(profile, seedCatalogue);
    expect(explainStoryConstraint(story, recommendation).status).toBe(
      "not_in_reviewed_catalogue",
    );
  });
});
