import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { vi } from "vitest";

import {
  QUESTIONNAIRE_STORAGE_KEY,
  QUESTIONNAIRE_VERSION,
} from "../domain/questionnaire";
import Quiz, { action } from "./quiz";

const coreProfile = {
  core: {
    version: QUESTIONNAIRE_VERSION,
    budgetCurrency: "USD",
    budgetMax: 10_000,
    wristCircumferenceMm: 170,
    deploymentEnvironment: "studio_desk_daily",
    ownershipFriction: "workhorse_mechanical",
    accuracyTolerance: "within_15_seconds_per_day",
    weightLimit: "under_160_g",
    requiredComplications: ["gmt"],
    datePreference: "either",
  },
};

function actionRequest(entries: Record<string, string>) {
  const body = new URLSearchParams(entries);
  return new Request("http://test.local/quiz", {
    method: "POST",
    body,
  });
}

describe("progressive diagnostic", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("keeps the recommendation visible when email channels are unavailable", async () => {
    vi.stubEnv("BEEHIIV_API_KEY", "");
    vi.stubEnv("BEEHIIV_PUBLICATION_ID", "");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "");

    const response = await action({
      request: actionRequest({
        intent: "core",
        profile: JSON.stringify(coreProfile),
        email: "reader@example.com",
        emailOptIn: "yes",
      }),
    } as Parameters<typeof action>[0]);
    const payload = response.data;

    expect(response.init?.status ?? 200).toBe(200);
    expect(payload.ok).toBe(true);
    if (!payload.ok) throw new Error("Expected a recommendation result");
    expect(payload.recommendation).toBeDefined();
    expect(payload.subscription).toMatchObject({
      status: "unavailable",
      newsletterStatus: "unavailable",
      dossierStatus: "unavailable",
    });
  });

  it("surfaces partial provider configuration without calling a provider", async () => {
    vi.stubEnv("BEEHIIV_API_KEY", "beehiiv-key");
    vi.stubEnv("BEEHIIV_PUBLICATION_ID", "");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "");
    const fetchImplementation = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchImplementation);

    const response = await action({
      request: actionRequest({
        intent: "core",
        profile: JSON.stringify(coreProfile),
        email: "reader@example.com",
        emailOptIn: "yes",
      }),
    } as Parameters<typeof action>[0]);
    const payload = response.data;

    expect(response.init?.status ?? 200).toBe(200);
    expect(payload.ok).toBe(true);
    if (!payload.ok) throw new Error("Expected a recommendation result");
    expect(payload.subscription).toMatchObject({
      status: "failed",
      newsletterStatus: "misconfigured",
      dossierStatus: "unavailable",
    });
    expect(payload.subscription.message).toContain(
      "newsletter delivery misconfigured",
    );
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("reports partial delivery when Beehiiv fails but Resend succeeds", async () => {
    vi.stubEnv("BEEHIIV_API_KEY", "beehiiv-key");
    vi.stubEnv("BEEHIIV_PUBLICATION_ID", "pub_123");
    vi.stubEnv("RESEND_API_KEY", "resend-key");
    vi.stubEnv("EMAIL_FROM", "The Reserve <hello@example.com>");
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 502 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "email_123" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchImplementation);
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const response = await action({
      request: actionRequest({
        intent: "core",
        profile: JSON.stringify(coreProfile),
        email: "reader@example.com",
        emailOptIn: "yes",
      }),
    } as Parameters<typeof action>[0]);
    const payload = response.data;

    expect(response.init?.status ?? 200).toBe(200);
    expect(payload.ok).toBe(true);
    if (!payload.ok) throw new Error("Expected a recommendation result");
    expect(payload.subscription).toMatchObject({
      status: "partial",
      newsletterStatus: "failed",
      dossierStatus: "sent",
    });
    expect(payload.recommendation).toBeDefined();
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
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
    expect(
      screen.getByText(/using the reviewed bundled snapshot/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Keep the dossier" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /explicitly opt in/i }),
    ).toBeInTheDocument();
    await user.type(
      screen.getByLabelText("Email address"),
      "reader@example.com",
    );
    await user.click(
      screen.getByRole("button", { name: "Request email delivery" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /requires explicit opt-in/i,
    );
    expect(
      screen.getByRole("heading", { name: "Keep the dossier" }),
    ).toBeInTheDocument();
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
