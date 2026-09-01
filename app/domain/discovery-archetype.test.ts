import {
  ARCHETYPE_IDS,
  ARCHETYPE_SCORING_VERSION,
  buildArchetypeSharePath,
  buildCoreQuizHandoff,
  parseArchetypeSearch,
  parseCoreQuizHandoff,
  scoreArchetype,
  type ArchetypeAnswers,
} from "./discovery-archetype";

const answers = {
  socialSignal: "anti_luxury",
  aestheticDna: "structural_tool",
  deploymentEnvironment: "field_water_abuse",
  priceComfort: "considered_entry",
} as const;

describe("discovery archetype", () => {
  it("scores complete answers deterministically", () => {
    expect(scoreArchetype(answers).id).toBe("field_rationalist");
    expect(
      parseArchetypeSearch(
        new URLSearchParams(buildArchetypeSharePath(answers).split("?")[1]),
      ),
    ).toMatchObject({
      status: "complete",
      archetype: { id: "field_rationalist" },
    });
  });

  it("separates mechanical connoisseurship from recognised benchmarks", () => {
    expect(
      scoreArchetype({
        socialSignal: "quiet_continuity",
        aestheticDna: "high_art",
        deploymentEnvironment: "formal_architectural",
        priceComfort: "exceptional_object",
      }).id,
    ).toBe("mechanical_connoisseur");
    expect(
      scoreArchetype({
        socialSignal: "unapologetic_benchmark",
        aestheticDna: "integrated_geometry",
        deploymentEnvironment: "formal_architectural",
        priceComfort: "established_collection",
      }).id,
    ).toBe("recognised_standard_bearer");
  });

  it("preserves unversioned legacy links while versioning new results", () => {
    const legacyAnswers = {
      socialSignal: "unapologetic_benchmark",
      aestheticDna: "high_art",
      deploymentEnvironment: "formal_architectural",
      priceComfort: "exceptional_object",
    } as const;
    const unversioned = new URLSearchParams(legacyAnswers);
    const versioned = new URLSearchParams(
      buildArchetypeSharePath(legacyAnswers).split("?")[1],
    );

    expect(parseArchetypeSearch(unversioned)).toMatchObject({
      status: "complete",
      archetype: { id: "expressive_collector" },
      scoringVersion: "1.0.0",
    });
    expect(parseArchetypeSearch(versioned)).toMatchObject({
      status: "complete",
      archetype: { id: "mechanical_connoisseur" },
      scoringVersion: "2.0.0",
    });
    expect(versioned.get("scoringVersion")).toBe("2.0.0");
  });

  it("keeps all six archetypes reachable across the complete answer space", () => {
    const socialSignals = [
      "discreet_competence",
      "quiet_continuity",
      "unapologetic_benchmark",
      "anti_luxury",
    ] as const;
    const aestheticDna = [
      "structural_tool",
      "mid_century_industrial",
      "integrated_geometry",
      "extravagant_creative",
      "high_art",
    ] as const;
    const deploymentEnvironments = [
      "field_water_abuse",
      "studio_desk_daily",
      "formal_architectural",
    ] as const;
    const priceComforts = [
      "considered_entry",
      "established_collection",
      "exceptional_object",
    ] as const;
    const resultCounts = Object.fromEntries(
      ARCHETYPE_IDS.map((id) => [id, 0]),
    ) as Record<(typeof ARCHETYPE_IDS)[number], number>;

    for (const socialSignal of socialSignals) {
      for (const aesthetic of aestheticDna) {
        for (const deploymentEnvironment of deploymentEnvironments) {
          for (const priceComfort of priceComforts) {
            const combination: ArchetypeAnswers = {
              socialSignal,
              aestheticDna: aesthetic,
              deploymentEnvironment,
              priceComfort,
            };
            resultCounts[scoreArchetype(combination).id] += 1;
          }
        }
      }
    }

    expect(ARCHETYPE_SCORING_VERSION).toBe("2.0.0");
    expect(resultCounts).toEqual({
      field_rationalist: 47,
      quiet_custodian: 28,
      architectural_modernist: 28,
      expressive_collector: 20,
      mechanical_connoisseur: 30,
      recognised_standard_bearer: 27,
    });
  });

  it("rejects incomplete and invalid shared results", () => {
    expect(
      parseArchetypeSearch(new URLSearchParams("socialSignal=not-a-value")),
    ).toEqual({ status: "invalid" });
    expect(parseArchetypeSearch(new URLSearchParams())).toEqual({
      status: "idle",
    });
  });

  it("hands off only validated soft preferences", () => {
    const handoff = buildCoreQuizHandoff(answers);
    const query = new URLSearchParams(handoff.split("?")[1]);

    expect(parseCoreQuizHandoff(query)).toEqual({
      socialSignal: "anti_luxury",
      aestheticDna: "structural_tool",
    });
    expect(handoff).not.toContain("priceComfort");
    expect(handoff).not.toContain("deploymentEnvironment");
    expect(handoff).not.toContain("budget");
    query.set("socialSignal", "forged-value");
    expect(parseCoreQuizHandoff(query)).toBeNull();
  });
});
