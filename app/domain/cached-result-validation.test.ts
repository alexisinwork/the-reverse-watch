import { describe, expect, it } from "vitest";

import type { FoundWatch } from "./ai-watch-types";
import {
  validateCachedWatch,
  type ValidationEvidence,
} from "./cached-result-validation";

const watch: FoundWatch = {
  brand: "Omega",
  model: "Aqua Terra",
  referenceCode: "231.10.39.21.03.001",
  sourceUrl: "https://example.com/watch",
  imageUrl: null,
  priceNote: null,
  rationale: "Skyfall",
  details: { person: "Daniel Craig", work: "Skyfall" },
};
const primary: ValidationEvidence = {
  provider: "perplexity",
  brand: "Omega",
  referenceCode: "23110392103001",
  person: "Daniel Craig",
  work: "Skyfall",
  sourceUrl: "https://first.example/sighting",
  sourceQuote: "Omega 231.10.39.21.03.001 Daniel Craig Skyfall",
  sourceVerified: true,
  supported: true,
};
const secondary: ValidationEvidence = {
  ...primary,
  provider: "muse",
  sourceUrl: "https://second.example/sighting",
};
const checkedAt = "2026-10-27T00:00:00Z";

describe("cached watch evidence reconciliation", () => {
  it("keeps the primary result when two inspected independent sources agree", () => {
    const result = validateCachedWatch(watch, primary, secondary, checkedAt);
    expect(result.status).toBe("verified");
    if (result.status !== "verified") throw new Error("expected verified");
    expect(result.watch.referenceCode).toBe(watch.referenceCode);
    expect(result.watch.details.validationEvidence).toHaveLength(2);
    expect(result.watch.details.validationEvidence?.[0]).toMatchObject({
      sourceQuote: primary.sourceQuote,
      person: "Daniel Craig",
      work: "Skyfall",
      checkedAt,
    });
  });

  it("rejects a different wearer even when the same film and brand match", () => {
    expect(
      validateCachedWatch(
        watch,
        { ...primary, person: "Naomie Harris" },
        secondary,
        checkedAt,
      ),
    ).toMatchObject({
      status: "unverified",
      reason: "person attribution conflict",
    });
  });

  it("rejects missing, unsafe, uninspected, same-host and conflicting evidence", () => {
    const cases: [FoundWatch, ValidationEvidence, ValidationEvidence][] = [
      [{ ...watch, referenceCode: null }, primary, secondary],
      [watch, { ...primary, sourceVerified: false }, secondary],
      [watch, { ...primary, sourceUrl: "http://127.0.0.1/private" }, secondary],
      [
        watch,
        primary,
        { ...secondary, sourceUrl: "https://www.first.example/other" },
      ],
      [watch, primary, { ...secondary, referenceCode: "another-ref" }],
      [watch, primary, { ...secondary, work: "Spectre" }],
      [watch, primary, { ...secondary, supported: false }],
      [watch, primary, { ...secondary, provider: "perplexity" }],
    ];
    for (const [candidate, a, b] of cases)
      expect(validateCachedWatch(candidate, a, b, checkedAt).status).toBe(
        "unverified",
      );
  });
});
