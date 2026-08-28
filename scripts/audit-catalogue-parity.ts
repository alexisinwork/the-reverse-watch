import { seedCatalogueSchema } from "../app/domain/catalogue";
import { hardFilterEvaluationSchema } from "../app/domain/catalogue.server";
import { catalogueParityMismatches } from "../app/domain/catalogue-parity";
import type { QuestionnaireProfile } from "../app/domain/questionnaire";
import { QUESTIONNAIRE_VERSION } from "../app/domain/questionnaire";
import {
  evaluateHardFilterPartition,
  recommendWatches,
} from "../app/domain/recommendation";
import { seedCatalogue } from "../app/domain/seed-catalogue";

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();

if (!supabaseUrl || !publishableKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required for the parity audit.",
  );
}
const configuredSupabaseUrl = supabaseUrl;
const configuredPublishableKey = publishableKey;

const response = await fetch(
  new URL("/rest/v1/rpc/recommendation_catalogue_v1", configuredSupabaseUrl),
  {
    method: "POST",
    headers: {
      apikey: configuredPublishableKey,
      "content-type": "application/json",
    },
    body: "{}",
    signal: AbortSignal.timeout(5_000),
  },
);

if (!response.ok) {
  throw new Error(`Catalogue RPC returned ${response.status}.`);
}

const databaseCatalogue = seedCatalogueSchema.parse(await response.json());
const factMismatches = catalogueParityMismatches(
  seedCatalogue,
  databaseCatalogue,
);

const profiles: QuestionnaireProfile[] = [
  {
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
  },
  {
    core: {
      version: QUESTIONNAIRE_VERSION,
      budgetCurrency: "USD",
      budgetMax: 1_000,
      wristCircumferenceMm: 165,
      deploymentEnvironment: "studio_desk_daily",
      ownershipFriction: "zero_maintenance",
      accuracyTolerance: "no_requirement",
      weightLimit: "no_limit",
      requiredComplications: ["chronograph"],
      datePreference: "required",
    },
  },
  {
    core: {
      version: QUESTIONNAIRE_VERSION,
      budgetCurrency: "EUR",
      budgetMax: 15_000,
      wristCircumferenceMm: 180,
      deploymentEnvironment: "formal_architectural",
      ownershipFriction: "workhorse_mechanical",
      accuracyTolerance: "no_requirement",
      weightLimit: "no_limit",
      requiredComplications: [],
      datePreference: "forbidden",
    },
    refinement: {
      acquisitionChannels: ["authorized_dealer"],
      lumePreference: "not_important",
    },
  },
  {
    core: {
      version: QUESTIONNAIRE_VERSION,
      budgetCurrency: "USD",
      budgetMax: 25_000,
      wristCircumferenceMm: 145,
      deploymentEnvironment: "field_water_abuse",
      ownershipFriction: "workhorse_mechanical",
      accuracyTolerance: "within_5_seconds_per_day",
      weightLimit: "under_80_g",
      requiredComplications: ["chronograph"],
      datePreference: "forbidden",
    },
    refinement: {
      speculativeRiskTolerance: "avoid",
      requiredLugCurvature: "steep",
      requiredAttachmentType: "quick_release",
      requiredLugWidthMm: 20,
      quickReleaseRequired: true,
      acquisitionChannels: ["secondary_market"],
      availabilityTolerance: "in_stock_only",
      premiumAllowancePercent: 30,
      liquidityPreference: "require_80_percent_plus",
      lumePreference: "strong_lume",
      crownPosition: "4",
      purchaseCountry: "PL",
      serviceCountry: "PL",
      acceptedConditions: ["pre_owned"],
      allergyConstraint: "nickel_contact",
    },
  },
  {
    core: {
      version: QUESTIONNAIRE_VERSION,
      budgetCurrency: "EUR",
      budgetMax: 1_000,
      wristCircumferenceMm: 220,
      deploymentEnvironment: "studio_desk_daily",
      ownershipFriction: "zero_maintenance",
      accuracyTolerance: "within_15_seconds_per_day",
      weightLimit: "under_120_g",
      requiredComplications: [],
      datePreference: "either",
    },
    refinement: {
      acquisitionChannels: ["authorized_dealer"],
      availabilityTolerance: "short_wait",
      liquidityPreference: "prefer_60_percent_plus",
      lumePreference: "some_lume",
      crownPosition: "3",
      acceptedConditions: ["new"],
    },
  },
  {
    core: {
      version: QUESTIONNAIRE_VERSION,
      budgetCurrency: "CHF",
      budgetMax: 7_000,
      wristCircumferenceMm: 180,
      deploymentEnvironment: "formal_architectural",
      ownershipFriction: "specialist_mechanical",
      accuracyTolerance: "no_requirement",
      weightLimit: "no_limit",
      requiredComplications: ["moonphase"],
      datePreference: "either",
    },
    refinement: {
      speculativeRiskTolerance: "accept",
      acquisitionChannels: ["grey_market", "secondary_market"],
      premiumAllowancePercent: 40,
      purchaseCountry: "US",
    },
  },
];

const evaluationTime = "2026-08-28T20:00:00Z";

async function fetchSqlHardFilter(profile: QuestionnaireProfile) {
  const hardFilterResponse = await fetch(
    new URL(
      "/rest/v1/rpc/recommendation_hard_filter_v1",
      configuredSupabaseUrl,
    ),
    {
      method: "POST",
      headers: {
        apikey: configuredPublishableKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        p_profile: profile,
        p_as_of: evaluationTime,
      }),
      signal: AbortSignal.timeout(5_000),
    },
  );
  if (!hardFilterResponse.ok) {
    throw new Error(`Hard-filter RPC returned ${hardFilterResponse.status}.`);
  }
  return hardFilterEvaluationSchema.parse(await hardFilterResponse.json());
}

const sqlHardFilters = await Promise.all(profiles.map(fetchSqlHardFilter));

function projectHardFilter(
  evaluation: ReturnType<typeof evaluateHardFilterPartition>,
) {
  return Object.fromEntries(
    Object.entries(evaluation)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([id, result]) => [
        id,
        {
          hardReasons: [...result.hardReasons].sort(),
          missingFacts: [...result.missingFacts].sort(),
        },
      ]),
  );
}

const hardFilterMismatches = profiles.flatMap((profile, index) => {
  const expected = projectHardFilter(
    evaluateHardFilterPartition(profile, seedCatalogue, {
      asOf: evaluationTime,
    }),
  );
  const actual = projectHardFilter(sqlHardFilters[index]!);
  return Object.keys(expected).flatMap((variantId) =>
    JSON.stringify(expected[variantId]) === JSON.stringify(actual[variantId])
      ? []
      : [
          `hard-filter-profile:${index + 1}:${variantId}:expected=${JSON.stringify(expected[variantId])}:actual=${JSON.stringify(actual[variantId])}`,
        ],
  );
});

const recommendationMismatches = profiles.flatMap((profile, index) => {
  const options = { asOf: evaluationTime };
  const expected = recommendWatches(profile, seedCatalogue, options);
  const actual = recommendWatches(profile, databaseCatalogue, {
    ...options,
    hardFilterEvaluation: sqlHardFilters[index],
  });
  const project = (result: typeof expected) => ({
    recommendations: result.recommendations.map((candidate) => candidate.id),
    verificationRequired: result.verificationRequired.map((candidate) => ({
      id: candidate.id,
      missing: candidate.missingFacts.map((fact) => fact.code).sort(),
    })),
    whyNot: result.whyNot.map((candidate) => ({
      id: candidate.id,
      reasons: candidate.hardReasons.map((reason) => reason.code).sort(),
    })),
  });
  return JSON.stringify(project(expected)) === JSON.stringify(project(actual))
    ? []
    : [`profile:${index + 1}`];
});

const mismatches = [
  ...factMismatches,
  ...hardFilterMismatches,
  ...recommendationMismatches,
];
if (mismatches.length > 0) {
  console.error(`Catalogue parity failed: ${mismatches.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log(
    `Catalogue and SQL hard-filter parity passed for ${databaseCatalogue.variants.length} variants and ${profiles.length} golden profiles.`,
  );
}
