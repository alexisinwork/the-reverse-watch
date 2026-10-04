import { vi } from "vitest";

const sites = vi.hoisted(() => ({
  findSiteByPublicKey: vi.fn(),
  findSiteBySecretKey: vi.fn(),
}));
vi.mock("./partner-sites.server", () => sites);

import type { ProgressLink } from "./ai-watch-types";
import {
  apiPreflight,
  apiStream,
  authenticateApiRequest,
  type ApiCaller,
} from "./partner-api.server";

const site = {
  id: "8d2c3f4e-1a2b-4c5d-8e9f-0a1b2c3d4e5f",
  name: "Shop",
  publicKey: "pk_live_abcdefghijklmnopqrstuvwx",
  hasSecret: true,
  allowedOrigins: ["https://shop.example.com"],
  active: true,
  monthlyQuota: null,
  theme: {},
  notes: null,
  createdAt: "2026-10-04T00:00:00Z",
  updatedAt: "2026-10-04T00:00:00Z",
};

const secret = `sk_live_${"a".repeat(40)}`;

beforeEach(() => {
  sites.findSiteByPublicKey.mockReset();
  sites.findSiteBySecretKey.mockReset();
});

async function errorCode(result: ApiCaller | Response) {
  expect(result).toBeInstanceOf(Response);
  const response = result as Response;
  const body = (await response.json()) as { error: { code: string } };
  return [response.status, body.error.code];
}

describe("partner API keys", () => {
  it("accepts a secret key from a server", async () => {
    sites.findSiteBySecretKey.mockResolvedValue(site);
    const caller = await authenticateApiRequest(
      new Request("https://thereserve.watch/api/v1/stories", {
        headers: { Authorization: `Bearer ${secret}` },
      }),
    );
    expect(caller).toEqual({ site, via: "server", origin: null });
    expect(sites.findSiteBySecretKey).toHaveBeenCalledWith(secret);
  });

  it("refuses a secret key sent from a browser, without looking it up", async () => {
    const result = await authenticateApiRequest(
      new Request("https://thereserve.watch/api/v1/stories", {
        headers: {
          Authorization: `Bearer ${secret}`,
          Origin: "https://shop.example.com",
        },
      }),
    );
    expect(await errorCode(result)).toEqual([400, "secret_key_in_browser"]);
    expect(sites.findSiteBySecretKey).not.toHaveBeenCalled();
  });

  it("accepts a public key only from a registered website", async () => {
    sites.findSiteByPublicKey.mockResolvedValue(site);
    const request = (origin?: string) =>
      new Request(
        `https://thereserve.watch/api/v1/find?key=${site.publicKey}`,
        { headers: origin ? { Origin: origin } : {} },
      );

    expect(
      await authenticateApiRequest(request("https://shop.example.com")),
    ).toEqual({ site, via: "browser", origin: "https://shop.example.com" });
    expect(
      await errorCode(
        await authenticateApiRequest(request("https://evil.example")),
      ),
    ).toEqual([403, "origin_not_allowed"]);
    // Copying the public key into curl does not work either.
    expect(await errorCode(await authenticateApiRequest(request()))).toEqual([
      403,
      "origin_not_allowed",
    ]);
  });

  it("answers unknown and missing keys with 401", async () => {
    sites.findSiteByPublicKey.mockResolvedValue(null);
    expect(
      await errorCode(
        await authenticateApiRequest(
          new Request("https://thereserve.watch/api/v1/find", {
            headers: { "X-Reserve-Key": "pk_live_nope" },
          }),
        ),
      ),
    ).toEqual([401, "invalid_key"]);
    expect(
      await errorCode(
        await authenticateApiRequest(
          new Request("https://thereserve.watch/api/v1/find"),
        ),
      ),
    ).toEqual([401, "missing_key"]);
  });

  it("answers browser preflights for the asking website", () => {
    const response = apiPreflight(
      new Request("https://thereserve.watch/api/v1/quiz", {
        method: "OPTIONS",
        headers: { Origin: "https://shop.example.com" },
      }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://shop.example.com",
    );
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain(
      "X-Reserve-Key",
    );
  });
});

describe("partner API stream", () => {
  it("sends each search step, then the result", async () => {
    const last: ProgressLink = {
      event: { text: "Confirming references…" },
      next: Promise.resolve(null),
    };
    const first: ProgressLink = {
      event: { text: "Checking the catalogue…" },
      next: Promise.resolve(last),
    };
    const response = apiStream(
      Promise.resolve(first),
      Promise.resolve({ status: "no_match", summary: "None." }),
      "https://shop.example.com",
      (result) => ({ result }),
    );
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://shop.example.com",
    );
    expect(await response.text()).toBe(
      [
        'event: progress\ndata: {"text":"Checking the catalogue…"}\n\n',
        'event: progress\ndata: {"text":"Confirming references…"}\n\n',
        'event: result\ndata: {"result":{"status":"no_match","summary":"None."}}\n\n',
      ].join(""),
    );
  });

  it("ends with an unavailable result when the search fails", async () => {
    const response = apiStream(
      Promise.resolve(null),
      Promise.reject(new Error("provider down")),
      null,
    );
    expect(await response.text()).toBe(
      'event: result\ndata: {"result":{"status":"unavailable"}}\n\n',
    );
  });
});
