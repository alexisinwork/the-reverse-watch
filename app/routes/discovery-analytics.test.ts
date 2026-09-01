import { vi } from "vitest";

const { persistDiscoveryFunnelEvent } = vi.hoisted(() => ({
  persistDiscoveryFunnelEvent: vi.fn(),
}));

vi.mock("../domain/discovery-funnel-store.server", () => ({
  persistDiscoveryFunnelEvent,
}));

import { action } from "./discovery-analytics";

function request(body: unknown, method = "POST") {
  return new Request("http://test.local/analytics/discovery", {
    method,
    headers: { "content-type": "application/json" },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

describe("discovery analytics endpoint", () => {
  beforeEach(() => persistDiscoveryFunnelEvent.mockReset());

  it("persists a validated aggregate event", async () => {
    persistDiscoveryFunnelEvent.mockResolvedValue(true);
    const response = await action({
      request: request({ name: "page_view", surface: "work" }),
    });

    expect(response.status).toBe(204);
    expect(persistDiscoveryFunnelEvent).toHaveBeenCalledWith({
      name: "page_view",
      surface: "work",
    });
  });

  it("rejects unknown fields and methods before persistence", async () => {
    const invalid = await action({
      request: request({ name: "page_view", surface: "story", url: "/secret" }),
    });
    const wrongMethod = await action({
      request: request(null, "GET"),
    });

    expect(invalid.status).toBe(400);
    expect(wrongMethod.status).toBe(405);
    expect(persistDiscoveryFunnelEvent).not.toHaveBeenCalled();
  });
});
