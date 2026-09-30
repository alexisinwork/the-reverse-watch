import { fireEvent, render, screen } from "@testing-library/react";

import type { FoundWatch } from "../domain/ai-watch-types";
import { WatchResults } from "./watch-results";

const watch = (index: number, misses?: string[]): FoundWatch => ({
  brand: `Brand${index}`,
  model: `Model ${index}`,
  referenceCode: null,
  sourceUrl: `https://brand${index}.example/`,
  imageUrl: null,
  priceNote: null,
  rationale: "Fits.",
  details: { price: { amount: 3_000, currency: "USD" }, misses },
});

describe("quiz shortlist", () => {
  it("shows five watches, then all ten on request, with near fits marked", () => {
    render(
      <WatchResults
        eyebrow="Shortlist"
        fx={null}
        heading="Watches"
        mode="quiz"
        result={{
          status: "found",
          fromCache: true,
          summary: "Ten watches.",
          watches: [
            ...Array.from({ length: 9 }, (_, index) => watch(index + 1)),
            watch(10, ["Case size outside your range"]),
          ],
        }}
      />,
    );
    expect(screen.getAllByRole("article")).toHaveLength(5);
    fireEvent.click(
      screen.getByRole("button", { name: "Show all 10 watches" }),
    );
    expect(screen.getAllByRole("article")).toHaveLength(10);
    expect(screen.getByText("Option 10 · Close fit")).toBeInTheDocument();
    expect(
      screen.getByText("Case size outside your range"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Show all/ }),
    ).not.toBeInTheDocument();
  });
});
