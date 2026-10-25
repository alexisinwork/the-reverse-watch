import { describe, expect, it } from "vitest";
import type { EnrichmentProgress } from "./enrichment-ledger";
import {
  initialisePerplexityBilling,
  perplexityAllowanceUsed,
  reservePerplexity,
  settlePerplexity,
} from "./perplexity-budget";
const progress = (): EnrichmentProgress => ({
  reservedUsd: 93.2,
  calls: 488,
  processed: 93,
  enriched: 73,
  errors: 6,
  stopped: null,
  sequence: 0,
});
describe("Perplexity-only allowance", () => {
  it("keeps the historical mixed reserve separate from the owner-reported baseline", () => {
    const p = progress();
    initialisePerplexityBilling(p).museCalls++;
    expect(perplexityAllowanceUsed(p)).toBe(5);
    expect(p.reservedUsd).toBe(93.2);
  });
  it("settles a reservation using the provider's actual reported cost", () => {
    const p = progress();
    reservePerplexity(p, 0.1, 100);
    settlePerplexity(
      p,
      0.1,
      200,
      { usage: { cost: { total_cost: 0.012609 } } },
      false,
    );
    expect(perplexityAllowanceUsed(p)).toBeCloseTo(5.012609);
    expect(p.billing?.perplexityPendingUsd).toBe(0);
  });
  it("charges successful Search calls only and refuses an over-budget request", () => {
    const p = progress();
    reservePerplexity(p, 0.005, 100);
    settlePerplexity(p, 0.005, 200, {}, true);
    reservePerplexity(p, 0.005, 100);
    settlePerplexity(p, 0.005, 429, {}, true);
    expect(perplexityAllowanceUsed(p)).toBeCloseTo(5.005);
    expect(() => reservePerplexity(p, 0.1, 5.01)).toThrow("BUDGET_LIMIT");
  });
});
