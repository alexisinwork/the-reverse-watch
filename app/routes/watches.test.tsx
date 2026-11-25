import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";

import { headers as embedLayoutHeaders } from "./embed-layout";
import WatchStory, {
  headers as storyHeaders,
  loader as storyLoader,
} from "./watch-story";
import WatchesIndex, {
  headers as indexHeaders,
  loader as indexLoader,
} from "./watches";

describe("discovery explorer pages", () => {
  it("renders the sourced index and diagnostic handoff", async () => {
    const Stub = createRoutesStub([
      { path: "/watches", Component: WatchesIndex, loader: indexLoader },
    ]);
    render(<Stub initialEntries={["/watches"]} />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Watches of Celebrity & Cinema",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Model family only").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("link", { name: "Start the reference diagnostic" }),
    ).toHaveAttribute("href", "/quiz");
    expect(
      screen.getByRole("link", { name: "Take the archetype quiz" }),
    ).toHaveAttribute("href", "/watches/archetype");
  });

  it("renders citations, uncertainty, and correction state", async () => {
    const Stub = createRoutesStub([
      {
        path: "/watches/stories/:storySlug",
        Component: WatchStory,
        loader: (args) =>
          storyLoader(args as Parameters<typeof storyLoader>[0]),
      },
    ]);
    render(
      <Stub
        initialEntries={[
          "/watches/stories/annie-edison-community-unidentified-watch",
        ]}
      />,
    );

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Annie Edison's recurring Community watch",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Unconfirmed identification")).toBeInTheDocument();
    expect(screen.getByText("Not identified")).toBeInTheDocument();
    // Sources are named, not linked (owner decision).
    expect(
      screen.getByText("Various Episodes: Annie Edison's Watch"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", {
        name: "Various Episodes: Annie Edison's Watch",
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/No open correction/)).toBeInTheDocument();
  });
});

describe("story page caching", () => {
  const args = (
    parentHeaders: Headers,
    errorHeaders?: Headers,
  ): Parameters<typeof indexHeaders>[0] => ({
    parentHeaders,
    loaderHeaders: new Headers(),
    actionHeaders: new Headers(),
    errorHeaders,
  });

  it("lets the CDN keep public story pages", () => {
    for (const pageHeaders of [indexHeaders, storyHeaders]) {
      const cacheControl = new Headers(pageHeaders(args(new Headers()))).get(
        "Cache-Control",
      );
      expect(cacheControl).toContain("s-maxage=");
    }
  });

  it("keeps stories inside a partner widget private and counted", () => {
    const widgetParent = new Headers(embedLayoutHeaders());
    for (const pageHeaders of [indexHeaders, storyHeaders]) {
      expect(
        new Headers(pageHeaders(args(widgetParent))).get("Cache-Control"),
      ).toBe("private, no-store");
    }
  });

  it("does not cache a missing story", () => {
    expect(
      new Headers(storyHeaders(args(new Headers(), new Headers()))).get(
        "Cache-Control",
      ),
    ).toBe("no-store");
  });
});
