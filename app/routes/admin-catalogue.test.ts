import { describe, expect, it, vi } from "vitest";

const catalogue = vi.hoisted(() => ({
  catalogueClient: vi.fn(() => ({ config: {}, fetchImpl: fetch })),
  listCatalogue: vi.fn(),
  reviewCatalogueWatch: vi.fn(async () => true),
  recordCataloguePrice: vi.fn(async () => true),
}));
vi.mock("../domain/watch-catalogue.server", () => catalogue);

const auth = vi.hoisted(() => ({
  adminLogin: vi.fn(async () => "reserve_admin=signed; Path=/admin"),
  adminLogout: vi.fn(async () => null),
  isAdmin: vi.fn(async () => true),
  parseAdminConfiguration: vi.fn(() => ({ configured: true })),
}));
vi.mock("../domain/admin-auth.server", () => auth);

import { action, pageAddress } from "./admin-catalogue";

const ID = "00000000-0000-0000-0000-000000000001";

function post(url: string, fields: Record<string, string>) {
  return action({
    request: new Request(url, {
      method: "POST",
      body: new URLSearchParams(fields),
    }),
  } as Parameters<typeof action>[0]);
}

describe("pageAddress", () => {
  it("turns React Router's data address back into the page address", () => {
    expect(
      pageAddress(
        "https://thereserve.watch/admin/catalogue.data?status=pending&q=omega&_routes=routes%2Fadmin-catalogue",
      ),
    ).toBe("/admin/catalogue?status=pending&q=omega");
    expect(pageAddress("https://thereserve.watch/admin/catalogue")).toBe(
      "/admin/catalogue",
    );
  });
});

describe("admin catalogue action", () => {
  it("approves in place without redirecting to the data address", async () => {
    const result = await post(
      "https://thereserve.watch/admin/catalogue.data?status=pending&_routes=x",
      { intent: "approve", id: ID },
    );
    expect(result).not.toBeInstanceOf(Response);
    expect(catalogue.reviewCatalogueWatch).toHaveBeenCalledWith(
      expect.anything(),
      ID,
      "approved",
    );
  });

  it("redirects a sign-in to the page address, with the cookie", async () => {
    const result = await post(
      "https://thereserve.watch/admin/catalogue.data?status=price&_routes=x",
      { intent: "login", password: "correct horse battery" },
    );
    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.headers.get("Location")).toBe(
      "/admin/catalogue?status=price",
    );
    expect(response.headers.get("Set-Cookie")).toContain("reserve_admin=");
  });
});
