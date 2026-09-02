import { z } from "zod";

import {
  AESTHETIC_DNA,
  DEPLOYMENT_ENVIRONMENTS,
  SOCIAL_SIGNALS,
} from "./questionnaire";
import { PRICE_COMFORTS } from "./discovery-archetype";

export const DISCOVERY_CONTEXT_VERSION = "discovery_context_v1" as const;
export const DISCOVERY_ANCHOR_KINDS = [
  "work",
  "public_figure",
  "character",
] as const;
export const DISCOVERY_TOPIC_STATUSES = [
  "needs_clarification",
  "queued",
  "researching",
  "review_pending",
  "matched",
  "no_evidence",
  "failed",
] as const;
export const DISCOVERY_PRECISIONS = [
  "exact_reference",
  "family_only",
  "custom_prop",
  "unconfirmed",
] as const;

const boundedText = z
  .string()
  .trim()
  .min(2)
  .max(160)
  .refine(
    (value) =>
      !/[\u0000-\u001f\u007f]/.test(value) && !/https?:\/\//i.test(value),
    "Use a short name or title, not a URL or control characters.",
  );

export const discoveryAnchorSchema = z.enum(DISCOVERY_ANCHOR_KINDS);
export const discoverySearchSchema = z
  .object({
    anchor: discoveryAnchorSchema,
    query: boundedText,
  })
  .strict();
export const discoveryTopicStatusSchema = z.enum(DISCOVERY_TOPIC_STATUSES);

export const discoveryResearchTopicSchema = z
  .object({
    anchor: discoveryAnchorSchema,
    displayText: boundedText,
    normalizedText: z.string().trim().min(2).max(160),
    releaseYear: z.number().int().min(1888).max(2100).nullable(),
    status: discoveryTopicStatusSchema,
  })
  .strict();

export const discoveryContextTraitsSchema = z
  .object({
    socialSignal: z.enum(SOCIAL_SIGNALS).nullable(),
    aestheticDna: z.enum(AESTHETIC_DNA).nullable(),
    deploymentEnvironment: z.enum(DEPLOYMENT_ENVIRONMENTS).nullable(),
    priceComfort: z.enum(PRICE_COMFORTS).nullable(),
  })
  .strict();

export const discoveryCandidateSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    precision: z.enum(DISCOVERY_PRECISIONS),
    publishedAt: z.string().datetime(),
    reviewedAt: z.string().datetime(),
    traits: discoveryContextTraitsSchema,
  })
  .strict();

export const discoveryHandoffSchema = z
  .object({
    socialSignal: z.enum(SOCIAL_SIGNALS).optional(),
    aestheticDna: z.enum(AESTHETIC_DNA).optional(),
  })
  .strict();

export function parseDiscoveryHandoff(search: URLSearchParams) {
  const result = discoveryHandoffSchema.safeParse({
    socialSignal: search.get("socialSignal") ?? undefined,
    aestheticDna: search.get("aestheticDna") ?? undefined,
  });
  return result.success ? result.data : null;
}

export function normalizeDiscoveryTopic(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-US");
}

const precisionRank = {
  exact_reference: 3,
  family_only: 2,
  custom_prop: 1,
  unconfirmed: 0,
} as const;
export function rankDiscoveryContext(
  preferences: z.infer<typeof discoveryContextTraitsSchema>,
  candidates: z.infer<typeof discoveryCandidateSchema>[],
) {
  return candidates
    .map((candidate) => {
      const factors = {
        socialSignal:
          preferences.socialSignal !== null &&
          preferences.socialSignal === candidate.traits.socialSignal
            ? 3
            : 0,
        aestheticDna:
          preferences.aestheticDna !== null &&
          preferences.aestheticDna === candidate.traits.aestheticDna
            ? 3
            : 0,
        deploymentEnvironment:
          preferences.deploymentEnvironment !== null &&
          preferences.deploymentEnvironment ===
            candidate.traits.deploymentEnvironment
            ? 2
            : 0,
        priceComfort:
          preferences.priceComfort !== null &&
          preferences.priceComfort === candidate.traits.priceComfort
            ? 1
            : 0,
      };
      return {
        candidate,
        factors,
        score: Object.values(factors).reduce((a, b) => a + b, 0),
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        precisionRank[b.candidate.precision] -
          precisionRank[a.candidate.precision] ||
        b.candidate.reviewedAt.localeCompare(a.candidate.reviewedAt) ||
        a.candidate.slug.localeCompare(b.candidate.slug),
    );
}
