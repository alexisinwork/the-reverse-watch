import type { QuestionnaireProfile } from "./questionnaire";
import { QUESTIONNAIRE_VERSION } from "./questionnaire";
import {
  evaluateHardFilterPartition,
  MAX_LUG_TO_LUG_TO_WRIST_RATIO,
  recommendWatches,
} from "./recommendation";
import { seedCatalogue } from "./seed-catalogue";

const baseProfile: QuestionnaireProfile = {
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
};

const TEST_AS_OF = "2026-08-28T20:00:00Z";

function recommend(profile: QuestionnaireProfile, catalogue = seedCatalogue) {
  return recommendWatches(profile, catalogue, { asOf: TEST_AS_OF });
}

describe("deterministic recommendation engine", () => {
  it("returns a fully verified precision GMT without hard-filter violations", () => {
    const result = recommend(baseProfile);
    expect(result.recommendations.map((candidate) => candidate.id)).toEqual([
      "grand-seiko-sbgn029",
    ]);
    expect(result.recommendations[0]?.hardReasons).toHaveLength(0);
    expect(result.recommendations[0]?.missingFacts).toHaveLength(0);
  });

  it("never lets a missing hard fact pass as a confirmed recommendation", () => {
    const result = recommend({
      ...baseProfile,
      core: {
        ...baseProfile.core,
        budgetMax: 500,
        requiredComplications: [],
        datePreference: "either",
      },
    });
    expect(
      result.recommendations.some(
        (candidate) => candidate.id === "citizen-bn0150-28e",
      ),
    ).toBe(false);
    expect(
      result.verificationRequired.some(
        (candidate) =>
          candidate.id === "citizen-bn0150-28e" &&
          candidate.missingFacts.some((fact) => fact.code === "lug_to_lug"),
      ),
    ).toBe(true);
  });

  it("enforces the conservative fit ratio at the exact boundary", () => {
    const seiko = seedCatalogue.variants.find(
      (variant) => variant.id === "seiko-ssc813",
    );
    expect(seiko?.geometry.lugToLugMm).toBe(45.5);
    const boundaryWrist = 45.5 / MAX_LUG_TO_LUG_TO_WRIST_RATIO;
    const result = recommend({
      ...baseProfile,
      core: {
        ...baseProfile.core,
        budgetMax: 1_000,
        wristCircumferenceMm: boundaryWrist,
        weightLimit: "no_limit",
        requiredComplications: ["chronograph"],
        datePreference: "required",
      },
    });
    expect(result.recommendations[0]?.id).toBe("seiko-ssc813");
  });

  it("uses verified overall case length for rectangular-watch fit", () => {
    const rectangularCatalogue = structuredClone(seedCatalogue);
    const grandSeiko = rectangularCatalogue.variants.find(
      (variant) => variant.id === "grand-seiko-sbgn029",
    )!;
    grandSeiko.geometry.caseDiameterMm = null;
    grandSeiko.geometry.caseWidthMm = 22;
    grandSeiko.geometry.caseLengthMm = 60;
    grandSeiko.geometry.lugToLugMm = null;
    grandSeiko.evidence = grandSeiko.evidence.map((entry) => ({
      ...entry,
      fields: entry.fields.filter((field) => field !== "lugToLugMm"),
    }));
    grandSeiko.evidence[0]!.fields.push("caseWidthMm", "caseLengthMm");

    const result = evaluateHardFilterPartition(
      baseProfile,
      rectangularCatalogue,
      { asOf: TEST_AS_OF },
    );
    expect(result["grand-seiko-sbgn029"]?.hardReasons).toContain(
      "fit_exceeds_wrist",
    );
  });

  it("suppresses speculative rows unless both explicit gates are present", () => {
    const speculativeCatalogue = structuredClone(seedCatalogue);
    const grandSeiko = speculativeCatalogue.variants.find(
      (variant) => variant.id === "grand-seiko-sbgn029",
    );
    expect(grandSeiko).toBeDefined();
    grandSeiko!.market.speculativeBubble = true;
    grandSeiko!.evidence.push({
      sourceId: "grand-seiko-sbgn029",
      fields: ["market"],
    });

    const suppressed = recommend(baseProfile, speculativeCatalogue);
    expect(suppressed.recommendations).toHaveLength(0);
    expect(
      suppressed.whyNot.find(
        (candidate) => candidate.id === "grand-seiko-sbgn029",
      )?.hardReasons,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "speculative_suppressed" }),
      ]),
    );

    const accepted = recommend(
      {
        ...baseProfile,
        refinement: {
          acquisitionChannels: ["authorized_dealer", "secondary_market"],
          speculativeRiskTolerance: "accept",
        },
      },
      speculativeCatalogue,
    );
    expect(accepted.recommendations[0]?.id).toBe("grand-seiko-sbgn029");
  });

  it("proposes rather than silently applies the last budget relaxation", () => {
    const result = recommend({
      ...baseProfile,
      core: { ...baseProfile.core, budgetMax: 3_500 },
    });
    expect(result.recommendations).toHaveLength(0);
    expect(result.relaxations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "budget_plus_10_percent" }),
      ]),
    );
  });

  it("moves cross-currency candidates to verification when FX expires", () => {
    const result = recommendWatches(
      {
        ...baseProfile,
        core: {
          ...baseProfile.core,
          budgetCurrency: "EUR",
          budgetMax: 4_000,
        },
      },
      seedCatalogue,
      { asOf: "2026-09-05T00:00:00Z" },
    );

    expect(result.recommendations).toHaveLength(0);
    expect(result.verificationRequired[0]?.missingFacts).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "fx_rate" })]),
    );
  });

  it("rejects an invalid evaluation timestamp", () => {
    expect(() =>
      recommendWatches(baseProfile, seedCatalogue, { asOf: "not-a-date" }),
    ).toThrow(RangeError);
  });

  it("accepts an exact external hard-filter partition as authoritative", () => {
    const hardFilterEvaluation = evaluateHardFilterPartition(
      baseProfile,
      seedCatalogue,
      { asOf: TEST_AS_OF },
    );
    hardFilterEvaluation["grand-seiko-sbgn029"] = {
      hardReasons: ["over_budget"],
      missingFacts: [],
    };

    const result = recommendWatches(baseProfile, seedCatalogue, {
      asOf: TEST_AS_OF,
      hardFilterEvaluation,
    });

    expect(result.recommendations).toHaveLength(0);
    expect(result.whyNot).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "grand-seiko-sbgn029",
          hardReasons: [expect.objectContaining({ code: "over_budget" })],
        }),
      ]),
    );
  });

  it("rejects a hard-filter partition that omits a catalogue variant", () => {
    const hardFilterEvaluation = evaluateHardFilterPartition(
      baseProfile,
      seedCatalogue,
      { asOf: TEST_AS_OF },
    );
    delete hardFilterEvaluation["grand-seiko-sbgn029"];

    expect(() =>
      recommendWatches(baseProfile, seedCatalogue, {
        asOf: TEST_AS_OF,
        hardFilterEvaluation,
      }),
    ).toThrow(/does not match the catalogue/i);
  });

  it("applies premium headroom only to an eligible candidate price channel", () => {
    const rolexOnly = structuredClone(seedCatalogue);
    rolexOnly.variants = rolexOnly.variants.filter(
      (variant) => variant.id === "rolex-124273",
    );
    const profile: QuestionnaireProfile = {
      core: {
        ...baseProfile.core,
        budgetMax: 10_000,
        ownershipFriction: "workhorse_mechanical",
        accuracyTolerance: "no_requirement",
        weightLimit: "no_limit",
        requiredComplications: [],
        datePreference: "forbidden",
      },
      refinement: {
        acquisitionChannels: ["authorized_dealer", "secondary_market"],
        premiumAllowancePercent: 50,
      },
    };

    const authorizedPrice = recommend(profile, rolexOnly);
    expect(authorizedPrice.whyNot[0]?.hardReasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "over_budget" }),
      ]),
    );

    rolexOnly.variants[0]!.price.channels = ["secondary_market"];
    const secondaryPrice = recommend(profile, rolexOnly);
    expect(secondaryPrice.whyNot).toHaveLength(0);
    expect(secondaryPrice.verificationRequired[0]?.id).toBe("rolex-124273");
  });

  it("requires country-specific purchase and service evidence", () => {
    const result = recommend({
      ...baseProfile,
      refinement: {
        purchaseCountry: "PL",
        serviceCountry: "PL",
      },
    });

    expect(result.recommendations).toHaveLength(0);
    expect(result.verificationRequired[0]?.missingFacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "purchase_country" }),
        expect.objectContaining({ code: "service_country" }),
      ]),
    );
  });

  it("discloses soft preferences that the seed cannot score", () => {
    const result = recommend({
      ...baseProfile,
      refinement: {
        provenancePreference: "sovereign_independent",
        cosmeticTolerance: "keep_looking_new",
      },
    });

    expect(result.unscoredPreferences.map((item) => item.field)).toEqual([
      "provenancePreference",
      "cosmeticTolerance",
    ]);
  });
});
