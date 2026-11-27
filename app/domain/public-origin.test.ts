import { describe, expect, it } from "vitest";

import { isLocalHostname, publicOrigin } from "./public-origin";

const on = (url: string) => new Request(url);

describe("publicOrigin", () => {
  it("uses APP_URL's origin when it is a public https address", () => {
    expect(
      publicOrigin(
        on("https://the-reverse-watch.vercel.app/partners"),
        "https://thereserve.watch/",
      ),
    ).toBe("https://thereserve.watch");
  });

  it("never gives a public visitor a local or http:// APP_URL", () => {
    const visitor = on("https://thereserve.watch/embed/pk/quiz");
    expect(publicOrigin(visitor, "http://localhost:5173")).toBe(
      "https://thereserve.watch",
    );
    expect(publicOrigin(visitor, "https://127.0.0.1:5173")).toBe(
      "https://thereserve.watch",
    );
    expect(publicOrigin(visitor, "http://thereserve.watch")).toBe(
      "https://thereserve.watch",
    );
  });

  it("keeps a local APP_URL while the request itself is local", () => {
    expect(
      publicOrigin(
        on("http://localhost:5173/partners"),
        "http://localhost:5173",
      ),
    ).toBe("http://localhost:5173");
  });

  it("falls back to the request's origin when APP_URL is missing or invalid", () => {
    const visitor = on("https://thereserve.watch/partners");
    expect(publicOrigin(visitor, undefined)).toBe("https://thereserve.watch");
    expect(publicOrigin(visitor, "  ")).toBe("https://thereserve.watch");
    expect(publicOrigin(visitor, "not a url")).toBe("https://thereserve.watch");
    expect(publicOrigin(visitor, "ftp://thereserve.watch")).toBe(
      "https://thereserve.watch",
    );
  });
});

describe("isLocalHostname", () => {
  it("knows the local names", () => {
    for (const host of ["localhost", "app.localhost", "127.0.0.1", "[::1]"])
      expect(isLocalHostname(host)).toBe(true);
    for (const host of ["thereserve.watch", "localhost.example.com"])
      expect(isLocalHostname(host)).toBe(false);
  });
});
