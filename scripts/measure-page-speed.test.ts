import { describe, expect, it } from "vitest";

import {
  functionRegionFrom,
  measurePaths,
  median,
  summarize,
} from "./measure-page-speed";

describe("measure-page-speed", () => {
  it("reads the function region from x-vercel-id", () => {
    expect(functionRegionFrom("arn1::iad1::hf7m7-1795636220985")).toBe("iad1");
    expect(functionRegionFrom("fra1::fra1::abc-1")).toBe("fra1");
    expect(functionRegionFrom(null)).toBeNull();
    expect(functionRegionFrom("no-separator")).toBeNull();
  });

  it("takes the median of odd and even samples", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBe(0);
  });

  it("counts cache results and keeps the slowest first byte", () => {
    const summary = summarize("/watches", [
      {
        firstByteMs: 100,
        totalMs: 120,
        status: 200,
        cache: "MISS",
        cacheControl: "public, max-age=0, must-revalidate",
        functionRegion: "iad1",
      },
      {
        firstByteMs: 20,
        totalMs: 25,
        status: 200,
        cache: "HIT",
        cacheControl: "public, max-age=0, must-revalidate",
        functionRegion: null,
      },
    ]);
    expect(summary.cacheResults).toEqual({ MISS: 1, HIT: 1 });
    expect(summary.slowestFirstByteMs).toBe(100);
    expect(summary.functionRegion).toBe("iad1");
    expect(summary.statuses).toEqual([200]);
  });

  it("sends only GET requests and reads every body", async () => {
    const methods: string[] = [];
    const fakeFetch: typeof fetch = (_input, init) => {
      methods.push(init?.method ?? "GET");
      return Promise.resolve(
        new Response("ok", {
          headers: { "x-vercel-cache": "HIT", "x-vercel-id": "fra1::fra1::x" },
        }),
      );
    };
    const results = await measurePaths({
      baseUrl: "https://example.test",
      paths: ["/a", "/b"],
      runs: 2,
      fetchImpl: fakeFetch,
    });
    expect(methods).toEqual(["GET", "GET", "GET", "GET"]);
    expect(results.map((result) => result.cacheResults)).toEqual([
      { HIT: 2 },
      { HIT: 2 },
    ]);
  });
});
