import { describe, expect, it } from "vitest";
import {
  parseMuseValidationResponse,
  parsePerplexityAgentValidationResponse,
  parsePerplexityValidationResponse,
} from "./validation-provider-response.server";

const claim = {
  brand: "Omega",
  referenceCode: "2201.50.00",
  person: "Daniel Craig",
  work: "Quantum of Solace",
  sourceUrl: "https://source.example/watch",
  sourceQuote: "Omega 2201.50.00 Daniel Craig Quantum of Solace",
  supported: true,
};
const perplexity = {
  choices: [{ message: { content: JSON.stringify(claim) } }],
  citations: [claim.sourceUrl],
  usage: { cost: { total_cost: 0.008 } },
};
const muse = {
  output: [
    { type: "web_search_call", status: "completed" },
    {
      type: "message",
      content: [
        {
          type: "output_text",
          text: JSON.stringify(claim),
          annotations: [{ type: "url_citation", url: claim.sourceUrl }],
        },
      ],
    },
  ],
  usage: { input_tokens: 1000, output_tokens: 500 },
};

describe("provider validation response evidence", () => {
  it("reads search results and actual usage from the Perplexity Agent API", () => {
    const response = {
      status: "completed",
      model: "openai/gpt-6-luna",
      output: [
        { type: "search_results", results: [{ id: 1, url: claim.sourceUrl }] },
        {
          type: "message",
          content: [{ type: "output_text", text: JSON.stringify(claim) }],
        },
      ],
      usage: {
        cost: { currency: "USD", total_cost: 0.007 },
        tool_calls_details: { search_web: { invocation: 1 } },
      },
    };
    expect(parsePerplexityAgentValidationResponse(response)).toMatchObject({
      costUsd: 0.007,
      evidence: { provider: "perplexity", sourceVerified: false },
    });
    expect(() =>
      parsePerplexityAgentValidationResponse({
        ...response,
        output: response.output.slice(1),
      }),
    ).toThrow();
    expect(() =>
      parsePerplexityAgentValidationResponse({
        ...response,
        usage: {
          ...response.usage,
          tool_calls_details: { search_web: { invocation: 0 } },
        },
      }),
    ).toThrow();
    expect(() =>
      parsePerplexityAgentValidationResponse({
        ...response,
        usage: {
          ...response.usage,
          cost: { currency: "EUR", total_cost: 0.007 },
        },
      }),
    ).toThrow();
  });
  it("keeps Perplexity citations and its reported cost without asserting page verification", () => {
    expect(parsePerplexityValidationResponse(perplexity)).toMatchObject({
      costUsd: 0.008,
      evidence: {
        provider: "perplexity",
        sourceVerified: false,
        sourceUrl: claim.sourceUrl,
      },
    });
  });

  it("rejects a missing citation, missing cost or a model-invented source", () => {
    expect(() =>
      parsePerplexityValidationResponse({ ...perplexity, citations: [] }),
    ).toThrow();
    expect(() =>
      parsePerplexityValidationResponse({ ...perplexity, usage: {} }),
    ).toThrow();
    expect(() =>
      parsePerplexityValidationResponse({
        ...perplexity,
        citations: ["https://other.example"],
      }),
    ).toThrow();
  });

  it("requires a completed Muse web search and a citation to the same page", () => {
    const result = parseMuseValidationResponse(
      muse,
      "muse-spark-1.3-contributor",
    );
    expect(result.costUsd).toBeCloseTo(0.0027);
    expect(result.evidence).toMatchObject({
      provider: "muse",
      sourceVerified: false,
    });
    expect(() =>
      parseMuseValidationResponse(
        { ...muse, output: muse.output.slice(1) },
        "muse-spark-1.3-contributor",
      ),
    ).toThrow();
    expect(() =>
      parseMuseValidationResponse(
        {
          ...muse,
          output: [
            muse.output[0],
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify(claim),
                  annotations: [],
                },
              ],
            },
          ],
        },
        "muse-spark-1.3-contributor",
      ),
    ).toThrow();
  });

  it("uses standard Muse pricing when the model is not contributor mode", () => {
    expect(
      parseMuseValidationResponse(muse, "muse-spark-1.3").costUsd,
    ).toBeCloseTo(0.005875);
    expect(() => parseMuseValidationResponse(muse, "unknown-model")).toThrow();
  });
});
