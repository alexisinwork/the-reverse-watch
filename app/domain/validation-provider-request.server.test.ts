import { describe, expect, it } from "vitest";
import { buildValidationRequests } from "./validation-provider-request.server";

const brief = {
  brand: "Omega",
  model: "Planet Ocean",
  referenceCode: "2201.50.00",
  person: "Daniel Craig",
  work: "Quantum of Solace",
};

describe("bounded validation requests", () => {
  it("builds separate one-search requests with Perplexity as primary", () => {
    const result = buildValidationRequests(brief, "muse-spark-1.3-contributor");
    expect(result.perplexity.endpoint).toBe(
      "https://api.perplexity.ai/v1/agent",
    );
    expect(result.perplexity.body).toMatchObject({
      effort: "fast",
      max_steps: 1,
      max_tool_calls: 1,
      max_output_tokens: 600,
      store: false,
    });
    expect(result.muse.body).toMatchObject({
      max_tool_calls: 1,
      max_output_tokens: 1200,
      store: false,
    });
    expect(JSON.parse(result.perplexity.body.input)).toEqual(brief);
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
});
