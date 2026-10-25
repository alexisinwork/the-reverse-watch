import { describe, expect, it } from "vitest";
import { interactionCountry } from "./interaction-country.server";

describe("interactionCountry", () => {
  it("accepts only the hosting edge's two-letter country code", () => {
    expect(
      interactionCountry(
        new Request("https://example.com", {
          headers: { "x-vercel-ip-country": "pl" },
        }),
      ),
    ).toBe("PL");
    expect(
      interactionCountry(
        new Request("https://example.com", {
          headers: { "x-vercel-ip-country": "Poland" },
        }),
      ),
    ).toBeNull();
    expect(interactionCountry(new Request("https://example.com"))).toBeNull();
  });
});
