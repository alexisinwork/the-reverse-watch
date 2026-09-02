import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { vi } from "vitest";

const redisMock = vi.hoisted(() => ({
  del: vi.fn(),
  set: vi.fn(),
}));
const discoveryFunnelMock = vi.hoisted(() => ({
  persistDiscoveryFunnelEvent: vi.fn(),
}));

vi.mock("@upstash/redis", () => ({
  Redis: class MockRedis {
    del = redisMock.del;
    set = redisMock.set;
  },
}));
vi.mock("../domain/discovery-funnel-store.server", () => discoveryFunnelMock);

import {
  QUESTIONNAIRE_STORAGE_KEY,
  QUESTIONNAIRE_VERSION,
} from "../domain/questionnaire";
import {
  issueDiagnosticAccessCookie,
  parseDiagnosticAccessConfiguration,
} from "../domain/diagnostic-access.server";
import Quiz, { action, loader } from "./quiz";

const SESSION_SECRET =
  "a-test-secret-that-is-longer-than-thirty-two-characters";
const accessConfiguration = parseDiagnosticAccessConfiguration({
  NODE_ENV: "test",
  SESSION_SECRET,
});
if (!accessConfiguration.configured) {
  throw new Error("Expected diagnostic access configuration");
}
const issuedDiagnosticCookie =
  await issueDiagnosticAccessCookie(accessConfiguration);
const issuedCookieHeader = issuedDiagnosticCookie.split(";", 1)[0];
if (typeof issuedCookieHeader !== "string") {
  throw new Error("Expected diagnostic access cookie");
}
const diagnosticCookie: string = issuedCookieHeader;

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
    headers: { Cookie: diagnosticCookie },
  });
}

function authenticatedRouteAction(args: Parameters<typeof action>[0]) {
  const headers = new Headers(args.request.headers);
  headers.set("Cookie", diagnosticCookie);
  return action({
    ...args,
    request: new Request(args.request, { headers }),
  });
}

describe("progressive diagnostic", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", SESSION_SECRET);
    window.sessionStorage.clear();
    redisMock.del.mockReset();
    redisMock.set.mockReset();
    discoveryFunnelMock.persistDiscoveryFunnelEvent.mockReset();
    discoveryFunnelMock.persistDiscoveryFunnelEvent.mockResolvedValue(false);
  });

  it("redirects unsigned visits and rejects unsigned submissions", async () => {
    const redirectResponse = await loader({
      request: new Request("http://test.local/quiz"),
    } as Parameters<typeof loader>[0]);
    expect(redirectResponse).toBeInstanceOf(Response);
    if (!(redirectResponse instanceof Response)) {
      throw new Error("Expected redirect response");
    }
    expect(redirectResponse.status).toBe(302);
    expect(redirectResponse.headers.get("Location")).toBe(
      "/?diagnostic=subscription#newsletter-signup",
    );
    const contextualRedirect = await loader({
      request: new Request(
        "http://test.local/quiz?story=don-draper-mad-men-omega",
      ),
    } as Parameters<typeof loader>[0]);
    expect(contextualRedirect).toBeInstanceOf(Response);
    if (!(contextualRedirect instanceof Response)) {
      throw new Error("Expected contextual redirect response");
    }
    expect(contextualRedirect.headers.get("Location")).toBe(
      "/?diagnostic=subscription&story=don-draper-mad-men-omega#newsletter-signup",
    );

    const response = await action({
      request: new Request("http://test.local/quiz", {
        method: "POST",
        body: new URLSearchParams({
          intent: "core",
          profile: JSON.stringify(coreProfile),
        }),
      }),
    } as Parameters<typeof action>[0]);

    expect(response.init?.status).toBe(403);
    expect(response.data).toEqual({
      ok: false,
      errors: ["Subscribe to The Reserve before starting the diagnostic."],
    });
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

  it("deduplicates a repeated configured email request per channel", async () => {
    vi.stubEnv("BEEHIIV_API_KEY", "beehiiv-key");
    vi.stubEnv("BEEHIIV_PUBLICATION_ID", "pub_123");
    vi.stubEnv("RESEND_API_KEY", "resend-key");
    vi.stubEnv("EMAIL_FROM", "The Reserve <hello@example.com>");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "redis-token");
    redisMock.set
      .mockResolvedValueOnce("OK")
      .mockResolvedValueOnce("OK")
      .mockResolvedValue(null);
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        data: {
          id: "sub_123",
          email: "reader@example.com",
          status: "active",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchImplementation);

    const first = await action({
      request: actionRequest({
        intent: "core",
        profile: JSON.stringify(coreProfile),
        email: "reader@example.com",
        emailOptIn: "yes",
      }),
    } as Parameters<typeof action>[0]);
    const second = await action({
      request: actionRequest({
        intent: "core",
        profile: JSON.stringify(coreProfile),
        email: "reader@example.com",
        emailOptIn: "yes",
      }),
    } as Parameters<typeof action>[0]);

    expect(first.data.ok).toBe(true);
    expect(second.data.ok).toBe(true);
    if (!first.data.ok || !second.data.ok) {
      throw new Error("Expected recommendation results");
    }
    expect(first.data.subscription).toMatchObject({
      status: "sent",
      newsletterStatus: "sent",
      dossierStatus: "sent",
    });
    expect(second.data.subscription).toMatchObject({
      status: "already_requested",
      newsletterStatus: "already_requested",
      dossierStatus: "already_requested",
    });
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    expect(redisMock.set).toHaveBeenCalledTimes(4);
    expect(redisMock.del).not.toHaveBeenCalled();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("carries only valid soft archetype preferences into the diagnostic", async () => {
    const Stub = createRoutesStub([
      { path: "/quiz", Component: Quiz, action: authenticatedRouteAction },
      { path: "/", Component: () => <p>Home</p> },
    ]);

    render(
      <Stub
        initialEntries={[
          "/quiz?source=archetype&socialSignal=anti_luxury&aestheticDna=structural_tool",
        ]}
      />,
    );

    await waitFor(() => {
      const raw = window.sessionStorage.getItem(QUESTIONNAIRE_STORAGE_KEY);
      expect(raw).not.toBeNull();
      const saved = JSON.parse(raw ?? "{}") as {
        core: { budgetMax: string; deploymentEnvironment: string };
        refinement: Record<string, unknown>;
      };
      expect(saved.refinement).toMatchObject({
        socialSignal: "anti_luxury",
        aestheticDna: "structural_tool",
      });
      expect(saved.core.budgetMax).toBe("");
      expect(saved.core.deploymentEnvironment).toBe("");
    });
  });

  it("attributes completed recommendations and explicit opt-ins to discovery", async () => {
    vi.stubEnv("BEEHIIV_API_KEY", "");
    vi.stubEnv("BEEHIIV_PUBLICATION_ID", "");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "");

    const response = await action({
      request: actionRequest({
        intent: "core",
        profile: JSON.stringify(coreProfile),
        funnelSource: "archetype",
        email: "reader@example.com",
        emailOptIn: "yes",
      }),
    } as Parameters<typeof action>[0]);

    expect(response.data.ok).toBe(true);
    expect(
      discoveryFunnelMock.persistDiscoveryFunnelEvent,
    ).toHaveBeenCalledWith({ name: "qualified_recommendation" });
    expect(
      discoveryFunnelMock.persistDiscoveryFunnelEvent,
    ).toHaveBeenCalledWith({ name: "opt_in" });
  });

  it("rejects forged discovery attribution", async () => {
    const response = await action({
      request: actionRequest({
        intent: "core",
        profile: JSON.stringify(coreProfile),
        funnelSource: "paid_campaign",
      }),
    } as Parameters<typeof action>[0]);

    expect(response.init?.status).toBe(400);
    expect(response.data).toEqual({
      ok: false,
      errors: ["The diagnostic source is invalid."],
    });
    expect(
      discoveryFunnelMock.persistDiscoveryFunnelEvent,
    ).not.toHaveBeenCalled();
  });

  it("fails closed for a forged or unpublished story context", async () => {
    const forged = await action({
      request: new Request("http://test.local/quiz?story=../private", {
        method: "POST",
        body: new URLSearchParams({
          intent: "core",
          profile: JSON.stringify(coreProfile),
        }),
        headers: { Cookie: diagnosticCookie },
      }),
    } as Parameters<typeof action>[0]);
    expect(forged.init?.status).toBe(400);
    expect(forged.data).toEqual({
      ok: false,
      errors: ["The discovery story context is invalid."],
    });

    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "");
    const unpublished = await action({
      request: new Request("http://test.local/quiz?story=not-published", {
        method: "POST",
        body: new URLSearchParams({
          intent: "core",
          profile: JSON.stringify(coreProfile),
        }),
        headers: { Cookie: diagnosticCookie },
      }),
    } as Parameters<typeof action>[0]);
    expect(unpublished.init?.status).toBe(400);
    expect(unpublished.data).toEqual({
      ok: false,
      errors: ["The discovery story context is unavailable."],
    });
  });

  it("returns reviewed story context without changing the hard-input flow", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "");
    const response = await action({
      request: new Request(
        "http://test.local/quiz?story=don-draper-mad-men-omega",
        {
          method: "POST",
          body: new URLSearchParams({
            intent: "core",
            profile: JSON.stringify(coreProfile),
          }),
          headers: { Cookie: diagnosticCookie },
        },
      ),
    } as Parameters<typeof action>[0]);
    expect(response.data.ok).toBe(true);
    if (!response.data.ok) throw new Error("Expected recommendation result");
    expect(response.data.storyContext).toMatchObject({
      storySlug: "don-draper-mad-men-omega",
      entityName: "Don Draper",
    });
    expect(
      response.data.recommendation.recommendations.every(
        (candidate) =>
          candidate.hardReasons.length === 0 &&
          candidate.missingFacts.length === 0,
      ),
    ).toBe(true);
  });

  it("does not double-count a refined recommendation", async () => {
    const response = await action({
      request: actionRequest({
        intent: "refine",
        profile: JSON.stringify({
          ...coreProfile,
          refinement: { socialSignal: "anti_luxury" },
        }),
        funnelSource: "archetype",
      }),
    } as Parameters<typeof action>[0]);

    expect(response.data.ok).toBe(true);
    expect(
      discoveryFunnelMock.persistDiscoveryFunnelEvent,
    ).not.toHaveBeenCalledWith({ name: "qualified_recommendation" });
  });

  it("continues from essential fit into all 21 personal preferences", async () => {
    const user = userEvent.setup();
    const Stub = createRoutesStub([
      { path: "/quiz", Component: Quiz, action: authenticatedRouteAction },
      { path: "/", Component: () => <p>Home</p> },
    ]);

    render(<Stub initialEntries={["/quiz"]} />);

    await user.type(screen.getByLabelText("Maximum amount"), "10000");
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByLabelText("Unit")).toHaveValue("mm");
    await user.selectOptions(screen.getByLabelText("Unit"), "in");
    await user.type(screen.getByLabelText("Wrist circumference (in)"), "6.7");
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
    await user.click(
      screen.getByRole("button", { name: "Continue to personal profile" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "How do you want to be perceived?",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/remaining 21 preferences/i)).toBeInTheDocument();
    await user.click(
      screen.getByRole("radio", { name: /Discreet competence/i }),
    );
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(
      screen.getByRole("heading", {
        name: "What visual impression should it create?",
      }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("radio", { name: /Mid-century industrial/i }),
    );
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(
      screen.getByRole("heading", {
        name: "What kind of history should it carry?",
      }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("radio", { name: /Sovereign independent/i }),
    );
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(
      screen.getByRole("heading", {
        name: "What should this watch make you feel?",
      }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("radio", { name: /Generational custody/i }),
    );
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(
      screen.getByRole("heading", { name: "How should it fit and age?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("How should the lugs follow your wrist?"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Must straps change without tools?"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(
      screen.getByRole("heading", { name: "How do you want to acquire it?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("How should the watch behave in the market?"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Where are you willing to buy?" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(
      screen.getByRole("heading", {
        name: "Where and how will you use it?",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("How important is low-light visibility?"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "View matches" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Your search boundary" }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("USD 10,000")).toBeInTheDocument();
    expect(screen.getByText(/170\.18 mm · 6\.7 in/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit personal answers" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Discreet competence")).toBeInTheDocument();
    expect(screen.getByText("Mid-century industrial")).toBeInTheDocument();
    expect(screen.getByText("Sovereign independent")).toBeInTheDocument();
    expect(screen.getByText("Generational custody")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Promising, but verify first" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Longines Spirit Zulu Time/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Keep the dossier" }),
    ).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(
      /supabase|sql|beehiiv|engine v|catalogue v|bundled snapshot/i,
    );

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

    await user.click(
      screen.getByRole("button", { name: "Restart diagnostic" }),
    );
    expect(
      screen.getByRole("heading", {
        name: "What is the actual purchase ceiling?",
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Maximum amount")).toHaveValue(null);
  });

  it("does not advance from a missing budget", () => {
    const Stub = createRoutesStub([
      { path: "/quiz", Component: Quiz, action: authenticatedRouteAction },
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
      { path: "/quiz", Component: Quiz, action: authenticatedRouteAction },
      { path: "/", Component: () => <p>Home</p> },
    ]);

    render(<Stub initialEntries={["/quiz"]} />);

    expect(
      await screen.findByRole("heading", { name: "Measure your wrist" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Unit")).toHaveValue("mm");
    expect(screen.getByLabelText("Wrist circumference (mm)")).toHaveValue(168);
  });
});
