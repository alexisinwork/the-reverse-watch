import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";

import {
  QUESTIONNAIRE_STORAGE_KEY,
  QUESTIONNAIRE_VERSION,
} from "../domain/questionnaire";
import Quiz, { action } from "./quiz";

describe("progressive diagnostic", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("keeps the core result to six screens and returns a validated profile", async () => {
    const user = userEvent.setup();
    const Stub = createRoutesStub([
      { path: "/quiz", Component: Quiz, action },
      { path: "/", Component: () => <p>Home</p> },
    ]);

    render(<Stub initialEntries={["/quiz"]} />);

    await user.type(screen.getByLabelText("Maximum amount"), "10000");
    await user.click(screen.getByRole("button", { name: "Next" }));

    await user.type(screen.getByLabelText("Wrist circumference (mm)"), "170");
    await user.click(screen.getByRole("button", { name: "Next" }));

    await user.click(screen.getByLabelText("Studio, desk, or daily wear"));
    await user.click(screen.getByRole("button", { name: "Next" }));

    await user.click(screen.getByLabelText("Workhorse mechanical"));
    await user.click(screen.getByLabelText("Within ±15 seconds per day"));
    await user.click(screen.getByRole("button", { name: "Next" }));

    await user.click(screen.getByLabelText("Under 160 g"));
    await user.click(screen.getByRole("button", { name: "Next" }));

    await user.click(screen.getByLabelText("GMT"));
    await user.click(screen.getByLabelText("Either is acceptable"));
    await user.click(screen.getByRole("button", { name: "View profile" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Your search boundary" }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("USD 10,000")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Refine the ranking profile" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Promising, but verify first" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Longines Spirit Zulu Time/)).toBeInTheDocument();
  });

  it("does not advance from a missing budget", () => {
    const Stub = createRoutesStub([
      { path: "/quiz", Component: Quiz, action },
      { path: "/", Component: () => <p>Home</p> },
    ]);

    render(<Stub initialEntries={["/quiz"]} />);

    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("recovers an unfinished core profile from session storage", async () => {
    window.sessionStorage.setItem(
      QUESTIONNAIRE_STORAGE_KEY,
      JSON.stringify({
        version: QUESTIONNAIRE_VERSION,
        step: 1,
        core: {
          budgetCurrency: "EUR",
          budgetMax: "5000",
          wristCircumferenceMm: "168",
          deploymentEnvironment: "",
          ownershipFriction: "",
          accuracyTolerance: "",
          weightLimit: "",
          requiredComplications: [],
          datePreference: "",
        },
        refinement: {},
      }),
    );
    const Stub = createRoutesStub([
      { path: "/quiz", Component: Quiz, action },
      { path: "/", Component: () => <p>Home</p> },
    ]);

    render(<Stub initialEntries={["/quiz"]} />);

    expect(
      await screen.findByRole("heading", { name: "Measure your wrist" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Wrist circumference (mm)")).toHaveValue(168);
  });
});
