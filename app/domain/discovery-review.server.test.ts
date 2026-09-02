import {
  independentlyFetchDiscoverySources,
  evaluateDiscoveryPromotion,
} from "./discovery-review.server";

const source = {
  id: 4,
  url: "https://example.com/evidence",
};

const candidate = {
  publicFigureName: null,
  characterName: "Don Draper",
  work: {
    title: "Mad Men",
    kind: "tv_series" as const,
    releaseYear: 2007,
    season: null,
    episode: null,
    scene: null,
    timecode: null,
  },
  claimType: "screen_worn" as const,
  identificationPrecision: "exact_reference" as const,
  brand: "Omega",
  modelFamily: "Seamaster De Ville",
  exactReference: "166.020",
  customPropPossible: false,
  contradictionState: "clear" as const,
  claimSummary: "The cited source identifies the watch.",
  sources: [
    {
      url: source.url,
      role: "specialist_corroboration" as const,
      stance: "supports" as const,
      locator: null,
    },
  ],
};

const verifiedSource = {
  sourceId: source.id,
  url: source.url,
  status: "verified" as const,
  fetchedAt: "2026-09-02T00:00:00.000Z",
  contentHash: "a".repeat(64),
  failureCategory: null,
};

describe("discovery review gates", () => {
  it("fetches bounded source bytes and stores only a hash", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("independent evidence"));
    const outcomes = await independentlyFetchDiscoverySources([source], {
      applicationOrigin: "https://thereserve.watch",
      fetchImpl,
      now: () => "2026-09-02T00:00:00.000Z",
    });
    expect(outcomes[0]?.status).toBe("verified");
    expect(outcomes[0]?.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(fetchImpl).toHaveBeenCalledWith(
      source.url,
      expect.objectContaining({ redirect: "manual" }),
    );
  });

  it("rejects circular and private source targets before network access", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const outcomes = await independentlyFetchDiscoverySources(
      [
        { id: 1, url: "https://thereserve.watch/research" },
        { id: 2, url: "https://127.0.0.1/private" },
      ],
      { fetchImpl },
    );
    expect(outcomes.map((outcome) => outcome.failureCategory)).toEqual([
      "circular_source",
      "unsafe_source",
    ]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("blocks publication for unresolved contradiction, unlicensed rights, or unreviewed catalogue", () => {
    expect(
      evaluateDiscoveryPromotion({
        candidate,
        sourceOutcomes: [verifiedSource],
        publish: true,
        referenceVariantReviewed: false,
        rights: null,
      }),
    ).toEqual({
      allowed: false,
      reasons: ["catalogue_variant_not_reviewed", "rights_decision_invalid"],
    });
    expect(
      evaluateDiscoveryPromotion({
        candidate: { ...candidate, contradictionState: "possible" },
        sourceOutcomes: [verifiedSource],
        publish: true,
        referenceVariantReviewed: true,
        rights: {
          imageState: "no_image_stored",
          assetUrl: null,
          rightsBasis: null,
          rightsHolder: null,
          licenceName: null,
          licenceUrl: null,
          creditLine: null,
          expiresAt: null,
          reviewedAt: "2026-09-02T00:00:00.000Z",
          editorialNote: null,
        },
      }).reasons,
    ).toContain("unresolved_contradiction");
  });
});
