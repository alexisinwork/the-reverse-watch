import { describe, expect, it, vi } from "vitest";

import { BUNDLED_VOCABULARY } from "./catalogue-vocabulary";
import { loadCatalogueVocabulary } from "./catalogue-vocabulary.server";

const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "publishable-key",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("loadCatalogueVocabulary", () => {
  it("falls back to the bundled vocabulary when unconfigured", async () => {
    const fetchImpl = vi.fn();
    await expect(loadCatalogueVocabulary({ env: {}, fetchImpl })).resolves.toBe(
      BUNDLED_VOCABULARY,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns validated database rows", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse([
        {
          kind: "positioning_group",
          slug: "instrument",
          label_en: "Instrument",
          source_alias: [],
          sort_order: 10,
          active: true,
        },
      ]),
    );
    await expect(loadCatalogueVocabulary({ env, fetchImpl })).resolves.toEqual([
      {
        kind: "positioning_group",
        slug: "instrument",
        labelEn: "Instrument",
        sourceAliases: [],
        sortOrder: 10,
        active: true,
      },
    ]);
  });

  it("falls back when the RPC fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 500));
    await expect(loadCatalogueVocabulary({ env, fetchImpl })).resolves.toBe(
      BUNDLED_VOCABULARY,
    );
  });

  it("falls back when the response shape is invalid", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse([{ kind: "nope", slug: "x" }]));
    await expect(loadCatalogueVocabulary({ env, fetchImpl })).resolves.toBe(
      BUNDLED_VOCABULARY,
    );
  });

  it("falls back when the request throws", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("timeout"));
    await expect(loadCatalogueVocabulary({ env, fetchImpl })).resolves.toBe(
      BUNDLED_VOCABULARY,
    );
  });
});
