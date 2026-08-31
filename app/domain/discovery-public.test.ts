import {
  findPublishedDiscoveryEntity,
  findPublishedDiscoveryStory,
  findPublishedDiscoveryWork,
  listPublishedDiscoveryStories,
} from "./discovery-public";

describe("published discovery read contract", () => {
  it("returns only the 21 schema-gated pilot stories", () => {
    const stories = listPublishedDiscoveryStories();
    expect(stories).toHaveLength(21);
    expect(stories.every((story) => story.citations.length > 0)).toBe(true);
    expect(
      stories.every((story) => story.imageState === "no_image_stored"),
    ).toBe(true);
  });

  it("groups repeated works without conflating their attributions", () => {
    const result = findPublishedDiscoveryWork("oppenheimer-2023");
    expect(result?.work.title).toBe("Oppenheimer");
    expect(result?.stories.map((story) => story.entity.name)).toEqual([
      "J. Robert Oppenheimer",
      "Kitty Oppenheimer",
      "Lieutenant General Leslie Groves",
    ]);
  });

  it("preserves an authenticated but unidentified television prop", () => {
    const story = findPublishedDiscoveryStory(
      "annie-edison-community-unidentified-watch",
    );
    expect(story?.attribution).toMatchObject({
      confidence: "unconfirmed",
      confidenceLabel: "Unconfirmed identification",
      brand: null,
      model: null,
      reference: null,
    });
  });

  it("returns null for unpublished slugs", () => {
    expect(findPublishedDiscoveryStory("not-published")).toBeNull();
    expect(findPublishedDiscoveryEntity("not-published")).toBeNull();
    expect(findPublishedDiscoveryWork("not-published")).toBeNull();
  });
});
