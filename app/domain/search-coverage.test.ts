import { describe, expect, it } from "vitest";
import type { AiSearchView, FoundWatch } from "./ai-watch-types";
import { coverSearchResults, unverifiedCandidate } from "./search-coverage";

const card = (index: number): FoundWatch => ({
  brand: `Brand${index}`,
  model: `Model${index}`,
  referenceCode: `REF${index}`,
  sourceUrl: "https://example.com/watch",
  imageUrl: null,
  priceNote: null,
  rationale: "Candidate",
  details: {},
});
const base = (watches: FoundWatch[]): AiSearchView => ({
  status: "found",
  watches,
  summary: "Checked options.",
  fromCache: true,
});

describe("shared search coverage", () => {
  it("keeps the checked card first and fills ten distinct options after deduplication", () => {
    const first = card(1);
    const result = coverSearchResults(base([first]), [
      { ...card(1), referenceCode: "R.E.F.1", model: "Renamed" },
      ...Array.from({ length: 14 }, (_, i) =>
        unverifiedCandidate(card(i + 2), "Needs checking"),
      ),
    ]);
    expect(result).toMatchObject({
      status: "found",
      coverage: { total: 10, status: "target_met", additionalCandidates: 9 },
    });
    if (result.status === "found") expect(result.watches[0]).toBe(first);
  });
  it("reports a real shortage without inventing records or retaining cut sections", () => {
    expect(coverSearchResults(base([card(1)]))).toMatchObject({
      coverage: { total: 1, status: "partial" },
    });
    const result = coverSearchResults({
      ...base(Array.from({ length: 10 }, (_, i) => card(i))),
      status: "found",
      watches: Array.from({ length: 10 }, (_, i) => card(i)),
      summary: "Options",
      fromCache: true,
      alsoWorth: [card(20)],
    });
    expect(result).toMatchObject({ alsoWorth: [], coverage: { total: 10 } });
    expect(coverSearchResults({ status: "unavailable" })).toEqual({
      status: "unavailable",
    });
  });
  it("never certifies additional data and preserves missing price/reference as null", () => {
    const result = unverifiedCandidate(
      {
        ...card(1),
        referenceCode: "null",
        details: {
          validationEvidence: [
            {
              provider: "muse",
              sourceUrl: "https://example.com",
              checkedAt: "2026-10-30T00:00:00Z",
            },
          ],
          validationFacts: [],
          price: null,
        },
      },
      "Not checked",
    );
    expect(result.referenceCode).toBeNull();
    expect(result.details).toEqual({
      price: null,
      verificationStatus: "unverified",
      verificationNote: "Not checked",
    });
  });
  it("does not add rejected candidates or duplicate across main and also-worth sections", () => {
    const result = coverSearchResults(
      {
        status: "found",
        watches: [card(1)],
        alsoWorth: [card(2)],
        summary: "Options",
        fromCache: true,
      },
      [
        card(2),
        { ...card(3), details: { reviewStatus: "rejected" } },
        ...[4, 5, 6].map((i) => unverifiedCandidate(card(i), "Check")),
      ],
    );
    expect(result).toMatchObject({
      coverage: { total: 5, status: "partial" },
      fromCache: false,
      alsoWorth: [card(2)],
    });
  });
});
