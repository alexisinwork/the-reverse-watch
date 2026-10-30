import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import type { FoundWatch } from "../domain/ai-watch-types";
import { SearchProgress, WatchResults } from "./watch-results";
import { createProgressFeed } from "../domain/progress-feed";
import { EmbedSurfaceProvider } from "./surface";

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
  it("shows immediate alternatives activity and the actual source-check steps", async () => {
    const progress = createProgressFeed(10_000);
    render(
      <MemoryRouter>
        <SearchProgress mode="alternatives" progress={progress.feed} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Opening the catalogue and identifying your watch",
    );
    await act(async () => {
      progress.report({ text: "Comparing your watch with the catalogue…" });
      progress.report({ text: "Independently checking Seiko SPB143J1…" });
    });
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Independently checking Seiko SPB143J1",
      ),
    );
    expect(
      screen.getByRole("list", { name: "Search steps so far" }),
    ).toHaveTextContent("Comparing your watch with the catalogue");
    progress.close();
  });
  it.each([
    ["retry_later" as const, /try again in five minutes/i],
    ["in_progress" as const, /still being checked/i],
    ["budget" as const, /temporarily paused/i],
    ["verification_failed" as const, /could not verify/i],
  ])("explains temporary unavailability: %s", (reason, message) => {
    render(
      <MemoryRouter>
        <WatchResults
          eyebrow="Picks"
          fx={null}
          heading="Watches"
          mode="quiz"
          result={{ status: "unavailable", reason }}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(message)).toBeInTheDocument();
  });
  it("checks both titles and references before rendering any result section", () => {
    const first = {
      ...watch(1),
      brand: "Omega",
      model: "Planet Ocean",
      referenceCode: "2201.50.00",
    };
    render(
      <WatchResults
        eyebrow="Picks"
        fx={null}
        heading="Watches"
        mode="quiz"
        result={{
          status: "found",
          fromCache: true,
          summary: "3 watches.",
          watches: [
            first,
            {
              ...first,
              model: "Seamaster Planet Ocean",
              referenceCode: "2201-50-00",
            },
            { ...first, referenceCode: "232.30.42.21.01.001" },
          ],
          alsoWorth: [{ ...first, referenceCode: "ref789" }, watch(2)],
        }}
      />,
    );
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(
      screen.getAllByRole("heading", { level: 3, name: /Planet Ocean/ }),
    ).toHaveLength(1);
  });
  it("tags only the cards whose maker reference is not confirmed", () => {
    render(
      <WatchResults
        eyebrow="Picks"
        fx={null}
        heading="Watches"
        mode="quiz"
        result={{
          status: "found",
          fromCache: true,
          summary: "Two watches.",
          watches: [
            {
              ...watch(1),
              details: { ...watch(1).details, referenceVerified: true },
            },
            watch(2),
          ],
        }}
      />,
    );
    expect(
      screen.getAllByText("Manufacturer reference not confirmed"),
    ).toHaveLength(1);
    expect(screen.getByText(/Reference confirmed on the/)).toBeInTheDocument();
  });

  it("shows all ten watches immediately, with near fits marked", () => {
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
    expect(screen.getAllByRole("article")).toHaveLength(10);
    expect(screen.getByText("Option 10 · Close fit")).toBeInTheDocument();
    expect(
      screen.getByText("Case size outside your range"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Show all/ }),
    ).not.toBeInTheDocument();
    // None of these has a confirmed reference, so every card says so.
    expect(
      screen.getAllByText("Manufacturer reference not confirmed"),
    ).toHaveLength(10);
  });
});

describe("film sightings", () => {
  it("labels uncertain results and unknown prices and keeps widget sources as text", () => {
    render(
      <EmbedSurfaceProvider
        value={{
          key: "test",
          feature: "find",
          themeQuery: "",
          siteOrigin: "https://thereserve.watch",
        }}
      >
        <WatchResults
          eyebrow="Film"
          heading="Watches"
          mode="film"
          fx={null}
          result={{
            status: "found",
            fromCache: true,
            summary: "Options",
            watches: [
              {
                ...watch(1),
                details: {
                  price: null,
                  verificationStatus: "unverified",
                  verificationNote: "Association not fully verified",
                  referenceSourceLabel: "Dials",
                  referenceSourceUrl: "https://dials.example/watch",
                  sourceDetails: { Diameter: 40 },
                },
              },
            ],
          }}
        />
      </EmbedSurfaceProvider>,
    );
    expect(
      screen.getByText("Association not fully verified"),
    ).toBeInTheDocument();
    expect(screen.getByText("Price not available")).toBeInTheDocument();
    expect(screen.getByText("Reference source: Dials")).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
  it("link to where each sighting was documented, never to a script URL", () => {
    render(
      <WatchResults
        eyebrow="Film"
        fx={null}
        heading="Watches"
        mode="film"
        result={{
          status: "found",
          fromCache: true,
          summary: "Two sightings.",
          watches: [
            {
              ...watch(1),
              details: {
                person: "Daniel Craig",
                evidenceUrl: "https://www.jamesbondwatches.com/casino-royale",
              },
            },
            {
              ...watch(2),
              sourceUrl: "javascript:alert(1)",
              details: { person: "Daniel Craig" },
            },
          ],
        }}
      />,
    );
    const links = screen.getAllByRole("link", { name: /^Source:/ });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute(
      "href",
      "https://www.jamesbondwatches.com/casino-royale",
    );
    expect(links[0]).toHaveTextContent("Source: jamesbondwatches.com");
  });
});
