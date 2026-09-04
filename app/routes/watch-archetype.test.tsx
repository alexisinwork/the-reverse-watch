import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { afterEach, vi } from "vitest";

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
  const originalAppUrl = process.env.APP_URL;

  afterEach(() => {
    if (originalAppUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = originalAppUrl;
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, "clipboard");
    Reflect.deleteProperty(document, "execCommand");
  });

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
    expect(document.querySelector('input[name="scoringVersion"]')).toHaveValue(
      "2.0.0",
    );
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
      name: "Find the right watch for me",
    });
    expect(handoff).toHaveAttribute(
      "href",
      "/quiz?source=archetype&socialSignal=anti_luxury&aestheticDna=structural_tool",
    );
    expect(screen.getByText(/No email is required/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Find a watch from film and culture" }),
    ).toHaveAttribute(
      "href",
      "/watches/find?socialSignal=anti_luxury&aestheticDna=structural_tool",
    );
  });

  it("renders an additional versioned archetype result", async () => {
    renderArchetype(
      "/watches/archetype?socialSignal=quiet_continuity&aestheticDna=high_art&deploymentEnvironment=formal_architectural&priceComfort=exceptional_object&scoringVersion=2.0.0",
    );

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "The Mechanical Connoisseur",
      }),
    ).toBeVisible();
  });

  it("copies the canonical public result URL", async () => {
    process.env.APP_URL = "https://thereserve.watch";
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    renderArchetype(
      "/watches/archetype?socialSignal=anti_luxury&aestheticDna=structural_tool&deploymentEnvironment=field_water_abuse&priceComfort=considered_entry",
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Share this result" }),
    );

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        "https://thereserve.watch/watches/archetype?socialSignal=anti_luxury&aestheticDna=structural_tool&deploymentEnvironment=field_water_abuse&priceComfort=considered_entry&scoringVersion=1.0.0",
      ),
    );
    expect(
      screen.getByText(/Link to The Field Rationalist copied/),
    ).toBeVisible();
  });

  it("uses the browser copy fallback when Clipboard API is denied", async () => {
    process.env.APP_URL = "https://thereserve.watch";
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });

    renderArchetype(
      "/watches/archetype?socialSignal=anti_luxury&aestheticDna=structural_tool&deploymentEnvironment=field_water_abuse&priceComfort=considered_entry",
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Share this result" }),
    );

    expect(writeText).toHaveBeenCalled();
    await waitFor(() => expect(execCommand).toHaveBeenCalledWith("copy"));
    expect(
      screen.getByText(/Link to The Field Rationalist copied/),
    ).toBeVisible();
  });

  it("shows a directly openable public link when automatic copy is unavailable", async () => {
    process.env.APP_URL = "https://thereserve.watch";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn().mockReturnValue(false),
    });

    renderArchetype(
      "/watches/archetype?socialSignal=anti_luxury&aestheticDna=structural_tool&deploymentEnvironment=field_water_abuse&priceComfort=considered_entry",
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Share this result" }),
    );

    const expectedUrl =
      "https://thereserve.watch/watches/archetype?socialSignal=anti_luxury&aestheticDna=structural_tool&deploymentEnvironment=field_water_abuse&priceComfort=considered_entry&scoringVersion=1.0.0";
    expect(await screen.findByLabelText("Shareable result link")).toHaveValue(
      expectedUrl,
    );
    expect(
      screen.getByRole("link", { name: "Open the shareable result" }),
    ).toHaveAttribute("href", expectedUrl);
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
