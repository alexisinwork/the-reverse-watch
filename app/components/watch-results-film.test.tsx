import { render, screen, within } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import type { AiSearchView, FoundWatch } from "../domain/ai-watch-types";
import { filmSummary } from "../domain/film-search-run.server";
import { WatchResults } from "./watch-results";

const watch = (
  reference: string,
  verificationStatus?: "unverified",
): FoundWatch => ({
  brand: "Omega",
  model: `Seamaster ${reference}`,
  referenceCode: reference,
  sourceUrl: `https://example.com/${reference}`,
  imageUrl: null,
  priceNote: null,
  rationale: "Seen on screen.",
  details: {
    person: "Daniel Craig",
    ...(verificationStatus ? { verificationStatus } : {}),
  },
});

function renderResults(result: AiSearchView) {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <WatchResults
          eyebrow="Film"
          fx={null}
          heading="Watches"
          mode="film"
          result={result}
        />
      ),
    },
  ]);
  render(<Stub initialEntries={["/"]} />);
}

describe("film results: confirmed first, possible apart", () => {
  it("summarizes confirmed and possible sightings separately", () => {
    expect(filmSummary([watch("A1"), watch("B2", "unverified")])).toBe(
      "1 confirmed sighting, each with its sources. 1 possible sighting is listed separately and still needs checking.",
    );
    expect(
      filmSummary([watch("B2", "unverified"), watch("C3", "unverified")]),
    ).toBe(
      "No sighting is confirmed yet. 2 possible sightings are listed separately and still need checking.",
    );
    expect(filmSummary([watch("A1"), watch("D4")])).toBe(
      "2 confirmed sightings, each with its sources.",
    );
  });

  it("lists confirmed sightings openly and possible ones in a collapsed block", async () => {
    const watches = [
      watch("A1"),
      watch("B2", "unverified"),
      watch("C3", "unverified"),
    ];
    renderResults({
      status: "found",
      fromCache: true,
      summary: filmSummary(watches),
      watches,
      coverage: {
        minimum: 5,
        target: 10,
        total: 3,
        additionalCandidates: 2,
        status: "partial",
      },
    });
    const block = (
      await screen.findByText("2 possible sightings, not confirmed")
    ).closest("details")!;
    expect(block).not.toHaveAttribute("open");
    expect(within(block).getByText(/Seamaster B2/)).toBeInTheDocument();
    expect(within(block).getByText(/Seamaster C3/)).toBeInTheDocument();
    const confirmed = screen.getByText(/Seamaster A1/);
    expect(confirmed.closest("details")).toBeNull();
    // A short confirmed list is complete: no "looking for ten" notice.
    expect(
      screen.queryByText(/We are looking for 10 distinct watches/),
    ).not.toBeInTheDocument();
  });

  it("says plainly when nothing is confirmed yet", async () => {
    const watches = [watch("B2", "unverified")];
    renderResults({
      status: "found",
      fromCache: true,
      summary: filmSummary(watches),
      watches,
    });
    expect(
      await screen.findByText(
        /No sighting is confirmed yet\. The possible ones/,
      ),
    ).toBeInTheDocument();
  });
});
