import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";

import WatchArchetype, { loader } from "./watch-archetype";

function renderArchetype(path: string) {
  const Stub = createRoutesStub([
    {
      path: "/watches/archetype",
      Component: WatchArchetype,
      loader: (args) => loader(args),
    },
  ]);
  render(<Stub initialEntries={[path]} />);
}

describe("watch archetype route", () => {
  it("asks four editorial questions without requesting an email", async () => {
    renderArchetype("/watches/archetype");

    expect(
      await screen.findByRole("heading", { name: "Your watch disposition" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("group")).toHaveLength(4);
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reveal editorial archetype" }),
    ).toBeInTheDocument();
  });

  it("renders a shareable result and a soft-preference-only handoff", async () => {
    renderArchetype(
      "/watches/archetype?socialSignal=anti_luxury&aestheticDna=structural_tool&deploymentEnvironment=field_water_abuse&priceComfort=considered_entry",
    );

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "The Field Rationalist",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Share this result" }),
    ).toBeInTheDocument();
    const handoff = screen.getByRole("link", {
      name: "Continue to the reference diagnostic",
    });
    expect(handoff).toHaveAttribute(
      "href",
      "/quiz?source=archetype&socialSignal=anti_luxury&aestheticDna=structural_tool",
    );
    expect(screen.getByText(/No email is required/)).toBeInTheDocument();
  });

  it("fails closed on an invalid shared result", async () => {
    renderArchetype(
      "/watches/archetype?socialSignal=forged&aestheticDna=structural_tool",
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "incomplete or invalid",
    );
    expect(
      screen.queryByRole("link", {
        name: "Continue to the reference diagnostic",
      }),
    ).not.toBeInTheDocument();
  });
});
