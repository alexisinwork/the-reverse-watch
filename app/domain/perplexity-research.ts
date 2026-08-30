import { z } from "zod";

import {
  RESEARCH_FACT_FIELDS,
  RESEARCH_SOURCE_TYPES,
  proposedFactSchema,
} from "./research";
import type { ProposedFact, ResearchTarget } from "./research";

export const PERPLEXITY_RESEARCH_CONTRACT_VERSION = 5 as const;

const candidateIdentityValueSchema = z
  .string()
  .min(1)
  .max(160)
  .refine(
    (value) => !/[\r\n{}]/.test(value),
    "Candidate identity values must be plain single-line text.",
  );

const researchExtractionClaimSchema = z
  .object({
    subjectType: z.enum([
      "brand",
      "reference_variant",
      "price_snapshot",
      "market_snapshot",
    ]),
    subjectKey: z.string().min(1),
    fieldName: z.enum(RESEARCH_FACT_FIELDS),
    value: z.json(),
    sourceUrl: z.url(),
    sourceType: z.enum(RESEARCH_SOURCE_TYPES),
    evidenceKind: z.enum(["observed", "estimated_class", "missing"]),
    observedAt: z.iso.datetime().nullish(),
    note: z.string().min(1).nullable(),
  })
  .strict()
  .superRefine((claim, context) => {
    if (claim.value === null && claim.evidenceKind !== "missing") {
      context.addIssue({
        code: "custom",
        path: ["value"],
        message:
          "A null value must be marked missing, not observed or estimated.",
      });
    }
    if (claim.value !== null && claim.evidenceKind === "missing") {
      context.addIssue({
        code: "custom",
        path: ["evidenceKind"],
        message: "A missing claim cannot carry a non-null value.",
      });
    }
  });

export const researchExtractionSchema = z
  .object({
    targetId: z.string().min(1),
    exactVariantFound: z.boolean(),
    candidateIdentity: z
      .object({
        brand: candidateIdentityValueSchema,
        model: candidateIdentityValueSchema,
        referenceCode: candidateIdentityValueSchema,
        variantName: candidateIdentityValueSchema,
      })
      .strict()
      .nullable(),
    claims: z.array(researchExtractionClaimSchema),
    unresolvedFields: z.array(z.enum(RESEARCH_FACT_FIELDS)),
    sourceAssessment: z.string().min(1),
  })
  .strict()
  .superRefine((extraction, context) => {
    if (
      extraction.exactVariantFound !==
      (extraction.candidateIdentity !== null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["candidateIdentity"],
        message:
          "Candidate identity must exist exactly when an exact variant was found.",
      });
    }
    if (extraction.exactVariantFound) {
      const resolvedIdentityFields = new Set(
        extraction.claims
          .filter(
            (claim) => claim.value !== null && claim.evidenceKind !== "missing",
          )
          .map((claim) => claim.fieldName),
      );
      for (const fieldName of ["identity", "productUrl"] as const) {
        if (!resolvedIdentityFields.has(fieldName)) {
          context.addIssue({
            code: "custom",
            path: ["claims"],
            message: `An exact variant requires a resolved ${fieldName} claim.`,
          });
        }
      }
    }
    const resolvedFields = new Set(
      extraction.claims
        .filter(
          (claim) => claim.value !== null && claim.evidenceKind !== "missing",
        )
        .map((claim) => claim.fieldName),
    );
    extraction.unresolvedFields.forEach((fieldName, index) => {
      if (resolvedFields.has(fieldName)) {
        context.addIssue({
          code: "custom",
          path: ["unresolvedFields", index],
          message: `${fieldName} cannot be both resolved and unresolved.`,
        });
      }
    });
  });

export const perplexityResearchResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "WatchReferenceResearchV5",
    schema: z.toJSONSchema(researchExtractionSchema, { target: "draft-7" }),
  },
} as const;

const perplexityOutputContentSchema = z
  .object({
    type: z.string(),
    text: z.string().nullish(),
  })
  .passthrough();

const perplexityOutputItemSchema = z
  .object({
    type: z.string(),
    content: z.array(perplexityOutputContentSchema).nullish(),
    results: z.array(z.object({ url: z.url() }).passthrough()).nullish(),
    contents: z.array(z.object({ url: z.url() }).passthrough()).nullish(),
  })
  .passthrough();

export const perplexityAgentResponseSchema = z
  .object({
    id: z.string().min(1),
    model: z.string().min(1),
    status: z.string(),
    output: z.array(perplexityOutputItemSchema),
    error: z.unknown().nullable().optional(),
    usage: z
      .object({
        input_tokens: z.number().int().nonnegative().optional(),
        output_tokens: z.number().int().nonnegative().optional(),
        cost: z
          .object({ total_cost: z.number().nonnegative().optional() })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type ResearchExtraction = z.infer<typeof researchExtractionSchema>;
export type PerplexityAgentResponse = z.infer<
  typeof perplexityAgentResponseSchema
>;

export function buildResearchPrompt(target: ResearchTarget) {
  return [
    `Research target: ${target.id}`,
    `Candidate brief: ${target.referenceLabel}`,
    `Coverage purpose: ${target.coverageRationale}`,
    "Find one exact, currently identifiable and materially homogeneous reference variant.",
    "Use official manufacturer product pages, technical sheets, and manuals first. Use a secondary or market source only for a fact the manufacturer cannot establish.",
    "Do not merge sizes, materials, bracelets, movements, prices, or production states. Missing values must remain null and appear in unresolvedFields.",
    "Return one JSON object and no Markdown. Every non-null claim must cite the exact URL supporting that field.",
    `Allowed fieldName values: ${RESEARCH_FACT_FIELDS.join(", ")}.`,
    "Required shape: {targetId, exactVariantFound, candidateIdentity:{brand,model,referenceCode,variantName}|null, claims:[{subjectType,subjectKey,fieldName,value,sourceUrl,sourceType,evidenceKind,observedAt,note}], unresolvedFields:[], sourceAssessment}.",
    "subjectType must be exactly brand, reference_variant, price_snapshot, or market_snapshot. Use reference_variant for watch specifications.",
    "sourceType must be one of manufacturer_product, manufacturer_manual, manufacturer_data_sheet, manufacturer_corporate, regulator_or_registry, central_bank, reviewed_market, secondary_editorial.",
    "evidenceKind must be observed, estimated_class, or missing. Do not turn a family estimate into an observed variant fact.",
    "A null value must use evidenceKind missing and its field must appear in unresolvedFields. A non-null observed or estimated field must not appear in unresolvedFields.",
    "When exactVariantFound is true, claims must include non-null identity and productUrl claims sourced to the selected exact variant.",
    "Omit observedAt unless the source establishes a full UTC ISO 8601 date-time such as 2026-08-29T00:00:00Z. Never return a date-only value; the worker supplies retrieval time when it is omitted.",
  ].join("\n");
}

export function extractPerplexityOutputText(response: PerplexityAgentResponse) {
  return response.output
    .flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text" && content.text)
    .map((content) => content.text)
    .join("\n");
}

export function extractPerplexitySourceUrls(response: PerplexityAgentResponse) {
  return [
    ...new Set(
      response.output.flatMap((item) => [
        ...(item.results ?? []).map((result) => result.url),
        ...(item.contents ?? []).map((result) => result.url),
      ]),
    ),
  ].sort();
}

export function parseExtractionText(text: string) {
  const unfenced = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start === -1 || end < start) {
    throw new Error("Perplexity response did not contain a JSON object.");
  }
  return researchExtractionSchema.parse(
    JSON.parse(unfenced.slice(start, end + 1)),
  );
}

export function normalizeProposedFacts({
  extraction,
  provider,
  preset,
  jobId,
  retrievedAt,
}: {
  extraction: ResearchExtraction;
  provider: "perplexity";
  preset: string;
  jobId: string;
  retrievedAt: string;
}): ProposedFact[] {
  return extraction.claims.map((claim) =>
    proposedFactSchema.parse({
      subjectType: claim.subjectType,
      subjectKey: claim.subjectKey,
      fieldName: claim.fieldName,
      value: claim.value,
      sourceUrl: claim.sourceUrl,
      sourceType: claim.sourceType,
      evidenceKind: claim.evidenceKind,
      note: claim.note,
      observedAt: claim.observedAt ?? retrievedAt,
      retrievedAt,
      reviewStatus: "provisional",
      extractor: {
        provider,
        modelOrPreset: preset,
        jobId,
      },
    }),
  );
}
