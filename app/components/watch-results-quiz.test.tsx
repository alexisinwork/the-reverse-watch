import { render, screen, within } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import type { FoundWatch } from "../domain/ai-watch-types";
import { closeFitsNote, WatchResults } from "./watch-results";

const watch = (
  reference: string,
  caseDiameterMm: number,
  misses: string[] = [],
): FoundWatch => ({
  brand: "Certina",
  model: `DS-8 ${reference}`,
  referenceCode: reference,
  sourceUrl: `https://example.com/${reference}`,
  imageUrl: null,
  priceNote: "USD 483",
  rationale: "Fits.",
  details: { caseDiameterMm, ...(misses.length ? { misses } : {}) },
});

const SIZE = "Case size outside your range";

describe("quiz results: exact matches first, close fits apart", () => {
  it("names the sizes the close fits have when most miss the case size", () => {
    expect(
      closeFitsNote([
        watch("A", 41, [SIZE]),
        watch("B", 42.5, [SIZE]),
        watch("C", 40, ["Caseback type not confirmed"]),
      ]),
    ).toContain("their sizes are 41–42.5 mm");
    expect(
      closeFitsNote([watch("C", 40, ["Caseback type not confirmed"])]),
    ).toBe(
      "Each card lists what differs from your answers or is not confirmed.",
    );
  });

  it("shows exact matches openly and close fits under their own heading", async () => {
    const Stub = createRoutesStub([
      {
        path: "/",
        Component: () => (
          <WatchResults
            eyebrow="Diagnostic"
            fx={null}
            heading="Your shortlist"
            mode="quiz"
            result={{
              status: "found",
              fromCache: true,
              summary: "1 watch meets every answer.",
              watches: [watch("EXACT", 39), watch("NEAR", 41, [SIZE])],
            }}
          />
        ),
      },
    ]);
    render(<Stub initialEntries={["/"]} />);
    const section = (
      await screen.findByRole("heading", {
        name: "Close fits",
      })
    ).closest("section")!;
    expect(within(section).getByText(/DS-8 NEAR/)).toBeInTheDocument();
    expect(within(section).queryByText(/DS-8 EXACT/)).toBeNull();
    expect(screen.getByText(/DS-8 EXACT/).closest(".close-fits")).toBeNull();
  });

  it("says no watch meets every answer when only close fits exist", async () => {
    const Stub = createRoutesStub([
      {
        path: "/",
        Component: () => (
          <WatchResults
            eyebrow="Diagnostic"
            fx={null}
            heading="Your shortlist"
            mode="quiz"
            result={{
              status: "found",
              fromCache: true,
              summary: "0 watches meet every answer.",
              watches: [watch("NEAR", 41, [SIZE])],
            }}
          />
        ),
      },
    ]);
    render(<Stub initialEntries={["/"]} />);
    expect(
      await screen.findByRole("heading", {
        name: "No watch meets every answer: the closest fits",
      }),
    ).toBeInTheDocument();
  });
});
