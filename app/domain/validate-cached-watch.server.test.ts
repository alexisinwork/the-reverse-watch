import { describe, expect, it, vi } from "vitest";
import type { FoundWatch } from "./ai-watch-types";
import type { ValidationEvidence } from "./cached-result-validation";
import { validateCachedWatchFromSources } from "./validate-cached-watch.server";

const watch: FoundWatch = {
  brand: "Omega",
  model: "Aqua Terra",
  referenceCode: "231.10.39.21.03.001",
  sourceUrl: "https://first.example/a",
  imageUrl: null,
  priceNote: null,
  rationale: "",
  details: { person: "Daniel Craig", work: "Skyfall" },
};
const primary: ValidationEvidence = {
  provider: "perplexity",
  brand: "Omega",
  referenceCode: watch.referenceCode,
  person: "Daniel Craig",
  work: "Skyfall",
  sourceUrl: "https://first.example/a",
  sourceVerified: true,
  sourceQuote: "Omega 231.10.39.21.03.001 Daniel Craig Skyfall",
  supported: true,
};
const secondary: ValidationEvidence = {
  ...primary,
  provider: "muse",
  sourceUrl: "https://second.example/a",
};

describe("cached watch source validation", () => {
  it("checks both pages before accepting the two provider assertions", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response("Omega 231.10.39.21.03.001 Daniel Craig Skyfall", {
          headers: { "content-type": "text/plain" },
        }),
    ) as unknown as typeof fetch;
    expect(
      (
        await validateCachedWatchFromSources(watch, primary, secondary, {
          fetchImpl,
        })
      ).status,
    ).toBe("verified");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not trust provider claims that an inaccessible source was checked", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("", { status: 403 }),
    ) as unknown as typeof fetch;
    expect(
      (
        await validateCachedWatchFromSources(watch, primary, secondary, {
          fetchImpl,
        })
      ).status,
    ).toBe("unverified");
  });

  it("fills missing technical facts only when both exact-reference pages support the same values", async () => {
    const facts = [
      {
        field: "caseDiameterMm" as const,
        value: 41.5,
        quote: "231.10.39.21.03.001 case diameter 41.5 mm",
      },
      {
        field: "waterResistanceM" as const,
        value: 150,
        quote: "231.10.39.21.03.001 water resistance 150 m",
      },
      {
        field: "movementType" as const,
        value: "automatic",
        quote: "231.10.39.21.03.001 automatic movement",
      },
    ];
    const page = `Omega 231.10.39.21.03.001 Daniel Craig Skyfall. ${facts.map((fact) => fact.quote).join(". ")}`;
    const fetchImpl = vi.fn(
      async () =>
        new Response(page, { headers: { "content-type": "text/plain" } }),
    ) as unknown as typeof fetch;
    const result = await validateCachedWatchFromSources(
      watch,
      { ...primary, facts },
      { ...secondary, facts },
      { fetchImpl, checkedAt: "2026-10-27T00:00:00Z" },
    );
    if (result.status !== "verified") throw new Error("expected verified");
    expect(result.watch.details).toMatchObject({
      caseDiameterMm: 41.5,
      waterResistanceM: 150,
      movement: "automatic",
    });
    expect(result.watch.details.validationFacts).toHaveLength(3);
    expect(result.watch.details.validationFacts?.[0]?.sources).toHaveLength(2);
  });

  it("leaves disputed or unsupported technical facts missing", async () => {
    const primaryFact = {
      field: "caseDiameterMm" as const,
      value: 41.5,
      quote: "231.10.39.21.03.001 case diameter 41.5 mm",
    };
    const otherFact = {
      ...primaryFact,
      value: 42,
      quote: "231.10.39.21.03.001 case diameter 42 mm",
    };
    const page = `Omega 231.10.39.21.03.001 Daniel Craig Skyfall. ${primaryFact.quote}. ${otherFact.quote}`;
    const fetchImpl = vi.fn(
      async () =>
        new Response(page, { headers: { "content-type": "text/plain" } }),
    ) as unknown as typeof fetch;
    const result = await validateCachedWatchFromSources(
      watch,
      { ...primary, facts: [primaryFact] },
      { ...secondary, facts: [otherFact] },
      { fetchImpl },
    );
    if (result.status !== "verified")
      throw new Error("expected verified attribution");
    expect(result.watch.details.caseDiameterMm).toBeUndefined();
    expect(result.watch.details.validationFacts).toBeUndefined();
  });

  it("adds the primary approximate price while retaining the second observation", async () => {
    const first = {
      field: "price" as const,
      value: "USD 3500",
      quote: "231.10.39.21.03.001 market price USD 3,500",
    };
    const second = {
      field: "price" as const,
      value: "USD 3600",
      quote: "231.10.39.21.03.001 asking price USD 3,600",
    };
    const page = `Omega 231.10.39.21.03.001 Daniel Craig Skyfall. ${first.quote}. ${second.quote}`;
    const fetchImpl = vi.fn(
      async () =>
        new Response(page, { headers: { "content-type": "text/plain" } }),
    ) as unknown as typeof fetch;
    const result = await validateCachedWatchFromSources(
      watch,
      { ...primary, facts: [first] },
      { ...secondary, facts: [second] },
      { fetchImpl },
    );
    if (result.status !== "verified")
      throw new Error("expected verified attribution");
    expect(result.watch.details.price).toEqual({
      amount: 3500,
      currency: "USD",
    });
    expect(result.watch.details.priceConfirmed).toBe(false);
    expect(
      result.watch.details.priceObservation?.sources.map(
        (source) => source.value,
      ),
    ).toEqual(["USD 3500", "USD 3600"]);
  });

  it("keeps different approximate market observations and currencies", async () => {
    const first = {
      field: "price" as const,
      value: "USD 3500",
      quote: "231.10.39.21.03.001 market price USD 3,500",
    };
    for (const second of [
      {
        ...first,
        value: "USD 4000",
        quote: "231.10.39.21.03.001 market price USD 4,000",
      },
      {
        ...first,
        value: "EUR 3500",
        quote: "231.10.39.21.03.001 market price EUR 3,500",
      },
    ]) {
      const page = `Omega 231.10.39.21.03.001 Daniel Craig Skyfall. ${first.quote}. ${second.quote}`;
      const fetchImpl = vi.fn(
        async () =>
          new Response(page, { headers: { "content-type": "text/plain" } }),
      ) as unknown as typeof fetch;
      const result = await validateCachedWatchFromSources(
        watch,
        { ...primary, facts: [first] },
        { ...secondary, facts: [second] },
        { fetchImpl },
      );
      if (result.status !== "verified")
        throw new Error("expected verified attribution");
      expect(result.watch.details.price).toEqual({
        amount: 3500,
        currency: "USD",
      });
      expect(result.watch.details.priceConfirmed).toBe(false);
    }
  });

  it("leaves price missing when the second page does not quote its price", async () => {
    const first = {
      field: "price" as const,
      value: "USD 3500",
      quote: "231.10.39.21.03.001 market price USD 3,500",
    };
    const second = {
      ...first,
      quote: "231.10.39.21.03.001 water resistance 150 m",
    };
    const page = `Omega 231.10.39.21.03.001 Daniel Craig Skyfall. ${first.quote}. ${second.quote}`;
    const fetchImpl = vi.fn(
      async () =>
        new Response(page, { headers: { "content-type": "text/plain" } }),
    ) as unknown as typeof fetch;
    const result = await validateCachedWatchFromSources(
      watch,
      { ...primary, facts: [first] },
      { ...secondary, facts: [second] },
      { fetchImpl },
    );
    if (result.status !== "verified")
      throw new Error("expected verified attribution");
    expect(result.watch.details.price).toBeUndefined();
  });

  it("does not count redirects to the same source as independent pages", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) =>
      String(input).startsWith("https://second.example")
        ? new Response(null, {
            status: 302,
            headers: { location: "https://first.example/other" },
          })
        : new Response("Omega 231.10.39.21.03.001 Daniel Craig Skyfall", {
            headers: { "content-type": "text/plain" },
          }),
    ) as unknown as typeof fetch;
    expect(
      await validateCachedWatchFromSources(watch, primary, secondary, {
        fetchImpl,
      }),
    ).toMatchObject({
      status: "unverified",
      reason: "independent sources required",
    });
  });
});
