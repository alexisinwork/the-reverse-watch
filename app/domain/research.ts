import { z } from "zod";

import { FUNCTION_PROFILES } from "./coverage";
import {
  ACCURACY_TOLERANCES,
  DEPLOYMENT_ENVIRONMENTS,
  OWNERSHIP_FRICTION_LEVELS,
  PRICE_BANDS,
  WEIGHT_LIMITS,
  WRIST_BANDS,
} from "./questionnaire";

const PRICE_BAND_IDS = PRICE_BANDS.map((band) => band.id);
const WRIST_BAND_IDS = WRIST_BANDS.map((band) => band.id);

export const RESEARCH_STATES = [
  "planned",
  "discovering",
  "extracting",
  "needs_review",
  "accepted",
  "excluded",
] as const;

export const DOSSIER_STATES = [
  "not_started",
  "researching",
  "needs_review",
  "accepted",
  "excluded",
] as const;

export const KNOWLEDGE_DOSSIER_STATES = [
  "owner_reviewed_input",
  "source_reviewed",
  "accepted_context",
  "excluded",
] as const;

export const knowledgeDossierLinkSchema = z
  .object({
    sourceFile: z.string().endsWith(".md"),
    sourceSnapshotDate: z.iso.date(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    intakeState: z.enum(KNOWLEDGE_DOSSIER_STATES),
    recommendationEligibility: z.literal("research_only"),
    referenceFamilyCount: z.number().int().nonnegative(),
    sourceUrlCount: z.number().int().nonnegative(),
  })
  .strict();

export const coverageIntentSchema = z
  .object({
    priceBands: z.array(z.enum(PRICE_BAND_IDS)).min(1).optional(),
    wristBands: z.array(z.enum(WRIST_BAND_IDS)).min(1).optional(),
    deploymentEnvironments: z
      .array(z.enum(DEPLOYMENT_ENVIRONMENTS))
      .min(1)
      .optional(),
    ownershipFrictionLevels: z
      .array(z.enum(OWNERSHIP_FRICTION_LEVELS))
      .min(1)
      .optional(),
    accuracyTolerances: z.array(z.enum(ACCURACY_TOLERANCES)).min(1).optional(),
    weightLimits: z.array(z.enum(WEIGHT_LIMITS)).min(1).optional(),
    functionProfiles: z.array(z.enum(FUNCTION_PROFILES)).min(1).optional(),
  })
  .strict()
  .refine(
    (intent) => Object.values(intent).some((values) => values !== undefined),
    "A planned target needs at least one explicit coverage intent.",
  );

const researchTargetBaseSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    referenceLabel: z.string().min(1),
    state: z.enum(RESEARCH_STATES),
    coverageIntent: coverageIntentSchema.optional(),
    coverageRationale: z.string().min(1),
    catalogueVariantId: z.string().min(1).optional(),
    exclusionReason: z.string().min(1).optional(),
  })
  .strict();

export const researchTargetSchema = researchTargetBaseSchema.superRefine(
  (target, context) => {
    if (target.state === "accepted" && !target.catalogueVariantId) {
      context.addIssue({
        code: "custom",
        path: ["catalogueVariantId"],
        message: "An accepted target must link to its catalogue variant.",
      });
    }
    if (target.state !== "accepted" && target.catalogueVariantId) {
      context.addIssue({
        code: "custom",
        path: ["catalogueVariantId"],
        message: "Only accepted targets may link to a catalogue variant.",
      });
    }
    if (target.state !== "accepted" && target.state !== "excluded") {
      if (!target.coverageIntent) {
        context.addIssue({
          code: "custom",
          path: ["coverageIntent"],
          message: "An active research target needs a coverage intent.",
        });
      }
    }
    if (target.state === "excluded" && !target.exclusionReason) {
      context.addIssue({
        code: "custom",
        path: ["exclusionReason"],
        message: "An excluded target needs a recorded reason.",
      });
    }
  },
);

export const researchBrandSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: z.string().min(1),
    priority: z.enum(["P0", "P1", "P2", "P3"]),
    manifestRationale: z.string().min(1),
    dossierState: z.enum(DOSSIER_STATES),
    knowledgeDossier: knowledgeDossierLinkSchema.optional(),
    targets: z.array(researchTargetSchema),
  })
  .strict()
  .refine(
    (brand) => brand.knowledgeDossier !== undefined || brand.targets.length > 0,
    "A manifest brand needs a knowledge dossier or at least one research target.",
  );

export const researchManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    strategy: z.literal("coverage_first"),
    targetBrandCount: z.number().int().min(1),
    updatedAt: z.iso.datetime(),
    brands: z.array(researchBrandSchema).min(1),
  })
  .strict()
  .superRefine((manifest, context) => {
    const brandSlugs = new Set<string>();
    const targetIds = new Set<string>();
    manifest.brands.forEach((brand, brandIndex) => {
      if (brandSlugs.has(brand.slug)) {
        context.addIssue({
          code: "custom",
          path: ["brands", brandIndex, "slug"],
          message: `Duplicate brand slug: ${brand.slug}.`,
        });
      }
      brandSlugs.add(brand.slug);
      brand.targets.forEach((target, targetIndex) => {
        if (targetIds.has(target.id)) {
          context.addIssue({
            code: "custom",
            path: ["brands", brandIndex, "targets", targetIndex, "id"],
            message: `Duplicate target id: ${target.id}.`,
          });
        }
        targetIds.add(target.id);
      });
    });
  });

export const researchJobSchema = z
  .object({
    jobId: z.string().uuid(),
    targetId: z.string().min(1),
    status: z.enum(["queued", "running", "succeeded", "failed"]),
    attempt: z.number().int().min(1),
    requestFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    provider: z.enum(["manual", "perplexity", "openai"]),
    preset: z.string().min(1).nullable(),
    queuedAt: z.iso.datetime(),
    startedAt: z.iso.datetime().nullable(),
    completedAt: z.iso.datetime().nullable(),
    rawArtifactPath: z.string().min(1).nullable(),
    normalizedArtifactPath: z.string().min(1).nullable(),
    sourceUrls: z.array(z.url()),
    costUsd: z.number().nonnegative().nullable(),
    inputTokens: z.number().int().nonnegative().nullable(),
    outputTokens: z.number().int().nonnegative().nullable(),
    error: z.string().min(1).nullable(),
  })
  .strict()
  .superRefine((job, context) => {
    const requireField = (field: keyof typeof job, message: string) => {
      if (job[field] === null) {
        context.addIssue({ code: "custom", path: [field], message });
      }
    };

    if (job.status === "queued") {
      if (job.startedAt !== null || job.completedAt !== null) {
        context.addIssue({
          code: "custom",
          path: ["status"],
          message: "A queued job cannot have execution timestamps.",
        });
      }
    }
    if (job.status === "running") {
      requireField("startedAt", "A running job needs a start timestamp.");
      if (job.completedAt !== null) {
        context.addIssue({
          code: "custom",
          path: ["completedAt"],
          message: "A running job cannot have a completion timestamp.",
        });
      }
    }
    if (job.status === "succeeded") {
      requireField("startedAt", "A succeeded job needs a start timestamp.");
      requireField(
        "completedAt",
        "A succeeded job needs a completion timestamp.",
      );
      requireField("rawArtifactPath", "A succeeded job needs a raw artifact.");
      requireField(
        "normalizedArtifactPath",
        "A succeeded job needs a normalized artifact.",
      );
    }
    if (job.status === "failed") {
      requireField("startedAt", "A failed job needs a start timestamp.");
      requireField("completedAt", "A failed job needs a completion timestamp.");
      requireField("error", "A failed job needs an error message.");
    }
    if (job.status !== "failed" && job.error !== null) {
      context.addIssue({
        code: "custom",
        path: ["error"],
        message: "Only a failed job may carry an error.",
      });
    }
  });

export const RESEARCH_FACT_FIELDS = [
  "identity",
  "collection",
  "model",
  "referenceCode",
  "variantName",
  "productUrl",
  "materials.case",
  "materials.caseback",
  "materials.bracelet",
  "materials.strap",
  "productionStatus",
  "price.amountMinor",
  "price.currency",
  "price.marketCountry",
  "price.availability",
  "price.channels",
  "price.conditions",
  "geometry.caseDiameterMm",
  "geometry.caseThicknessMm",
  "geometry.lugToLugMm",
  "geometry.lugWidthMm",
  "geometry.weightFullG",
  "geometry.lugCurvature",
  "geometry.integratedBracelet",
  "movement.type",
  "movement.caliber",
  "movement.powerReserveHours",
  "movement.accuracyLowerSeconds",
  "movement.accuracyUpperSeconds",
  "movement.accuracyPeriodDays",
  "operation.waterResistanceM",
  "operation.crownType",
  "operation.crownPosition",
  "operation.crystal",
  "operation.lumeGrade",
  "operation.attachmentType",
  "operation.claspMicroadjustment",
  "operation.shockResistant",
  "operation.nickelContactRisk",
  "complications",
  "dateStatus",
  "serviceCountries",
  "market.secondaryRatioLow",
  "market.secondaryRatioHigh",
  "market.hypeRisk",
  "market.speculativeBubble",
] as const;

export const RESEARCH_SOURCE_TYPES = [
  "manufacturer_product",
  "manufacturer_manual",
  "manufacturer_data_sheet",
  "manufacturer_corporate",
  "regulator_or_registry",
  "central_bank",
  "reviewed_market",
  "secondary_editorial",
] as const;

export const M1_REVIEW_FIELDS = [
  "identity",
  "price",
  "caseDiameterMm",
  "caseThicknessMm",
  "lugToLugMm",
  "lugWidthMm",
  "weightFullG",
  "movement",
  "accuracy",
  "waterResistanceM",
  "lumeGrade",
  "attachmentType",
  "dateStatus",
] as const;

export const proposedFactSchema = z
  .object({
    subjectType: z.enum([
      "brand",
      "reference_variant",
      "price_snapshot",
      "market_snapshot",
    ]),
    subjectKey: z.string().min(1),
    fieldName: z.string().min(1),
    value: z.json(),
    sourceUrl: z.url(),
    sourceType: z.enum(RESEARCH_SOURCE_TYPES),
    evidenceKind: z.enum(["observed", "estimated_class", "missing"]),
    note: z.string().min(1).nullable(),
    observedAt: z.iso.datetime(),
    retrievedAt: z.iso.datetime(),
    reviewStatus: z.literal("provisional"),
    extractor: z
      .object({
        provider: z.enum(["manual", "perplexity", "openai"]),
        modelOrPreset: z.string().min(1),
        jobId: z.string().uuid(),
      })
      .strict(),
  })
  .strict();

export const researchReviewSchema = z
  .object({
    reviewVersion: z.literal(1),
    targetId: z.string().min(1),
    jobId: z.string().uuid(),
    reviewedAt: z.iso.datetime(),
    reviewer: z.string().min(1),
    outcome: z.enum(["needs_more_evidence", "ready_for_migration", "excluded"]),
    candidateIdentity: z
      .object({
        brand: z.string().min(1),
        model: z.string().min(1),
        referenceCode: z.string().min(1),
        variantName: z.string().min(1),
      })
      .strict(),
    sourceChecks: z
      .array(
        z
          .object({
            url: z.url(),
            status: z.enum([
              "validated_primary",
              "validated_secondary",
              "fetch_blocked",
              "rejected",
            ]),
            note: z.string().min(1),
          })
          .strict(),
      )
      .min(1),
    verifiedProvisionalFields: z.array(z.enum(RESEARCH_FACT_FIELDS)),
    additionalVerifiedFacts: z.array(
      z
        .object({
          fieldName: z.enum(RESEARCH_FACT_FIELDS),
          value: z.json(),
          sourceUrl: z.url(),
          note: z.string().min(1),
        })
        .strict(),
    ),
    rejectedProvisionalFields: z.array(
      z
        .object({
          fieldName: z.enum(RESEARCH_FACT_FIELDS),
          reason: z.string().min(1),
        })
        .strict(),
    ),
    missingM1Fields: z.array(z.enum(M1_REVIEW_FIELDS)),
    note: z.string().min(1),
  })
  .strict()
  .superRefine((review, context) => {
    if (
      review.outcome === "ready_for_migration" &&
      review.missingM1Fields.length > 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["missingM1Fields"],
        message: "A migration-ready review cannot retain M1 gaps.",
      });
    }
    const verified = new Set(review.verifiedProvisionalFields);
    review.rejectedProvisionalFields.forEach((field, index) => {
      if (verified.has(field.fieldName)) {
        context.addIssue({
          code: "custom",
          path: ["rejectedProvisionalFields", index, "fieldName"],
          message: `${field.fieldName} cannot be both verified and rejected.`,
        });
      }
    });
  });

export type CoverageIntent = z.infer<typeof coverageIntentSchema>;
export type ResearchManifest = z.infer<typeof researchManifestSchema>;
export type ResearchTarget = z.infer<typeof researchTargetSchema>;
export type ResearchJob = z.infer<typeof researchJobSchema>;
export type ProposedFact = z.infer<typeof proposedFactSchema>;
export type ResearchReview = z.infer<typeof researchReviewSchema>;
