import { z } from "zod";

import type { PublishedDiscoveryStory } from "./discovery-public";
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

const normalizedReference = (value: string | null) =>
  value?.replace(/[\s.-]/g, "").toLowerCase() || null;

/** Whether the story's own watch is among the watches found for the visitor. */
export function explainStoryConstraint(
  story: PublishedDiscoveryStory,
  watches: readonly { referenceCode: string | null }[],
) {
  const identity = originalIdentity(story) || "This attribution";
  const reference = normalizedReference(story.attribution.reference);
  const inShortlist =
    reference !== null &&
    watches.some(
      (watch) => normalizedReference(watch.referenceCode) === reference,
    );
  return inShortlist
    ? {
        identity,
        status: "in_shortlist" as const,
        message: `${identity} is in your shortlist: it fits your constraints.`,
      }
    : {
        identity,
        status: "not_in_shortlist" as const,
        message: `${identity} is not in your shortlist; the watches above were found for your own constraints.`,
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
