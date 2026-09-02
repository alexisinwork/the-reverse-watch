import {
  discoveryResearchCandidateSchema,
  discoveryResearchResponseSchema,
} from "./discovery-research";

const source = {
  url: "https://example.com/evidence",
  role: "direct_interview" as const,
  stance: "supports" as const,
  locator: "Interview, 12:30",
};

const exactCandidate = {
  publicFigureName: null,
  characterName: "Don Draper",
  work: {
    title: "Mad Men",
    kind: "tv_series" as const,
    releaseYear: 2007,
    season: null,
    episode: null,
    scene: "Office",
    timecode: null,
  },
  claimType: "screen_worn" as const,
  identificationPrecision: "exact_reference" as const,
  brand: "Omega",
  modelFamily: "Seamaster De Ville",
  exactReference: "166.020",
  customPropPossible: false,
  contradictionState: "clear" as const,
  claimSummary: "The character is shown wearing the cited watch.",
  sources: [source],
};

describe("discovery research contract", () => {
  it("keeps a character screen claim separate from an actor ownership claim", () => {
    expect(
      discoveryResearchCandidateSchema.safeParse(exactCandidate).success,
    ).toBe(true);
    expect(
      discoveryResearchCandidateSchema.safeParse({
        ...exactCandidate,
        publicFigureName: "Jon Hamm",
      }).success,
    ).toBe(false);
    expect(
      discoveryResearchCandidateSchema.safeParse({
        ...exactCandidate,
        claimType: "owned",
      }).success,
    ).toBe(false);
  });

  it("does not allow unsupported precision or a custom prop to become exact", () => {
    expect(
      discoveryResearchCandidateSchema.safeParse({
        ...exactCandidate,
        customPropPossible: true,
      }).success,
    ).toBe(false);
    expect(
      discoveryResearchCandidateSchema.safeParse({
        ...exactCandidate,
        identificationPrecision: "model_family",
        exactReference: null,
      }).success,
    ).toBe(true);
  });

  it("allows an explicit insufficient-evidence result with no candidates", () => {
    expect(
      discoveryResearchResponseSchema.safeParse({
        targetKind: "work",
        targetName: "Unknown film",
        releaseYear: null,
        aliases: [],
        ambiguous: false,
        targetMismatch: false,
        insufficientEvidence: true,
        candidates: [],
        contradictions: [],
      }).success,
    ).toBe(true);
  });
});
