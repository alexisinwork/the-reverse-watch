import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import type { AiSearchView } from "../domain/ai-watch-types";
import { EmbedSurfaceProvider } from "./surface";
import { WatchResults } from "./watch-results";

const result: AiSearchView = {
  status: "found",
  fromCache: true,
  summary: "One option",
  watches: [
    {
      brand: "Seiko",
      model: "Prospex",
      referenceCode: "SPB451",
      sourceUrl: "https://www.seikowatches.com/",
      imageUrl: null,
      priceNote: null,
      rationale: "Fits.",
      details: { price: { amount: 1_300, currency: "USD" } },
    },
  ],
};
const results = () => (
  <WatchResults
    eyebrow="Shortlist"
    fx={null}
    heading="Your watches"
    mode="quiz"
    result={result}
  />
);

describe("Exclusive Watch Selection", () => {
  it("is announced under the site's own results and takes nothing yet", async () => {
    render(<MemoryRouter>{results()}</MemoryRouter>);
    expect(
      await screen.findByRole("complementary", {
        name: "Exclusive Watch Selection",
      }),
    ).toBeVisible();
    const button = screen.getByRole("button", { name: "Coming soon" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute(
      "data-analytics-control",
      "exclusive_selection",
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.click(button);
    expect(screen.getByRole("status")).toHaveTextContent("Not open yet");
  });

  it("never appears inside a partner's widget", async () => {
    render(
      <MemoryRouter>
        <EmbedSurfaceProvider
          value={{
            key: "test",
            feature: "alternatives",
            themeQuery: "",
            siteOrigin: "https://thereserve.watch",
            parentOrigins: ["https://partner.example"],
          }}
        >
          {results()}
        </EmbedSurfaceProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText("Seiko")).toBeInTheDocument();
    expect(
      screen.queryByText("Exclusive Watch Selection"),
    ).not.toBeInTheDocument();
  });
});
