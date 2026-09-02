import { describe, expect, it, vi } from "vitest";

import { verifyFilmOrSeriesTitle } from "./perplexity-title-verification.server";

describe("Perplexity title verification", () => {
  it("uses Sonar structured output and returns a source-backed title", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        citations: ["https://www.britannica.com/topic/Inception"],
        choices: [
          {
            message: {
              content: JSON.stringify({
                exists: true,
                canonicalTitle: "Inception",
                releaseYear: 2010,
                sources: ["https://www.britannica.com/topic/Inception"],
              }),
            },
          },
        ],
      }),
    );
    await expect(
      verifyFilmOrSeriesTitle("Inception", { apiKey: "key", fetchImpl }),
    ).resolves.toMatchObject({ exists: true, canonicalTitle: "Inception" });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      "https://api.perplexity.ai/v1/sonar",
    );
    const requestBody = fetchImpl.mock.calls[0]?.[1]?.body;
    expect(typeof requestBody).toBe("string");
    if (typeof requestBody === "string") {
      expect(JSON.parse(requestBody)).toMatchObject({
        model: "sonar-pro",
        response_format: { type: "json_schema" },
      });
    }
  });

  it("rejects malformed or source-free provider output", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ choices: [{ message: { content: "{}" } }] }),
      );
    await expect(
      verifyFilmOrSeriesTitle("Unknown title", { apiKey: "key", fetchImpl }),
    ).rejects.toThrow();
  });
});
