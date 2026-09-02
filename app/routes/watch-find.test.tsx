import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { expect, it, vi } from "vitest";

const { enqueueDiscoveryResearch, persistDiscoveryFunnelEvent } = vi.hoisted(
  () => ({
    enqueueDiscoveryResearch: vi.fn(),
    persistDiscoveryFunnelEvent: vi.fn(),
  }),
);
const { verifyFilmOrSeriesTitle } = vi.hoisted(() => ({
  verifyFilmOrSeriesTitle: vi.fn(),
}));

vi.mock("../domain/discovery-research-store.server", () => ({
  enqueueDiscoveryResearch,
}));
vi.mock("../domain/discovery-funnel-store.server", () => ({
  persistDiscoveryFunnelEvent,
}));
vi.mock("../domain/perplexity-title-verification.server", () => ({
  verifyFilmOrSeriesTitle,
}));

import WatchFind, { action, loader } from "./watch-find";

it("renders an email-free accepted-record finder with validated handoff", async () => {
  const Stub = createRoutesStub([
    {
      path: "/watches/find",
      Component: WatchFind,
      loader: (args) => loader(args),
    },
  ]);
  render(
    <Stub
      initialEntries={[
        "/watches/find?socialSignal=anti_luxury&aestheticDna=structural_tool",
      ]}
    />,
  );
  expect(
    await screen.findByRole("heading", {
      name: "Find a watch through a story",
    }),
  ).toBeInTheDocument();
  const anchors = [
    screen.getByRole("button", { name: "Film or TV" }),
    screen.getByRole("button", { name: "Actor or public figure" }),
    screen.getByRole("button", { name: "Fictional character" }),
  ];
  expect(anchors).toHaveLength(3);
  anchors.forEach((anchor) => expect(anchor).toBeEnabled());
  expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/research request/i)).not.toBeInTheDocument();
});

describe("research intake action", () => {
  const originalEnvironment = {
    maxRequests: process.env.DISCOVERY_RESEARCH_RATE_LIMIT_MAX_REQUESTS,
    windowSeconds: process.env.DISCOVERY_RESEARCH_RATE_LIMIT_WINDOW_SECONDS,
  };

  beforeEach(() => {
    process.env.DISCOVERY_RESEARCH_RATE_LIMIT_MAX_REQUESTS = "2";
    process.env.DISCOVERY_RESEARCH_RATE_LIMIT_WINDOW_SECONDS = "60";
    enqueueDiscoveryResearch.mockReset();
    persistDiscoveryFunnelEvent.mockReset();
    verifyFilmOrSeriesTitle.mockReset();
    persistDiscoveryFunnelEvent.mockResolvedValue(false);
  });

  afterEach(() => {
    if (originalEnvironment.maxRequests === undefined) {
      delete process.env.DISCOVERY_RESEARCH_RATE_LIMIT_MAX_REQUESTS;
    } else {
      process.env.DISCOVERY_RESEARCH_RATE_LIMIT_MAX_REQUESTS =
        originalEnvironment.maxRequests;
    }
    if (originalEnvironment.windowSeconds === undefined) {
      delete process.env.DISCOVERY_RESEARCH_RATE_LIMIT_WINDOW_SECONDS;
    } else {
      process.env.DISCOVERY_RESEARCH_RATE_LIMIT_WINDOW_SECONDS =
        originalEnvironment.windowSeconds;
    }
  });

  it("queues a valid topic and records only its anchor kind", async () => {
    enqueueDiscoveryResearch.mockResolvedValue({
      token: "c".repeat(48),
      status: "queued",
    });
    const form = new FormData();
    form.set("anchor", "work");
    form.set("query", "Arrival");
    const response = await action({
      request: new Request("http://test.local/watches/find", {
        method: "POST",
        headers: { "x-real-ip": "203.0.113.9" },
        body: form,
      }),
    } as Parameters<typeof action>[0]);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      `/watches/research/${"c".repeat(48)}`,
    );
    expect(enqueueDiscoveryResearch).toHaveBeenCalledWith({
      anchor: "work",
      displayText: "Arrival",
      releaseYear: null,
    });
    expect(persistDiscoveryFunnelEvent).toHaveBeenCalledWith({
      name: "research_request_submitted",
      anchor: "work",
    });
  });

  it("silently accepts the honeypot without queuing a topic", async () => {
    const form = new FormData();
    form.set("website", "bot.example");
    const response = await action({
      request: new Request("http://test.local/watches/find", {
        method: "POST",
        body: form,
      }),
    } as Parameters<typeof action>[0]);
    expect(response.status).toBe(204);
    expect(enqueueDiscoveryResearch).not.toHaveBeenCalled();
  });

  it("verifies an original title before the actor/character step", async () => {
    process.env.PERPLEXITY_API_KEY = "provider-key";
    verifyFilmOrSeriesTitle.mockResolvedValue({
      exists: true,
      canonicalTitle: "Inception",
      releaseYear: 2010,
      sources: ["https://www.britannica.com/topic/Inception"],
    });
    const form = new FormData();
    form.set("intent", "verify_work");
    form.set("title", "Inception");
    const response = await action({
      request: new Request("http://test.local/watches/find", {
        method: "POST",
        body: form,
      }),
    } as Parameters<typeof action>[0]);
    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    expect(body).toMatchObject({
      kind: "title_verification",
      result: { exists: true, canonicalTitle: "Inception" },
    });
    expect(verifyFilmOrSeriesTitle).toHaveBeenCalledTimes(1);
    delete process.env.PERPLEXITY_API_KEY;
  });
});
