import {
  DISCOVERY_RESEARCH_CONTRACT_VERSION,
  buildDiscoveryResearchInput,
  buildDiscoveryResearchInstructions,
  discoveryResearchResponseFormat,
  discoveryResearchResponseSchema,
} from "./discovery-research";
import type { DiscoveryResearchResponse } from "./discovery-research";
import type { discoveryAnchorSchema } from "./discovery-selection";
import { z } from "zod";

const responseContentSchema = z
  .object({
    type: z.string(),
    text: z.string().nullish(),
    annotations: z.array(z.object({ url: z.url() }).passthrough()).nullish(),
  })
  .passthrough();
const responseItemSchema = z
  .object({
    type: z.string(),
    content: z.array(responseContentSchema).nullish(),
    results: z.array(z.object({ url: z.url() }).passthrough()).nullish(),
    contents: z.array(z.object({ url: z.url() }).passthrough()).nullish(),
  })
  .passthrough();
export const perplexityDiscoveryResponseSchema = z
  .object({
    id: z.string().min(1),
    model: z.string().min(1),
    object: z.string().optional(),
    status: z.enum([
      "completed",
      "failed",
      "incomplete",
      "in_progress",
      "queued",
      "cancelled",
    ]),
    output: z.array(responseItemSchema),
    error: z.unknown().nullable().optional(),
    usage: z
      .object({
        input_tokens: z.number().int().nonnegative().optional(),
        output_tokens: z.number().int().nonnegative().optional(),
        cost: z
          .object({ total_cost: z.number().nonnegative().optional() })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type PerplexityDiscoveryResponse = z.infer<
  typeof perplexityDiscoveryResponseSchema
>;

export type DiscoveryProviderFailureCategory =
  | "provider_auth"
  | "provider_rate_limit"
  | "provider_unavailable"
  | "provider_timeout"
  | "provider_rejected"
  | "malformed_response";

export class PerplexityDiscoveryError extends Error {
  constructor(
    readonly category: DiscoveryProviderFailureCategory,
    readonly retryable: boolean,
    message: string = category,
  ) {
    super(message);
    this.name = "PerplexityDiscoveryError";
  }
}

export function extractDiscoveryOutputText(
  response: PerplexityDiscoveryResponse,
) {
  return response.output
    .flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text" && content.text)
    .map((content) => content.text)
    .join("\n");
}

export function extractDiscoverySourceUrls(
  response: PerplexityDiscoveryResponse,
) {
  return [
    ...new Set(
      response.output.flatMap((item) => [
        ...(item.content ?? []).flatMap((content) =>
          (content.annotations ?? []).map((annotation) => annotation.url),
        ),
        ...(item.results ?? []).map((result) => result.url),
        ...(item.contents ?? []).map((result) => result.url),
      ]),
    ),
  ].sort();
}

function parseStructuredText(text: string): DiscoveryResearchResponse {
  const unfenced = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start === -1 || end < start) {
    throw new PerplexityDiscoveryError(
      "malformed_response",
      false,
      "The provider did not return a JSON object.",
    );
  }
  try {
    return discoveryResearchResponseSchema.parse(
      JSON.parse(unfenced.slice(start, end + 1)),
    );
  } catch {
    throw new PerplexityDiscoveryError(
      "malformed_response",
      false,
      "The provider response did not match the discovery schema.",
    );
  }
}

function boundedRawResponse(response: PerplexityDiscoveryResponse) {
  const output = response.output.map((item) => ({
    type: item.type,
    content: (item.content ?? []).map((content) => ({
      type: content.type,
      text: content.text ?? null,
      annotations: (content.annotations ?? []).map((annotation) => ({
        url: annotation.url,
      })),
    })),
    results: (item.results ?? []).map((result) => ({ url: result.url })),
    contents: (item.contents ?? []).map((result) => ({ url: result.url })),
  }));
  const value = {
    id: response.id,
    model: response.model,
    status: response.status,
    output,
    usage: response.usage ?? null,
  };
  if (JSON.stringify(value).length <= 220_000) return value;
  return {
    id: response.id,
    model: response.model,
    status: response.status,
    usage: response.usage ?? null,
    output: [],
    truncated: true,
  };
}

export function parseDiscoveryProviderResponse(raw: unknown) {
  let response: PerplexityDiscoveryResponse;
  try {
    response = perplexityDiscoveryResponseSchema.parse(raw);
  } catch {
    throw new PerplexityDiscoveryError(
      "malformed_response",
      false,
      "The provider response envelope was invalid.",
    );
  }
  if (response.status !== "completed") {
    throw new PerplexityDiscoveryError(
      "provider_unavailable",
      response.status === "queued" || response.status === "in_progress",
      "The provider did not complete the response.",
    );
  }
  const result = parseStructuredText(extractDiscoveryOutputText(response));
  if (
    result.candidates.some((candidate) =>
      candidate.sources.some(
        (source) => !extractDiscoverySourceUrls(response).includes(source.url),
      ),
    )
  ) {
    throw new PerplexityDiscoveryError(
      "malformed_response",
      false,
      "A candidate source was not present in the provider citations.",
    );
  }
  return {
    responseId: response.id,
    model: response.model,
    result,
    sourceUrls: extractDiscoverySourceUrls(response),
    rawResponse: boundedRawResponse(response),
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
    costUsd: response.usage?.cost?.total_cost ?? null,
  };
}

export async function requestPerplexityDiscoveryResearch(
  topic: {
    anchor: z.infer<typeof discoveryAnchorSchema>;
    displayText: string;
    releaseYear: number | null;
  },
  {
    apiKey,
    preset,
    maxOutputTokens,
    fetchImpl = fetch,
    timeoutMs = 120_000,
  }: {
    apiKey: string;
    preset: string;
    maxOutputTokens: number;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  },
) {
  let response: Response;
  try {
    response = await fetchImpl("https://api.perplexity.ai/v1/agent", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        preset,
        input: buildDiscoveryResearchInput(topic),
        instructions: buildDiscoveryResearchInstructions(),
        tools: [{ type: "web_search" }],
        max_output_tokens: maxOutputTokens,
        max_steps: 4,
        store: false,
        response_format: discoveryResearchResponseFormat,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new PerplexityDiscoveryError(
        "provider_timeout",
        true,
        "The provider request timed out.",
      );
    }
    throw new PerplexityDiscoveryError(
      "provider_unavailable",
      true,
      "The provider request could not be completed.",
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new PerplexityDiscoveryError(
      "malformed_response",
      false,
      "The provider returned a non-JSON response.",
    );
  }
  if (!response.ok) {
    const category: DiscoveryProviderFailureCategory =
      response.status === 401 || response.status === 403
        ? "provider_auth"
        : response.status === 429
          ? "provider_rate_limit"
          : response.status >= 500
            ? "provider_unavailable"
            : "provider_rejected";
    throw new PerplexityDiscoveryError(
      category,
      category === "provider_rate_limit" || category === "provider_unavailable",
      `The provider returned HTTP ${response.status}.`,
    );
  }
  return parseDiscoveryProviderResponse(body);
}

export const discoveryResearchProviderContract = {
  version: DISCOVERY_RESEARCH_CONTRACT_VERSION,
  endpoint: "https://api.perplexity.ai/v1/agent",
} as const;
