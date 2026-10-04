/**
 * POST /api/v1/quiz — the diagnostic's shortlist for a set of answers
 * (profileV4Schema, the same answers the /quiz page sends). GET returns the
 * choices to build a form from. See /api/v1/openapi.json.
 */
import type { Route } from "./+types/api-v1-quiz";
import {
  apiCallAllowed,
  apiError,
  apiJson,
  apiPreflight,
  apiStream,
  authenticateApiRequest,
  wantsStream,
} from "../domain/partner-api.server";
import { meterPartnerUse } from "../domain/partner-embed.server";
import { createProgressFeed } from "../domain/progress-feed";
import { MOVEMENT_TYPE_CHOICES } from "../domain/questionnaire-v3";
import {
  BUDGET_CURRENCIES,
  PRICE_RANGES,
  priceRangeLabel,
  profileV4Schema,
  QUESTIONNAIRE_V4_VERSION,
  WRIST_CM_MAX,
  WRIST_CM_MIN,
} from "../domain/questionnaire-v4";
import { issueMessages } from "../domain/quiz-form";
import { loadQuizOptions } from "../domain/quiz-options.server";
import { searchQuiz } from "../domain/quiz-search.server";
import type { RateLimitPolicy } from "../domain/rate-limit.server";

const VISITOR_POLICY: RateLimitPolicy = {
  configured: true,
  maxRequests: 20,
  windowMs: 10 * 60 * 1_000,
};

const BODY_MAX = 16_000;

export async function loader({ request }: Route.LoaderArgs) {
  if (request.method === "OPTIONS") return apiPreflight(request);
  const caller = await authenticateApiRequest(request);
  if (caller instanceof Response) return caller;
  const options = await loadQuizOptions();
  return apiJson(
    {
      version: QUESTIONNAIRE_V4_VERSION,
      currencies: BUDGET_CURRENCIES,
      priceRanges: PRICE_RANGES.map((range) => ({
        id: range.id,
        label: priceRangeLabel(range),
      })),
      wristCm: { min: WRIST_CM_MIN, max: WRIST_CM_MAX },
      wearingScenarios: options.scenarios,
      movementTypes: MOVEMENT_TYPE_CHOICES,
      complications: options.complications,
    },
    200,
    caller.origin,
  );
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method === "OPTIONS") return apiPreflight(request);
  if (request.method !== "POST")
    return apiError(405, "method_not_allowed", "Use POST.");
  const caller = await authenticateApiRequest(request);
  if (caller instanceof Response) return caller;
  const { origin } = caller;

  // JSON, sent as application/json or text/plain (the latter needs no
  // browser preflight).
  const text = await request.text();
  if (text.length > BODY_MAX)
    return apiError(413, "too_large", "The answers are too large.", origin);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return apiError(400, "invalid_json", "Send the answers as JSON.", origin);
  }
  const parsed = profileV4Schema.safeParse(body);
  if (!parsed.success) {
    return apiJson(
      {
        error: {
          code: "invalid_answers",
          message: issueMessages(parsed.error).join(" "),
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
      400,
      origin,
    );
  }

  if (!(await apiCallAllowed(caller, "quiz", request, VISITOR_POLICY))) {
    return apiError(
      429,
      "rate_limited",
      "Too many searches in a short time. Try again in a few minutes.",
      origin,
    );
  }
  const limitMessage = await meterPartnerUse(caller.site, "quiz");
  if (limitMessage) return apiError(429, "monthly_limit", limitMessage, origin);

  // Only the validated answers reach the search.
  const progress = createProgressFeed();
  const search = searchQuiz(parsed.data, { report: progress.report });
  void search.finally(progress.close);
  if (wantsStream(request)) {
    return apiStream(progress.feed, search, origin, (result) => ({ result }));
  }
  progress.close();
  return apiJson({ result: await search }, 200, origin);
}
