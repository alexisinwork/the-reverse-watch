import { loader } from "./health";

describe("health route", () => {
  it("returns a non-cacheable service status", async () => {
    const response = loader();
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toMatchObject({
      status: "ok",
      service: "the-reserve-web",
    });
    expect(body.timestamp).toEqual(expect.any(String));
  });
});
