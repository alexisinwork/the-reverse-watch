import { findPublishedDiscoveryStory } from "./discovery-public";
import {
  discoverySoftPreferences,
  explainStoryConstraint,
  parseDiscoveryStorySlug,
} from "./discovery-context.server";

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

  it("recognises the story's watch in the shortlist despite reference formatting", () => {
    const story = structuredClone(
      findPublishedDiscoveryStory("don-draper-mad-men-omega")!,
    );
    story.attribution.reference = "SBGN029";

    expect(
      explainStoryConstraint(story, [
        { referenceCode: null },
        { referenceCode: "sbgn-029" },
      ]).status,
    ).toBe("in_shortlist");
  });

  it("reports a story watch that the search did not return", () => {
    const story = findPublishedDiscoveryStory(
      "murph-cooper-interstellar-hamilton",
    )!;
    expect(
      explainStoryConstraint(story, [{ referenceCode: "SPB143" }]).status,
    ).toBe("not_in_shortlist");
  });
});
