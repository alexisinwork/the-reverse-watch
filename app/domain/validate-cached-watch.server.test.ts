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
