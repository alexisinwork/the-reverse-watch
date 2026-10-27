import { describe, expect, it, vi } from "vitest";
import type { FoundWatch } from "./ai-watch-types";
import { inspectCachedResultSource } from "./cached-result-source-check.server";

const watch: FoundWatch = {
  brand: "Omega",
  model: "Aqua Terra",
  referenceCode: "231.10.39.21.03.001",
  sourceUrl: "https://example.com",
  imageUrl: null,
  priceNote: null,
  rationale: "",
  details: { person: "Daniel Craig", work: "Skyfall" },
};
function response(body: string, status = 200, contentType = "text/html") {
  return vi.fn(
    async () =>
      new Response(body, { status, headers: { "content-type": contentType } }),
  ) as unknown as typeof fetch;
}

describe("checking source pages for cached watch claims", () => {
  it("finds the exact reference, brand, wearer and film in page text", async () => {
    const html =
      "<p>Daniel Craig wore Omega 231.10.39.21.03.001 in Skyfall.</p>";
    expect(
      await inspectCachedResultSource(
        watch,
        "https://source.example/a",
        response(html),
      ),
    ).toEqual({ status: "matched", finalUrl: "https://source.example/a" });
  });

  it("does not treat a reference appearing only in a URL or script as page evidence", async () => {
    const html =
      "<script>Omega 231.10.39.21.03.001 Daniel Craig Skyfall</script><p>Unrelated.</p>";
    expect(
      (
        await inspectCachedResultSource(
          watch,
          "https://source.example/231.10.39.21.03.001",
          response(html),
        )
      ).status,
    ).toBe("missing");
  });

  it("does not treat another wearer, a different reference, or an HTTP failure as confirmation", async () => {
    const wrongWearer = "Omega 231.10.39.21.03.001 Naomie Harris Skyfall";
    const wrongRef = "Omega 231.10.39.21.03.001X Daniel Craig Skyfall";
    expect(
      (
        await inspectCachedResultSource(
          watch,
          "https://source.example",
          response(wrongWearer),
        )
      ).status,
    ).toBe("missing");
    expect(
      (
        await inspectCachedResultSource(
          watch,
          "https://source.example",
          response(wrongRef),
        )
      ).status,
    ).toBe("missing");
    expect(
      (
        await inspectCachedResultSource(
          watch,
          "https://source.example",
          response("", 403),
        )
      ).status,
    ).toBe("unavailable");
    expect(
      (
        await inspectCachedResultSource(
          watch,
          "https://source.example",
          response("", 200, "image/jpeg"),
        )
      ).status,
    ).toBe("unavailable");
  });

  it("refuses private-address redirects", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "http://127.0.0.1/admin" },
        }),
    ) as unknown as typeof fetch;
    expect(
      (
        await inspectCachedResultSource(
          watch,
          "https://source.example",
          fetchImpl,
        )
      ).status,
    ).toBe("unavailable");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
