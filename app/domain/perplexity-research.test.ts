import {
  buildResearchPrompt,
  extractPerplexityOutputText,
  extractPerplexitySonarOutputText,
  extractPerplexitySonarSourceUrls,
  extractPerplexitySourceUrls,
  normalizeProposedFacts,
  parseExtractionText,
  perplexityAgentResponseSchema,
  perplexityResearchResponseFormat,
  researchExtractionSchema,
  perplexitySonarResponseSchema,
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
    expect(prompt).toContain("historical target");
    expect(prompt).toContain("full configured weight");
    expect(prompt).toContain("audit every claim mechanically");
    expect(prompt).toContain("authorized-retailer archive");
    expect(prompt).toContain("official manufacturer");
    expect(prompt).toContain("Never return a date-only value");
    expect(prompt).toContain(`targetId is exactly "${target.id}"`);
    expect(perplexityResearchResponseFormat).toMatchObject({
      type: "json_schema",
      json_schema: { name: "WatchReferenceResearchV5" },
    });
  });

  it("adds validation feedback to a retry prompt", () => {
    const prompt = buildResearchPrompt(
      target,
      "movement.type cannot be both resolved and unresolved.",
    );

    expect(prompt).toContain("previous extraction was rejected");
    expect(prompt).toContain(
      "movement.type cannot be both resolved and unresolved.",
    );
  });

  it("rejects empty or malformed exact-variant extractions", () => {
    const candidateIdentity = {
      brand: "Nodus",
      model: "Sector Deep",
      referenceCode: "SEC-D-BLU",
      variantName: "Blue Orthodox",
    };
    const empty = {
      targetId: "nodus-regulated-mechanical-tool",
      exactVariantFound: true,
      candidateIdentity,
      claims: [],
      unresolvedFields: [],
      sourceAssessment: "No usable claims returned.",
    };

    expect(researchExtractionSchema.safeParse(empty).success).toBe(false);
    expect(
      researchExtractionSchema.safeParse({
        ...empty,
        candidateIdentity: {
          ...candidateIdentity,
          referenceCode: `missing ${"placeholder ".repeat(20)}`,
        },
      }).success,
    ).toBe(false);
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
          fieldName: "identity",
          value: "Cartier Tank Must WSTA0107",
          sourceUrl: "https://example.com/product",
          sourceType: "manufacturer_product",
          evidenceKind: "observed",
          observedAt: null,
          note: null,
        },
        {
          subjectType: "reference_variant",
          subjectKey: "cartier-wsta0107",
          fieldName: "productUrl",
          value: "https://example.com/product",
          sourceUrl: "https://example.com/product",
          sourceType: "manufacturer_product",
          evidenceKind: "observed",
          observedAt: null,
          note: null,
        },
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

  it("extracts Sonar structured output and source URLs", () => {
    const response = perplexitySonarResponseSchema.parse({
      id: "sonar_test",
      model: "sonar-pro",
      choices: [
        {
          message: {
            role: "assistant",
            content: '{"targetId":"x"}',
          },
        },
      ],
      citations: ["https://example.com/product"],
      search_results: [
        { url: "https://example.com/product" },
        { url: "https://example.com/manual" },
      ],
    });

    expect(extractPerplexitySonarOutputText(response)).toBe('{"targetId":"x"}');
    expect(extractPerplexitySonarSourceUrls(response)).toEqual([
      "https://example.com/manual",
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
          "fieldName": "identity",
          "value": "Cartier Tank Must WSTA0042",
          "sourceUrl": "https://example.com/product",
          "sourceType": "manufacturer_product",
          "evidenceKind": "observed",
          "observedAt": null,
          "note": null
        }, {
          "subjectType": "reference_variant",
          "subjectKey": "cartier-wsta0042",
          "fieldName": "productUrl",
          "value": "https://example.com/product",
          "sourceUrl": "https://example.com/product",
          "sourceType": "manufacturer_product",
          "evidenceKind": "observed",
          "observedAt": null,
          "note": null
        }, {
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
    expect(facts[2]).toMatchObject({
      reviewStatus: "provisional",
      fieldName: "geometry.caseDiameterMm",
      observedAt: "2026-08-28T20:01:00Z",
    });
  });
});
