import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { vi } from "vitest";

const store = vi.hoisted(() => ({ searchWithStore: vi.fn() }));
const finder = vi.hoisted(() => ({ check: vi.fn() }));

vi.mock("../domain/ai-watch-store.server", () => ({
  ...store,
  loadAiWatchStoreConfig: () => null,
}));
vi.mock("../domain/validation-runtime.server", () => ({
  meteredSearchOptions: ({
    allowPaid,
  }: {
    allowPaid: () => Promise<boolean>;
  }) => ({
    validateDraft: async () =>
      (await allowPaid())
        ? (finder.check() as unknown)
        : { status: "unavailable", reason: "retry_later" },
  }),
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

/** The loader returns plain data, or data with cache headers for a finished
 * answer; tests read the data either way. */
async function load(args: Parameters<typeof loader>[0]) {
  const value = await loader(args);
  return "init" in value && "data" in value ? value.data : value;
}

describe("find a watch from the screen", () => {
  beforeEach(() => {
    store.searchWithStore.mockReset();
    finder.check.mockReset();
    clearRateLimitBuckets();
  });

  it("offers a type list, one search box and examples before any search", async () => {
    stub("/watches/find");
    expect(
      await screen.findByRole("heading", {
        name: "Find the watch from the screen",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: /movie, series, actor/i }),
    ).toBeInTheDocument();
    const type = screen.getByRole("combobox", {
      name: "What are you searching for?",
    });
    expect(type).toBeRequired();
    expect(screen.getByRole("link", { name: /Daniel Craig/ })).toHaveAttribute(
      "href",
      "/watches/find?type=actor&q=Daniel%20Craig",
    );
    expect(store.searchWithStore).not.toHaveBeenCalled();
  });

  it("searches a normalized query and streams in documented sightings", async () => {
    store.searchWithStore.mockResolvedValue(sighting);
    stub("/watches/find?type=actor&q=%20Daniel%20%20Craig%20");

    expect(
      await screen.findByRole("heading", {
        name: "Omega Seamaster Diver 300M",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Daniel Craig · No Time to Die · 2021"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "See the evidence" }),
    ).not.toBeInTheDocument();
    expect(store.searchWithStore).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "film",
        cacheInput: { query: "daniel craig", kind: "actor" },
      }),
      expect.any(Object),
    );
  });

  it("lets the CDN keep a finished answer and streams a new search", async () => {
    const cacheControl = (value: Awaited<ReturnType<typeof loader>>) =>
      "init" in value && "data" in value
        ? new Headers(value.init?.headers).get("Cache-Control")
        : null;
    store.searchWithStore.mockResolvedValueOnce({
      ...sighting,
      fromCache: true,
    });
    const finished = await loader(
      loaderArgs("http://test.local/watches/find?type=actor&q=Daniel+Craig"),
    );
    expect(cacheControl(finished)).toContain("s-maxage=");

    store.searchWithStore.mockImplementationOnce(
      () => new Promise(() => undefined),
    );
    vi.useFakeTimers();
    try {
      const pending = loader(
        loaderArgs("http://test.local/watches/find?type=actor&q=New+Person"),
      );
      await vi.advanceTimersByTimeAsync(2_000);
      const streamed = await pending;
      expect(cacheControl(streamed)).toBeNull();
      expect("init" in streamed).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not search for a one-character query", async () => {
    const result = await load(
      loaderArgs("http://test.local/watches/find?type=movie&q=x"),
    );
    expect(result.result).toBeNull();
    expect(store.searchWithStore).not.toHaveBeenCalled();
  });

  it("asks for the type instead of searching without one", async () => {
    const result = await load(
      loaderArgs("http://test.local/watches/find?q=Heat"),
    );
    expect(result.result).toBeNull();
    expect(result.needsType).toBe(true);
    expect(store.searchWithStore).not.toHaveBeenCalled();
  });

  it("rate-limits fresh searches per visitor but not stored answers", async () => {
    store.searchWithStore.mockImplementation(
      (_request: unknown, options: { validateDraft: () => Promise<unknown> }) =>
        options.validateDraft(),
    );
    finder.check.mockResolvedValue(sighting);

    const outcomes = [];
    for (let index = 0; index < 13; index += 1) {
      outcomes.push(
        await (
          await load(
            loaderArgs(
              `http://test.local/watches/find?type=movie&q=query-${index}`,
            ),
          )
        ).result,
      );
    }

    expect(finder.check).toHaveBeenCalledTimes(12);
    expect(outcomes.at(-1)).toMatchObject({
      status: "unavailable",
      reason: "retry_later",
    });
    const otherVisitor = await (
      await load(
        loaderArgs(
          "http://test.local/watches/find?type=movie&q=another",
          "198.51.100.9",
        ),
      )
    ).result;
    expect(otherVisitor).toMatchObject({ status: "found" });
  });
});
