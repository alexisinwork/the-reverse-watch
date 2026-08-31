import { vi } from "vitest";

const { persistFunnelEvent } = vi.hoisted(() => ({
  persistFunnelEvent: vi.fn(),
}));

vi.mock("./funnel-store.server", () => ({ persistFunnelEvent }));

import { recordQuizAnalyticsEvent } from "./analytics.server";

describe("quiz analytics contract", () => {
  beforeEach(() => persistFunnelEvent.mockReset());
  it("emits only aggregate funnel fields", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await recordQuizAnalyticsEvent({
      name: "evaluation",
      intent: "core",
      catalogueOrigin: "supabase",
      recommendationCount: 3,
      verificationCount: 2,
      whyNotCount: 4,
      hardFilterViolationCount: 0,
      evaluationDurationMs: 12.34,
      providerCostUsd: 0,
    });

    expect(info).toHaveBeenCalledWith(
      JSON.stringify({
        event: "quiz_funnel",
        name: "evaluation",
        intent: "core",
        catalogueOrigin: "supabase",
        recommendationCount: 3,
        verificationCount: 2,
        whyNotCount: 4,
        hardFilterViolationCount: 0,
        evaluationDurationMs: 12.34,
        providerCostUsd: 0,
      }),
    );
    expect(info.mock.calls[0]?.[0]).not.toContain("email");
    info.mockRestore();
  });

  it("rejects unrecognized fields before logging", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await expect(
      recordQuizAnalyticsEvent({
        name: "subscription",
        intent: "core",
        catalogueOrigin: "supabase",
        status: "sent",
        email: "reader@example.com",
      } as never),
    ).rejects.toThrow();
    expect(info).not.toHaveBeenCalled();
    info.mockRestore();
  });

  it("accepts partial channel delivery as a measured status", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await recordQuizAnalyticsEvent({
      name: "subscription",
      intent: "refine",
      catalogueOrigin: "bundled_seed",
      status: "partial",
    });

    expect(info).toHaveBeenCalledOnce();
    info.mockRestore();
  });

  it("forwards only validated aggregates to the durable event store", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const event = {
      name: "evaluation" as const,
      intent: "refine" as const,
      catalogueOrigin: "supabase" as const,
      recommendationCount: 2,
      hardFilterViolationCount: 0,
      topRecommendationScore: 8.5,
    };
    await recordQuizAnalyticsEvent(event);

    expect(persistFunnelEvent).toHaveBeenCalledWith(event);
    info.mockRestore();
  });
});
