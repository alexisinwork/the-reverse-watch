import { describe, expect, it } from "vitest";

import { listPublishedDiscoveryStories } from "./discovery-public";
import { storySightings } from "./film-story-sightings";

const stories = listPublishedDiscoveryStories();

describe("published stories as confirmed film sightings", () => {
  it("leads a person search with that person's story, exact reference kept", () => {
    const [card] = storySightings(stories, "paul newman", "celebrity");
    expect(card).toMatchObject({
      brand: "Rolex",
      referenceCode: "6239",
      details: { person: "Paul Newman" },
    });
    expect(card!.details.verificationStatus).toBeUndefined();
    expect(card!.sourceUrl).toBe(
      "https://www.phillips.com/detail/rolex/100049",
    );
  });

  it("matches a character and a work, and keeps family-only claims without a reference", () => {
    expect(storySightings(stories, "Don Draper", "character")[0]).toMatchObject(
      {
        brand: "OMEGA",
        referenceCode: "166.020",
      },
    );
    const bond = storySightings(stories, "James Bond", "character")[0]!;
    expect(bond.referenceCode).toBeNull();
    expect(bond.rationale).toContain("model family is confirmed");
    const madMen = storySightings(stories, "Mad Men", "series").map(
      (card) => card.details.person,
    );
    expect(madMen).toEqual(
      expect.arrayContaining(["Don Draper", "Roger Sterling"]),
    );
  });

  it("never turns an unconfirmed story or the wrong kind into a sighting", () => {
    expect(storySightings(stories, "Annie Edison", "character")).toEqual([]);
    // A public figure is not a character, and a person is not a work.
    expect(storySightings(stories, "Paul Newman", "character")).toEqual([]);
    expect(storySightings(stories, "Paul Newman", "movie")).toEqual([]);
    expect(storySightings(stories, "", "actor")).toEqual([]);
  });
});
