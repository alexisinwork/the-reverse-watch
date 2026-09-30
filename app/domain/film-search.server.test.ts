import { describe, expect, it, vi } from "vitest";

import type { Deps } from "./ai-providers.server";
import { searchFilmWatches } from "./film-search.server";

function sonar(sightings: object[]) {
  return Response.json({
    choices: [{ message: { content: JSON.stringify({ sightings }) } }],
  });
}

function deps(answer: (prompt: string) => object[]): Partial<Deps> {
  return {
    config: {
      museSpark: {
        apiKey: "m",
        baseUrl: "https://muse.test/v1/",
        fastModel: "f",
      },
      perplexity: { apiKey: "p", model: "sonar" },
      webSearch: "perplexity",
    },
    fetchImpl: async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url === "https://api.perplexity.ai/chat/completions") {
        const prompt = (
          JSON.parse(String(init?.body)) as {
            messages: { content: string }[];
          }
        ).messages[0]!.content;
        return sonar(answer(prompt));
      }
      if (url.startsWith("https://muse.test")) {
        throw new Error("The ranker must not run for the cast fallback.");
      }
      return new Response("", { status: 404 });
    },
    sleep: async () => undefined,
  };
}

const hanks = {
  brand: "Omega",
  model: "Speedmaster Professional",
  referenceCode: "310.30.42.50.01.001",
  person: "Tom Hanks",
  work: "null",
  year: null,
  context: "Worn in public.",
  evidenceUrl: "https://www.fratellowatches.com/tom-hanks-speedmaster",
  manufacturerUrl: null,
};

describe("searchFilmWatches cast fallback", () => {
  it("shows the lead cast's documented watches when none is documented on screen", async () => {
    const report = vi.fn();
    const result = await searchFilmWatches("The Green Mile", {
      ...deps((prompt) =>
        prompt.includes("lead actors")
          ? [
              hanks,
              {
                ...hanks,
                brand: "Westclox",
                model: "Big Ben alarm clock",
                referenceCode: null,
              },
            ]
          : [],
      ),
      report,
    });

    expect(result).toMatchObject({ status: "found" });
    if (result.status !== "found") throw new Error("expected watches");
    expect(result.summary).toContain("wear off screen");
    expect(result.watches.map((watch) => watch.brand)).toEqual(["Omega"]);
    expect(result.watches[0]!.details.work).toBeNull();
    expect(report).toHaveBeenCalledWith({
      text: expect.stringContaining("lead actors wear off screen") as string,
    });
  });

  it("says so when neither the film nor its cast has documented watches", async () => {
    const result = await searchFilmWatches(
      "Obscure Film",
      deps(() => []),
    );
    expect(result).toMatchObject({ status: "no_match" });
  });

  it("fails rather than reporting no watches when the cast searches all fail", async () => {
    const base = deps(() => []);
    await expect(
      searchFilmWatches("Busy Film", {
        ...base,
        fetchImpl: async (input, init) => {
          const body = String(init?.body ?? "");
          // The film questions answer "nothing"; every cast question errors.
          if (body.includes("lead actors")) {
            return new Response("rate limited", { status: 503 });
          }
          return base.fetchImpl!(input, init);
        },
      }),
    ).rejects.toThrow("Every cast search failed.");
  });
});
