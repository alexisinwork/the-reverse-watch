import { describe, expect, it } from "vitest";

import { publicFetch, safeHttpUrl } from "./source-pages.server";

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
});
