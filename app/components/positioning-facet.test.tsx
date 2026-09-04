import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PositioningFacet } from "./positioning-facet";

const groups = [
  { slug: "instrument", labelEn: "Instrument" },
  { slug: "quiet_classic", labelEn: "Quiet classic" },
];

describe("PositioningFacet", () => {
  it("renders nothing when no groups are available", () => {
    const { container } = render(
      <PositioningFacet groups={[]} selected={null} onSelect={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a chip per group plus an all option", () => {
    render(
      <PositioningFacet groups={groups} selected={null} onSelect={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Instrument" }),
    ).toBeInTheDocument();
  });

  it("marks the selected chip as pressed", () => {
    render(
      <PositioningFacet
        groups={groups}
        selected="instrument"
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Instrument" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("reports the chosen slug", async () => {
    const onSelect = vi.fn();
    render(
      <PositioningFacet groups={groups} selected={null} onSelect={onSelect} />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Quiet classic" }),
    );
    expect(onSelect).toHaveBeenCalledWith("quiet_classic");
  });

  it("reports null when All is chosen", async () => {
    const onSelect = vi.fn();
    render(
      <PositioningFacet
        groups={groups}
        selected="instrument"
        onSelect={onSelect}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "All" }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
