import { render, screen } from "@testing-library/react";
import { createRoutesStub, RouterContextProvider } from "react-router";
import { vi } from "vitest";

const redisMock = vi.hoisted(() => ({ del: vi.fn(), set: vi.fn() }));
const aiSearchMock = vi.hoisted(() => ({ searchWithStore: vi.fn() }));
const usage = vi.hoisted(() => ({ recordPartnerUse: vi.fn() }));

vi.mock("@upstash/redis", () => ({
  Redis: class MockRedis {
    del = redisMock.del;
    set = redisMock.set;
  },
}));
vi.mock("../domain/discovery-funnel-store.server", () => ({
  persistDiscoveryFunnelEvent: vi.fn(),
}));
vi.mock("../domain/ai-watch-store.server", () => aiSearchMock);
vi.mock("../domain/fx.server", () => ({ loadFxTable: async () => null }));
vi.mock("../domain/partner-sites.server", () => ({
  recordPartnerUse: usage.recordPartnerUse,
  MONTHLY_LIMIT_MESSAGE: "Monthly limit reached.",
}));

import { EmbedSurfaceProvider } from "../components/surface";
import { partnerSiteContext } from "../embed-context";
import type { PartnerSite } from "../domain/partner-sites.server";
import { action as quizAction, loader as quizLoader } from "./quiz";
import { loader as alternativesLoader } from "./watch-alternatives";
import WatchFind from "./watch-find";

const site: PartnerSite = {
  id: "8d2c3f4e-1a2b-4c5d-8e9f-0a1b2c3d4e5f",
  name: "Shop",
  publicKey: "pk_live_abcdefghijklmnopqrstuvwx",
  hasSecret: false,
  allowedOrigins: ["https://shop.example.com"],
  active: true,
  monthlyQuota: null,
  theme: {},
  notes: null,
  createdAt: "2026-10-04T00:00:00Z",
  updatedAt: "2026-10-04T00:00:00Z",
};

function partnerContext() {
  const context = new RouterContextProvider();
  context.set(partnerSiteContext, site);
  return context;
}

const profile: Record<string, string | string[]> = {
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

function quizRequest(entries: Record<string, string | string[]>) {
  const body = new URLSearchParams();
  for (const [name, value] of Object.entries(entries)) {
    for (const entry of Array.isArray(value) ? value : [value])
      body.append(name, entry);
  }
  // No subscriber cookie: the partner's key is the access.
  return new Request(`http://test.local/embed/${site.publicKey}/quiz`, {
    method: "POST",
    body,
    headers: { "x-forwarded-for": "198.51.100.9" },
  });
}

beforeEach(() => {
  usage.recordPartnerUse.mockReset();
  usage.recordPartnerUse.mockResolvedValue({ allowed: true, uses: 1 });
  aiSearchMock.searchWithStore.mockReset();
  aiSearchMock.searchWithStore.mockResolvedValue({
    status: "no_match",
    summary: "Nothing fits.",
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("the diagnostic inside a partner widget", () => {
  it("needs no subscription, counts the use and never sends an email", async () => {
    const fetchSpy = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchSpy);
    const response = await quizAction({
      request: quizRequest({
        ...profile,
        email: "reader@example.com",
        emailOptIn: "yes",
      }),
      context: partnerContext(),
    } as unknown as Parameters<typeof quizAction>[0]);

    expect(response.init?.status ?? 200).toBe(200);
    expect(response.data.ok).toBe(true);
    if (!response.data.ok) throw new Error("Expected a shortlist");
    expect(response.data.subscription.status).toBe("not_requested");
    expect(usage.recordPartnerUse).toHaveBeenCalledWith(site, "quiz");
    // No newsletter or dossier provider was called.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("stops at the site's monthly limit", async () => {
    usage.recordPartnerUse.mockResolvedValue({ allowed: false, uses: 500 });
    const response = await quizAction({
      request: quizRequest(profile),
      context: partnerContext(),
    } as unknown as Parameters<typeof quizAction>[0]);
    expect(response.init?.status).toBe(429);
    expect(response.data).toEqual({
      ok: false,
      errors: ["Monthly limit reached."],
    });
  });

  it("still requires a subscription on The Reserve itself", async () => {
    const response = await quizAction({
      request: quizRequest(profile),
      context: new RouterContextProvider(),
    } as unknown as Parameters<typeof quizAction>[0]);
    expect(response.init?.status).toBe(403);
    expect(usage.recordPartnerUse).not.toHaveBeenCalled();
  });

  it("loads the questions without the subscriber cookie", async () => {
    const result = await quizLoader({
      request: new Request(`http://test.local/embed/${site.publicKey}/quiz`),
      context: partnerContext(),
    } as unknown as Parameters<typeof quizLoader>[0]);
    expect(result).not.toBeInstanceOf(Response);
    expect(result).toHaveProperty("scenarios");
  });
});

describe("other widgets", () => {
  it("opens the alternatives search without the subscriber cookie", async () => {
    const result = await alternativesLoader({
      request: new Request(
        `http://test.local/embed/${site.publicKey}/alternatives`,
      ),
      context: partnerContext(),
    } as unknown as Parameters<typeof alternativesLoader>[0]);
    expect(result).not.toBeInstanceOf(Response);
    expect(result).toMatchObject({ error: null, page: null });
  });

  it("hides The Reserve's own navigation and keeps links in the frame", async () => {
    const surface = {
      key: site.publicKey,
      feature: "find" as const,
      themeQuery: "scheme=light",
      siteOrigin: "https://thereserve.watch",
    };
    const Stub = createRoutesStub([
      {
        path: "/embed/:key/find",
        Component: () => (
          <EmbedSurfaceProvider value={surface}>
            <WatchFind />
          </EmbedSurfaceProvider>
        ),
        loader: () => ({
          query: "",
          kind: null,
          handoff: null,
          result: null,
          progress: null,
          needsType: false,
        }),
      },
    ]);
    render(<Stub initialEntries={[`/embed/${site.publicKey}/find`]} />);

    expect(
      await screen.findByRole("heading", {
        name: "Find the watch from the screen",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Discovery navigation" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Daniel Craig/ }).getAttribute("href"),
    ).toBe(
      `/embed/${site.publicKey}/find?type=actor&q=Daniel+Craig&scheme=light`,
    );
    // The theme survives a new search from the form.
    expect(
      document.querySelector('form input[type="hidden"][name="scheme"]'),
    ).toHaveAttribute("value", "light");
  });
});
