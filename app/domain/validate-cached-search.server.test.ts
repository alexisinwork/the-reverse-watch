import { describe, expect, it, vi } from "vitest";
import type { FoundWatch } from "./ai-watch-types";
import type { ProviderAssertion } from "./validation-provider-response.server";
import {
  validateCachedSearch,
  type ValidationServices,
} from "./validate-cached-search.server";

const watch: FoundWatch = {
  brand: "Omega",
  model: "Planet Ocean",
  referenceCode: "2201.50.00",
  sourceUrl: "https://example.com/watch",
  imageUrl: null,
  priceNote: null,
  rationale: "Private: do not send this rationale",
  details: { person: "Daniel Craig", work: "Quantum of Solace" },
};
function assertion(provider: "perplexity" | "muse"): ProviderAssertion {
  return {
    costUsd: 0.008,
    evidence: {
      provider,
      brand: watch.brand,
      referenceCode: watch.referenceCode,
      person: watch.details.person!,
      work: watch.details.work!,
      sourceUrl: `https://${provider}.example/watch`,
      supported: true,
      sourceVerified: false,
    },
  };
}
function services(): ValidationServices {
  return {
    hydrate: vi.fn(async (watches: FoundWatch[]) => watches),
    reserve: vi.fn(async () => ({
      state: "reserved" as const,
      attemptId: "attempt",
    })),
    primary: vi.fn(async () => assertion("perplexity")),
    secondary: vi.fn(async () => assertion("muse")),
    inspect: vi.fn(
      async (
        candidate: FoundWatch,
        primary: ProviderAssertion,
        secondary: ProviderAssertion,
      ) => ({
        status: "verified" as const,
        watch: candidate,
        evidence: [primary.evidence, secondary.evidence],
      }),
    ),
    settle: vi.fn(async () => true),
  };
}

describe("validating a cached result under a reservation", () => {
  it("hydrates and deduplicates before paying, then settles verified cards", async () => {
    const deps = services();
    const result = await validateCachedSearch(
      "a".repeat(64),
      [watch, { ...watch, model: "Seamaster Planet Ocean" }],
      deps,
    );
    expect(result).toMatchObject({
      status: "verified",
      watches: [watch],
      rejected: 0,
    });
    expect(deps.reserve).toHaveBeenCalledWith("a".repeat(64), 1);
    expect(deps.settle).toHaveBeenCalledWith("attempt", [0.016]);
    expect(deps.primary).toHaveBeenCalledWith({
      brand: "Omega",
      model: "Planet Ocean",
      referenceCode: "2201.50.00",
      person: "Daniel Craig",
      work: "Quantum of Solace",
    });
  });

  it("never calls providers if the monthly reserve is unavailable", async () => {
    const deps = services();
    deps.reserve = vi.fn(async () => ({ state: "monthly_limit" as const }));
    expect(await validateCachedSearch("a".repeat(64), [watch], deps)).toEqual({
      status: "unavailable",
      reason: "monthly_limit",
    });
    expect(deps.primary).not.toHaveBeenCalled();
    expect(deps.secondary).not.toHaveBeenCalled();
  });

  it("charges unknown cost conservatively and refuses an unconfirmed card", async () => {
    const deps = services();
    deps.secondary = vi.fn(async () => {
      throw new Error("timeout");
    });
    expect(await validateCachedSearch("a".repeat(64), [watch], deps)).toEqual({
      status: "unavailable",
      reason: "no confirmed candidates",
    });
    expect(deps.settle).toHaveBeenCalledWith("attempt", [null]);
    expect(deps.inspect).not.toHaveBeenCalled();
  });

  it("does not return a verified answer if budget settlement fails", async () => {
    const deps = services();
    deps.settle = vi.fn(async () => false);
    expect(await validateCachedSearch("a".repeat(64), [watch], deps)).toEqual({
      status: "unavailable",
      reason: "settlement failed",
    });
  });
});
