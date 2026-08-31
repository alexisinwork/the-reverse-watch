import { seedCatalogueSchema } from "../app/domain/catalogue";
import {
  hardFilterEvaluationSchema,
  SUPABASE_CATALOGUE_RPC,
  SUPABASE_HARD_FILTER_RPC,
} from "../app/domain/catalogue.server";
import { catalogueParityMismatches } from "../app/domain/catalogue-parity";
import { goldenEvaluationProfiles } from "../app/domain/evaluation-fixtures";
import type { QuestionnaireProfile } from "../app/domain/questionnaire";
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
  new URL(`/rest/v1/rpc/${SUPABASE_CATALOGUE_RPC}`, configuredSupabaseUrl),
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

const profiles: QuestionnaireProfile[] = [...goldenEvaluationProfiles];

const observedTimes = [
  seedCatalogue.fx.observedAt,
  ...seedCatalogue.variants.flatMap((variant) => [
    variant.price.observedAt,
    variant.price.availabilityObservedAt,
  ]),
].filter((value): value is string => value !== null);
const staleTimes = [
  seedCatalogue.fx.staleAfter,
  ...seedCatalogue.variants.flatMap((variant) => [
    variant.price.staleAfter,
    variant.price.availabilityStaleAfter,
  ]),
].filter((value): value is string => value !== null);
const latestObservation = Math.max(
  ...observedTimes.map((value) => new Date(value).getTime()),
);
const earliestExpiry = Math.min(
  ...staleTimes.map((value) => new Date(value).getTime()),
);
if (latestObservation >= earliestExpiry) {
  throw new Error(
    "Catalogue facts do not share an overlapping mutable-fact freshness window.",
  );
}
const evaluationTime = new Date(latestObservation).toISOString();

async function fetchSqlHardFilter(profile: QuestionnaireProfile) {
  const hardFilterResponse = await fetch(
    new URL(`/rest/v1/rpc/${SUPABASE_HARD_FILTER_RPC}`, configuredSupabaseUrl),
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
