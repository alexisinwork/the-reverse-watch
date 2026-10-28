import type { Deps } from "./ai-providers.server";
import type { ValidationBrief } from "./validate-cached-search.server";
import { buildValidationRequests } from "./validation-provider-request.server";
import {
  parseMuseValidationResponse,
  parsePerplexityAgentValidationResponse,
  estimatedMuseCost,
  reportedPerplexityCost,
  ProviderCostError,
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
      const body: unknown = await response.json().catch(() => null);
      const cost = reportedPerplexityCost(body);
      if (!response.ok)
        throw new ProviderCostError(
          `Perplexity validation returned ${response.status}`,
          cost,
        );
      try {
        return parsePerplexityAgentValidationResponse(body);
      } catch {
        throw new ProviderCostError(
          "Perplexity validation response was unusable",
          cost,
        );
      }
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
      const body: unknown = await response.json().catch(() => null);
      const cost = estimatedMuseCost(body);
      if (!response.ok)
        throw new ProviderCostError(
          `Muse validation returned ${response.status}`,
          cost,
        );
      try {
        return parseMuseValidationResponse(body, museModel);
      } catch {
        throw new ProviderCostError(
          "Muse validation response was unusable",
          cost,
        );
      }
    },
  };
}
