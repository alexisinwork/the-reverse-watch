import { describe, expect, it } from "vitest";

import {
  NO_STORE,
  PUBLIC_PAGE_CACHE_CONTROL,
  publicPageHeaders,
} from "./cache-policy";

describe("publicPageHeaders", () => {
  it("lets the CDN cache a public page while browsers revalidate", () => {
    const headers = publicPageHeaders({ parentHeaders: new Headers() });
    expect(headers.get("Cache-Control")).toBe(PUBLIC_PAGE_CACHE_CONTROL);
    expect(PUBLIC_PAGE_CACHE_CONTROL).toContain("max-age=0");
    expect(PUBLIC_PAGE_CACHE_CONTROL).toContain("s-maxage=");
  });

  it("keeps a partner widget page private so each view is counted", () => {
    const parentHeaders = new Headers({
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    });
    const headers = publicPageHeaders({ parentHeaders });
    expect(headers.get("Cache-Control")).toBe("private, no-store");
    expect(headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });

  it("never caches a missing page or a failed read", () => {
    const headers = publicPageHeaders({
      parentHeaders: new Headers(),
      errorHeaders: new Headers(),
    });
    expect(headers.get("Cache-Control")).toBe(NO_STORE);
  });
});
