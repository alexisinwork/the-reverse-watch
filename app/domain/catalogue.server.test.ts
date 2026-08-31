import {
  createCatalogueLoader,
  createRecommendationDataLoader,
  SUPABASE_CATALOGUE_RPC,
  SUPABASE_HARD_FILTER_RPC,
} from "./catalogue.server";
import type { QuestionnaireProfile } from "./questionnaire";
import { QUESTIONNAIRE_VERSION } from "./questionnaire";
import { seedCatalogue } from "./seed-catalogue";

const configuredEnv = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
};

const profile: QuestionnaireProfile = {
  core: {
    version: QUESTIONNAIRE_VERSION,
    budgetCurrency: "USD",
    budgetMax: 4_000,
    wristCircumferenceMm: 170,
    deploymentEnvironment: "field_water_abuse",
    ownershipFriction: "zero_maintenance",
    accuracyTolerance: "seconds_per_month",
    weightLimit: "under_160_g",
    requiredComplications: ["gmt"],
    datePreference: "required",
  },
};

describe("server catalogue loader", () => {
  it("targets the applicability-aware v3 RPC pair", () => {
    expect(SUPABASE_CATALOGUE_RPC).toBe("recommendation_catalogue_v3");
    expect(SUPABASE_HARD_FILTER_RPC).toBe("recommendation_hard_filter_v3");
  });

  it("uses and caches a strictly validated Supabase catalogue", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(seedCatalogue), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const load = createCatalogueLoader({
      env: configuredEnv,
      fetchImpl,
      now: () => 1_000,
    });

    const first = await load();
    const second = await load();

    expect(first.origin).toBe("supabase");
    expect(first.catalogue.variants).toHaveLength(24);
    expect(second.origin).toBe("supabase");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const catalogueRequest = fetchImpl.mock.calls[0]?.[0];
    expect(catalogueRequest).toBeInstanceOf(URL);
    expect((catalogueRequest as URL).pathname).toBe(
      `/rest/v1/rpc/${SUPABASE_CATALOGUE_RPC}`,
    );
  });

  it("falls back visibly when configuration is absent", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const load = createCatalogueLoader({ env: {}, fetchImpl });

    const result = await load();

    expect(result.origin).toBe("bundled_seed");
    expect(result.notice).toMatch(/not configured/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails closed to the reviewed snapshot when the RPC shape is invalid", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ variants: [] })));
    const load = createCatalogueLoader({
      env: configuredEnv,
      fetchImpl,
    });

    const result = await load();

    expect(result.origin).toBe("bundled_seed");
    expect(result.notice).toMatch(/validation failed/i);
  });

  it("loads a complete PostgreSQL hard-filter partition for recommendations", async () => {
    const hardFilterEvaluation = Object.fromEntries(
      seedCatalogue.variants.map((variant) => [
        variant.id,
        { hardReasons: [], missingFacts: [] },
      ]),
    );
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(seedCatalogue), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(hardFilterEvaluation), { status: 200 }),
      );
    const load = createRecommendationDataLoader({
      env: configuredEnv,
      fetchImpl,
    });

    const result = await load(profile, "2026-08-28T20:00:00Z");

    expect(result.origin).toBe("supabase");
    expect(result.hardFilterEvaluation).toEqual(hardFilterEvaluation);
    expect(result.notice).toMatch(/hard-filter decisions/i);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const hardFilterRequest = fetchImpl.mock.calls[1]?.[0];
    expect(hardFilterRequest).toBeInstanceOf(URL);
    expect((hardFilterRequest as URL).pathname).toBe(
      `/rest/v1/rpc/${SUPABASE_HARD_FILTER_RPC}`,
    );
    expect(fetchImpl.mock.calls[1]?.[1]?.body).toContain("p_profile");
  });

  it("falls back as one unit when the SQL partition is incomplete", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(seedCatalogue), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            "grand-seiko-sbgn029": { hardReasons: [], missingFacts: [] },
          }),
          { status: 200 },
        ),
      );
    const load = createRecommendationDataLoader({
      env: configuredEnv,
      fetchImpl,
    });

    const result = await load(profile, "2026-08-28T20:00:00Z");

    expect(result.origin).toBe("bundled_seed");
    expect(result.hardFilterEvaluation).toBeUndefined();
    expect(result.notice).toMatch(/hard-filter validation failed/i);
  });
});
