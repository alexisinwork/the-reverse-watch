import {
  PerplexityDiscoveryError,
  parseDiscoveryProviderResponse,
  requestPerplexityDiscoveryResearch,
} from "./perplexity-discovery-research.server";

const result = {
  targetKind: "character" as const,
  targetName: "Don Draper",
  releaseYear: null,
  aliases: [],
  ambiguous: false,
  targetMismatch: false,
  insufficientEvidence: false,
  candidates: [
    {
      publicFigureName: null,
      characterName: "Don Draper",
      work: {
        title: "Mad Men",
        kind: "tv_series" as const,
        releaseYear: 2007,
        season: null,
        episode: null,
        scene: null,
        timecode: null,
      },
      claimType: "screen_worn" as const,
      identificationPrecision: "model_family" as const,
      brand: "Omega",
      modelFamily: "Seamaster De Ville",
      exactReference: null,
      customPropPossible: false,
      contradictionState: "possible" as const,
      claimSummary:
        "A cited report identifies the family but not the reference.",
      sources: [
        {
          url: "https://example.com/mad-men-watch",
          role: "specialist_corroboration" as const,
          stance: "supports" as const,
          locator: null,
        },
      ],
    },
  ],
  contradictions: [],
};

function envelope(content: unknown, url = "https://example.com/mad-men-watch") {
  return {
    id: "resp_test",
    model: "perplexity/sonar",
    object: "response",
    status: "completed",
    output: [
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: JSON.stringify(content),
            annotations: [{ url }],
          },
        ],
      },
    ],
    usage: {
      input_tokens: 101,
      output_tokens: 203,
      cost: { total_cost: 0.0123 },
    },
  };
}

describe("Perplexity discovery adapter", () => {
  it("parses only candidate URLs present in provider citations", () => {
    const parsed = parseDiscoveryProviderResponse(envelope(result));
    expect(parsed.result).toEqual(result);
    expect(parsed.sourceUrls).toEqual(["https://example.com/mad-men-watch"]);
    expect(parsed.costUsd).toBe(0.0123);
  });

  it("rejects a generated source URL absent from citations", () => {
    expect(() =>
      parseDiscoveryProviderResponse(
        envelope({
          ...result,
          candidates: result.candidates.map((candidate) => ({
            ...candidate,
            sources: [
              { ...candidate.sources[0], url: "https://example.com/invented" },
            ],
          })),
        }),
      ),
    ).toThrowError(PerplexityDiscoveryError);
  });

  it("preserves ambiguity, no-evidence state, and contradictions", () => {
    const parsed = parseDiscoveryProviderResponse(
      envelope({
        ...result,
        ambiguous: true,
        insufficientEvidence: true,
        candidates: [],
        contradictions: ["One source identifies a different model family."],
      }),
    );
    expect(parsed.result).toMatchObject({
      ambiguous: true,
      insufficientEvidence: true,
      candidates: [],
      contradictions: ["One source identifies a different model family."],
    });
  });

  it("rejects malformed structured output without retaining provider prose", () => {
    expect(() =>
      parseDiscoveryProviderResponse(envelope("not a JSON object")),
    ).toThrowError(expect.objectContaining({ category: "malformed_response" }));
  });

  it("uses the current Agent API structured-output request", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(envelope(result)));
    await requestPerplexityDiscoveryResearch(
      { anchor: "character", displayText: "Don Draper", releaseYear: null },
      {
        apiKey: "secret",
        preset: "pro-search",
        maxOutputTokens: 2_000,
        fetchImpl,
      },
    );
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://api.perplexity.ai/v1/agent");
    const requestBody = (
      typeof init?.body === "string" ? JSON.parse(init.body) : null
    ) as unknown;
    expect(requestBody).toMatchObject({
      preset: "pro-search",
      tools: [{ type: "web_search" }],
      max_output_tokens: 2_000,
      max_steps: 4,
      store: false,
      response_format: { type: "json_schema" },
    });
    expect(init?.headers).toMatchObject({ Authorization: "Bearer secret" });
  });

  it("classifies provider rate limits as retryable without exposing the body", async () => {
    const errorBody = { error: { message: "private provider detail" } };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(errorBody, { status: 429 }));
    await expect(
      requestPerplexityDiscoveryResearch(
        { anchor: "work", displayText: "Unknown film", releaseYear: null },
        {
          apiKey: "secret",
          preset: "pro-search",
          maxOutputTokens: 2_000,
          fetchImpl,
        },
      ),
    ).rejects.toMatchObject({
      name: "PerplexityDiscoveryError",
      category: "provider_rate_limit",
      retryable: true,
    });
  });

  it("classifies provider timeouts as retryable", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    await expect(
      requestPerplexityDiscoveryResearch(
        { anchor: "character", displayText: "Don Draper", releaseYear: null },
        {
          apiKey: "secret",
          preset: "pro-search",
          maxOutputTokens: 2_000,
          fetchImpl,
        },
      ),
    ).rejects.toMatchObject({
      category: "provider_timeout",
      retryable: true,
    });
  });
});
