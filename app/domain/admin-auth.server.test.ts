import { describe, expect, it } from "vitest";

import {
  adminLogin,
  isAdmin,
  parseAdminConfiguration,
} from "./admin-auth.server";

const env = {
  NODE_ENV: "test",
  SESSION_SECRET: "a-test-secret-that-is-longer-than-thirty-two-characters",
  ADMIN_PASSWORD: "correct horse battery",
};

function request(cookie: string | null) {
  return new Request(
    "http://test.local/admin/catalogue",
    cookie ? { headers: { Cookie: cookie.split(";", 1)[0]! } } : {},
  );
}

describe("admin auth", () => {
  it("is off without a long enough password", () => {
    expect(
      parseAdminConfiguration({ ...env, ADMIN_PASSWORD: "short" }).configured,
    ).toBe(false);
    expect(
      parseAdminConfiguration({ ...env, ADMIN_PASSWORD: undefined }).configured,
    ).toBe(false);
  });

  it("signs in with the right password only", async () => {
    expect(await adminLogin("wrong password!!", env)).toBeNull();
    const cookie = await adminLogin("correct horse battery", env);
    expect(cookie).toContain("reserve_admin=");
    expect(await isAdmin(request(cookie), env)).toBe(true);
    expect(await isAdmin(request(null), env)).toBe(false);
  });

  it("expires and rejects a cookie signed with another secret", async () => {
    const cookie = await adminLogin("correct horse battery", env, 0);
    expect(await isAdmin(request(cookie), env)).toBe(false);
    const fresh = await adminLogin("correct horse battery", env);
    expect(
      await isAdmin(request(fresh), {
        ...env,
        SESSION_SECRET: "another-secret-that-is-longer-than-thirty-two-chars",
      }),
    ).toBe(false);
  });
});
