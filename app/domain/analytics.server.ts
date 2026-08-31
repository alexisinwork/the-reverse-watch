import { z } from "zod";

import { persistFunnelEvent } from "./funnel-store.server";

const quizAnalyticsEventSchema = z
  .object({
    name: z.enum(["evaluation", "subscription"]),
    intent: z.enum(["core", "refine"]),
    catalogueOrigin: z.enum(["supabase", "bundled_seed"]),
    recommendationCount: z.number().int().nonnegative().optional(),
    verificationCount: z.number().int().nonnegative().optional(),
    whyNotCount: z.number().int().nonnegative().optional(),
    hardFilterViolationCount: z.number().int().nonnegative().optional(),
    evaluationDurationMs: z.number().nonnegative().optional(),
    providerCostUsd: z.number().nonnegative().optional(),
    topRecommendationScore: z.number().nonnegative().nullable().optional(),
    meanRecommendationScore: z.number().nonnegative().nullable().optional(),
    status: z
      .enum([
        "not_requested",
        "sent",
        "partial",
        "unavailable",
        "failed",
        "already_requested",
      ])
      .optional(),
  })
  .strict();

export type QuizAnalyticsEvent = z.infer<typeof quizAnalyticsEventSchema>;

/**
 * Emit a privacy-safe event for the runtime log provider. Profile answers and
 * email addresses never enter this payload; only funnel dimensions and counts
 * needed for the Phase 7 evaluation are retained.
 */
export async function recordQuizAnalyticsEvent(event: QuizAnalyticsEvent) {
  const parsed = quizAnalyticsEventSchema.parse(event);
  console.info(JSON.stringify({ event: "quiz_funnel", ...parsed }));
  try {
    await persistFunnelEvent(parsed);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "quiz_funnel_persistence_error",
        message: error instanceof Error ? error.message : "unknown error",
      }),
    );
  }
}
