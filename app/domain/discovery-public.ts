import { z } from "zod";

import {
  DISCOVERY_CONFIDENCE_LABELS,
  discoveryPilotCorpusSchema,
} from "./discovery";
import { DISCOVERY_PILOT_CORPUS } from "./discovery-pilot";

export const publishedDiscoveryStorySchema = z
  .object({
    slug: z.string(),
    headline: z.string(),
    summary: z.string(),
    entity: z.object({
      kind: z.enum(["public_figure", "fictional_character"]),
      slug: z.string(),
      name: z.string(),
      disambiguation: z.string().nullable(),
    }),
    work: z
      .object({
        slug: z.string(),
        title: z.string(),
        kind: z.enum([
          "film",
          "television_series",
          "television_episode",
          "documentary",
          "music_video",
          "other",
        ]),
        releaseDate: z.string().nullable(),
      })
      .nullable(),
    event: z
      .object({
        title: z.string(),
        occurredOn: z.string().nullable(),
        location: z.string().nullable(),
      })
      .nullable(),
    attribution: z.object({
      claimType: z.enum([
        "owned",
        "worn_publicly",
        "screen_worn",
        "reported",
        "unconfirmed",
      ]),
      precision: z.enum([
        "exact_reference",
        "model_family",
        "brand_only",
        "unidentified",
      ]),
      brand: z.string().nullable(),
      model: z.string().nullable(),
      reference: z.string().nullable(),
      confidence: z.enum([
        "confirmed",
        "disputed",
        "family_only",
        "unconfirmed",
      ]),
      confidenceLabel: z.string(),
      observedOn: z.string().nullable(),
      sceneLocator: z.string().nullable(),
      note: z.string().nullable(),
      publishedAt: z.string(),
    }),
    citations: z.array(
      z.object({
        url: z.url(),
        title: z.string().nullable(),
        publisher: z.string().nullable(),
        retrievedAt: z.string(),
        locator: z.string().nullable(),
      }),
    ),
    corrections: z.array(
      z.object({
        status: z.enum(["open", "resolved", "dismissed"]),
        note: z.string(),
      }),
    ),
    imageState: z.enum([
      "no_image_stored",
      "licensed_asset",
      "owned_asset",
      "public_domain_asset",
      "external_embed_cleared",
    ]),
  })
  .strict();

export const publishedDiscoveryStoriesSchema = z.array(
  publishedDiscoveryStorySchema,
);

function publishedStories() {
  return publishedDiscoveryStoriesSchema.parse(
    discoveryPilotCorpusSchema
      .parse(DISCOVERY_PILOT_CORPUS)
      .stories.map((story) => ({
        slug: story.slug,
        headline: story.headline,
        summary: story.summary,
        entity: {
          kind: story.entity.entityKind,
          slug: story.entity.slug,
          name: story.entity.displayName,
          disambiguation: story.entity.disambiguation,
        },
        work: story.work
          ? {
              slug: story.work.slug,
              title: story.work.title,
              kind: story.work.workKind,
              releaseDate: story.work.releaseDate,
            }
          : null,
        event: story.event
          ? {
              title: story.event.title,
              occurredOn: story.event.occurredOn,
              location: story.event.location,
            }
          : null,
        attribution: {
          claimType: story.publication.attribution.claimType,
          precision: story.publication.attribution.identificationPrecision,
          brand: story.publication.attribution.identifiedBrand,
          model: story.publication.attribution.identifiedModelFamily,
          reference: story.publication.attribution.identifiedReferenceCode,
          confidence: story.publication.attribution.confidenceCode,
          confidenceLabel:
            DISCOVERY_CONFIDENCE_LABELS[
              story.publication.attribution.confidenceCode
            ],
          observedOn: story.publication.attribution.observedOn,
          sceneLocator: story.publication.attribution.sceneLocator,
          note: story.publication.attribution.editorialNote,
          publishedAt: story.publication.attribution.publishedAt,
        },
        citations: story.publication.evidence
          .filter(
            (evidence) =>
              evidence.reviewStatus === "accepted" &&
              evidence.stance === "supports",
          )
          .map((evidence) => ({
            url: evidence.source.url,
            title: evidence.source.title,
            publisher: evidence.source.publisher,
            retrievedAt: evidence.source.retrievedAt,
            locator: evidence.sourceLocator,
          })),
        corrections: story.publication.corrections.map((correction) => ({
          status: correction.correctionStatus,
          note: correction.publicNote ?? correction.summary,
        })),
        imageState: story.publication.imageRights.imageState,
      })),
  );
}

export type PublishedDiscoveryStory = ReturnType<
  typeof publishedStories
>[number];

export function listPublishedDiscoveryStories() {
  return publishedStories();
}

export function findPublishedDiscoveryStory(slug: string) {
  return publishedStories().find((story) => story.slug === slug) ?? null;
}

export function findPublishedDiscoveryEntity(slug: string) {
  const stories = publishedStories().filter(
    (story) => story.entity.slug === slug,
  );
  return stories.length === 0 ? null : { entity: stories[0]!.entity, stories };
}

export function findPublishedDiscoveryWork(slug: string) {
  const stories = publishedStories().filter(
    (story) => story.work?.slug === slug,
  );
  const work = stories[0]?.work;
  return !work ? null : { work, stories };
}
