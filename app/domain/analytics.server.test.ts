import { vi } from "vitest";

import { recordQuizAnalyticsEvent } from "./analytics.server";

describe("quiz analytics contract", () => {
  it("emits only aggregate funnel fields", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    recordQuizAnalyticsEvent({
      name: "evaluation",
      intent: "core",
      catalogueOrigin: "supabase",
      recommendationCount: 3,
      verificationCount: 2,
      whyNotCount: 4,
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
      }),
    );
    expect(info.mock.calls[0]?.[0]).not.toContain("email");
    info.mockRestore();
  });

  it("rejects unrecognized fields before logging", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    expect(() =>
      recordQuizAnalyticsEvent({
        name: "subscription",
        intent: "core",
        catalogueOrigin: "supabase",
        status: "sent",
        email: "reader@example.com",
      } as never),
    ).toThrow();
    expect(info).not.toHaveBeenCalled();
    info.mockRestore();
  });
});
