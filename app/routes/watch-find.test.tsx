import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { vi } from "vitest";

const store = vi.hoisted(() => ({ searchWithStore: vi.fn() }));
const finder = vi.hoisted(() => ({ searchFilmWatches: vi.fn() }));

vi.mock("../domain/ai-watch-store.server", () => store);
vi.mock("../domain/film-search.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../domain/film-search.server")>()),
  searchFilmWatches: finder.searchFilmWatches,
}));

import { clearRateLimitBuckets } from "../domain/rate-limit.server";
import WatchFind, { loader } from "./watch-find";

const sighting = {
  status: "found",
  fromCache: false,
  summary: "Bond wore Omega.",
  watches: [
    {
      brand: "Omega",
      model: "Seamaster Diver 300M",
      referenceCode: "210.90.42.20.01.001",
      sourceUrl: "https://www.hodinkee.com/bond",
      imageUrl: "https://img.test/omega.jpg",
      priceNote: null,
      rationale: "Worn by Daniel Craig in No Time to Die.",
      details: { person: "Daniel Craig", work: "No Time to Die", year: 2021 },
    },
  ],
};

function stub(entry: string) {
  const Stub = createRoutesStub([
    {
      path: "/watches/find",
      Component: WatchFind,
      loader: (args) => loader(args),
    },
  ]);
  return render(<Stub initialEntries={[entry]} />);
}

function loaderArgs(url: string, ip = "203.0.113.7") {
  return {
    request: new Request(url, { headers: { "x-forwarded-for": ip } }),
  } as Parameters<typeof loader>[0];
}

describe("find a watch from the screen", () => {
  beforeEach(() => {
    store.searchWithStore.mockReset();
    finder.searchFilmWatches.mockReset();
    clearRateLimitBuckets();
  });

  it("offers one search box and examples before any search", async () => {
    stub("/watches/find");
    expect(
      await screen.findByRole("heading", {
        name: "Find the watch from the screen",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: /film, series, actor/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Daniel Craig" })).toHaveAttribute(
      "href",
      "/watches/find?q=Daniel%20Craig",
    );
    expect(store.searchWithStore).not.toHaveBeenCalled();
  });

  it("searches a normalized query and streams in documented sightings", async () => {
    store.searchWithStore.mockResolvedValue(sighting);
    stub("/watches/find?q=%20Daniel%20%20Craig%20");

    expect(
      await screen.findByRole("heading", {
        name: "Omega Seamaster Diver 300M",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Daniel Craig · No Time to Die · 2021"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "See the evidence" }),
    ).toHaveAttribute("href", "https://www.hodinkee.com/bond");
    expect(store.searchWithStore).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "film",
        cacheInput: { query: "daniel craig" },
      }),
    );
  });

  it("does not search for a one-character query", () => {
    const result = loader(loaderArgs("http://test.local/watches/find?q=x"));
    expect(result.result).toBeNull();
    expect(store.searchWithStore).not.toHaveBeenCalled();
  });

  it("rate-limits fresh searches per visitor but not stored answers", async () => {
    store.searchWithStore.mockImplementation(
      ({ run }: { run: () => Promise<unknown> }) => run(),
    );
    finder.searchFilmWatches.mockResolvedValue(sighting);

    const outcomes = [];
    for (let index = 0; index < 13; index += 1) {
      outcomes.push(
        await loader(
          loaderArgs(`http://test.local/watches/find?q=query-${index}`),
        ).result,
      );
    }

    expect(finder.searchFilmWatches).toHaveBeenCalledTimes(12);
    expect(outcomes.at(-1)).toMatchObject({ status: "no_match" });
    const otherVisitor = await loader(
      loaderArgs("http://test.local/watches/find?q=another", "198.51.100.9"),
    ).result;
    expect(otherVisitor).toMatchObject({ status: "found" });
  });
});
