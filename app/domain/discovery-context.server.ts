import { z } from "zod";

import type { PublishedDiscoveryStory } from "./discovery-public";
import type { RecommendationResult } from "./recommendation";
import type { AESTHETIC_DNA, SOCIAL_SIGNALS } from "./questionnaire";

const storySlugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(120);

export function parseDiscoveryStorySlug(value: string | null) {
  if (value === null) return { status: "none" as const, slug: null };
  const parsed = storySlugSchema.safeParse(value);
  return parsed.success
    ? { status: "valid" as const, slug: parsed.data }
    : { status: "invalid" as const, slug: null };
}

export function discoverySoftPreferences(traits: {
  socialSignal: (typeof SOCIAL_SIGNALS)[number] | null;
  aestheticDna: (typeof AESTHETIC_DNA)[number] | null;
}) {
  return {
    socialSignal: traits.socialSignal,
    aestheticDna: traits.aestheticDna,
  };
}

function originalIdentity(story: PublishedDiscoveryStory) {
  return [
    story.attribution.brand,
    story.attribution.model,
    story.attribution.reference,
  ]
    .filter(Boolean)
    .join(" ");
}

export function explainStoryConstraint(
  story: PublishedDiscoveryStory,
  recommendation: RecommendationResult,
) {
  const identity = originalIdentity(story) || "This attribution";
  const candidates = [
    ...recommendation.recommendations,
    ...recommendation.verificationRequired,
    ...recommendation.whyNot,
  ];
  const original = candidates.find(
    (candidate) =>
      story.attribution.reference !== null &&
      candidate.referenceCode === story.attribution.reference,
  );
  if (!original) {
    return {
      identity,
      status: "not_in_reviewed_catalogue" as const,
      message:
        `${identity} is not in the current reviewed recommendation catalogue; ` +
        "the equivalent shortlist is evaluated independently.",
      hardReasons: [] as string[],
    };
  }
  if (original.hardReasons.length > 0) {
    return {
      identity,
      status: "fails_hard_constraints" as const,
      message:
        `${identity} is retained as context, but it fails one or more of ` +
        "your non-negotiable constraints.",
      hardReasons: original.hardReasons.map((reason) => reason.code),
    };
  }
  return {
    identity,
    status: "meets_hard_constraints" as const,
    message: `${identity} meets the current hard constraints; the shortlist still ranks reviewed equivalents by fit.`,
    hardReasons: [] as string[],
  };
}

export type DiscoveryStoryContext = {
  story: PublishedDiscoveryStory;
  traits: {
    socialSignal: string | null;
    aestheticDna: string | null;
    deploymentEnvironment: string | null;
    priceComfort: string | null;
  };
};

export type DiscoveryStoryContextSummary = ReturnType<
  typeof explainStoryConstraint
>;
