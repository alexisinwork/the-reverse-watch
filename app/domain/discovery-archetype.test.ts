import {
  buildArchetypeSharePath,
  buildCoreQuizHandoff,
  parseArchetypeSearch,
  parseCoreQuizHandoff,
  scoreArchetype,
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
