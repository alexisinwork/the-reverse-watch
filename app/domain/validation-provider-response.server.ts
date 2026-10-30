import { z } from "zod";

import { parseModelJson } from "./ai-providers.server";
import type { ValidationEvidence } from "./cached-result-validation";
import { safeHttpUrl } from "./source-pages.server";

const claimSchema = z.object({
  brand: z.string().trim().min(1).max(160),
  model: z.string().trim().min(1).max(200).nullable().optional(),
  referenceCode: z.string().trim().min(1).max(120).nullable(),
  person: z.string().trim().max(160).nullable(),
  work: z.string().trim().max(200).nullable(),
  sourceUrl: z.string().url().max(2048),
  sourceQuote: z.string().trim().max(280),
  supported: z.boolean(),
  facts: z
    .array(
      z.object({
        field: z.enum([
          "caseDiameterMm",
          "waterResistanceM",
          "movementType",
          "price",
        ]),
        value: z.union([z.string().max(100), z.number().finite()]),
        quote: z.string().min(1).max(280),
        sourceUrl: z
          .string()
          .url()
          .max(2048)
          .nullish()
          .transform((value) => value ?? undefined),
      }),
    )
    .max(4)
    .default([]),
});

const url = (value: string) => safeHttpUrl(value);
function matchingCitation(source: string, citations: string[]) {
  const expected = url(source);
  return (
    expected !== null &&
    citations.some((citation) => url(citation) === expected)
  );
}

export type ProviderAssertion = {
  evidence: ValidationEvidence;
  costUsd: number;
};

/** A rejected assertion can still have a bill. Keep the reported/estimated
 * cost separate from the unusable claim so the ledger does not lose it. */
export class ProviderCostError extends Error {
  constructor(
    message: string,
    readonly costUsd: number | null,
  ) {
    super(message);
    this.name = "ProviderCostError";
  }
}

export function reportedPerplexityCost(body: unknown): number | null {
  const parsed = z
    .object({
      usage: z.object({
        cost: z.object({
          currency: z.literal("USD"),
          total_cost: z.number().finite().nonnegative(),
        }),
      }),
    })
    .safeParse(body);
  return parsed.success ? parsed.data.usage.cost.total_cost : null;
}

/** Meta bills each search query, including queries in an unusable response. */
export function estimatedMuseCost(body: unknown): number | null {
  const parsed = z
    .object({
      model: z.string(),
      output: z.array(z.object({ type: z.string() }).passthrough()),
      usage: z.object({
        input_tokens: z.number().int().nonnegative(),
        output_tokens: z.number().int().nonnegative(),
      }),
    })
    .safeParse(body);
  if (
    !parsed.success ||
    !/^muse-spark-1\.[23](?:-contributor)?$/.test(parsed.data.model)
  )
    return null;
  let count = 0;
  for (const search of parsed.data.output.filter(
    (item) => item.type === "web_search_call",
  )) {
    const action = z
      .object({
        type: z.literal("search"),
        queries: z.array(z.string().min(1)).min(1).optional(),
        query: z.string().min(1).optional(),
      })
      .safeParse(search.action);
    if (!action.success) return null;
    const n = action.data.queries?.length ?? (action.data.query ? 1 : 0);
    if (!n) return null;
    count += n;
  }
  const contributor = parsed.data.model.endsWith("-contributor");
  return (
    count * 0.0025 +
    (parsed.data.usage.input_tokens * (contributor ? 0.1 : 1.25)) / 1_000_000 +
    (parsed.data.usage.output_tokens * (contributor ? 0.2 : 4.25)) / 1_000_000
  );
}

/** A structured model claim is usable only if its own provider cites its URL.
 * Source pages must still be checked separately before acceptance. */
export function parsePerplexityValidationResponse(
  body: unknown,
): ProviderAssertion {
  const response = z
    .object({
      choices: z
        .array(z.object({ message: z.object({ content: z.string() }) }))
        .min(1),
      citations: z.array(z.string()).min(1),
      usage: z.object({
        cost: z.object({ total_cost: z.number().finite().nonnegative() }),
      }),
    })
    .parse(body);
  const claim = claimSchema.parse(
    parseModelJson(response.choices[0]!.message.content),
  );
  if (!matchingCitation(claim.sourceUrl, response.citations))
    throw new Error("Perplexity claim has no matching citation");
  return {
    evidence: {
      ...claim,
      provider: "perplexity",
      sourceVerified: false,
      citedUrls: response.citations
        .map(url)
        .filter((value): value is string => value !== null)
        .slice(0, 5),
    },
    costUsd: response.usage.cost.total_cost,
  };
}

/** The current Agent API returns search results separately from message text.
 * A result URL is only a candidate source: it still needs page inspection. */
function parsePerplexityAgentEnvelope(body: unknown) {
  const response = z
    .object({
      status: z.literal("completed"),
      model: z.literal("openai/gpt-6-luna"),
      output: z.array(z.object({ type: z.string() }).passthrough()),
      usage: z.object({
        cost: z.object({
          currency: z.literal("USD"),
          total_cost: z.number().finite().nonnegative(),
        }),
        tool_calls_details: z.object({
          search_web: z.object({ invocation: z.literal(1) }),
        }),
      }),
    })
    .parse(body);
  const messages = response.output.flatMap((item) => {
    if (item.type !== "message" || !Array.isArray(item.content)) return [];
    return z
      .array(
        z
          .object({ type: z.string(), text: z.string().optional() })
          .passthrough(),
      )
      .parse(item.content)
      .filter((block) => block.type === "output_text")
      .map((block) => block.text ?? "");
  });
  const sources = response.output.flatMap((item) => {
    if (item.type !== "search_results" || !Array.isArray(item.results))
      return [];
    return z
      .array(z.object({ url: z.string() }).passthrough())
      .parse(item.results)
      .map((result) => result.url);
  });
  return {
    content: parseModelJson(messages.join("")),
    sources,
    costUsd: response.usage.cost.total_cost,
  };
}

export function parsePerplexityAgentValidationResponse(
  body: unknown,
): ProviderAssertion {
  const { content, sources, costUsd } = parsePerplexityAgentEnvelope(body);
  const claim = claimSchema.parse(content);
  if (!matchingCitation(claim.sourceUrl, sources))
    throw new Error("Perplexity claim has no matching search result");
  return {
    evidence: {
      ...claim,
      provider: "perplexity",
      sourceVerified: false,
      citedUrls: sources
        .map(url)
        .filter((value): value is string => value !== null)
        .slice(0, 5),
    },
    costUsd,
  };
}

/** Keep only individually cited candidates from the single discovery call. */
export function parsePerplexityFilmDiscoveryResponse(body: unknown): {
  evidence: ValidationEvidence[];
  costUsd: number;
} {
  const { content, sources, costUsd } = parsePerplexityAgentEnvelope(body);
  const { sightings } = z
    .object({ sightings: z.array(z.unknown()).max(20) })
    .parse(content);
  const citedUrls = sources
    .map(url)
    .filter((value): value is string => value !== null)
    .slice(0, 5);
  return {
    costUsd,
    evidence: sightings
      .flatMap((raw) => {
        const parsed = claimSchema.safeParse(raw);
        return parsed.success &&
          matchingCitation(parsed.data.sourceUrl, sources)
          ? [parsed.data]
          : [];
      })
      .map((claim) => ({
        ...claim,
        provider: "perplexity" as const,
        sourceVerified: false,
        citedUrls,
      })),
  };
}

/** Meta charges for tokens and web searches; use uncached input pricing for
 * conservative accounting and reject an answer that did not search. */
export function parseMuseValidationResponse(
  body: unknown,
  model: string,
): ProviderAssertion {
  if (!/^muse-spark-1\.[23](?:-contributor)?$/.test(model))
    throw new Error("Unsupported Muse model for metered validation");
  const response = z
    .object({
      status: z.literal("completed"),
      model: z.literal(model),
      output: z.array(z.object({ type: z.string() }).passthrough()),
      usage: z.object({
        input_tokens: z.number().int().nonnegative(),
        output_tokens: z.number().int().nonnegative(),
      }),
    })
    .parse(body);
  const searches = response.output.filter(
    (item) => item.type === "web_search_call",
  );
  if (searches.length !== 1 || searches[0]?.status !== "completed")
    throw new Error("Muse did not complete exactly one web search");
  // One hosted tool call can contain multiple billed search queries. Do not
  // infer the number of queries from the number of web_search_call items.
  const action = z
    .object({
      type: z.literal("search"),
      queries: z.array(z.string().min(1)).min(1).optional(),
      query: z.string().min(1).optional(),
    })
    .parse(searches[0].action);
  const queryCount = action.queries?.length ?? (action.query ? 1 : 0);
  if (!queryCount) throw new Error("Muse search query count is unavailable");
  const blocks = response.output.flatMap((item) => {
    if (
      item.type !== "message" ||
      item.phase === "commentary" ||
      !Array.isArray(item.content)
    )
      return [];
    return z
      .array(
        z
          .object({
            type: z.string(),
            text: z.string().optional(),
            annotations: z
              .array(
                z
                  .object({ type: z.string(), url: z.string().optional() })
                  .passthrough(),
              )
              .optional(),
          })
          .passthrough(),
      )
      .parse(item.content);
  });
  const content = blocks
    .filter((block) => block.type === "output_text")
    .map((block) => block.text ?? "")
    .join("");
  const annotations = blocks.flatMap((block) =>
    (block.annotations ?? []).flatMap((annotation) =>
      annotation.type === "url_citation" && annotation.url
        ? [annotation.url]
        : [],
    ),
  );
  const searchResults = z
    .object({
      results: z.array(z.object({ url: z.string() }).passthrough()).nullish(),
      action: z
        .object({
          sources: z
            .array(z.object({ url: z.string() }).passthrough())
            .optional(),
        })
        .passthrough(),
    })
    .parse(searches[0]);
  const citations = [
    ...annotations,
    ...(searchResults.results ?? []).map((source) => source.url),
    ...(searchResults.action.sources ?? []).map((source) => source.url),
  ];
  const claim = claimSchema.parse(parseModelJson(content));
  const citedSource = matchingCitation(claim.sourceUrl, citations)
    ? claim.sourceUrl
    : searchResults.results
        ?.map((source) => safeHttpUrl(source.url))
        .find((source) => source !== null);
  if (!citedSource) throw new Error("Muse claim has no matching citation");
  const costUsd = estimatedMuseCost(body);
  if (costUsd === null) throw new Error("Muse cost is unavailable");
  return {
    evidence: {
      ...claim,
      // Raw tool results can repair a model-rewritten URL. No assertion is
      // accepted until the server opens this actual result and checks the
      // reference and, for sightings, its exact quoted passage.
      sourceUrl: citedSource,
      provider: "muse",
      sourceVerified: false,
      citedUrls: citations
        .map(url)
        .filter((value): value is string => value !== null)
        .slice(0, 5),
    },
    costUsd,
  };
}
