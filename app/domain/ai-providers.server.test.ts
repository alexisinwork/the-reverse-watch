import { vi } from "vitest";

import {
  defaultDeps,
  fallbackSearchDeps,
  findPages,
  webResearchJson,
  type AiWatchFinderConfig,
} from "./ai-providers.server";

const both: AiWatchFinderConfig = {
  webSearch: "perplexity",
  museSpark: {
    apiKey: "muse-key",
    baseUrl: "https://muse.test/v1/",
    fastModel: "muse-fast",
  },
  perplexity: { apiKey: "pplx-key", model: "sonar" },
};

const museAnswer = (text: string) =>
  Response.json({
    output: [{ type: "message", content: [{ type: "output_text", text }] }],
  });

const sonarAnswer = (content: string) =>
  Response.json({ choices: [{ message: { content } }] });

function depsWith(
  config: AiWatchFinderConfig,
  fetchImpl: (url: string) => Promise<Response>,
) {
  return defaultDeps({
    config,
    fetchImpl: vi.fn((input: RequestInfo | URL) =>
      fetchImpl(String(input)),
    ) as unknown as typeof fetch,
    sleep: () => Promise.resolve(),
  });
}

describe("web search fallback", () => {
  it("switches to the other provider only when its key is set", () => {
    const deps = depsWith(both, () => Promise.reject(new Error("unused")));
    expect(fallbackSearchDeps(deps)?.config.webSearch).toBe("muse");
    expect(
      fallbackSearchDeps(
        depsWith({ ...both, webSearch: "muse" }, () =>
          Promise.reject(new Error("unused")),
        ),
      )?.config.webSearch,
    ).toBe("perplexity");
    expect(
      fallbackSearchDeps(
        depsWith({ ...both, museSpark: null }, () =>
          Promise.reject(new Error("unused")),
        ),
      ),
    ).toBeNull();
  });

  it("answers from Muse when Perplexity is down", async () => {
    const calls: string[] = [];
    const deps = depsWith(both, (url) => {
      calls.push(url);
      return Promise.resolve(
        url.includes("perplexity")
          ? new Response("upstream error", { status: 503 })
          : museAnswer('{"sightings":[]}'),
      );
    });
    await expect(
      webResearchJson("question", { type: "object" }, deps),
    ).resolves.toEqual({ sightings: [] });
    expect(calls).toEqual([
      "https://api.perplexity.ai/chat/completions",
      "https://muse.test/v1/responses",
    ]);
  });

  it("answers from Perplexity when Muse is the chosen provider and fails", async () => {
    const deps = depsWith({ ...both, webSearch: "muse" }, (url) =>
      url.includes("muse.test")
        ? Promise.reject(new Error("The operation timed out."))
        : Promise.resolve(sonarAnswer('{"sightings":[1]}')),
    );
    await expect(
      webResearchJson("question", { type: "object" }, deps),
    ).resolves.toEqual({ sightings: [1] });
  });

  it("finds pages through Muse when the Perplexity Search API fails", async () => {
    const deps = depsWith(both, (url) =>
      Promise.resolve(
        url.includes("perplexity")
          ? new Response("quota", { status: 401 })
          : museAnswer(
              '{"pages":[{"url":"https://www.omegawatches.com/watch-omega-seamaster","title":"Seamaster","reference":"210.30.42.20.03.001"}]}',
            ),
      ),
    );
    await expect(findPages(["Omega Seamaster"], deps)).resolves.toEqual([
      {
        url: "https://www.omegawatches.com/watch-omega-seamaster",
        title: "Seamaster",
        snippet: "210.30.42.20.03.001",
      },
    ]);
  });

  it("reports the failure when both providers fail", async () => {
    const deps = depsWith(both, () =>
      Promise.resolve(new Response("down", { status: 500 })),
    );
    await expect(
      webResearchJson("question", { type: "object" }, deps),
    ).rejects.toThrow("Muse Spark web research returned 500");
  });
});
