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
    reportOverrun: vi.fn(async () => true),
    publish: vi.fn(async () => true),
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
    expect(deps.publish).toHaveBeenCalledWith("attempt", [watch], [0.016]);
    expect(deps.settle).not.toHaveBeenCalled();
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

  it("recovers a missing reference only when both providers agree and inspection passes", async () => {
    const deps = services();
    const unreferenced = { ...watch, referenceCode: null };
    const result = await validateCachedSearch(
      "a".repeat(64),
      [unreferenced],
      deps,
    );
    expect(deps.primary).toHaveBeenCalledWith(
      expect.objectContaining({ referenceCode: null }),
    );
    expect(deps.secondary).toHaveBeenCalledWith(
      expect.objectContaining({ referenceCode: null }),
    );
    expect(deps.inspect).toHaveBeenCalledWith(
      watch,
      expect.anything(),
      expect.anything(),
    );
    expect(deps.hydrate).toHaveBeenLastCalledWith([watch]);
    expect(result).toMatchObject({ status: "verified", watches: [watch] });
    expect(deps.publish).toHaveBeenCalledWith("attempt", [watch], [0.016]);
  });

  it("deduplicates references discovered after the initial catalogue lookup", async () => {
    const deps = services();
    const first = { ...watch, referenceCode: null };
    const second = { ...first, model: "Different display name" };
    const result = await validateCachedSearch(
      "a".repeat(64),
      [first, second],
      deps,
    );
    expect(result).toMatchObject({
      status: "verified",
      watches: [watch],
      rejected: 1,
    });
    expect(deps.publish).toHaveBeenCalledWith(
      "attempt",
      [watch],
      [0.016, 0.016],
    );
  });

  it("charges but rejects disagreeing or placeholder references", async () => {
    for (const reference of ["different-123", "unknown"]) {
      const deps = services();
      deps.secondary = vi.fn(async () => ({
        ...assertion("muse"),
        evidence: { ...assertion("muse").evidence, referenceCode: reference },
      }));
      if (reference === "unknown") {
        deps.primary = vi.fn(async () => ({
          ...assertion("perplexity"),
          evidence: {
            ...assertion("perplexity").evidence,
            referenceCode: reference,
          },
        }));
      }
      expect(
        await validateCachedSearch(
          "a".repeat(64),
          [{ ...watch, referenceCode: null }],
          deps,
        ),
      ).toEqual({
        status: "unavailable",
        reason: "no confirmed candidates",
      });
      expect(deps.inspect).not.toHaveBeenCalled();
      expect(deps.settle).toHaveBeenCalledWith("attempt", [0.016]);
      expect(deps.publish).not.toHaveBeenCalled();
    }
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

  it("does not return a verified answer if atomic publication fails", async () => {
    const deps = services();
    deps.publish = vi.fn(async () => false);
    expect(await validateCachedSearch("a".repeat(64), [watch], deps)).toEqual({
      status: "unavailable",
      reason: "publication failed",
    });
  });

  it("retains the reservation when known provider costs exceed the per-watch cap", async () => {
    const deps = services();
    deps.primary = vi.fn(async () => ({
      ...assertion("perplexity"),
      costUsd: 0.02,
    }));
    expect(await validateCachedSearch("a".repeat(64), [watch], deps)).toEqual({
      status: "unavailable",
      reason: "provider cost exceeded reservation",
    });
    expect(deps.settle).not.toHaveBeenCalled();
    expect(deps.reportOverrun).toHaveBeenCalledWith("attempt", [0.028]);
    expect(deps.inspect).not.toHaveBeenCalled();
  });

  it("halts on a known overrun even if the other provider fails", async () => {
    const deps = services();
    deps.primary = vi.fn(async () => ({
      ...assertion("perplexity"),
      costUsd: 0.03,
    }));
    deps.secondary = vi.fn(async () => {
      throw new Error("timeout");
    });
    expect(await validateCachedSearch("a".repeat(64), [watch], deps)).toEqual({
      status: "unavailable",
      reason: "provider cost exceeded reservation",
    });
    expect(deps.reportOverrun).toHaveBeenCalledWith("attempt", [0.03]);
    expect(deps.settle).not.toHaveBeenCalled();
  });
});
