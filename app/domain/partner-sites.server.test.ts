import {
  clearPartnerSiteCache,
  findSiteByPublicKey,
  findSiteBySecretKey,
  hashSecretKey,
  recordPartnerUse,
  type PartnerSite,
} from "./partner-sites.server";
import type { CatalogueClient } from "./watch-catalogue.server";

const row = {
  id: "8d2c3f4e-1a2b-4c5d-8e9f-0a1b2c3d4e5f",
  name: "Shop",
  publicKey: "pk_live_abcdefghijklmnopqrstuvwx",
  hasSecret: false,
  allowedOrigins: ["https://shop.example.com"],
  active: true,
  monthlyQuota: 100,
  theme: { accent: "#0a7cff", text: "not a colour" },
  notes: null,
  createdAt: "2026-10-04T00:00:00Z",
  updatedAt: "2026-10-04T00:00:00Z",
};

function client(respond: (name: string, body: unknown) => unknown) {
  const calls: { name: string; body: unknown }[] = [];
  const fetchImpl = (async (url: URL, init: RequestInit) => {
    const name = url.pathname.split("/").pop()!;
    const body: unknown = JSON.parse(String(init.body));
    calls.push({ name, body });
    return new Response(JSON.stringify(respond(name, body)), { status: 200 });
  }) as unknown as typeof fetch;
  return {
    calls,
    client: {
      config: { supabaseUrl: "https://db.test", serviceKey: "sb_secret_x" },
      fetchImpl,
    } satisfies CatalogueClient,
  };
}

beforeEach(() => clearPartnerSiteCache());

describe("partner site lookups", () => {
  it("finds an active site by public key, cleans its theme and caches it", async () => {
    const { client: store, calls } = client(() => row);
    const site = await findSiteByPublicKey(row.publicKey, store, 0);
    expect(site?.name).toBe("Shop");
    expect(site?.theme).toEqual({ accent: "#0a7cff" });
    await findSiteByPublicKey(row.publicKey, store, 30_000);
    expect(calls).toHaveLength(1);
    await findSiteByPublicKey(row.publicKey, store, 61_000);
    expect(calls).toHaveLength(2);
  });

  it("never looks up malformed keys and ignores switched-off sites", async () => {
    const { client: store, calls } = client(() => ({ ...row, active: false }));
    expect(await findSiteByPublicKey("pk_live_short", store)).toBeNull();
    expect(calls).toHaveLength(0);
    expect(await findSiteByPublicKey(row.publicKey, store)).toBeNull();
  });

  it("looks secret keys up by their hash only", async () => {
    const secret = `sk_live_${"b".repeat(40)}`;
    const { client: store, calls } = client(() => ({
      ...row,
      hasSecret: true,
    }));
    expect((await findSiteBySecretKey(secret, store))?.hasSecret).toBe(true);
    expect(calls[0]).toEqual({
      name: "partner_site_by_secret_v1",
      body: { p_hash: hashSecretKey(secret) },
    });
    expect(JSON.stringify(calls)).not.toContain(secret);
  });

  it("treats a database error as no site", async () => {
    const store: CatalogueClient = {
      config: { supabaseUrl: "https://db.test", serviceKey: "sb_secret_x" },
      fetchImpl: async () => new Response("down", { status: 500 }),
    };
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await findSiteByPublicKey(row.publicKey, store)).toBeNull();
  });
});

describe("partner use counting", () => {
  const site = { ...row, theme: {} } as PartnerSite;

  it("passes the database's decision through", async () => {
    const { client: store, calls } = client(() => ({
      allowed: false,
      uses: 100,
    }));
    expect(await recordPartnerUse(site, "quiz", store)).toEqual({
      allowed: false,
      uses: 100,
    });
    expect(calls[0]).toEqual({
      name: "partner_site_use_v1",
      body: { p_site: site.id, p_feature: "quiz" },
    });
  });

  it("never blocks a paying partner because counting failed", async () => {
    const store: CatalogueClient = {
      config: { supabaseUrl: "https://db.test", serviceKey: "sb_secret_x" },
      fetchImpl: async () => new Response("down", { status: 500 }),
    };
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await recordPartnerUse(site, "find", store)).toEqual({
      allowed: true,
      uses: 0,
    });
  });
});
