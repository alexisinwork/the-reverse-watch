import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";

import WatchStory, { loader as storyLoader } from "./watch-story";
import WatchesIndex, { loader as indexLoader } from "./watches";

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
    expect(
      screen.getByRole("link", {
        name: "Various Episodes: Annie Edison's Watch",
      }),
    ).toHaveAttribute("href", expect.stringContaining("propstoreauction.com"));
    expect(screen.getByText(/No open correction/)).toBeInTheDocument();
  });
});
