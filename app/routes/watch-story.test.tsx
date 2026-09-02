import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";

import { findPublishedDiscoveryStory } from "../domain/discovery-public";
import WatchStory from "./watch-story";

it("carries an accepted story slug into the full diagnostic", async () => {
  const story = findPublishedDiscoveryStory("don-draper-mad-men-omega");
  if (!story) throw new Error("Expected pilot story");
  const Stub = createRoutesStub([
    {
      path: "/watches/stories/:storySlug",
      Component: WatchStory,
      loader: () => ({ story }),
    },
  ]);

  render(
    <Stub initialEntries={["/watches/stories/don-draper-mad-men-omega"]} />,
  );

  expect(
    await screen.findByRole("heading", {
      name: "Don Draper's black-dial Seamaster De Ville",
    }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Start the reference diagnostic" }),
  ).toHaveAttribute("href", "/quiz?story=don-draper-mad-men-omega");
});
