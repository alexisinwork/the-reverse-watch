/**
 * GET /api/v1/archetype — without answers, the four questions and their
 * choices; with answers (?socialSignal=…&aestheticDna=…
 * &deploymentEnvironment=…&priceComfort=…), the archetype and its ten
 * watches. No AI call: the watches are chosen ahead of time.
 */
import type { Route } from "./+types/api-v1-archetype";
import { ARCHETYPE_BANDS, archetypeWatches } from "../domain/archetype-picks";
import {
  ARCHETYPE_QUESTIONS,
  ARCHETYPE_SCORING_VERSION,
  parseArchetypeSearch,
} from "../domain/discovery-archetype";
import {
  apiCallAllowed,
  apiError,
  apiJson,
  apiPreflight,
  authenticateApiRequest,
} from "../domain/partner-api.server";
import { meterPartnerUse } from "../domain/partner-embed.server";
import type { RateLimitPolicy } from "../domain/rate-limit.server";

const VISITOR_POLICY: RateLimitPolicy = {
  configured: true,
  maxRequests: 60,
  windowMs: 10 * 60 * 1_000,
};

export async function loader({ request }: Route.LoaderArgs) {
  if (request.method === "OPTIONS") return apiPreflight(request);
  const caller = await authenticateApiRequest(request);
  if (caller instanceof Response) return caller;
  const { origin } = caller;

  const params = new URL(request.url).searchParams;
  // The current scoring applies unless a shared link pins an older one.
  if (!params.has("scoringVersion"))
    params.set("scoringVersion", ARCHETYPE_SCORING_VERSION);
  const parsed = parseArchetypeSearch(params);
  if (parsed.status === "idle") {
    return apiJson(
      {
        scoringVersion: ARCHETYPE_SCORING_VERSION,
        questions: ARCHETYPE_QUESTIONS.map((question) => ({
          name: question.name,
          question: question.legend,
          ...("hint" in question ? { hint: question.hint } : {}),
          options: question.options.map(([value, label]) => ({
            value,
            label,
          })),
        })),
      },
      200,
      origin,
    );
  }
  if (parsed.status === "invalid") {
    return apiError(
      400,
      "invalid_answers",
      "Answer all four questions with one of the listed values (GET without parameters lists them).",
      origin,
    );
  }

  if (!(await apiCallAllowed(caller, "archetype", request, VISITOR_POLICY))) {
    return apiError(
      429,
      "rate_limited",
      "Too many requests in a short time. Try again in a few minutes.",
      origin,
    );
  }
  const limitMessage = await meterPartnerUse(caller.site, "archetype");
  if (limitMessage) return apiError(429, "monthly_limit", limitMessage, origin);

  const { archetype, answers } = parsed;
  return apiJson(
    {
      archetype: {
        id: archetype.id,
        title: archetype.title,
        strapline: archetype.strapline,
        description: archetype.description,
      },
      priceIdea: ARCHETYPE_BANDS[answers.priceComfort].label,
      watches: archetypeWatches(archetype.id, answers.priceComfort),
    },
    200,
    origin,
  );
}
