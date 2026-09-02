import { discoveryAnalyticsEventSchema } from "./discovery-analytics";

describe("discovery analytics contract", () => {
  it("accepts only aggregate allowlisted dimensions", () => {
    expect(
      discoveryAnalyticsEventSchema.parse({
        name: "archetype_completion",
        archetypeId: "recognised_standard_bearer",
      }),
    ).toEqual({
      name: "archetype_completion",
      archetypeId: "recognised_standard_bearer",
    });
    expect(
      discoveryAnalyticsEventSchema.parse({
        name: "page_view",
        surface: "story",
      }),
    ).toEqual({ name: "page_view", surface: "story" });
    for (const name of [
      "archetype_start",
      "qualified_recommendation",
      "opt_in",
    ] as const) {
      expect(discoveryAnalyticsEventSchema.safeParse({ name }).success).toBe(
        true,
      );
    }
    for (const name of [
      "archetype_completion",
      "share",
      "core_handoff",
    ] as const) {
      expect(
        discoveryAnalyticsEventSchema.safeParse({
          name,
          archetypeId: "field_rationalist",
        }).success,
      ).toBe(true);
    }
    expect(
      discoveryAnalyticsEventSchema.safeParse({
        name: "outbound_market_click",
        surface: "story",
      }).success,
    ).toBe(true);
    expect(
      discoveryAnalyticsEventSchema.safeParse({
        name: "research_request_submitted",
        anchor: "character",
      }).success,
    ).toBe(true);
    expect(
      discoveryAnalyticsEventSchema.safeParse({
        name: "research_status_seen",
        status: "review_pending",
      }).success,
    ).toBe(true);
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
