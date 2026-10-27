import type { Deps } from "./ai-providers.server";
import type { ValidationBrief } from "./validate-cached-search.server";
import { buildValidationRequests } from "./validation-provider-request.server";
import {
  parseMuseValidationResponse,
  parsePerplexityAgentValidationResponse,
} from "./validation-provider-response.server";

/** Single-attempt requests only. The caller must first obtain a durable budget
 * reservation; no automatic retry or provider fallback may run here. */
export function validationProviderCalls(deps: Deps) {
  const { perplexity, museSpark } = deps.config;
  if (!perplexity || !museSpark)
    throw new Error("Both validation providers are required");
  const museModel = museSpark.fastModel;
  return {
    primary: async (brief: ValidationBrief) => {
      const request = buildValidationRequests(brief, museModel).perplexity;
      const response = await deps.fetchImpl(request.endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${perplexity.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(request.body),
        signal: AbortSignal.timeout(35_000),
      });
      if (!response.ok)
        throw new Error(`Perplexity validation returned ${response.status}`);
      return parsePerplexityAgentValidationResponse(
        (await response.json()) as unknown,
      );
    },
    secondary: async (brief: ValidationBrief) => {
      const request = buildValidationRequests(brief, museModel).muse;
      const response = await deps.fetchImpl(
        new URL("responses", museSpark.baseUrl),
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${museSpark.apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(request.body),
          signal: AbortSignal.timeout(35_000),
        },
      );
      if (!response.ok)
        throw new Error(`Muse validation returned ${response.status}`);
      return parseMuseValidationResponse(
        (await response.json()) as unknown,
        museModel,
      );
    },
  };
}
