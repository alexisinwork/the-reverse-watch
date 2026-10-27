import { z } from "zod";

import { parseModelJson } from "./ai-providers.server";
import type { ValidationEvidence } from "./cached-result-validation";
import { safeHttpUrl } from "./source-pages.server";

const claimSchema = z.object({
  brand: z.string().trim().min(1).max(160),
  referenceCode: z.string().trim().min(1).max(120).nullable(),
  person: z.string().trim().max(160).nullable(),
  work: z.string().trim().max(200).nullable(),
  sourceUrl: z.string().url().max(2048),
  supported: z.boolean(),
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
    evidence: { ...claim, provider: "perplexity", sourceVerified: false },
    costUsd: response.usage.cost.total_cost,
  };
}

/** The current Agent API returns search results separately from message text.
 * A result URL is only a candidate source: it still needs page inspection. */
export function parsePerplexityAgentValidationResponse(
  body: unknown,
): ProviderAssertion {
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
  const claim = claimSchema.parse(parseModelJson(messages.join("")));
  if (!matchingCitation(claim.sourceUrl, sources))
    throw new Error("Perplexity claim has no matching search result");
  return {
    evidence: { ...claim, provider: "perplexity", sourceVerified: false },
    costUsd: response.usage.cost.total_cost,
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
  const blocks = response.output.flatMap((item) => {
    if (item.type !== "message" || !Array.isArray(item.content)) return [];
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
  const citations = blocks.flatMap((block) =>
    (block.annotations ?? []).flatMap((annotation) =>
      annotation.type === "url_citation" && annotation.url
        ? [annotation.url]
        : [],
    ),
  );
  const claim = claimSchema.parse(parseModelJson(content));
  if (!matchingCitation(claim.sourceUrl, citations))
    throw new Error("Muse claim has no matching citation");
  const contributor = model.endsWith("-contributor");
  const costUsd =
    0.0025 +
    (response.usage.input_tokens * (contributor ? 0.1 : 1.25)) / 1_000_000 +
    (response.usage.output_tokens * (contributor ? 0.2 : 4.25)) / 1_000_000;
  return {
    evidence: { ...claim, provider: "muse", sourceVerified: false },
    costUsd,
  };
}
