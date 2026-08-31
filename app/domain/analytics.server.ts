import { z } from "zod";
import { track } from "@vercel/analytics/server";

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
export async function recordQuizAnalyticsEvent(
  event: QuizAnalyticsEvent,
  request?: Request,
) {
  const parsed = quizAnalyticsEventSchema.parse(event);
  console.info(JSON.stringify({ event: "quiz_funnel", ...parsed }));

  if (!request) return;

  const { name, ...properties } = parsed;
  await track(`quiz_${name}`, properties, { request });
}
