import { z } from "zod";

export const DISCOVERY_CONFIDENCE_LABELS = {
  confirmed: "Confirmed identification",
  disputed: "Disputed identification",
  family_only: "Model family only",
  unconfirmed: "Unconfirmed identification",
} as const;

const recordIdSchema = z.number().int().positive();
const nullableTextSchema = z.string().trim().min(1).nullable();
const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a lowercase kebab-case slug.");

export const discoveryReviewStatusSchema = z.enum([
  "draft",
  "in_review",
  "accepted",
  "rejected",
  "withdrawn",
]);

export const discoveryEntitySchema = z.object({
  id: recordIdSchema,
  entityKind: z.enum(["public_figure", "fictional_character"]),
  slug: slugSchema,
  displayName: z.string().trim().min(1),
  disambiguation: nullableTextSchema,
  reviewStatus: discoveryReviewStatusSchema.exclude(["withdrawn"]),
});

export const discoveryWorkSchema = z
  .object({
    id: recordIdSchema,
    parentWorkId: recordIdSchema.nullable(),
    workKind: z.enum([
      "film",
      "television_series",
      "television_episode",
      "documentary",
      "music_video",
      "other",
    ]),
    slug: slugSchema,
    title: z.string().trim().min(1),
    releaseDate: z.iso.date().nullable(),
    seasonNumber: z.number().int().positive().nullable(),
    episodeNumber: z.number().int().positive().nullable(),
    reviewStatus: discoveryReviewStatusSchema.exclude(["withdrawn"]),
  })
  .superRefine((work, context) => {
    if (work.parentWorkId === work.id) {
      context.addIssue({
        code: "custom",
        path: ["parentWorkId"],
        message: "A work cannot be its own parent.",
      });
    }
    if (
      work.workKind !== "television_episode" &&
      (work.seasonNumber !== null || work.episodeNumber !== null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["workKind"],
        message:
          "Season and episode numbers belong only to television episodes.",
      });
    }
  });

export const discoveryEventSchema = z
  .object({
    id: recordIdSchema,
    eventKind: z.enum([
      "premiere",
      "award_ceremony",
      "interview",
      "sporting_event",
      "public_appearance",
      "other",
    ]),
    slug: slugSchema,
    title: z.string().trim().min(1),
    occurredOn: z.iso.date().nullable(),
    endedOn: z.iso.date().nullable(),
    location: nullableTextSchema,
    reviewStatus: discoveryReviewStatusSchema.exclude(["withdrawn"]),
  })
  .superRefine((event, context) => {
    if (
      event.occurredOn !== null &&
      event.endedOn !== null &&
      event.endedOn < event.occurredOn
    ) {
      context.addIssue({
        code: "custom",
        path: ["endedOn"],
        message: "An event cannot end before it begins.",
      });
    }
  });

export const discoveryAttributionSchema = z
  .object({
    id: recordIdSchema,
    entityId: recordIdSchema,
    workId: recordIdSchema.nullable(),
    eventId: recordIdSchema.nullable(),
    referenceVariantId: z.uuid().nullable(),
    claimType: z.enum([
      "owned",
      "worn_publicly",
      "screen_worn",
      "reported",
      "unconfirmed",
    ]),
    identificationPrecision: z.enum([
      "exact_reference",
      "model_family",
      "brand_only",
      "unidentified",
    ]),
    identifiedBrand: nullableTextSchema,
    identifiedModelFamily: nullableTextSchema,
    identifiedReferenceCode: nullableTextSchema,
    confidenceCode: z.enum([
      "confirmed",
      "disputed",
      "family_only",
      "unconfirmed",
    ]),
    disputeState: z.enum(["clear", "disputed", "corrected", "withdrawn"]),
    observedOn: z.iso.date().nullable(),
    sceneLocator: nullableTextSchema,
    editorialNote: nullableTextSchema,
    reviewStatus: discoveryReviewStatusSchema,
    publishedAt: z.iso.datetime({ offset: true }).nullable(),
  })
  .superRefine((attribution, context) => {
    const issue = (path: string, message: string) =>
      context.addIssue({ code: "custom", path: [path], message });

    if (attribution.workId !== null && attribution.eventId !== null) {
      issue(
        "workId",
        "An attribution cannot point to both a work and an event.",
      );
    }
    if (
      attribution.claimType === "screen_worn" &&
      (attribution.workId === null || attribution.eventId !== null)
    ) {
      issue("claimType", "A screen-worn claim requires one work context.");
    }
    if (
      attribution.referenceVariantId !== null &&
      attribution.identificationPrecision !== "exact_reference"
    ) {
      issue(
        "referenceVariantId",
        "Only an exact-reference identification can link to the catalogue.",
      );
    }
    if (
      attribution.identificationPrecision === "exact_reference" &&
      attribution.referenceVariantId === null &&
      attribution.identifiedReferenceCode === null
    ) {
      issue(
        "identifiedReferenceCode",
        "An exact identification requires a reference code or reviewed catalogue link.",
      );
    }
    if (
      attribution.identificationPrecision === "model_family" &&
      (attribution.identifiedBrand === null ||
        attribution.identifiedModelFamily === null)
    ) {
      issue(
        "identifiedModelFamily",
        "A family-only identification requires both brand and model family.",
      );
    }
    if (
      attribution.identificationPrecision === "brand_only" &&
      (attribution.identifiedBrand === null ||
        attribution.identifiedModelFamily !== null ||
        attribution.identifiedReferenceCode !== null)
    ) {
      issue(
        "identifiedBrand",
        "A brand-only identification cannot imply a model or reference.",
      );
    }
    if (
      attribution.identificationPrecision === "unidentified" &&
      (attribution.referenceVariantId !== null ||
        attribution.identifiedBrand !== null ||
        attribution.identifiedModelFamily !== null ||
        attribution.identifiedReferenceCode !== null)
    ) {
      issue(
        "identificationPrecision",
        "An unidentified watch cannot carry guessed identity fields.",
      );
    }
    if (
      attribution.confidenceCode === "confirmed" &&
      (attribution.identificationPrecision !== "exact_reference" ||
        attribution.claimType === "unconfirmed")
    ) {
      issue(
        "confidenceCode",
        "Confirmed means an exact reference supported by a substantive claim.",
      );
    }
    if (
      attribution.confidenceCode === "family_only" &&
      !["model_family", "brand_only"].includes(
        attribution.identificationPrecision,
      )
    ) {
      issue(
        "confidenceCode",
        "The family-only label is reserved for bounded brand or model-family identifications.",
      );
    }
    if (
      attribution.claimType === "unconfirmed" &&
      attribution.confidenceCode !== "unconfirmed"
    ) {
      issue(
        "claimType",
        "An unconfirmed claim must remain labelled unconfirmed.",
      );
    }
    if (
      attribution.confidenceCode === "disputed" &&
      attribution.disputeState !== "disputed"
    ) {
      issue(
        "disputeState",
        "A disputed label requires an active dispute state.",
      );
    }
    if (
      attribution.publishedAt !== null &&
      attribution.reviewStatus !== "accepted"
    ) {
      issue("publishedAt", "Only an accepted attribution can be published.");
    }
  });

export const discoverySourceSchema = z.object({
  id: z.uuid(),
  url: z.url(),
  title: nullableTextSchema,
  publisher: nullableTextSchema,
  sourceType: z.string().trim().min(1),
  publishedAt: z.iso.datetime({ offset: true }).nullable(),
  retrievedAt: z.iso.datetime({ offset: true }),
  archivedUrl: z.url().nullable(),
});

export const discoveryEvidenceSchema = z.object({
  id: recordIdSchema,
  attributionId: recordIdSchema,
  source: discoverySourceSchema,
  stance: z.enum(["supports", "contradicts", "context"]),
  sourceRole: z.enum([
    "official_production_record",
    "direct_interview",
    "primary_visual",
    "contemporaneous_reporting",
    "specialist_corroboration",
    "other",
  ]),
  sourceLocator: nullableTextSchema,
  excerpt: nullableTextSchema,
  editorialNote: nullableTextSchema,
  observedAt: z.iso.datetime({ offset: true }).nullable(),
  reviewStatus: z.enum(["pending", "accepted", "rejected"]),
  reviewedAt: z.iso.datetime({ offset: true }).nullable(),
});

export const discoveryImageRightsSchema = z
  .object({
    attributionId: recordIdSchema,
    imageState: z.enum([
      "no_image_stored",
      "licensed_asset",
      "owned_asset",
      "public_domain_asset",
      "external_embed_cleared",
    ]),
    assetUrl: z.url().nullable(),
    rightsBasis: nullableTextSchema,
    rightsHolder: nullableTextSchema,
    licenceName: nullableTextSchema,
    licenceUrl: z.url().nullable(),
    creditLine: nullableTextSchema,
    expiresAt: z.iso.datetime({ offset: true }).nullable(),
    reviewedAt: z.iso.datetime({ offset: true }),
    editorialNote: nullableTextSchema,
  })
  .superRefine((rights, context) => {
    if (rights.imageState === "no_image_stored" && rights.assetUrl !== null) {
      context.addIssue({
        code: "custom",
        path: ["assetUrl"],
        message:
          "No image may be attached when the decision is no image stored.",
      });
    }
    if (
      rights.imageState !== "no_image_stored" &&
      (rights.assetUrl === null || rights.rightsBasis === null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["rightsBasis"],
        message: "Every used image requires a cleared asset and rights basis.",
      });
    }
  });

export const discoveryCorrectionSchema = z
  .object({
    id: recordIdSchema,
    attributionId: recordIdSchema,
    sourceId: z.uuid().nullable(),
    correctionStatus: z.enum(["open", "resolved", "dismissed"]),
    summary: z.string().trim().min(1),
    publicNote: nullableTextSchema,
    resolutionNote: nullableTextSchema,
    openedAt: z.iso.datetime({ offset: true }),
    resolvedAt: z.iso.datetime({ offset: true }).nullable(),
  })
  .superRefine((correction, context) => {
    const resolved = correction.correctionStatus !== "open";
    if (resolved !== (correction.resolvedAt !== null)) {
      context.addIssue({
        code: "custom",
        path: ["resolvedAt"],
        message: "Resolved or dismissed corrections require a resolution time.",
      });
    }
  });

export const discoveryPublicationSchema = z
  .object({
    attribution: discoveryAttributionSchema,
    evidence: z.array(discoveryEvidenceSchema).min(1),
    imageRights: discoveryImageRightsSchema,
    corrections: z.array(discoveryCorrectionSchema),
  })
  .superRefine((publication, context) => {
    const attribution = publication.attribution;
    if (
      attribution.reviewStatus !== "accepted" ||
      attribution.publishedAt === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["attribution", "reviewStatus"],
        message:
          "Publication requires an accepted attribution and publication time.",
      });
    }

    const relatedEvidence = publication.evidence.filter(
      (evidence) => evidence.attributionId === attribution.id,
    );
    if (
      relatedEvidence.length !== publication.evidence.length ||
      !relatedEvidence.some(
        (evidence) =>
          evidence.reviewStatus === "accepted" &&
          evidence.stance === "supports" &&
          evidence.reviewedAt !== null,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["evidence"],
        message:
          "Publication requires accepted supporting evidence for this claim.",
      });
    }

    if (publication.imageRights.attributionId !== attribution.id) {
      context.addIssue({
        code: "custom",
        path: ["imageRights", "attributionId"],
        message: "The image-rights decision must belong to this attribution.",
      });
    }

    const relatedCorrections = publication.corrections.filter(
      (correction) => correction.attributionId === attribution.id,
    );
    if (relatedCorrections.length !== publication.corrections.length) {
      context.addIssue({
        code: "custom",
        path: ["corrections"],
        message: "Correction records must belong to this attribution.",
      });
    }
    if (
      attribution.confidenceCode === "disputed" &&
      !relatedCorrections.some(
        (correction) => correction.correctionStatus === "open",
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["corrections"],
        message: "A disputed publication requires an open correction record.",
      });
    }
  });

export const discoveryPilotStorySchema = z
  .object({
    slug: slugSchema,
    headline: z.string().trim().min(1),
    summary: z.string().trim().min(1),
    entity: discoveryEntitySchema,
    work: discoveryWorkSchema.nullable(),
    event: discoveryEventSchema.nullable(),
    publication: discoveryPublicationSchema,
  })
  .superRefine((story, context) => {
    const attribution = story.publication.attribution;
    const issue = (path: string[], message: string) =>
      context.addIssue({ code: "custom", path, message });

    if (attribution.entityId !== story.entity.id) {
      issue(
        ["publication", "attribution", "entityId"],
        "The attribution must belong to the pilot story entity.",
      );
    }
    if (attribution.workId !== (story.work?.id ?? null)) {
      issue(
        ["publication", "attribution", "workId"],
        "The attribution work must match the pilot story work.",
      );
    }
    if (attribution.eventId !== (story.event?.id ?? null)) {
      issue(
        ["publication", "attribution", "eventId"],
        "The attribution event must match the pilot story event.",
      );
    }
    if (attribution.referenceVariantId !== null) {
      issue(
        ["publication", "attribution", "referenceVariantId"],
        "The packet 8.2 pilot cannot create or assume catalogue links.",
      );
    }
    if (story.publication.imageRights.imageState !== "no_image_stored") {
      issue(
        ["publication", "imageRights", "imageState"],
        "The text-only pilot cannot attach uncleared imagery.",
      );
    }
  });

export const discoveryPilotCorpusSchema = z
  .object({
    version: z.literal(1),
    reviewedAt: z.iso.datetime({ offset: true }),
    stories: z.array(discoveryPilotStorySchema).min(20).max(30),
  })
  .superRefine((corpus, context) => {
    const unique = (values: Array<string | number>) =>
      new Set(values).size === values.length;
    const issue = (path: string[], message: string) =>
      context.addIssue({ code: "custom", path, message });

    if (!unique(corpus.stories.map((story) => story.slug))) {
      issue(["stories"], "Pilot story slugs must be unique.");
    }
    if (!unique(corpus.stories.map((story) => story.entity.id))) {
      issue(["stories"], "Each pilot story must have an independent entity.");
    }
    if (
      !unique(corpus.stories.map((story) => story.publication.attribution.id))
    ) {
      issue(["stories"], "Pilot attribution IDs must be unique.");
    }

    const hasCinema = corpus.stories.some(
      (story) => story.work?.workKind === "film",
    );
    const hasTelevision = corpus.stories.some((story) =>
      ["television_series", "television_episode"].includes(
        story.work?.workKind ?? "",
      ),
    );
    const hasPublicFigure = corpus.stories.some(
      (story) => story.entity.entityKind === "public_figure",
    );
    if (!hasCinema || !hasTelevision || !hasPublicFigure) {
      issue(
        ["stories"],
        "The pilot must include cinema, television, and public-figure stories.",
      );
    }
  });

export type DiscoveryPublication = z.infer<typeof discoveryPublicationSchema>;
export type DiscoveryPilotCorpus = z.infer<typeof discoveryPilotCorpusSchema>;
