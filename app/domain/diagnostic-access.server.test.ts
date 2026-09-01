import {
  hasDiagnosticAccess,
  issueDiagnosticAccessCookie,
  parseDiagnosticAccessConfiguration,
} from "./diagnostic-access.server";

const environment = {
  NODE_ENV: "test",
  SESSION_SECRET: "a-test-secret-that-is-longer-than-thirty-two-characters",
};

describe("subscriber diagnostic access", () => {
  it("fails closed when the signing secret is missing or unsafe", () => {
    expect(parseDiagnosticAccessConfiguration({})).toEqual({
      configured: false,
      reason: "missing",
    });
    expect(
      parseDiagnosticAccessConfiguration({ SESSION_SECRET: "too-short" }),
    ).toEqual({ configured: false, reason: "invalid" });
  });

  it("accepts an unexpired server-signed grant", async () => {
    const configuration = parseDiagnosticAccessConfiguration(environment);
    if (!configuration.configured) throw new Error("Expected configuration");
    const setCookie = await issueDiagnosticAccessCookie(configuration, 1_000);
    const [cookie] = setCookie.split(";", 1);
    if (!cookie) throw new Error("Expected access cookie");
    const request = new Request("http://test.local/quiz", {
      headers: { Cookie: cookie },
    });

    await expect(
      hasDiagnosticAccess(request, environment, 2_000),
    ).resolves.toBe(true);
  });

  it("rejects missing, tampered, and expired grants", async () => {
    const configuration = parseDiagnosticAccessConfiguration(environment);
    if (!configuration.configured) throw new Error("Expected configuration");
    const setCookie = await issueDiagnosticAccessCookie(configuration, 1_000);
    const [cookie] = setCookie.split(";", 1);
    if (!cookie) throw new Error("Expected access cookie");

    await expect(
      hasDiagnosticAccess(new Request("http://test.local/quiz"), environment),
    ).resolves.toBe(false);
    await expect(
      hasDiagnosticAccess(
        new Request("http://test.local/quiz", {
          headers: { Cookie: `${cookie}tampered` },
        }),
        environment,
      ),
    ).resolves.toBe(false);
    await expect(
      hasDiagnosticAccess(
        new Request("http://test.local/quiz", { headers: { Cookie: cookie } }),
        environment,
        1_000 + 60 * 60 * 24 * 180 * 1_000,
      ),
    ).resolves.toBe(false);
  });
});
