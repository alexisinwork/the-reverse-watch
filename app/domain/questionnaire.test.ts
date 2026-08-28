import {
  coreProfileSchema,
  derivePriceBand,
  deriveWristBand,
  effectiveBudgetCeiling,
  normalizeProfile,
  permitsSpeculativeCandidate,
  QUESTIONNAIRE_VERSION,
  questionnaireProfileSchema,
  refinementSchema,
} from "./questionnaire";

const VALID_CORE = {
  version: QUESTIONNAIRE_VERSION,
  budgetCurrency: "USD",
  budgetMax: 10_000,
  wristCircumferenceMm: 170,
  deploymentEnvironment: "studio_desk_daily",
  ownershipFriction: "workhorse_mechanical",
  accuracyTolerance: "within_15_seconds_per_day",
  weightLimit: "under_160_g",
  requiredComplications: ["gmt"],
  datePreference: "either",
} as const;

describe("questionnaire domain contract", () => {
  it("derives one price band at every shared boundary", () => {
    expect(derivePriceBand(299.99)).toBe("under_300");
    expect(derivePriceBand(300)).toBe("300_500");
    expect(derivePriceBand(500)).toBe("500_1000");
    expect(derivePriceBand(1_000)).toBe("1000_2000");
    expect(derivePriceBand(2_000)).toBe("2000_5000");
    expect(derivePriceBand(5_000)).toBe("5000_10000");
    expect(derivePriceBand(10_000)).toBe("10000_15000");
    expect(derivePriceBand(15_000)).toBe("15000_plus");
  });

  it("derives wrist display bands from the normalized millimetre value", () => {
    expect(deriveWristBand(5.75 * 25.4 - 0.01)).toBe("under_5_75");
    expect(deriveWristBand(5.75 * 25.4)).toBe("5_75_6_25");
    expect(deriveWristBand(6.25 * 25.4)).toBe("6_25_6_75");
    expect(deriveWristBand(6.75 * 25.4)).toBe("6_75_7_5");
    expect(deriveWristBand(7.5 * 25.4)).toBe("7_5_plus");
  });

  it("validates a complete core profile and rejects forged duplicate values", () => {
    expect(coreProfileSchema.safeParse(VALID_CORE).success).toBe(true);
    expect(
      coreProfileSchema.safeParse({
        ...VALID_CORE,
        requiredComplications: ["gmt", "gmt"],
      }).success,
    ).toBe(false);
  });

  it("requires an eligible acquisition channel for an explicit premium", () => {
    expect(
      refinementSchema.safeParse({ premiumAllowancePercent: 30 }).success,
    ).toBe(false);
    expect(
      refinementSchema.safeParse({
        premiumAllowancePercent: 30,
        acquisitionChannels: ["secondary_market"],
      }).success,
    ).toBe(true);
    expect(() => effectiveBudgetCeiling(10_000, 101)).toThrow(RangeError);
    expect(effectiveBudgetCeiling(10_000, 30)).toBe(13_000);
  });

  it("suppresses speculative candidates unless both explicit gates pass", () => {
    expect(
      permitsSpeculativeCandidate({
        speculativeRiskTolerance: "accept",
        acquisitionChannels: ["authorized_dealer"],
      }),
    ).toBe(false);
    expect(
      permitsSpeculativeCandidate({
        speculativeRiskTolerance: "accept",
        acquisitionChannels: ["grey_market"],
      }),
    ).toBe(true);
  });

  it("normalizes derived values without replacing exact inputs", () => {
    const parsed = questionnaireProfileSchema.parse({
      core: VALID_CORE,
      refinement: {
        premiumAllowancePercent: 20,
        acquisitionChannels: ["secondary_market"],
        speculativeRiskTolerance: "accept",
      },
    });
    const normalized = normalizeProfile(parsed);

    expect(normalized.core.budgetMax).toBe(10_000);
    expect(normalized.derived).toMatchObject({
      priceBand: "10000_15000",
      wristBand: "6_25_6_75",
      effectiveBudgetCeiling: 12_000,
      speculativeCandidatesAllowed: true,
    });
  });
});
