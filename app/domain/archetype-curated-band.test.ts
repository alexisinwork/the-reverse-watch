import { describe, expect, it } from "vitest";

import type { FoundWatch } from "./ai-watch-types";
import { curatedInBand } from "./archetype-catalogue.server";

const pick = (
  model: string,
  price: { amount: number; currency: string } | null,
): FoundWatch => ({
  brand: "Brand",
  model,
  referenceCode: model.toUpperCase(),
  sourceUrl: "",
  imageUrl: null,
  priceNote: null,
  rationale: "",
  details: { price },
});
// EUR 1 = USD 1.0935, the ECB rate on 2026-11-26.
const fx = { date: "2026-11-26", perEur: { EUR: 1, USD: 1.0935 } };

describe("curatedInBand", () => {
  it("leaves out an editorial pick priced below the band at today's rate", () => {
    const picks = [
      pick("eur-8900", { amount: 8_900, currency: "EUR" }),
      pick("usd-12000", { amount: 12_000, currency: "USD" }),
      pick("no-price", null),
    ];
    expect(
      curatedInBand(picks, "exceptional_object", fx).map(
        (watch) => watch.model,
      ),
    ).toEqual(["usd-12000", "no-price"]);
  });

  it("keeps the band's upper limit exclusive, like the catalogue window", () => {
    const picks = [
      pick("usd-2000", { amount: 2_000, currency: "USD" }),
      pick("usd-1999", { amount: 1_999, currency: "USD" }),
    ];
    expect(
      curatedInBand(picks, "first_good_watch", fx).map((watch) => watch.model),
    ).toEqual(["usd-1999"]);
  });

  it("keeps a pick it cannot convert rather than guessing", () => {
    expect(
      curatedInBand(
        [pick("eur-8900", { amount: 8_900, currency: "EUR" })],
        "exceptional_object",
        null,
      ),
    ).toHaveLength(1);
  });
});
