import { describe, expect, it } from "vitest";
import {
  discoverySearchSchema,
  discoveryTopicStatusSchema,
  normalizeDiscoveryTopic,
  parseDiscoveryHandoff,
  rankDiscoveryContext,
} from "./discovery-selection";

describe("guided discovery contracts", () => {
  it("rejects short, URL-bearing, and forged search inputs", () => {
    expect(
      discoverySearchSchema.safeParse({ anchor: "work", query: "D" }).success,
    ).toBe(false);
    expect(
      discoverySearchSchema.safeParse({
        anchor: "work",
        query: "https://example.test",
      }).success,
    ).toBe(false);
    expect(
      discoverySearchSchema.safeParse({ anchor: "actor", query: "Drive" })
        .success,
    ).toBe(false);
  });
  it("normalizes topics and accepts only validated soft handoff values", () => {
    expect(normalizeDiscoveryTopic("  DＲIVE   ")).toBe("drive");
    expect(
      parseDiscoveryHandoff(
        new URLSearchParams(
          "socialSignal=anti_luxury&aestheticDna=structural_tool",
        ),
      ),
    ).toEqual({ socialSignal: "anti_luxury", aestheticDna: "structural_tool" });
    expect(
      parseDiscoveryHandoff(new URLSearchParams("socialSignal=forged")),
    ).toBeNull();
    expect(discoveryTopicStatusSchema.safeParse("queued").success).toBe(true);
    expect(discoveryTopicStatusSchema.safeParse("published").success).toBe(
      false,
    );
  });
  it("scores reviewed traits deterministically and breaks ties by precision then slug", () => {
    const ranked = rankDiscoveryContext(
      {
        socialSignal: "anti_luxury",
        aestheticDna: "structural_tool",
        deploymentEnvironment: null,
        priceComfort: null,
      },
      [
        {
          slug: "family",
          precision: "family_only",
          publishedAt: "2026-01-01T00:00:00.000Z",
          reviewedAt: "2026-01-01T00:00:00.000Z",
          traits: {
            socialSignal: "anti_luxury",
            aestheticDna: "structural_tool",
            deploymentEnvironment: null,
            priceComfort: null,
          },
        },
        {
          slug: "exact",
          precision: "exact_reference",
          publishedAt: "2026-01-01T00:00:00.000Z",
          reviewedAt: "2026-01-01T00:00:00.000Z",
          traits: {
            socialSignal: "anti_luxury",
            aestheticDna: "structural_tool",
            deploymentEnvironment: null,
            priceComfort: null,
          },
        },
      ],
    );
    expect(
      ranked.map(({ candidate, score }) => [candidate.slug, score]),
    ).toEqual([
      ["exact", 6],
      ["family", 6],
    ]);
  });
});
