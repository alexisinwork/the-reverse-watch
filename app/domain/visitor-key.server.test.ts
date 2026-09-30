import { isSameOrigin, visitorKey } from "./visitor-key.server";

const request = (headers: Record<string, string>) =>
  new Request("https://thereserve.watch/analytics/discovery", {
    method: "POST",
    headers,
  });

describe("visitor key", () => {
  it("hashes the address, so no IP address is kept", () => {
    const key = visitorKey(
      "analytics",
      request({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }),
    );
    expect(key).toMatch(/^analytics:[0-9a-f]{64}$/);
    expect(key).not.toContain("203.0.113.7");
    expect(key).toBe(
      visitorKey("analytics", request({ "x-real-ip": "203.0.113.7" })),
    );
  });

  it("rejects requests another website's page sends", () => {
    expect(isSameOrigin(request({}))).toBe(true);
    expect(isSameOrigin(request({ Origin: "https://thereserve.watch" }))).toBe(
      true,
    );
    expect(isSameOrigin(request({ Origin: "https://evil.example" }))).toBe(
      false,
    );
  });
});
