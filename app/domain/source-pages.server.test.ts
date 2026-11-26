import { describe, expect, it, vi } from "vitest";

import {
  inspectSourcePage,
  PLAIN_READER_AGENT,
  publicFetch,
  safeHttpUrl,
} from "./source-pages.server";

describe("safeHttpUrl", () => {
  it("keeps public http(s) addresses", () => {
    expect(safeHttpUrl("https://www.omegawatches.com/a")).toBe(
      "https://www.omegawatches.com/a",
    );
    expect(safeHttpUrl("http://example.com:443/x")).not.toBeNull();
  });

  it.each([
    "javascript:alert(1)",
    "file:///etc/passwd",
    "http://localhost:3000/",
    "http://127.0.0.1/",
    "http://10.0.0.5/",
    "http://172.16.0.1/",
    "http://192.168.1.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://metadata.google.internal/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://intranet/",
    "http://printer.local/",
    "https://example.com:8443/",
    "https://user:pass@example.com/",
  ])("refuses %s", (url) => {
    expect(safeHttpUrl(url)).toBeNull();
  });
});

describe("publicFetch", () => {
  it("follows public redirects and refuses a hop to a private address", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      if (url === "https://maker.example/a") {
        return new Response(null, {
          status: 301,
          headers: { location: "/b" },
        });
      }
      if (url === "https://maker.example/b") {
        return new Response(null, {
          status: 302,
          headers: { location: "http://169.254.169.254/latest" },
        });
      }
      return new Response("ok");
    }) as typeof fetch;

    expect(
      await publicFetch("https://maker.example/a", {}, fetchImpl),
    ).toBeNull();
    expect(calls).toEqual([
      "https://maker.example/a",
      "https://maker.example/b",
    ]);

    const ok = await publicFetch("https://maker.example/c", {}, fetchImpl);
    expect(ok?.finalUrl).toBe("https://maker.example/c");
  });

  it("reads a page again under the plain name when a server hangs up on the usual one", async () => {
    const refused = Object.assign(new TypeError("fetch failed"), {
      cause: { code: "UND_ERR_SOCKET" },
    });
    const agents: string[] = [];
    const fetchImpl = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const agent = new Headers(init?.headers).get("user-agent") ?? "";
      agents.push(agent);
      if (agent.startsWith("Mozilla/")) throw refused;
      return new Response("page");
    }) as unknown as typeof fetch;
    const page = await publicFetch(
      "https://oracleoftime.example/steve-mcqueen-watches/",
      {
        headers: {
          "user-agent":
            "Mozilla/5.0 (compatible; TheReserveBot/1.0; +https://thereserve.watch)",
        },
      },
      fetchImpl,
    );
    expect(await page?.response.text()).toBe("page");
    expect(agents).toEqual([
      "Mozilla/5.0 (compatible; TheReserveBot/1.0; +https://thereserve.watch)",
      PLAIN_READER_AGENT,
    ]);
    // A request already under the plain name, or another failure, is not
    // tried again.
    const failing = vi.fn(async () => {
      throw refused;
    }) as unknown as typeof fetch;
    await expect(
      publicFetch(
        "https://oracleoftime.example/a",
        { headers: { "user-agent": PLAIN_READER_AGENT } },
        failing,
      ),
    ).rejects.toThrow("fetch failed");
    expect(failing).toHaveBeenCalledOnce();
    const timedOut = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    await expect(
      publicFetch(
        "https://oracleoftime.example/b",
        { headers: { "user-agent": "Mozilla/5.0" } },
        timedOut,
      ),
    ).rejects.toThrow("fetch failed");
    expect(timedOut).toHaveBeenCalledOnce();
  });
});

describe("inspectSourcePage", () => {
  const url = "https://www.archimede-watches.com/sporttaucher-ua300-st-bl.html";
  const answer = (status: number) => async () =>
    new Response("<html></html>", { status });

  it("never confirms a reference from a page that does not exist", async () => {
    for (const status of [404, 410, 500]) {
      const page = await inspectSourcePage(url, "UA300-ST-BL", answer(status));
      expect(page).toMatchObject({ reachable: false, referenceFound: false });
    }
  });

  it("accepts the reference in the URL only when the maker blocks automated visitors", async () => {
    const page = await inspectSourcePage(url, "UA300-ST-BL", answer(403));
    expect(page).toMatchObject({ reachable: false, referenceFound: true });
  });
});
