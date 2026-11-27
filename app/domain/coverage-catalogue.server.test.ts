import { describe, expect, it, vi } from "vitest";

import type { FoundWatch } from "./ai-watch-types";
import { hydrateCoverageCandidates } from "./coverage-catalogue.server";
import type { CatalogueClient } from "./watch-catalogue.server";

const row = (patch: Record<string, unknown>) => ({
  id: "8547c0fe-91a0-47d1-957f-ddef90982e3f",
  identityKey: "panerai|pam01320",
  brand: "Panerai",
  model: "Luminor Due 3 Days GMT Power Reserve Automatic Acciaio",
  referenceCode: "PAM01320",
  referenceConfirmed: true,
  styles: [],
  caseDiameterMm: 47,
  caseThicknessMm: null,
  caseShape: null,
  waterResistanceM: 30,
  movement: "automatic",
  inHouseCalibre: null,
  crystal: null,
  displayCaseback: null,
  complications: [],
  caseMaterial: null,
  casebackMaterial: null,
  strapMaterial: null,
  priceAmount: null,
  priceCurrency: null,
  priceStatus: "unconfirmed",
  priceCheckedAt: null,
  priceEvidence: {},
  priceChange: null,
  sourceUrl: "https://www.panerai.com/pam01320",
  sourceKind: "manufacturer",
  imageUrl: null,
  rationale: null,
  foundIn: [],
  reviewStatus: "approved",
  reviewedAt: null,
  createdAt: "2026-10-25",
  updatedAt: "2026-11-27",
  sourceDetails: {
    factCheck: {
      model: "corrected · maker_page · panerai.com · 2026-11-27",
      waterResistanceM: "corrected · maker_page · panerai.com · 2026-11-27",
    },
  },
  ...patch,
});
const saved: FoundWatch = {
  brand: "Panerai",
  model: "Submersible Bronzo",
  referenceCode: "PAM01320",
  sourceUrl: "https://research.example/pam01320",
  imageUrl: null,
  priceNote: null,
  rationale: "Possible match from saved research",
  details: { waterResistanceM: 300 },
};
function client(complete: unknown[]) {
  const fetchImpl = vi.fn(async (input: RequestInfo | URL) =>
    // The candidate lookup leaves out the unpriced record; the whole
    // catalogue has it.
    Response.json(
      String(input).includes("watch_catalogue_candidate_lookup_v1")
        ? []
        : complete,
    ),
  );
  const value: CatalogueClient = {
    config: { supabaseUrl: "https://db.example", serviceKey: "test" },
    fetchImpl,
  };
  return { value, fetchImpl };
}

describe("saved-research candidates and the whole catalogue", () => {
  it("take the facts the repair read on a page, even for an unpriced record", async () => {
    const db = client([row({})]);
    const [card] = await hydrateCoverageCandidates([saved], db.value);
    expect(card).toMatchObject({
      model: "Luminor Due 3 Days GMT Power Reserve Automatic Acciaio",
      details: { waterResistanceM: 30 },
    });
    expect(db.fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("drop a watch the catalogue has rejected", async () => {
    const db = client([row({ reviewStatus: "rejected" })]);
    expect(await hydrateCoverageCandidates([saved], db.value)).toEqual([]);
  });

  it("keep the card as it was when the whole catalogue cannot be read", async () => {
    const value: CatalogueClient = {
      config: { supabaseUrl: "https://db.example", serviceKey: "test" },
      fetchImpl: vi.fn(async (input: RequestInfo | URL) =>
        String(input).includes("watch_catalogue_candidate_lookup_v1")
          ? Response.json([])
          : new Response("busy", { status: 503 }),
      ),
    };
    expect(await hydrateCoverageCandidates([saved], value)).toEqual([saved]);
  });
});
