import { describe, expect, it } from "vitest";
import {
  buildFilmDiscoveryRequest,
  buildQuizDiscoveryRequest,
  buildValidationRequests,
  buildSelectionDiscoveryRequest,
} from "./validation-provider-request.server";

const brief = {
  brand: "Omega",
  model: "Planet Ocean",
  referenceCode: "2201.50.00",
  person: "Daniel Craig",
  work: "Quantum of Solace",
};

describe("bounded validation requests", () => {
  it("carries functional quiz requirements but excludes arbitrary private strings", () => {
    const result = buildQuizDiscoveryRequest(
      {
        version: 4,
        budgetCurrency: "USD",
        priceRange: "0_500",
        wristCm: 21,
        wearingScenarios: ["everyday"],
        minimumWaterResistanceM: 0,
        movementTypes: ["automatic"],
        requiredComplications: ["day_of_week", "alex_private_name"],
        allergyConstraint: "none",
        caseShape: "round",
        crystal: "sapphire",
        displayCaseback: true,
      },
      "muse-spark-1.3-contributor",
    );
    const text = JSON.stringify(result.body);
    expect(text).toContain("day_of_week");
    expect(text).toContain("sapphire");
    expect(text).not.toContain("alex_private_name");
    expect(text).not.toContain("wristCm");
  });
  it("supports metered alternatives discovery using only the catalogue target and constraints", () => {
    const result = buildSelectionDiscoveryRequest(
      {
        feature: "alternatives",
        styles: ["dive"],
        price: { minimum: 1000, maximum: 2000, currency: "USD" },
        diameter: { minimumMm: 37, maximumMm: 43 },
        movements: ["automatic"],
        target: {
          brand: "Tudor",
          model: "Black Bay",
          referenceCode: "M79030N",
        },
      },
      "muse-spark-1.3-contributor",
      [{ brand: "Seiko", model: "Prospex", referenceCode: "SPB143" }],
    );
    expect(result.body.instructions).toContain("SPB143");
    expect(result.body.instructions).toContain("Tudor");
    expect(result.body).toMatchObject({
      max_steps: 1,
      max_tool_calls: 1,
      store: false,
    });
  });
  it("sends only numeric and canonical quiz constraints to discovery", () => {
    const request = buildQuizDiscoveryRequest(
      {
        version: 4,
        budgetCurrency: "USD",
        priceRange: "3000_4000",
        wristCm: 17.5,
        wearingScenarios: ["office", "visitor@example.com"],
        minimumWaterResistanceM: 100,
        movementTypes: ["automatic"],
        requiredComplications: ["private free text"],
        allergyConstraint: "none",
      },
      "muse-spark-1.3-contributor",
    );
    expect(request.body).toMatchObject({
      max_steps: 1,
      max_tool_calls: 1,
      store: false,
    });
    const serialized = JSON.stringify(request.body);
    expect(serialized).toContain("38-42 mm");
    expect(serialized).not.toContain("visitor@example.com");
    expect(serialized).not.toContain("17.5");
    expect(serialized).not.toContain("private free text");
    expect(serialized).toContain("person and work must both be null");
  });
  it("searches articles about a subject's watches within bounds and refuses identifying contact data", () => {
    const result = buildFilmDiscoveryRequest(
      { query: "daniel craig", kind: "actor" },
      "muse-spark-1.3-contributor",
    );
    // Relevance before cost (owner, 2026-11-26): up to three full searches
    // reading most of each page, without social posts, forums or shops.
    expect(result.body).toMatchObject({
      max_steps: 3,
      max_tool_calls: 3,
      max_output_tokens: 6000,
      store: false,
      tools: [
        {
          type: "web_search",
          search_type: "web",
          max_results: 10,
          max_tokens_per_page: 1500,
        },
      ],
    });
    expect(result.body.tools[0]!.filters.search_domain_filter).toEqual(
      expect.arrayContaining(["-pinterest.com", "-reddit.com", "-ebay.com"]),
    );
    expect(result.body.input).toBe("daniel craig watches");
    expect(
      buildFilmDiscoveryRequest(
        { query: "Casino Royale", kind: "movie" },
        "muse-spark-1.3-contributor",
      ).body.input,
    ).toBe("watches worn in the film Casino Royale");
    expect(() =>
      buildFilmDiscoveryRequest(
        { query: "person@example.com", kind: "actor" },
        "muse-spark-1.3-contributor",
      ),
    ).toThrow();
  });
  it("builds separate one-search requests with Perplexity as primary", () => {
    const result = buildValidationRequests(brief, "muse-spark-1.3-contributor");
    expect(result.perplexity.endpoint).toBe(
      "https://api.perplexity.ai/v1/agent",
    );
    expect(result.perplexity.body).toMatchObject({
      effort: "fast",
      model: "openai/gpt-6-luna",
      max_steps: 1,
      max_tool_calls: 1,
      max_output_tokens: 600,
      store: false,
    });
    // A sighting's second check reads more of each page and has room to
    // answer after thinking.
    expect(result.muse.body).toMatchObject({
      max_tool_calls: 2,
      reasoning: { effort: "low" },
      max_output_tokens: 6000,
      store: false,
      tools: [{ type: "web_search", search_context_size: "medium" }],
    });
    expect(result.perplexity.body.input).toBe(
      "Omega 2201.50.00 Daniel Craig Quantum of Solace",
    );
    expect(result.perplexity.body.input).not.toContain("Planet Ocean");
  });

  it("does not include extra properties or accept contact data or unpriced models", () => {
    const hasExtra = { ...brief, email: "visitor@example.com" };
    expect(() =>
      buildValidationRequests(hasExtra, "muse-spark-1.3-contributor"),
    ).toThrow();
    expect(() =>
      buildValidationRequests(
        { ...brief, person: "visitor@example.com" },
        "muse-spark-1.3-contributor",
      ),
    ).toThrow();
    expect(() =>
      buildValidationRequests(
        { ...brief, referenceCode: "visitor@example.com" },
        "muse-spark-1.3-contributor",
      ),
    ).toThrow();
    expect(() => buildValidationRequests(brief, "muse-wonder-1.0")).toThrow();
  });

  it("allows an absent reference for independent discovery", () => {
    const result = buildValidationRequests(
      { ...brief, referenceCode: null },
      "muse-spark-1.3-contributor",
    );
    expect(result.perplexity.body.input).toBe(
      "Omega Planet Ocean Daniel Craig Quantum of Solace",
    );
  });

  it("sends a sighting's second check to another site, with the wearer as a search hint", () => {
    const film = buildValidationRequests(
      {
        brand: "Bvlgari",
        model: "CH35S",
        referenceCode: "CH35S",
        person: null,
        work: "Heat",
        avoidHost: "watchreel.watch",
        wearerHint: "Vincent Hanna (Al Pacino)",
      },
      "muse-spark-1.3-contributor",
    );
    expect(film.muse.body.input).toBe(
      "Bvlgari CH35S Heat Vincent Hanna (Al Pacino)",
    );
    expect(film.muse.body.instructions).toContain(
      "The first source, on watchreel.watch, has already been checked: cite a page on a different website.",
    );
    // The hint helps the search only; Perplexity's request is unchanged.
    expect(film.perplexity.body.input).toBe("Bvlgari CH35S Heat");
    expect(() =>
      buildValidationRequests(
        { ...brief, avoidHost: "https://watchreel.watch/x" },
        "muse-spark-1.3-contributor",
      ),
    ).toThrow();
    expect(() =>
      buildValidationRequests(
        { ...brief, wearerHint: "visitor@example.com" },
        "muse-spark-1.3-contributor",
      ),
    ).toThrow();
  });

  it("keeps the short second check for a watch without a sighting", () => {
    const plain = buildValidationRequests(
      { ...brief, person: null, work: null },
      "muse-spark-1.3-contributor",
    );
    expect(plain.muse.body).toMatchObject({
      max_tool_calls: 1,
      reasoning: { effort: "minimal" },
      max_output_tokens: 1200,
      tools: [{ type: "web_search", search_context_size: "low" }],
    });
    expect(plain.muse.body.instructions).toContain(
      "Prefer an independent catalogue, established retailer or editorial watch publication",
    );
  });
});
