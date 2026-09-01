import { discoveryAnalyticsEventSchema } from "./discovery-analytics";

describe("discovery analytics contract", () => {
  it("accepts only aggregate allowlisted dimensions", () => {
    expect(
      discoveryAnalyticsEventSchema.parse({
        name: "archetype_completion",
        archetypeId: "field_rationalist",
      }),
    ).toEqual({
      name: "archetype_completion",
      archetypeId: "field_rationalist",
    });
    expect(
      discoveryAnalyticsEventSchema.parse({
        name: "page_view",
        surface: "story",
      }),
    ).toEqual({ name: "page_view", surface: "story" });
  });

  it("rejects answers, URLs, and unknown event values", () => {
    expect(
      discoveryAnalyticsEventSchema.safeParse({
        name: "page_view",
        surface: "story",
        url: "/watches/stories/private-query",
      }).success,
    ).toBe(false);
    expect(
      discoveryAnalyticsEventSchema.safeParse({
        name: "archetype_completion",
        archetypeId: "field_rationalist",
        socialSignal: "anti_luxury",
      }).success,
    ).toBe(false);
    expect(
      discoveryAnalyticsEventSchema.safeParse({ name: "email_open" }).success,
    ).toBe(false);
  });
});
