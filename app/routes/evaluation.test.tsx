import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { vi } from "vitest";

const stores = vi.hoisted(() => ({
  loadFunnelSummary: vi.fn(),
  loadDiscoveryFunnelSummary: vi.fn(),
}));

vi.mock("../domain/funnel-store.server", () => ({
  loadFunnelSummary: stores.loadFunnelSummary,
}));
vi.mock("../domain/discovery-funnel-store.server", () => ({
  loadDiscoveryFunnelSummary: stores.loadDiscoveryFunnelSummary,
}));

import EvaluationDashboard, { loader } from "./evaluation";

describe("evaluation dashboard", () => {
  it("renders aggregate discovery conversion with honest denominators", async () => {
    stores.loadFunnelSummary.mockResolvedValue({
      since: "2026-08-01T00:00:00+00:00",
      until: "2026-09-01T00:00:00+00:00",
      starts: 0,
      coreEvaluations: 0,
      refineEvaluations: 0,
      hardFilterViolations: 0,
      averageEvaluationDurationMs: null,
      providerCostUsd: 0,
      averageTopRecommendationScore: null,
      averageMeanRecommendationScore: null,
      subscriptionStatuses: {},
    });
    stores.loadDiscoveryFunnelSummary.mockResolvedValue({
      since: "2026-08-01T00:00:00+00:00",
      until: "2026-09-01T00:00:00+00:00",
      pageViews: 120,
      pageViewsBySurface: { index: 60, story: 60 },
      archetypeStarts: 40,
      archetypeCompletions: 30,
      shares: 6,
      coreHandoffs: 12,
      qualifiedRecommendations: 6,
      optIns: 2,
      outboundMarketClicks: 0,
      archetypeCompletionsByType: { quiet_custodian: 30 },
    });
    const Stub = createRoutesStub([
      { path: "/evaluation", Component: EvaluationDashboard, loader },
    ]);

    render(<Stub initialEntries={["/evaluation"]} />);

    expect(
      await screen.findByRole("heading", { name: "Discovery funnel" }),
    ).toBeInTheDocument();
    expect(screen.getByText("75.0%")).toBeInTheDocument();
    expect(screen.getByText("20.0%")).toBeInTheDocument();
    expect(screen.getByText("50.0%")).toBeInTheDocument();
    expect(screen.getAllByText("Insufficient sample").length).toBeGreaterThan(
      0,
    );
  });
});
