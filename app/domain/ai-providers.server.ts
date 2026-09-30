/**
 * The two AI providers and the plumbing around them.
 *
 * - Muse Spark (Meta Model API): proposes watches and ranks results, and
 *   can search the web itself with Meta's built-in web_search tool.
 * - Perplexity: Sonar answers with live web search, and the Search API for
 *   raw ranked results.
 *
 * WEB_SEARCH_PROVIDER picks who does the web searching: "perplexity" (the
 * default) or "muse" (Muse Spark only, no Perplexity calls at all).
 *
 * Every call takes a `Deps` object so tests can swap in a fake fetch and
 * clock. Only watch-search constraints are ever sent to either provider.
 */
import type { AiSearchOutcome, ProgressEvent } from "./ai-watch-types";
import { loadFxTable, type FxTable } from "./fx.server";
import { safeHttpUrl } from "./source-pages.server";

export type MuseSparkConfig = {
  apiKey: string;
  baseUrl: string;
  /** Used where latency matters most (proposals, ranking). */
  fastModel: string;
};
export type PerplexityConfig = { apiKey: string; model: string };
export type WebSearchProvider = "perplexity" | "muse";
export type AiWatchFinderConfig = {
  museSpark: MuseSparkConfig | null;
  perplexity: PerplexityConfig | null;
  webSearch: WebSearchProvider;
};

export function loadAiWatchFinderConfig(
  env: NodeJS.ProcessEnv = process.env,
): AiWatchFinderConfig {
  const museSparkKey = env.MUSE_SPARK_API_KEY?.trim();
  const perplexityKey = env.PERPLEXITY_API_KEY?.trim();
  return {
    webSearch:
      env.WEB_SEARCH_PROVIDER?.trim() === "muse" ? "muse" : "perplexity",
    museSpark: museSparkKey
      ? {
          apiKey: museSparkKey,
          baseUrl: (
            env.MUSE_SPARK_BASE_URL?.trim() || "https://api.meta.ai/v1"
          ).replace(/\/?$/, "/"),
          // Measured: 1.2-contributor answers in 8-9 s where 1.3 takes 15-17 s,
          // almost all of it hidden reasoning before the first token.
          fastModel:
            env.MUSE_SPARK_FAST_MODEL?.trim() || "muse-spark-1.2-contributor",
        }
      : null,
    perplexity: perplexityKey
      ? {
          apiKey: perplexityKey,
          // sonar measured as fast as sonar-pro at half the cost here.
          model: env.PERPLEXITY_SEARCH_MODEL?.trim() || "sonar",
        }
      : null,
  };
}

/**
 * Muse Spark is always needed; Perplexity only when it does the searching.
 */
export function searchReady(config: AiWatchFinderConfig) {
  return (
    config.museSpark !== null &&
    (config.webSearch === "muse" || config.perplexity !== null)
  );
}

export type Deps = {
  config: AiWatchFinderConfig;
  fetchImpl: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  loadFx: () => Promise<FxTable | null>;
  now: () => number;
  /** Tells the visitor what the search is doing right now (optional). */
  report?: (event: ProgressEvent) => void;
};

export function defaultDeps(overrides: Partial<Deps> = {}): Deps {
  const fetchImpl = overrides.fetchImpl ?? fetch;
  return {
    config: overrides.config ?? loadAiWatchFinderConfig(),
    fetchImpl,
    sleep:
      overrides.sleep ??
      ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms))),
    loadFx: overrides.loadFx ?? (() => loadFxTable(fetchImpl)),
    now: overrides.now ?? Date.now,
    ...(overrides.report ? { report: overrides.report } : {}),
  };
}

/** A trimmed, non-empty string from model output, or null. */
export function clean(value: unknown) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  // Models sometimes write the word "null" instead of a JSON null.
  return text && !/^(null|none|n\/a|undefined)$/i.test(text) ? text : null;
}

/** A finite number from model output, or null. */
export function finite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// Placeholder names models sometimes emit instead of admitting a gap.
export const VAGUE =
  /\b(unknown|unidentified|unspecified|various|n\/a|tbd|null|none)\b/i;

export function logError(event: string, error: unknown) {
  console.error(
    JSON.stringify({
      event,
      message: error instanceof Error ? error.message : "unknown error",
    }),
  );
}

export function parseModelJson(content: string) {
  return JSON.parse(
    content.replace(/^```(?:json)?\s*|\s*```$/g, ""),
  ) as unknown;
}

// ---------------------------------------------------------------------------
// Upstream calls

const PERPLEXITY_RETRIES = 2;

export async function perplexityPost(
  path: "chat/completions" | "search",
  body: unknown,
  deps: Deps,
  timeoutMs: number,
) {
  const config = deps.config.perplexity!;
  for (let attempt = 0; ; attempt += 1) {
    const response = await deps.fetchImpl(`https://api.perplexity.ai/${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status === 429 && attempt < PERPLEXITY_RETRIES) {
      await response.body?.cancel();
      const retryAfter = Number(response.headers.get("retry-after"));
      await deps.sleep(
        Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter, 5) * 1_000
          : 1_000 * (attempt + 1),
      );
      continue;
    }
    if (!response.ok) {
      throw new Error(
        `Perplexity ${path} returned ${response.status}: ${(await response.text()).slice(0, 200)}`,
      );
    }
    return (await response.json()) as unknown;
  }
}

export async function sonarJson(
  prompt: string,
  schema: Record<string, unknown>,
  deps: Deps,
  contextSize: "low" | "medium" = "low",
) {
  const body = (await perplexityPost(
    "chat/completions",
    {
      model: deps.config.perplexity!.model,
      max_tokens: 2_000,
      // Same question, same answer as far as the model allows.
      temperature: 0,
      web_search_options: { search_context_size: contextSize },
      response_format: { type: "json_schema", json_schema: { schema } },
      messages: [{ role: "user", content: prompt }],
    },
    deps,
    20_000,
  )) as { choices?: { message?: { content?: unknown } }[] };
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== "string")
    throw new Error("Perplexity returned no content.");
  return parseModelJson(content);
}

export type SearchHit = { url: string; title: string; snippet: string };

/** Perplexity Search API: raw ranked results, up to 5 queries per request. */
export async function searchWeb(
  queries: string[],
  deps: Deps,
): Promise<SearchHit[]> {
  if (queries.length === 0) return [];
  const body = (await perplexityPost(
    "search",
    { query: queries.slice(0, 5), max_results: 20, max_tokens_per_page: 256 },
    deps,
    8_000,
  )) as { results?: unknown };
  const results = Array.isArray(body.results) ? body.results.flat() : [];
  return results.flatMap((raw) => {
    const item = raw as Record<string, unknown>;
    const url = safeHttpUrl(clean(item.url));
    return url
      ? [
          {
            url,
            title: clean(item.title) ?? "",
            snippet: clean(item.snippet) ?? "",
          },
        ]
      : [];
  });
}

export async function museJson(
  system: string,
  user: string,
  cacheKey: string,
  deps: Deps,
  timeoutMs: number,
): Promise<unknown> {
  const config = deps.config.museSpark!;
  const response = await deps.fetchImpl(
    new URL("chat/completions", config.baseUrl),
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: config.fastModel,
        // "none" is rejected by the API; "minimal" is the fastest allowed.
        reasoning_effort: "minimal",
        // Same question, same answer as far as the model allows.
        temperature: 0,
        // The system prompt comes first and never changes, so Muse Spark's
        // automatic prefix cache serves it at a fraction of the input price.
        prompt_cache_key: cacheKey,
        max_tokens: 4_000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Muse Spark returned ${response.status}: ${(await response.text()).slice(0, 200)}`,
    );
  }
  const body = (await response.json()) as {
    choices?: { message?: { content?: unknown } }[];
  };
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== "string")
    throw new Error("Muse Spark returned no content.");
  return parseModelJson(content);
}

export type MuseResearch = {
  /** The final answer text (JSON when a schema was given). */
  text: string;
  /** Pages Muse's web_search tool opened successfully, in order. */
  openedPages: string[];
  /** How many search and page-open calls it made (each is billed). */
  toolCalls: number;
};

/**
 * Muse Spark with Meta's built-in, server-side web_search tool (Responses
 * API). Meta bills each search or page open ($2.50 per 1,000) plus tokens,
 * so maxToolCalls keeps a lookup cheap and fast.
 */
export async function museWebResearch(
  input: string,
  deps: Deps,
  {
    instructions,
    schema,
    maxToolCalls = 6,
    timeoutMs = 60_000,
  }: {
    instructions?: string;
    schema?: Record<string, unknown>;
    maxToolCalls?: number;
    timeoutMs?: number;
  } = {},
): Promise<MuseResearch> {
  const config = deps.config.museSpark!;
  const response = await deps.fetchImpl(new URL("responses", config.baseUrl), {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: config.fastModel,
      ...(instructions ? { instructions } : {}),
      input,
      tools: [{ type: "web_search" }],
      max_tool_calls: maxToolCalls,
      reasoning: { effort: "minimal" },
      temperature: 0,
      ...(schema
        ? {
            text: {
              format: {
                type: "json_schema",
                name: "answer",
                strict: false,
                schema,
              },
            },
          }
        : {}),
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(
      `Muse Spark web research returned ${response.status}: ${(await response.text()).slice(0, 200)}`,
    );
  }
  const body = (await response.json()) as { output?: unknown };
  const output = Array.isArray(body.output)
    ? (body.output as Record<string, unknown>[])
    : [];
  const openedPages: string[] = [];
  let toolCalls = 0;
  let text = "";
  for (const item of output) {
    if (item.type === "web_search_call") {
      toolCalls += 1;
      const action = item.action as
        { type?: unknown; url?: unknown } | undefined;
      if (
        item.status === "completed" &&
        action?.type === "open_page" &&
        typeof action.url === "string"
      ) {
        openedPages.push(action.url);
      }
    }
    // "commentary" messages are progress notes; the answer has no phase.
    if (item.type === "message" && item.phase !== "commentary") {
      const content = Array.isArray(item.content)
        ? (item.content as { text?: unknown }[])
        : [];
      const joined = content
        .map((part) => (typeof part.text === "string" ? part.text : ""))
        .join("");
      if (joined.trim()) text = joined;
    }
  }
  if (!text) throw new Error("Muse Spark web research returned no answer.");
  return { text, openedPages, toolCalls };
}

/**
 * A JSON answer grounded in a live web search, from whichever provider
 * WEB_SEARCH_PROVIDER selects. Used for film sightings, live quiz
 * proposals and catalogue proposals.
 */
export async function webResearchJson(
  prompt: string,
  schema: Record<string, unknown>,
  deps: Deps,
  {
    maxToolCalls = 6,
    system,
    contextSize = "low",
  }: {
    maxToolCalls?: number;
    system?: string;
    /** Perplexity only: "medium" reads more of each page (slower, surer). */
    contextSize?: "low" | "medium";
  } = {},
): Promise<unknown> {
  if (deps.config.webSearch === "muse") {
    const research = await museWebResearch(prompt, deps, {
      schema,
      maxToolCalls,
      ...(system ? { instructions: system } : {}),
    });
    return parseModelJson(research.text);
  }
  return sonarJson(
    system ? `${system}\n\n${prompt}` : prompt,
    schema,
    deps,
    contextSize,
  );
}

/**
 * Pages about each query (for example "Omega 210.30.42.20.03.001"): the
 * Perplexity Search API, or Muse's web search asked for product-page URLs.
 */
export async function findPages(
  queries: string[],
  deps: Deps,
): Promise<SearchHit[]> {
  if (queries.length === 0) return [];
  if (deps.config.webSearch !== "muse") return searchWeb(queries, deps);
  const research = await museWebResearch(
    [
      "For each watch below, find its official product page on the manufacturer's website, or an authorised retailer's product page for it.",
      "Return every page you find with its URL, the page title, and the exact reference number shown on the page.",
      ...queries.map((query) => `- ${query}`),
    ].join("\n"),
    deps,
    {
      maxToolCalls: Math.min(8, queries.length + 2),
      schema: {
        type: "object",
        properties: {
          pages: {
            type: "array",
            items: {
              type: "object",
              properties: {
                url: { type: "string" },
                title: { type: "string" },
                reference: { type: "string" },
              },
              required: ["url"],
            },
          },
        },
        required: ["pages"],
      },
    },
  );
  const parsed = parseModelJson(research.text) as { pages?: unknown };
  const pages = Array.isArray(parsed.pages)
    ? (parsed.pages as Record<string, unknown>[])
    : [];
  return pages.flatMap((page) => {
    const url = safeHttpUrl(clean(page.url));
    return url
      ? [
          {
            url,
            title: clean(page.title) ?? "",
            snippet: clean(page.reference) ?? "",
          },
        ]
      : [];
  });
}

// ---------------------------------------------------------------------------

export const AI_SEARCH_TIMEOUT_MS = 35_000;

/** Never throws: failures and timeouts are logged and become "unavailable". */
export async function runSafely(
  search: () => Promise<AiSearchOutcome>,
  timeoutMs = AI_SEARCH_TIMEOUT_MS,
): Promise<AiSearchOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      search(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`AI watch search exceeded ${timeoutMs} ms.`)),
          timeoutMs,
        );
      }),
    ]);
  } catch (error) {
    logError("ai_watch_search_error", error);
    return { status: "unavailable" };
  } finally {
    clearTimeout(timer);
  }
}
