import { describe, expect, it, vi } from "vitest";
import { defaultDeps } from "./ai-providers.server";
import { meteredSearchOptions } from "./validation-runtime.server";

describe("visitor validation runtime", () => {
  it("does not reserve or call a provider when the visitor rate limit rejects research", async () => {
    const fetchImpl = vi.fn();
    const options = meteredSearchOptions({
      client: {
        config: { supabaseUrl: "https://db.example", serviceKey: "test" },
        fetchImpl,
      },
      deps: defaultDeps({
        config: {
          webSearch: "perplexity",
          perplexity: { apiKey: "test", model: "unused" },
          museSpark: {
            apiKey: "test",
            baseUrl: "https://muse.example/v1/",
            fastModel: "muse-spark-1.2-contributor",
          },
        },
        fetchImpl,
      }),
      allowPaid: async () => false,
    });
    expect(await options.validateDraft?.("a".repeat(64), [])).toEqual({
      status: "unavailable",
      reason: "retry_later",
    });
    expect(
      await options.validateMissingFilm?.("a".repeat(64), {
        query: "Daniel Craig",
        kind: "actor",
      }),
    ).toEqual({ status: "unavailable", reason: "retry_later" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("keeps cache reads available when either provider is not configured", () => {
    expect(meteredSearchOptions({ client: null })).toEqual({});
  });
});
