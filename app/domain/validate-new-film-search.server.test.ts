import { describe, expect, it, vi } from "vitest";
import type { FoundWatch } from "./ai-watch-types";
import type { ValidationEvidence } from "./cached-result-validation";
import type { ValidationServices } from "./validate-cached-search.server";
import { ProviderCostError } from "./validation-provider-response.server";
import {
  validateNewFilmSearch,
  type FilmDiscoverySubject,
} from "./validate-new-film-search.server";

const subject = { query: "daniel craig", kind: "actor" as const };
const primary: ValidationEvidence = {
  provider: "perplexity",
  brand: "Omega",
  referenceCode: "2201.50.00",
  person: "Daniel Craig",
  work: null,
  sourceUrl: "https://one.example/watch",
  sourceQuote: "Omega 2201.50.00 Daniel Craig",
  supported: true,
  sourceVerified: false,
};
const secondary = {
  ...primary,
  provider: "muse" as const,
  sourceUrl: "https://two.example/watch",
};

function fixture() {
  const order: string[] = [];
  const services = {
    reserve: vi.fn(async () => {
      order.push("reserve");
      return { state: "reserved" as const, attemptId: "attempt" };
    }),
    discoverFilm: vi.fn(async () => {
      order.push("perplexity");
      return { evidence: primary, costUsd: 0.004 };
    }),
    hydrate: vi.fn(async (watches: FoundWatch[]) => {
      order.push("catalogue");
      return watches;
    }),
    primary: vi.fn(),
    secondary: vi.fn(async () => {
      order.push("muse");
      return { evidence: secondary, costUsd: 0.003 };
    }),
    inspect: vi.fn(async (watch: FoundWatch) => {
      order.push("inspect");
      return {
        status: "verified" as const,
        watch,
        evidence: [primary, secondary],
      };
    }),
    settle: vi.fn(async () => {
      order.push("settle");
      return true;
    }),
    reportOverrun: vi.fn(async () => {
      order.push("overrun");
      return true;
    }),
    publish: vi.fn(async () => {
      order.push("publish");
      return true;
    }),
  } satisfies ValidationServices & {
    discoverFilm: (
      subject: FilmDiscoverySubject,
    ) => Promise<{ evidence: ValidationEvidence; costUsd: number }>;
  };
  return { services, order };
}

describe("new film discovery", () => {
  it("reserves before discovery and verifies only the discovered reference", async () => {
    const { services, order } = fixture();
    const result = await validateNewFilmSearch(
      "a".repeat(64),
      subject,
      services,
    );
    expect(result).toMatchObject({
      status: "verified",
      watches: [{ brand: "Omega", referenceCode: "2201.50.00" }],
    });
    expect(order).toEqual([
      "reserve",
      "perplexity",
      "catalogue",
      "muse",
      "inspect",
      "catalogue",
      "publish",
    ]);
    expect(services.secondary).toHaveBeenCalledWith(
      expect.objectContaining({
        brand: "Omega",
        referenceCode: "2201.50.00",
        person: "daniel craig",
      }),
    );
    expect(services.publish).toHaveBeenCalledWith(
      "attempt",
      expect.any(Array),
      [0.007],
    );
    expect(services.primary).not.toHaveBeenCalled();
  });
  it("settles the primary cost when its candidate does not match the subject", async () => {
    const { services } = fixture();
    services.discoverFilm.mockResolvedValueOnce({
      evidence: { ...primary, person: "Someone else" },
      costUsd: 0.004,
    });
    expect(
      await validateNewFilmSearch("a".repeat(64), subject, services),
    ).toMatchObject({ status: "unavailable" });
    expect(services.secondary).not.toHaveBeenCalled();
    expect(services.settle).toHaveBeenCalledWith("attempt", [0.004]);
  });
  it("does not publish a different reference proposed by Muse", async () => {
    const { services } = fixture();
    services.secondary.mockResolvedValueOnce({
      evidence: { ...secondary, referenceCode: "OTHER123" },
      costUsd: 0.003,
    });
    expect(
      await validateNewFilmSearch("a".repeat(64), subject, services),
    ).toMatchObject({ status: "unavailable" });
    expect(services.publish).not.toHaveBeenCalled();
    expect(services.settle).toHaveBeenCalledWith("attempt", [0.007]);
  });
  it("retains the full reservation when a provider's charge is unknown", async () => {
    const { services } = fixture();
    services.secondary.mockRejectedValueOnce(
      new ProviderCostError("unknown", null),
    );
    await validateNewFilmSearch("a".repeat(64), subject, services);
    expect(services.settle).toHaveBeenCalledWith("attempt", [null]);
    expect(services.publish).not.toHaveBeenCalled();
  });
  it("halts on a known overrun instead of understating the charge", async () => {
    const { services } = fixture();
    services.discoverFilm.mockResolvedValueOnce({
      evidence: primary,
      costUsd: 0.026,
    });
    await validateNewFilmSearch("a".repeat(64), subject, services);
    expect(services.reportOverrun).toHaveBeenCalledWith("attempt", [0.026]);
    expect(services.secondary).not.toHaveBeenCalled();
    expect(services.settle).not.toHaveBeenCalled();
  });
});
