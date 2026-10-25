import { z } from "zod";
import type { EnrichmentProgress } from "./enrichment-ledger";
export function initialisePerplexityBilling(
  progress: EnrichmentProgress,
  reportedBaselineUsd = 5,
) {
  progress.billing ??= {
    ownerReportedBaselineUsd: reportedBaselineUsd,
    baselineAt: new Date().toISOString(),
    perplexityReportedUsd: 0,
    perplexityUnreportedEstimateUsd: 0,
    perplexityPendingUsd: 0,
    perplexityCalls: 0,
    museCalls: 0,
  };
  return progress.billing;
}
export function perplexityAllowanceUsed(progress: EnrichmentProgress) {
  const billing = initialisePerplexityBilling(progress);
  return (
    billing.ownerReportedBaselineUsd +
    billing.perplexityReportedUsd +
    billing.perplexityUnreportedEstimateUsd +
    billing.perplexityPendingUsd
  );
}
export function reservePerplexity(
  progress: EnrichmentProgress,
  reserve: number,
  budget: number,
) {
  if (perplexityAllowanceUsed(progress) + reserve > budget)
    throw new Error("ENRICHMENT_BUDGET_LIMIT");
  const billing = initialisePerplexityBilling(progress);
  billing.perplexityCalls++;
  billing.perplexityPendingUsd += reserve;
}
export function settlePerplexity(
  progress: EnrichmentProgress,
  reserve: number,
  status: number,
  payload: unknown,
  search: boolean,
) {
  const billing = initialisePerplexityBilling(progress);
  billing.perplexityPendingUsd = Math.max(
    0,
    billing.perplexityPendingUsd - reserve,
  );
  const parsed = z
    .object({
      usage: z.object({
        cost: z.object({ total_cost: z.number().nonnegative() }),
      }),
    })
    .safeParse(payload);
  if (parsed.success)
    billing.perplexityReportedUsd += parsed.data.usage.cost.total_cost;
  else if (search && status >= 200 && status < 300)
    billing.perplexityReportedUsd += 0.005;
  else if (status >= 200 && status < 300)
    billing.perplexityUnreportedEstimateUsd += reserve;
  // Uncertain transport failures leave their reservation outstanding; HTTP
  // failures are not treated as a successful paid Search API response.
}
