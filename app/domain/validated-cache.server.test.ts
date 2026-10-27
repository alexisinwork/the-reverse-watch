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
    expect(String(target)).toContain("ai_watch_validated_cache_publish_v2");
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
