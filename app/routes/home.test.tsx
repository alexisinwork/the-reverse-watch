import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { vi } from "vitest";

import Home, { action, meta } from "./home";

const SESSION_SECRET =
  "a-test-secret-that-is-longer-than-thirty-two-characters";

function renderHome() {
  const Stub = createRoutesStub([{ path: "/", Component: Home, action }]);
  render(<Stub />);
}

function actionRequest(entries: Record<string, string>) {
  return new Request("http://test.local/", {
    method: "POST",
    body: new URLSearchParams(entries),
  });
}

describe("landing page", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", SESSION_SECRET);
  });

  it("preserves the documentary landing-page copy", () => {
    renderHome();

    expect(
      screen.getByRole("heading", { level: 1, name: "The Reserve" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/we investigate the filings, the balance sheets/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Archival Documentary")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Start the reference diagnostic/i }),
    ).toHaveAttribute("href", "#newsletter-signup");
    expect(
      screen.getByRole("link", {
        name: /Explore watches/i,
      }),
    ).toHaveAttribute("href", "/watches");
  });

  it("renders a legible first-party Beehiiv subscription form", () => {
    renderHome();

    expect(screen.getByLabelText("Email address")).toHaveAttribute(
      "autocomplete",
      "email",
    );
    expect(
      screen.getByRole("checkbox", { name: /agree to receive/i }),
    ).toBeRequired();
    expect(screen.getByRole("button", { name: "Subscribe" })).toBeVisible();
    expect(
      document.querySelector('script[src*="subscribe-forms.beehiiv.com"]'),
    ).not.toBeInTheDocument();
  });

  it("links returning subscribers directly to the diagnostic", async () => {
    const Stub = createRoutesStub([
      {
        path: "/",
        Component: Home,
        action,
        loader: () => ({ diagnosticAccess: true }),
      },
    ]);
    render(<Stub />);

    expect(
      await screen.findByRole("link", {
        name: /Start the reference diagnostic/i,
      }),
    ).toHaveAttribute("href", "/quiz");
    expect(screen.getByText(/Subscriber access · Unlocked/i)).toBeVisible();
  });

  it("requires explicit consent before calling Beehiiv", async () => {
    const fetchImplementation = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchImplementation);
    const response = await action({
      request: actionRequest({
        intent: "newsletter",
        email: "reader@example.com",
      }),
    } as Parameters<typeof action>[0]);

    expect(response.init?.status).toBe(400);
    expect(response.data).toEqual({
      ok: false,
      message: "Please confirm the email opt-in.",
    });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("subscribes through the server-side Beehiiv adapter", async () => {
    vi.stubEnv("BEEHIIV_API_KEY", "beehiiv-key");
    vi.stubEnv("BEEHIIV_PUBLICATION_ID", "pub_123");
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchImplementation);
    const response = await action({
      request: actionRequest({
        intent: "newsletter",
        email: "reader@example.com",
        newsletterConsent: "yes",
      }),
    } as Parameters<typeof action>[0]);

    expect(response.init?.status ?? 200).toBe(200);
    expect(response.data).toEqual({
      ok: true,
      message: "Subscribed. The reference diagnostic is now unlocked.",
    });
    expect(new Headers(response.init?.headers).get("Set-Cookie")).toContain(
      "reserve_diagnostic_access=",
    );
    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://api.beehiiv.com/v2/publications/pub_123/subscriptions",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("retains the original document metadata", () => {
    expect(meta()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "The Reserve · Documentary & Horological Forensics",
        }),
      ]),
    );
  });
});
