import { describe, expect, it, vi } from "vitest";
import type { FoundWatch } from "./ai-watch-types";
import {
  loadValidatedSnapshot,
  publishValidatedSnapshot,
} from "./validated-cache.server";
import type { CatalogueClient } from "./watch-catalogue.server";

const attempt = "00000000-0000-4000-8000-000000000001";
const watch: FoundWatch = {
  brand: "Omega",
  model: "Planet Ocean",
  referenceCode: "2201.50.00",
  sourceUrl: "https://first.example/watch",
  imageUrl: null,
  priceNote: null,
  rationale: "Fits",
  details: {
    validationEvidence: [
      {
        provider: "perplexity",
        sourceUrl: "https://first.example/watch",
        checkedAt: "2026-10-27T00:00:00Z",
        sourceQuote: "Omega 2201.50.00 Daniel Craig Quantum of Solace",
        person: "Daniel Craig",
        work: "Quantum of Solace",
      },
      {
        provider: "muse",
        sourceUrl: "https://second.example/watch",
        checkedAt: "2026-10-27T00:00:00Z",
      },
    ],
  },
};
function client(reply: unknown) {
  const fetchImpl = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json(reply),
  );
  const value: CatalogueClient = {
    config: { supabaseUrl: "https://db.example", serviceKey: "test" },
    fetchImpl,
  };
  return { value, fetchImpl };
}

describe("validated cache snapshots", () => {
  it("publishes evidence and conservative unknown costs through one RPC", async () => {
    const db = client(true);
    expect(
      await publishValidatedSnapshot(db.value, attempt, [watch], [null]),
    ).toBe(true);
    const [target, init] = db.fetchImpl.mock.calls[0]!;
    expect(String(target)).toContain("ai_watch_validated_cache_publish_v7");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      p_attempt_id: attempt,
      p_costs_usd: [0.025],
      p_watches: [watch],
    });
    expect(db.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("refuses to publish an output without both source records", async () => {
    const db = client(true);
    await expect(
      publishValidatedSnapshot(
        db.value,
        attempt,
        [{ ...watch, details: {} }],
        [0.01],
      ),
    ).rejects.toThrow();
    expect(db.fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects sighting snapshots when either checked passage or attribution is absent", async () => {
    const db = client(true);
    await expect(
      publishValidatedSnapshot(
        db.value,
        attempt,
        [
          {
            ...watch,
            details: {
              ...watch.details,
              person: "Daniel Craig",
              work: "Quantum of Solace",
            },
          },
        ],
        [0.01],
      ),
    ).rejects.toThrow();
    expect(db.fetchImpl).not.toHaveBeenCalled();
  });

  it("does not publish technical facts without matching two-source evidence", async () => {
    const db = client(true);
    await expect(
      publishValidatedSnapshot(
        db.value,
        attempt,
        [
          {
            ...watch,
            details: {
              ...watch.details,
              caseDiameterMm: 40,
              validationFacts: [
                {
                  field: "caseDiameterMm",
                  value: 40,
                  sources: [
                    {
                      provider: "perplexity",
                      sourceUrl: "https://first.example/watch",
                      quote: "Diameter 40 mm",
                      checkedAt: "2026-10-27T00:00:00Z",
                    },
                    {
                      provider: "muse",
                      sourceUrl: "https://other.example/watch",
                      quote: "Diameter 40 mm",
                      checkedAt: "2026-10-27T00:00:00Z",
                    },
                  ],
                },
              ],
            },
          },
        ],
        [0.01],
      ),
    ).rejects.toThrow();
    expect(db.fetchImpl).not.toHaveBeenCalled();
  });

  it("accepts independently cited product facts and rejects mismatched citations", async () => {
    const db = client(true);
    const urls = [
      "https://product-one.example/watch",
      "https://product-two.example/watch",
    ];
    const records = watch.details.validationEvidence!.map((entry, index) => ({
      ...entry,
      citedUrls: [urls[index]!],
    }));
    const fact = {
      field: "caseDiameterMm" as const,
      value: 40,
      sources: records.map((entry, index) => ({
        provider: entry.provider as "perplexity" | "muse",
        sourceUrl: urls[index]!,
        citedUrl: urls[index]!,
        quote: "2201.50.00 case diameter 40 mm",
        checkedAt: entry.checkedAt,
      })),
    };
    const enriched: FoundWatch = {
      ...watch,
      details: {
        ...watch.details,
        caseDiameterMm: 40,
        validationEvidence: records,
        validationFacts: [fact],
      },
    };
    expect(
      await publishValidatedSnapshot(db.value, attempt, [enriched], [0.01]),
    ).toBe(true);
    const invalid = {
      ...enriched,
      details: {
        ...enriched.details,
        validationFacts: [
          {
            ...fact,
            sources: fact.sources.map((source) => ({
              ...source,
              citedUrl: "https://uncited.example/watch",
            })),
          },
        ],
      },
    };
    await expect(
      publishValidatedSnapshot(db.value, attempt, [invalid], [0.01]),
    ).rejects.toThrow();
    expect(db.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does not publish an approximate price from a quote for another amount", async () => {
    const db = client(true);
    await expect(
      publishValidatedSnapshot(
        db.value,
        attempt,
        [
          {
            ...watch,
            details: {
              ...watch.details,
              price: { amount: 3500, currency: "USD" },
              priceConfirmed: false,
              priceObservation: {
                value: "USD 3500",
                sources: [
                  {
                    provider: "perplexity",
                    sourceUrl: "https://first.example/watch",
                    quote: "2201.50.00 price USD 3,500",
                    checkedAt: "2026-10-27T00:00:00Z",
                    value: "USD 3500",
                  },
                  {
                    provider: "muse",
                    sourceUrl: "https://second.example/watch",
                    quote: "2201.50.00 price USD 4,000",
                    checkedAt: "2026-10-27T00:00:00Z",
                    value: "USD 3500",
                  },
                ],
              },
            },
          },
        ],
        [0.01],
      ),
    ).rejects.toThrow();
    expect(db.fetchImpl).not.toHaveBeenCalled();
  });

  it("does not publish a photo attributed to another reference", async () => {
    const db = client(true);
    await expect(
      publishValidatedSnapshot(
        db.value,
        attempt,
        [
          {
            ...watch,
            imageUrl: "https://img.example/photo.jpg",
            details: {
              ...watch.details,
              imageEvidence: {
                sourceUrl: "https://first.example/watch",
                imageUrl: "https://img.example/photo.jpg",
                referenceCode: "OTHER123",
                checkedAt: "2026-10-27T00:00:00Z",
              },
            },
          },
        ],
        [0.01],
      ),
    ).rejects.toThrow();
    expect(db.fetchImpl).not.toHaveBeenCalled();
  });

  it("publishes a photo from a product page cited by the same provider", async () => {
    const db = client(true);
    const photoWatch: FoundWatch = {
      ...watch,
      imageUrl: "https://img.example/photo.jpg",
      details: {
        ...watch.details,
        validationEvidence: watch.details.validationEvidence!.map((entry) =>
          entry.provider === "perplexity"
            ? { ...entry, citedUrls: ["https://product.example/watch"] }
            : entry,
        ),
        imageEvidence: {
          provider: "perplexity",
          citedUrl: "https://product.example/watch",
          sourceUrl: "https://product.example/watch",
          imageUrl: "https://img.example/photo.jpg",
          referenceCode: watch.referenceCode!,
          checkedAt: "2026-10-27T00:00:00Z",
        },
      },
    };
    expect(
      await publishValidatedSnapshot(db.value, attempt, [photoWatch], [0.01]),
    ).toBe(true);
    const invalid = {
      ...photoWatch,
      details: {
        ...photoWatch.details,
        imageEvidence: {
          ...photoWatch.details.imageEvidence!,
          provider: "muse" as const,
        },
      },
    };
    await expect(
      publishValidatedSnapshot(db.value, attempt, [invalid], [0.01]),
    ).rejects.toThrow();
    expect(db.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("checks source URLs and strips a dangerous image URL when reading a snapshot", async () => {
    const db = client({
      validationStatus: "valid",
      summary: "Checked.",
      validatedAt: "2026-10-27T00:00:00Z",
      policyVersion: "source-v1",
      watches: [{ ...watch, imageUrl: "javascript:alert(1)" }],
    });
    const snapshot = await loadValidatedSnapshot(db.value, "a".repeat(64));
    expect(snapshot?.watches[0]?.imageUrl).toBeNull();
  });
});
