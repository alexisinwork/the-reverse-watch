import { expect, it, vi } from "vitest";
import { checkProduction } from "./monitor-production";
it("authenticates only the private check and fails on a dependency outage", async () => {
  const token = "test-operations-token-with-at-least-32-characters";
  const fetchImpl = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      if (
        String(input).endsWith("/health") &&
        !String(input).includes("/internal/")
      ) {
        expect(init?.headers).toBeUndefined();
        return Response.json({ status: "ok" });
      }
      expect(init?.headers).toEqual({ Authorization: `Bearer ${token}` });
      return Response.json({ status: "unavailable" }, { status: 503 });
    },
  );
  await expect(checkProduction({ token, fetchImpl })).rejects.toThrow(/503/);
});
