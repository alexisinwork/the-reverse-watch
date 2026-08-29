import {
  buildResearchPrompt,
  extractPerplexityOutputText,
  extractPerplexitySourceUrls,
  normalizeProposedFacts,
  parseExtractionText,
  perplexityAgentResponseSchema,
  perplexityResearchResponseFormat,
  researchExtractionSchema,
} from "./perplexity-research";

const target = {
  id: "cartier-small-formal-quartz",
  referenceLabel: "Select a current small formal quartz reference",
  state: "planned" as const,
  coverageIntent: { priceBands: ["2000_5000" as const] },
  coverageRationale: "Fill compact formal precision coverage.",
};

describe("Perplexity research normalization", () => {
  it("builds a variant-specific source-first prompt", () => {
    const prompt = buildResearchPrompt(target);
    expect(prompt).toContain(target.id);
    expect(prompt).toContain("materially homogeneous");
    expect(prompt).toContain("official manufacturer");
    expect(prompt).toContain("Never return a date-only value");
    expect(perplexityResearchResponseFormat).toMatchObject({
      type: "json_schema",
      json_schema: { name: "WatchReferenceResearchV4" },
    });
  });

  it("rejects null observed facts and resolved/unresolved contradictions", () => {
    const base = {
      targetId: "cartier-small-formal-quartz",
      exactVariantFound: true,
      candidateIdentity: {
        brand: "Cartier",
        model: "Tank Must",
        referenceCode: "WSTA0107",
        variantName: "Small steel bracelet",
      },
      claims: [
        {
          subjectType: "reference_variant",
          subjectKey: "cartier-wsta0107",
          fieldName: "geometry.caseThicknessMm",
          value: null,
          sourceUrl: "https://example.com/product",
          sourceType: "manufacturer_product",
          evidenceKind: "observed",
          observedAt: null,
          note: null,
        },
      ],
      unresolvedFields: ["geometry.caseThicknessMm"],
      sourceAssessment: "Test extraction.",
    };

    expect(researchExtractionSchema.safeParse(base).success).toBe(false);
    expect(
      researchExtractionSchema.safeParse({
        ...base,
        claims: [
          {
            ...base.claims[0],
            value: 6.6,
            evidenceKind: "observed",
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("extracts output text and discovered source URLs", () => {
    const response = perplexityAgentResponseSchema.parse({
      id: "resp_test",
      model: "test/model",
      status: "completed",
      output: [
        {
          type: "search_results",
          results: [{ url: "https://example.com/product" }],
        },
        { type: "fetch_url", contents: null },
        {
          type: "message",
          content: [{ type: "output_text", text: '{"targetId":"x"}' }],
        },
      ],
    });
    expect(extractPerplexityOutputText(response)).toBe('{"targetId":"x"}');
    expect(extractPerplexitySourceUrls(response)).toEqual([
      "https://example.com/product",
    ]);
  });

  it("parses fenced JSON and forces normalized facts to remain provisional", () => {
    const extraction = parseExtractionText(`\`\`\`json
      {
        "targetId": "cartier-small-formal-quartz",
        "exactVariantFound": true,
        "candidateIdentity": {
          "brand": "Cartier",
          "model": "Tank Must",
          "referenceCode": "WSTA0042",
          "variantName": "Small steel on leather"
        },
        "claims": [{
          "subjectType": "reference_variant",
          "subjectKey": "cartier-wsta0042",
          "fieldName": "geometry.caseDiameterMm",
          "value": 22,
          "sourceUrl": "https://example.com/product",
          "sourceType": "manufacturer_product",
          "evidenceKind": "observed",
          "observedAt": null,
          "note": null
        }],
        "unresolvedFields": ["geometry.weightFullG"],
        "sourceAssessment": "Manufacturer page supports the dimension."
      }
    \`\`\``);
    const facts = normalizeProposedFacts({
      extraction,
      provider: "perplexity",
      preset: "pro-search",
      jobId: "5fa1e3f0-7713-4a90-bbb8-c073c25b7139",
      retrievedAt: "2026-08-28T20:01:00Z",
    });
    expect(facts[0]).toMatchObject({
      reviewStatus: "provisional",
      fieldName: "geometry.caseDiameterMm",
      observedAt: "2026-08-28T20:01:00Z",
    });
  });
});
