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
const aiSearchMock = vi.hoisted(() => ({
  searchWithStore: vi.fn(),
}));

vi.mock("@upstash/redis", () => ({
  Redis: class MockRedis {
    del = redisMock.del;
    set = redisMock.set;
  },
}));
vi.mock("../domain/discovery-funnel-store.server", () => discoveryFunnelMock);
vi.mock("../domain/ai-watch-store.server", () => aiSearchMock);
vi.mock("../domain/fx.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../domain/fx.server")>()),
  loadFxTable: async () => ({
    date: "2026-09-29",
    perEur: { EUR: 1, USD: 1.1355, GBP: 0.85718, CHF: 0.9461 },
  }),
}));

import { QUESTIONNAIRE_V4_STORAGE_KEY } from "../domain/questionnaire-v4";
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

type FormEntries = Record<string, string | string[]>;

const completeProfile: FormEntries = {
  version: "4",
  budgetCurrency: "USD",
  priceRange: "10000_15000",
  wristCm: "17.5",
  wearingScenarios: ["office"],
  minimumWaterResistanceM: "100",
  movementTypes: ["automatic"],
  requiredComplications: [],
  allergyConstraint: "none",
};

function formBody(entries: FormEntries) {
  const body = new URLSearchParams();
  for (const [name, value] of Object.entries(entries)) {
    if (Array.isArray(value)) {
      for (const entry of value) body.append(name, entry);
    } else {
      body.append(name, value);
    }
  }
  return body;
}

function actionRequest(entries: FormEntries, url = "http://test.local/quiz") {
  return new Request(url, {
    method: "POST",
    body: formBody(entries),
    headers: { Cookie: diagnosticCookie },
  });
}

function buildRequest(entries: FormEntries, url?: string) {
  return { request: actionRequest(entries, url) } as Parameters<
    typeof action
  >[0];
}

function authenticatedRouteAction(args: Parameters<typeof action>[0]) {
  const headers = new Headers(args.request.headers);
  headers.set("Cookie", diagnosticCookie);
  return action({
    ...args,
    request: new Request(args.request, { headers }),
  });
}

function authenticatedRouteLoader(args: Parameters<typeof loader>[0]) {
  const headers = new Headers(args.request.headers);
  headers.set("Cookie", diagnosticCookie);
  return loader({
    ...args,
    request: new Request(args.request, { headers }),
  });
}

function routeStub() {
  return createRoutesStub([
    {
      path: "/quiz",
      Component: Quiz,
      action: authenticatedRouteAction,
      loader: authenticatedRouteLoader,
    },
    { path: "/", Component: () => <p>Home</p> },
  ]);
}

async function pickRangeAndWrist(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("radio", { name: "USD 10k–15k" }));
  await user.click(screen.getByRole("button", { name: "Next" }));
  await user.type(await screen.findByLabelText("Wrist circumference"), "17.5");
  await user.click(screen.getByRole("button", { name: "Next" }));
}

async function completeAllScreens(user: ReturnType<typeof userEvent.setup>) {
  await pickRangeAndWrist(user);
  await user.click(await screen.findByRole("checkbox", { name: "Office" }));
  await user.click(screen.getByRole("button", { name: "Next" }));
  await user.click(await screen.findByRole("checkbox", { name: "Automatic" }));
  await user.click(screen.getByRole("button", { name: "Next" }));
  await user.click(screen.getByRole("button", { name: "Next" }));
}

describe("version-4 diagnostic", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", SESSION_SECRET);
    window.sessionStorage.clear();
    redisMock.del.mockReset();
    redisMock.set.mockReset();
    discoveryFunnelMock.persistDiscoveryFunnelEvent.mockReset();
    discoveryFunnelMock.persistDiscoveryFunnelEvent.mockResolvedValue(false);
    aiSearchMock.searchWithStore.mockReset();
    aiSearchMock.searchWithStore.mockResolvedValue({
      status: "found",
      fromCache: false,
      summary: "One strong fit.",
      watches: [
        {
          brand: "Seiko",
          model: "Prospex SPB143",
          referenceCode: "SPB143",
          sourceUrl: "https://www.seikowatches.com/spb143",
          imageUrl: "https://images.example/spb143.jpg",
          priceNote: "about USD 1,300 new",
          rationale: "Automatic diver within budget and diameter.",
          details: {
            price: { amount: 1_300, currency: "USD" },
            caseDiameterMm: 40.5,
            waterResistanceM: 200,
            movement: "automatic",
            sourceKind: "manufacturer",
            referenceVerified: true,
          },
        },
      ],
    });
  });

  it("runs the AI search on every submission with the profile only", async () => {
    const response = await action(
      buildRequest({
        ...completeProfile,
        email: "reader@example.com",
        emailOptIn: "yes",
      }),
    );
    const payload = response.data;
    if (!payload.ok) throw new Error("Expected a recommendation result");

    expect(aiSearchMock.searchWithStore).toHaveBeenCalledTimes(1);
    const [request] = aiSearchMock.searchWithStore.mock.calls[0]!;
    expect(JSON.stringify(request)).not.toContain("reader@example.com");
    expect(request).toMatchObject({
      kind: "quiz",
      cacheInput: {
        budgetCurrency: "USD",
        priceRange: "10000_15000",
        caseDiameter: { minimumMm: 38, maximumMm: 42 },
      },
    });
    expect(await payload.aiSearch).toMatchObject({ status: "found" });
  });

  it("shows the AI pick as the headline result", async () => {
    const user = userEvent.setup();
    const Stub = routeStub();
    render(<Stub initialEntries={["/quiz"]} />);

    await completeAllScreens(user);
    await user.click(
      await screen.findByRole("button", { name: "See the shortlist" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "Watches that fit every answer",
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Reference confirmed on the manufacturer's page"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Seiko Prospex SPB143" }),
    ).toBeInTheDocument();
    // No source links (they are often wrong); prices carry a warning.
    expect(
      screen.queryByRole("link", { name: "Open the source" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Approximate price, may be wrong"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Seiko Prospex SPB143" }),
    ).toHaveAttribute("src", "https://images.example/spb143.jpg");
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
        body: formBody(completeProfile),
      }),
    } as Parameters<typeof action>[0]);

    expect(response.init?.status).toBe(403);
    expect(response.data).toEqual({
      ok: false,
      errors: ["Subscribe to The Reserve before starting the diagnostic."],
    });
  });

  it("serves the questionnaire vocabulary to a signed visit", async () => {
    const result = await authenticatedRouteLoader({
      request: new Request("http://test.local/quiz"),
    } as Parameters<typeof loader>[0]);
    expect(result).not.toBeInstanceOf(Response);
    if (result instanceof Response) throw new Error("Expected loader data");
    expect(result.scenarios.some((option) => option.slug === "office")).toBe(
      true,
    );
    expect(result.complications.some((option) => option.slug === "date")).toBe(
      true,
    );
  });

  it("rejects a version-2 payload", async () => {
    const response = await action(
      buildRequest({ version: "2", budgetCurrency: "USD", budgetMax: "5000" }),
    );
    expect(response.init?.status).toBe(400);
  });

  it("accepts a complete version-4 payload and streams the result", async () => {
    const response = await action(buildRequest(completeProfile));
    expect(response.init?.status ?? 200).toBe(200);
    if (!response.data.ok) throw new Error("Expected a result");
    expect(response.data.aiSearch).toBeInstanceOf(Promise);
    expect(await response.data.aiSearch).toMatchObject({ status: "found" });
  });

  it("rejects an implausible wrist size and an unknown price range", async () => {
    expect(
      (await action(buildRequest({ ...completeProfile, wristCm: "40" }))).init
        ?.status,
    ).toBe(400);
    expect(
      (
        await action(
          buildRequest({ ...completeProfile, priceRange: "3000_3500" }),
        )
      ).init?.status,
    ).toBe(400);
  });

  it("keeps the recommendation visible when email channels are unavailable", async () => {
    vi.stubEnv("BEEHIIV_API_KEY", "");
    vi.stubEnv("BEEHIIV_PUBLICATION_ID", "");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "");

    const response = await action(
      buildRequest({
        ...completeProfile,
        email: "reader@example.com",
        emailOptIn: "yes",
      }),
    );
    const payload = response.data;

    expect(response.init?.status ?? 200).toBe(200);
    expect(payload.ok).toBe(true);
    if (!payload.ok) throw new Error("Expected a recommendation result");
    expect(payload.aiSearch).toBeDefined();
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

    const response = await action(
      buildRequest({
        ...completeProfile,
        email: "reader@example.com",
        emailOptIn: "yes",
      }),
    );
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

    const response = await action(
      buildRequest({
        ...completeProfile,
        email: "reader@example.com",
        emailOptIn: "yes",
      }),
    );
    const payload = response.data;

    expect(response.init?.status ?? 200).toBe(200);
    expect(payload.ok).toBe(true);
    if (!payload.ok) throw new Error("Expected a recommendation result");
    expect(payload.subscription).toMatchObject({
      status: "partial",
      newsletterStatus: "failed",
      dossierStatus: "sent",
    });
    expect(payload.aiSearch).toBeDefined();
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

    const emailRequest = {
      ...completeProfile,
      email: "reader@example.com",
      emailOptIn: "yes",
    };
    const first = await action(buildRequest(emailRequest));
    const second = await action(buildRequest(emailRequest));

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

  it("attributes completed recommendations and explicit opt-ins to discovery", async () => {
    vi.stubEnv("BEEHIIV_API_KEY", "");
    vi.stubEnv("BEEHIIV_PUBLICATION_ID", "");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "");

    const response = await action(
      buildRequest({
        ...completeProfile,
        funnelSource: "archetype",
        email: "reader@example.com",
        emailOptIn: "yes",
      }),
    );

    expect(response.data.ok).toBe(true);
    expect(
      discoveryFunnelMock.persistDiscoveryFunnelEvent,
    ).toHaveBeenCalledWith({ name: "qualified_recommendation" });
    expect(
      discoveryFunnelMock.persistDiscoveryFunnelEvent,
    ).toHaveBeenCalledWith({ name: "opt_in" });
  });

  it("rejects forged discovery attribution", async () => {
    const response = await action(
      buildRequest({ ...completeProfile, funnelSource: "paid_campaign" }),
    );

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
    const forged = await action(
      buildRequest(completeProfile, "http://test.local/quiz?story=../private"),
    );
    expect(forged.init?.status).toBe(400);
    expect(forged.data).toEqual({
      ok: false,
      errors: ["The discovery story context is invalid."],
    });

    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "");
    const unpublished = await action(
      buildRequest(
        completeProfile,
        "http://test.local/quiz?story=not-published",
      ),
    );
    expect(unpublished.init?.status).toBe(400);
    expect(unpublished.data).toEqual({
      ok: false,
      errors: ["The discovery story context is unavailable."],
    });
  });

  it("returns story context alongside the AI shortlist", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "");
    const response = await action(
      buildRequest(
        completeProfile,
        "http://test.local/quiz?story=don-draper-mad-men-omega",
      ),
    );
    expect(response.data.ok).toBe(true);
    if (!response.data.ok) throw new Error("Expected recommendation result");
    expect(response.data.storyContext).toMatchObject({
      storySlug: "don-draper-mad-men-omega",
      entityName: "Don Draper",
    });
    expect((await response.data.storyContext?.explanation)?.status).toBe(
      "not_in_shortlist",
    );
  });

  it("renders six screens and no personal-profile stage", async () => {
    const Stub = routeStub();
    render(<Stub initialEntries={["/quiz"]} />);

    expect(await screen.findByText(/step 1 of 6/i)).toBeInTheDocument();
    expect(screen.queryByText(/personal profile/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/essential fit/i)).not.toBeInTheDocument();
  });

  it("offers scenario and complication options supplied by the loader", async () => {
    const user = userEvent.setup();
    const Stub = routeStub();
    render(<Stub initialEntries={["/quiz"]} />);

    await pickRangeAndWrist(user);

    expect(
      await screen.findByRole("checkbox", { name: "Office" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Smart casual" }),
    ).toBeInTheDocument();
  });

  it("walks the six screens and returns a shortlist", async () => {
    const user = userEvent.setup();
    const Stub = routeStub();
    render(<Stub initialEntries={["/quiz"]} />);

    await completeAllScreens(user);

    expect(
      screen.getByRole("heading", { name: "What must this watch do?" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "See the shortlist" }));

    expect(
      await screen.findByRole("heading", { name: "Your search boundary" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Email me this shortlist" }),
    ).toBeInTheDocument();
  });

  it("does not advance without a price range", async () => {
    const Stub = routeStub();
    render(<Stub initialEntries={["/quiz"]} />);

    expect(await screen.findByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("recovers an unfinished draft from session storage", async () => {
    window.sessionStorage.setItem(
      QUESTIONNAIRE_V4_STORAGE_KEY,
      JSON.stringify({
        version: 4,
        step: 1,
        draft: {
          budgetCurrency: "EUR",
          priceRange: "4000_5000",
          wristValue: "17.5",
          wristUnit: "cm",
          wearingScenarios: ["office"],
          minimumWaterResistanceM: "100",
          movementTypes: [],
          requiredComplications: [],
          allergyConstraint: "none",
          maxCaseThicknessMm: "",
          caseShape: "",
          movementConstruction: "",
          displayCaseback: "",
          crystal: "",
          microAdjustmentRequired: "",
        },
      }),
    );
    const Stub = routeStub();
    render(<Stub initialEntries={["/quiz"]} />);

    expect(
      await screen.findByRole("heading", {
        name: "What is your wrist size?",
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Wrist circumference")).toHaveValue(17.5);
    expect(screen.getByText(/cases of 38–42 mm/)).toBeInTheDocument();
  });

  it("discards an older draft rather than migrating it", async () => {
    window.sessionStorage.setItem(
      "the-reserve:diagnostic:v3",
      JSON.stringify({ version: 3, step: 3, draft: { budgetMax: "9000" } }),
    );
    const Stub = routeStub();
    render(<Stub initialEntries={["/quiz"]} />);

    expect(
      await screen.findByRole("radio", { name: "USD 10k–15k" }),
    ).not.toBeChecked();
    expect(screen.getByText(/step 1 of 6/i)).toBeInTheDocument();
  });

  it("carries discovery attribution into the submitted profile", async () => {
    const user = userEvent.setup();
    const Stub = routeStub();
    const { container } = render(
      <Stub
        initialEntries={[
          "/quiz?source=archetype&socialSignal=anti_luxury&aestheticDna=structural_tool",
        ]}
      />,
    );

    await completeAllScreens(user);

    await waitFor(() => {
      expect(
        container.querySelector('input[name="funnelSource"]'),
      ).not.toBeNull();
    });
    expect(container.querySelector('input[name="funnelSource"]')).toHaveValue(
      "archetype",
    );
    expect(container.querySelector('input[name="version"]')).toHaveValue("4");
  });
});
