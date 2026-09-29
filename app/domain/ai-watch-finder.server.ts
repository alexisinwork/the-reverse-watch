import { z } from "zod";

import { derivePriceBand, PRICE_BANDS } from "./questionnaire";
import type { ProfileV3 } from "./questionnaire-v3";

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

/**
 * What to search for, as plain non-identifying text. Callers build it from
 * search constraints only; no email, session, cookie, or IP ever goes in.
 */
export type WatchBrief = {
  task: string;
  lines: string[];
  maxWatches: number;
};

export const QUIZ_MAX_WATCHES = 5;

/**
 * Results are stored and reused per price band, so the search itself targets
 * the band rather than the visitor's exact ceiling; otherwise a stored result
 * would not hold for the next visitor in the same band.
 */
function priceRangeLine(profile: ProfileV3) {
  const band = PRICE_BANDS.find(
    (candidate) => candidate.id === derivePriceBand(profile.budgetMax),
  )!;
  const amount = (value: number) =>
    `${profile.budgetCurrency} ${value.toLocaleString("en")}`;
  return band.maximumExclusive === null
    ? `Price: ${amount(band.minimum)} or more (new, retail).`
    : `Price: between ${amount(band.minimum)} and ${amount(band.maximumExclusive)} (new, retail).`;
}

/** The inputs that decide whether two quiz submissions share a result. */
export function quizCacheInput(profile: ProfileV3) {
  const sorted = (values: readonly string[]) => [...values].sort();
  return {
    budgetCurrency: profile.budgetCurrency,
    priceBand: derivePriceBand(profile.budgetMax),
    wearingScenarios: sorted(profile.wearingScenarios),
    minimumWaterResistanceM: profile.minimumWaterResistanceM,
    caseDiameterMinMm: profile.caseDiameterMinMm,
    caseDiameterMaxMm: profile.caseDiameterMaxMm,
    movementTypes: sorted(profile.movementTypes),
    requiredComplications: sorted(profile.requiredComplications),
    allergyConstraint: profile.allergyConstraint,
    maxCaseThicknessMm: profile.maxCaseThicknessMm,
    caseShape: profile.caseShape,
    movementConstruction: profile.movementConstruction,
    displayCaseback: profile.displayCaseback,
    crystal: profile.crystal,
    microAdjustmentRequired: profile.microAdjustmentRequired,
  };
}

export function quizBrief(profile: ProfileV3): WatchBrief {
  const optional = [
    profile.maxCaseThicknessMm !== undefined
      ? `Maximum case thickness: ${profile.maxCaseThicknessMm} mm.`
      : null,
    profile.caseShape !== undefined ? `Case shape: ${profile.caseShape}.` : null,
    profile.movementConstruction !== undefined
      ? `Movement construction: ${profile.movementConstruction === "manufacture" ? "in-house calibre" : "widely produced calibre"}.`
      : null,
    profile.displayCaseback !== undefined
      ? `Caseback: ${profile.displayCaseback ? "display" : "solid"}.`
      : null,
    profile.crystal !== undefined ? `Crystal: ${profile.crystal}.` : null,
    profile.microAdjustmentRequired !== undefined
      ? `Clasp micro-adjustment: ${profile.microAdjustmentRequired ? "required" : "not wanted"}.`
      : null,
  ].filter((line): line is string => line !== null);

  return {
    task: `Find up to ${QUIZ_MAX_WATCHES} distinct real, currently available watches that each satisfy every constraint below, best fit first.`,
    lines: [
      priceRangeLine(profile),
      `Wearing scenarios: ${profile.wearingScenarios.join(", ")}.`,
      `Minimum water resistance: ${profile.minimumWaterResistanceM} m.`,
      `Case diameter: ${profile.caseDiameterMinMm}-${profile.caseDiameterMaxMm} mm.`,
      `Movement types: ${profile.movementTypes.join(", ")}.`,
      `Required complications: ${profile.requiredComplications.length > 0 ? profile.requiredComplications.join(", ") : "none"}.`,
      `Allergy constraint: ${profile.allergyConstraint === "nickel_contact" ? "no nickel may touch the skin (case back and bracelet included)" : "none"}.`,
      ...optional,
    ],
    maxWatches: QUIZ_MAX_WATCHES,
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

const modelWatchSchema = z.object({
  brand: z.string().nullable(),
  model: z.string().nullable(),
  referenceCode: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  imageUrl: z.string().nullable(),
  priceNote: z.string().nullable(),
  rationale: z.string(),
});

const modelAnswerSchema = z.object({
  found: z.boolean(),
  watches: z.array(modelWatchSchema).max(10),
  summary: z.string().min(1),
});

export type FoundWatch = {
  brand: string;
  model: string;
  referenceCode: string | null;
  sourceUrl: string;
  imageUrl: string | null;
  priceNote: string | null;
  rationale: string;
};

export type FindWatchesResult =
  | { status: "found"; watches: FoundWatch[]; summary: string }
  | { status: "no_match"; summary: string }
  | { status: "unavailable"; reason: string };

// Model output ends up in href and src attributes.
export function safeHttpUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * The URL is only kept (never the file) when the host really answers with an
 * image; many sites refuse HEAD, so a one-byte ranged GET is the fallback.
 */
export async function verifyImageUrl(
  url: string | null,
  fetchImpl: typeof fetch,
): Promise<string | null> {
  if (!url) return null;
  const isImage = (response: Response) =>
    response.ok &&
    (response.headers.get("content-type") ?? "").toLowerCase().startsWith("image/");
  try {
    const head = await fetchImpl(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(5_000),
    });
    if (isImage(head)) return url;
    const ranged = await fetchImpl(url, {
      headers: { range: "bytes=0-0" },
      redirect: "follow",
      signal: AbortSignal.timeout(5_000),
    });
    await ranged.body?.cancel();
    return isImage(ranged) ? url : null;
  } catch {
    return null;
  }
}

async function finalizeWatches(
  candidates: z.infer<typeof modelWatchSchema>[],
  maxWatches: number,
  fetchImpl: typeof fetch,
): Promise<FoundWatch[]> {
  const seen = new Set<string>();
  const kept: FoundWatch[] = [];
  for (const candidate of candidates) {
    const brand = clean(candidate.brand);
    const model = clean(candidate.model);
    const sourceUrl = safeHttpUrl(candidate.sourceUrl);
    // Anything served to later visitors must name a real watch and cite it.
    if (!brand || !model || !sourceUrl) continue;
    const referenceCode = clean(candidate.referenceCode);
    const identity = `${brand}|${model}|${referenceCode ?? ""}`.toLowerCase();
    if (seen.has(identity)) continue;
    seen.add(identity);
    kept.push({
      brand,
      model,
      referenceCode,
      sourceUrl,
      imageUrl: safeHttpUrl(candidate.imageUrl),
      priceNote: clean(candidate.priceNote),
      rationale: candidate.rationale.trim(),
    });
    if (kept.length === maxWatches) break;
  }
  const images = await Promise.all(
    kept.map((watch) => verifyImageUrl(watch.imageUrl, fetchImpl)),
  );
  return kept.map((watch, index) => ({ ...watch, imageUrl: images[index]! }));
}

const PERPLEXITY_SEARCH_TOOL = {
  type: "function",
  function: {
    name: "search_watches_via_perplexity",
    description:
      "Search the live web via Perplexity. Returns an answer, citation URLs, and image results (imageUrl plus the page it came from). Always use this before answering; never answer from memory alone. You may call it again to find a missing image or detail.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "A natural-language web search query.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
} as const;

type SearchImage = { imageUrl: string; originUrl: string | null };

/**
 * Executes the live Perplexity search that Muse Spark's tool call requested.
 * The query text is whatever Muse Spark composed from the brief it was
 * given; nothing else is added here.
 */
const PERPLEXITY_RETRIES = 2;

async function postToPerplexity(
  query: string,
  config: PerplexityConfig,
  fetchImpl: typeof fetch,
  sleep: (ms: number) => Promise<void>,
) {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetchImpl("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: "user", content: query }],
        max_tokens: 1_200,
        return_images: true,
      }),
      signal: AbortSignal.timeout(40_000),
    });
    if (response.status !== 429 || attempt === PERPLEXITY_RETRIES) return response;
    await response.body?.cancel();
    const retryAfterSeconds = Number(response.headers.get("retry-after"));
    await sleep(
      Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? Math.min(retryAfterSeconds, 20) * 1_000
        : 2_000 * (attempt + 1),
    );
  }
}

async function searchWatchesViaPerplexity(
  query: string,
  config: PerplexityConfig,
  fetchImpl: typeof fetch,
  sleep: (ms: number) => Promise<void>,
): Promise<{ text: string; citations: string[]; images: SearchImage[] }> {
  const response = await postToPerplexity(query, config, fetchImpl, sleep);
  if (!response.ok) {
    throw new Error(
      `Perplexity returned ${response.status}: ${(await response.text()).slice(0, 300)}`,
    );
  }
  const body = (await response.json()) as {
    citations?: unknown;
    images?: unknown;
  };
  const message = extractMessage(body);
  const text = message.content;
  if (typeof text !== "string" || text.length === 0) {
    throw new Error("Perplexity response did not include message content.");
  }
  const citations = Array.isArray(body.citations)
    ? body.citations.filter((value): value is string => typeof value === "string")
    : [];
  const images = Array.isArray(body.images)
    ? body.images
        .map((image) => {
          const record = image as Record<string, unknown>;
          const imageUrl = safeHttpUrl(
            typeof record.image_url === "string" ? record.image_url : null,
          );
          const originUrl = safeHttpUrl(
            typeof record.origin_url === "string" ? record.origin_url : null,
          );
          return imageUrl ? { imageUrl, originUrl } : null;
        })
        .filter((image): image is SearchImage => image !== null)
        .slice(0, 12)
    : [];
  return { text, citations, images };
}

const MAX_TOOL_ROUNDS = 4;
// Keeps one quiz inside Perplexity's per-minute rate limit.
const MAX_SEARCHES_PER_BRIEF = 4;

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Muse Spark is required to call the Perplexity tool before it answers,
 * reviews the live results, and returns up to brief.maxWatches watches. Only
 * watches that name a brand and model and cite an http(s) source survive,
 * and an image URL is kept only if it really serves an image.
 */
export async function findWatchesWithAi(
  brief: WatchBrief,
  config: AiWatchFinderConfig,
  fetchImpl: typeof fetch = fetch,
  sleep: (ms: number) => Promise<void> = defaultSleep,
): Promise<FindWatchesResult> {
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

  const systemPrompt = [
    "You are the watch researcher for The Reserve. You receive an anonymous search brief only; no personal or identifying data is available to you and none should be requested.",
    "You MUST call the search_watches_via_perplexity tool before writing any other response; never answer, and never write JSON, on your first turn.",
    "Only include watches the search results actually surfaced. Never invent a watch, reference code, price, or URL.",
    "For each watch give: brand, model, referenceCode (null if unknown), sourceUrl (the page that supports it, preferably the manufacturer's), imageUrl (one of the imageUrl values the tool returned that shows this watch, or null), priceNote (e.g. 'about EUR 2,300 new', or null), and a one or two sentence rationale.",
    "Treat every constraint as hard: a watch that breaks one must be left out, not explained away.",
    "When you have searched enough, respond only with the requested JSON.",
  ].join(" ");
  const userPrompt = [brief.task, "", ...brief.lines].join("\n");

  const messages: Record<string, unknown>[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  let sawToolCall = false;
  let searchesRun = 0;
  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    // Meta's Model API only supports tool_choice: "auto"; forcing a named
    // function (or "required") is rejected with a 400. The system prompt
    // does the forcing, and sawToolCall hard-fails if that did not happen.
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
                  schema: z.toJSONSchema(modelAnswerSchema, { target: "draft-7" }),
                },
              },
            }
          : {}),
        // Muse Spark is a reasoning model: hidden reasoning tokens count
        // against max_tokens before any visible content is written, so this
        // must be generous or the response truncates with content: null.
        max_tokens: 10_000,
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!response.ok) {
      throw new Error(
        `Muse Spark returned ${response.status}: ${(await response.text()).slice(0, 300)}`,
      );
    }
    const message = extractMessage(await response.json());
    const toolCalls = message.tool_calls;

    if (Array.isArray(toolCalls) && toolCalls.length > 0) {
      sawToolCall = true;
      messages.push(message);
      // One at a time: a burst of parallel calls trips Perplexity's rate limit.
      for (const toolCall of toolCalls) {
        const call = toolCall as {
          id: string;
          function: { name: string; arguments: string };
        };
        let content: string;
        if (searchesRun >= MAX_SEARCHES_PER_BRIEF) {
          content = JSON.stringify({
            error: "Search budget used up. Answer now with what earlier searches found.",
          });
        } else {
          searchesRun += 1;
          const args = parseJsonObject(call.function.arguments) as {
            query?: unknown;
          };
          const query = typeof args.query === "string" ? args.query : userPrompt;
          content = JSON.stringify(
            await searchWatchesViaPerplexity(query, perplexity, fetchImpl, sleep),
          );
        }
        messages.push({ role: "tool", tool_call_id: call.id, content });
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
      throw new Error("Muse Spark answered without a tool call and without content.");
    }
    const answer = modelAnswerSchema.parse(parseJsonObject(content));
    const watches = answer.found
      ? await finalizeWatches(answer.watches, brief.maxWatches, fetchImpl)
      : [];
    return watches.length > 0
      ? { status: "found", watches, summary: answer.summary }
      : { status: "no_match", summary: answer.summary };
  }

  throw new Error(
    `Muse Spark did not produce a final answer within ${MAX_TOOL_ROUNDS} tool-calling rounds.`,
  );
}

/** What the browser receives: no internal error text, no upstream bodies. */
export type AiSearchOutcome =
  | { status: "found"; watches: FoundWatch[]; summary: string }
  | { status: "no_match"; summary: string }
  | { status: "unavailable" };

export type AiSearchView =
  | (Extract<AiSearchOutcome, { status: "found" }> & { fromCache: boolean })
  | Exclude<AiSearchOutcome, { status: "found" }>;

export const AI_SEARCH_TIMEOUT_MS = 180_000;

/**
 * Runs one brief without ever throwing: failures, missing configuration,
 * and timeouts are logged server-side and reach the page as "unavailable".
 */
export async function runAiWatchSearch(
  brief: WatchBrief,
  {
    config = loadAiWatchFinderConfig(),
    timeoutMs = AI_SEARCH_TIMEOUT_MS,
    fetchImpl = fetch,
  }: {
    config?: AiWatchFinderConfig;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<AiSearchOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      findWatchesWithAi(brief, config, fetchImpl),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`AI watch search exceeded ${timeoutMs} ms.`)),
          timeoutMs,
        );
      }),
    ]);
    if (result.status !== "unavailable") return result;
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
