import { z } from "zod";

const quizAnalyticsEventSchema = z
  .object({
    name: z.enum(["evaluation", "subscription"]),
    intent: z.enum(["core", "refine"]),
    catalogueOrigin: z.enum(["supabase", "bundled_seed"]),
    recommendationCount: z.number().int().nonnegative().optional(),
    verificationCount: z.number().int().nonnegative().optional(),
    whyNotCount: z.number().int().nonnegative().optional(),
    status: z
      .enum(["not_requested", "sent", "unavailable", "failed"])
      .optional(),
  })
  .strict();

export type QuizAnalyticsEvent = z.infer<typeof quizAnalyticsEventSchema>;

/**
 * Emit a privacy-safe event for the runtime log provider. Profile answers and
 * email addresses never enter this payload; only funnel dimensions and counts
 * needed for the Phase 7 evaluation are retained.
 */
export function recordQuizAnalyticsEvent(event: QuizAnalyticsEvent) {
  const parsed = quizAnalyticsEventSchema.parse(event);
  console.info(JSON.stringify({ event: "quiz_funnel", ...parsed }));
}
