import { z } from "zod";

import type { ProfileV3 } from "./questionnaire-v3";

/**
 * Only these seven non-identifying constraint fields ever leave the server in
 * an AI prompt. No email, session, cookie, or IP data is read by this module.
 */
function constraintLines(profile: ProfileV3): string[] {
  return [
    `Budget ceiling: ${profile.budgetCurrency} ${profile.budgetMax}.`,
    `Wearing scenarios: ${profile.wearingScenarios.join(", ")}.`,
    `Minimum water resistance: ${profile.minimumWaterResistanceM} m.`,
    `Case diameter: ${profile.caseDiameterMinMm}-${profile.caseDiameterMaxMm} mm.`,
    `Movement types: ${profile.movementTypes.join(", ")}.`,
    `Required complications: ${profile.requiredComplications.length > 0 ? profile.requiredComplications.join(", ") : "none"}.`,
    `Allergy constraint: ${profile.allergyConstraint}.`,
  ];
}

export type MuseSparkConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export type PerplexityConfig = {
  apiKey: string;
  model: string;
};

export type AiWatchFinderConfig = {
  museSpark: MuseSparkConfig | null;
  perplexity: PerplexityConfig | null;
};

export function loadAiWatchFinderConfig(
  env: NodeJS.ProcessEnv = process.env,
): AiWatchFinderConfig {
  const museSparkKey = env.MUSE_SPARK_API_KEY?.trim();
  const perplexityKey = env.PERPLEXITY_API_KEY?.trim();
  return {
    museSpark: museSparkKey
      ? {
          apiKey: museSparkKey,
          baseUrl: (
            env.MUSE_SPARK_BASE_URL?.trim() || "https://api.meta.ai/v1"
          ).replace(/\/?$/, "/"),
          model: env.MUSE_SPARK_MODEL?.trim() || "muse-spark-1.3-contributor",
        }
      : null,
    perplexity: perplexityKey
      ? {
          apiKey: perplexityKey,
          model: env.PERPLEXITY_RESEARCH_MODEL?.trim() || "sonar-pro",
        }
      : null,
  };
}

function extractMessage(body: unknown): Record<string, unknown> {
  const choices = (body as { choices?: unknown } | null)?.choices;
  const first = Array.isArray(choices) ? choices[0] : undefined;
  const message = (first as { message?: unknown } | undefined)?.message;
  if (!message || typeof message !== "object") {
    const finishReason = (first as { finish_reason?: unknown } | undefined)
      ?.finish_reason;
    const usage = (body as { usage?: unknown } | null)?.usage;
    throw new Error(
      `The model response did not include a message (finish_reason=${JSON.stringify(finishReason)}, usage=${JSON.stringify(usage)}).`,
    );
  }
  return message as Record<string, unknown>;
}

function parseJsonObject(text: string): unknown {
  const unfenced = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start === -1 || end < start) {
    throw new Error("The model response did not contain a JSON object.");
  }
  return JSON.parse(unfenced.slice(start, end + 1));
}

const watchFindSchema = z
  .object({
    found: z.boolean(),
    brand: z.string().min(1).nullable(),
    model: z.string().min(1).nullable(),
    referenceCode: z.string().min(1).nullable(),
    sourceUrl: z.url().nullable(),
    rationale: z.string().min(1),
  })
  .strict();

export type FindWatchResult =
  | {
      status: "found";
      brand: string | null;
      model: string | null;
      referenceCode: string | null;
      sourceUrl: string | null;
      rationale: string;
    }
  | { status: "no_match"; rationale: string }
  | { status: "unavailable"; reason: string };

const PERPLEXITY_SEARCH_TOOL = {
  type: "function",
  function: {
    name: "search_watches_via_perplexity",
    description:
      "Search the live web via Perplexity for real, currently available watches matching a natural-language description of constraints. Always use this before answering; never answer from memory alone.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "A natural-language search query describing the desired watch constraints.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
} as const;

/**
 * Executes the live Perplexity search that Muse Spark's tool call requested.
 * The query text is whatever Muse Spark composed from the non-PII constraint
 * lines it was given; no profile data is added here.
 */
async function searchWatchesViaPerplexity(
  query: string,
  config: PerplexityConfig,
  fetchImpl: typeof fetch,
): Promise<{ text: string; citations: string[] }> {
  const response = await fetchImpl("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: "user", content: query }],
      max_tokens: 900,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(
      `Perplexity returned ${response.status}: ${(await response.text()).slice(0, 300)}`,
    );
  }
  const body = await response.json();
  const message = extractMessage(body);
  const text = message.content;
  if (typeof text !== "string" || text.length === 0) {
    throw new Error("Perplexity response did not include message content.");
  }
  const citations = Array.isArray((body as { citations?: unknown }).citations)
    ? ((body as { citations: unknown[] }).citations.filter(
        (value): value is string => typeof value === "string",
      ) as string[])
    : [];
  return { text, citations };
}

const MAX_TOOL_ROUNDS = 3;

/**
 * Runs on every quiz completion. Muse Spark is not restricted to any
 * pre-vetted candidate list: it is forced to call the
 * search_watches_via_perplexity tool at least once, reviews the live results,
 * and only then answers with the best-fitting watch it found. Only the
 * non-PII constraint lines ever leave this server.
 */
export async function findWatchWithAi(
  profile: ProfileV3,
  config: AiWatchFinderConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<FindWatchResult> {
  if (!config.museSpark) {
    return { status: "unavailable", reason: "Muse Spark is not configured." };
  }
  if (!config.perplexity) {
    return {
      status: "unavailable",
      reason: "Perplexity is not configured for the search tool Muse Spark requires.",
    };
  }
  const museSpark = config.museSpark;
  const perplexity = config.perplexity;

  const systemPrompt =
    "You are a watch-finding assistant for The Reserve. You are given anonymous search constraints only; no personal or identifying data is available to you and none should be requested. You MUST call the search_watches_via_perplexity tool before writing any other response — never answer, and never write JSON, on your first turn. Only after you receive the tool's search results may you respond, and that response must be the requested JSON. Do not invent a watch the search did not surface.";
  const userPrompt = ["Constraints:", ...constraintLines(profile)].join("\n");

  const messages: Record<string, unknown>[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  let sawToolCall = false;
  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    // Meta's Model API only supports tool_choice: "auto" — forcing a named
    // function call (or "required") is rejected with a 400. The system
    // prompt's "MUST call the tool first" instruction does the forcing
    // instead; sawToolCall below still hard-fails if that didn't happen.
    const response = await fetchImpl(new URL("chat/completions", museSpark.baseUrl), {
      method: "POST",
      headers: {
        authorization: `Bearer ${museSpark.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: museSpark.model,
        messages,
        tools: [PERPLEXITY_SEARCH_TOOL],
        tool_choice: "auto",
        ...(sawToolCall
          ? {
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "WatchFind",
                  schema: z.toJSONSchema(watchFindSchema, { target: "draft-7" }),
                },
              },
            }
          : {}),
        // Muse Spark is a reasoning model: hidden reasoning tokens are billed
        // against max_tokens before any visible content is written, so this
        // must be generous or the response truncates with content: null.
        max_tokens: 6_000,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      throw new Error(
        `Muse Spark returned ${response.status}: ${(await response.text()).slice(0, 300)}`,
      );
    }
    const body = await response.json();
    const message = extractMessage(body);
    const toolCalls = message.tool_calls;

    if (Array.isArray(toolCalls) && toolCalls.length > 0) {
      sawToolCall = true;
      messages.push(message);
      for (const toolCall of toolCalls) {
        const call = toolCall as {
          id: string;
          function: { name: string; arguments: string };
        };
        const args = parseJsonObject(call.function.arguments) as { query?: unknown };
        const query = typeof args.query === "string" ? args.query : userPrompt;
        const searchResult = await searchWatchesViaPerplexity(
          query,
          perplexity,
          fetchImpl,
        );
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(searchResult),
        });
      }
      continue;
    }

    if (!sawToolCall) {
      throw new Error(
        "Muse Spark answered without ever calling search_watches_via_perplexity, violating the required search-first instruction.",
      );
    }
    const content = message.content;
    if (typeof content !== "string" || content.length === 0) {
      throw new Error(
        "Muse Spark answered without a tool call and without message content.",
      );
    }
    const parsed = watchFindSchema.parse(parseJsonObject(content));
    return parsed.found
      ? {
          status: "found",
          brand: parsed.brand,
          model: parsed.model,
          referenceCode: parsed.referenceCode,
          sourceUrl: parsed.sourceUrl,
          rationale: parsed.rationale,
        }
      : { status: "no_match", rationale: parsed.rationale };
  }

  throw new Error(
    `Muse Spark did not produce a final answer within ${MAX_TOOL_ROUNDS} tool-calling rounds.`,
  );
}

/** What the browser receives: no internal error text, no upstream bodies. */
export type AiSearchView =
  | {
      status: "found";
      brand: string | null;
      model: string | null;
      referenceCode: string | null;
      sourceUrl: string | null;
      rationale: string;
    }
  | { status: "no_match"; rationale: string }
  | { status: "unavailable" };

// The model chooses this URL, and it ends up in an href.
function safeHttpUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export const AI_SEARCH_TIMEOUT_MS = 100_000;

/**
 * Runs the Muse Spark -> Perplexity search for one quiz submission without
 * ever throwing: failures, missing configuration, and timeouts are logged
 * server-side and surface to the page only as "unavailable".
 */
export async function searchWatchForQuiz(
  profile: ProfileV3,
  {
    config = loadAiWatchFinderConfig(),
    timeoutMs = AI_SEARCH_TIMEOUT_MS,
    fetchImpl = fetch,
  }: {
    config?: AiWatchFinderConfig;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<AiSearchView> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      findWatchWithAi(profile, config, fetchImpl),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`AI watch search exceeded ${timeoutMs} ms.`)),
          timeoutMs,
        );
      }),
    ]);
    if (result.status === "found") {
      return { ...result, sourceUrl: safeHttpUrl(result.sourceUrl) };
    }
    if (result.status === "no_match") return result;
    console.error(
      JSON.stringify({ event: "ai_watch_search_unavailable", reason: result.reason }),
    );
    return { status: "unavailable" };
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "ai_watch_search_error",
        message: error instanceof Error ? error.message : "unknown error",
      }),
    );
    return { status: "unavailable" };
  } finally {
    clearTimeout(timer);
  }
}
