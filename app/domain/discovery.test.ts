import {
  DISCOVERY_CONFIDENCE_LABELS,
  discoveryAttributionSchema,
  discoveryPilotCorpusSchema,
  discoveryPublicationSchema,
} from "./discovery";
import { DISCOVERY_PILOT_CORPUS } from "./discovery-pilot";

const timestamp = "2026-08-31T12:00:00.000Z";
const sourceId = "10000000-0000-4000-8000-000000000001";
const referenceVariantId = "20000000-0000-4000-8000-000000000001";

const confirmedAttribution = {
  id: 1,
  entityId: 1,
  workId: 1,
  eventId: null,
  referenceVariantId,
  claimType: "screen_worn" as const,
  identificationPrecision: "exact_reference" as const,
  identifiedBrand: "Example Watch Co.",
  identifiedModelFamily: "Example Model",
  identifiedReferenceCode: "EX-100",
  confidenceCode: "confirmed" as const,
  disputeState: "clear" as const,
  observedOn: "2026-08-30",
  sceneLocator: "00:42:10",
  editorialNote: "The case and dial are visible in the cited production still.",
  reviewStatus: "accepted" as const,
  publishedAt: timestamp,
};

const supportingEvidence = {
  id: 1,
  attributionId: 1,
  source: {
    id: sourceId,
    url: "https://example.com/production-record",
    title: "Production record",
    publisher: "Example Studio",
    sourceType: "official_production_record",
    publishedAt: null,
    retrievedAt: timestamp,
    archivedUrl: null,
  },
  stance: "supports" as const,
  sourceRole: "official_production_record" as const,
  sourceLocator: "Prop inventory item 14",
  excerpt: null,
  editorialNote: "Exact reference recorded by the production.",
  observedAt: timestamp,
  reviewStatus: "accepted" as const,
  reviewedAt: timestamp,
};

const noImageStored = {
  attributionId: 1,
  imageState: "no_image_stored" as const,
  assetUrl: null,
  rightsBasis: null,
  rightsHolder: null,
  licenceName: null,
  licenceUrl: null,
  creditLine: null,
  expiresAt: null,
  reviewedAt: timestamp,
  editorialNote: "Text-only publication.",
};

describe("Phase 8 discovery claim contract", () => {
  it("publishes a reviewed exact-reference claim with evidence and image decision", () => {
    expect(
      discoveryPublicationSchema.safeParse({
        attribution: confirmedAttribution,
        evidence: [supportingEvidence],
        imageRights: noImageStored,
        corrections: [],
      }).success,
    ).toBe(true);
    expect(DISCOVERY_CONFIDENCE_LABELS.confirmed).toBe(
      "Confirmed identification",
    );
  });

  it("does not publish an unsupported claim as confirmed", () => {
    expect(
      discoveryPublicationSchema.safeParse({
        attribution: confirmedAttribution,
        evidence: [
          {
            ...supportingEvidence,
            stance: "context",
            reviewStatus: "pending",
            reviewedAt: null,
          },
        ],
        imageRights: noImageStored,
        corrections: [],
      }).success,
    ).toBe(false);
  });

  it("does not turn a family-only identification into an exact catalogue link", () => {
    const familyOnly = {
      ...confirmedAttribution,
      referenceVariantId: null,
      identificationPrecision: "model_family" as const,
      identifiedReferenceCode: null,
      confidenceCode: "family_only" as const,
    };
    expect(discoveryAttributionSchema.safeParse(familyOnly).success).toBe(true);
    expect(
      discoveryAttributionSchema.safeParse({
        ...familyOnly,
        referenceVariantId,
      }).success,
    ).toBe(false);
  });

  it("requires screen-worn claims to identify a work, not a public event", () => {
    expect(
      discoveryAttributionSchema.safeParse({
        ...confirmedAttribution,
        workId: null,
        eventId: 4,
      }).success,
    ).toBe(false);
  });

  it("requires an exact reference code or reviewed catalogue link", () => {
    expect(
      discoveryAttributionSchema.safeParse({
        ...confirmedAttribution,
        referenceVariantId: null,
        identifiedReferenceCode: null,
      }).success,
    ).toBe(false);
  });

  it("requires a rights basis before publishing an image", () => {
    expect(
      discoveryPublicationSchema.safeParse({
        attribution: confirmedAttribution,
        evidence: [supportingEvidence],
        imageRights: {
          ...noImageStored,
          imageState: "external_embed_cleared",
          assetUrl: "https://example.com/still.jpg",
        },
        corrections: [],
      }).success,
    ).toBe(false);
  });

  it("requires an open correction record for a disputed publication", () => {
    const disputed = {
      ...confirmedAttribution,
      confidenceCode: "disputed" as const,
      disputeState: "disputed" as const,
    };
    const withoutCorrection = discoveryPublicationSchema.safeParse({
      attribution: disputed,
      evidence: [supportingEvidence],
      imageRights: noImageStored,
      corrections: [],
    });
    expect(withoutCorrection.success).toBe(false);

    expect(
      discoveryPublicationSchema.safeParse({
        attribution: disputed,
        evidence: [supportingEvidence],
        imageRights: noImageStored,
        corrections: [
          {
            id: 1,
            attributionId: 1,
            sourceId,
            correctionStatus: "open",
            summary: "Two credible sources identify different references.",
            publicNote: "Identification is under review.",
            resolutionNote: null,
            openedAt: timestamp,
            resolvedAt: null,
          },
        ],
      }).success,
    ).toBe(true);
  });
});

describe("Phase 8 editorial pilot corpus", () => {
  it("validates 20 to 30 independent, reviewed discovery stories", () => {
    const result = discoveryPilotCorpusSchema.safeParse(DISCOVERY_PILOT_CORPUS);

    expect(result.error?.issues).toEqual(undefined);
    expect(result.success).toBe(true);
    expect(DISCOVERY_PILOT_CORPUS.stories).toHaveLength(21);
  });

  it("keeps the text-only pilot outside the recommendation catalogue", () => {
    for (const story of DISCOVERY_PILOT_CORPUS.stories) {
      expect(story.publication.attribution.referenceVariantId).toBeNull();
      expect(story.publication.imageRights.imageState).toBe("no_image_stored");
      expect(
        story.publication.evidence.every(
          (evidence) =>
            evidence.reviewStatus === "accepted" &&
            evidence.stance === "supports" &&
            evidence.source.retrievedAt === DISCOVERY_PILOT_CORPUS.reviewedAt,
        ),
      ).toBe(true);
    }
  });

  it("includes cinema, television, public figures, and conservative uncertainty", () => {
    expect(
      DISCOVERY_PILOT_CORPUS.stories.some(
        (story) => story.work?.workKind === "film",
      ),
    ).toBe(true);
    expect(
      DISCOVERY_PILOT_CORPUS.stories.some((story) =>
        ["television_series", "television_episode"].includes(
          story.work?.workKind ?? "",
        ),
      ),
    ).toBe(true);
    expect(
      DISCOVERY_PILOT_CORPUS.stories.some(
        (story) => story.entity.entityKind === "public_figure",
      ),
    ).toBe(true);
    expect(
      DISCOVERY_PILOT_CORPUS.stories.some(
        (story) =>
          story.publication.attribution.confidenceCode === "unconfirmed" &&
          story.publication.attribution.identificationPrecision ===
            "unidentified",
      ),
    ).toBe(true);
  });
});
