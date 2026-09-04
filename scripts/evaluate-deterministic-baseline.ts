import { performance } from "node:perf_hooks";

import { goldenEvaluationProfiles } from "../app/domain/evaluation-fixtures";
import {
  evaluateHardFilterPartitionV3,
  recommendWatchesV3,
} from "../app/domain/recommendation";
import { seedCatalogue } from "../app/domain/seed-catalogue";

const iterations = Number(process.env.BASELINE_ITERATIONS ?? 1_000);
if (!Number.isInteger(iterations) || iterations < 1) {
  throw new Error("BASELINE_ITERATIONS must be a positive integer.");
}

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
const asOf = new Date(latestObservation).toISOString();

const rows = goldenEvaluationProfiles.map((profile, index) => {
  const expectedPartition = evaluateHardFilterPartitionV3(
    profile,
    seedCatalogue,
    {
      asOf,
    },
  );
  const first = recommendWatchesV3(profile, seedCatalogue, { asOf });
  const firstProjection = JSON.stringify({
    recommendations: first.recommendations.map((candidate) => candidate.id),
    verificationRequired: first.verificationRequired.map(
      (candidate) => candidate.id,
    ),
    whyNot: first.whyNot.map((candidate) => candidate.id),
  });
  const start = performance.now();
  let deterministic = true;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const result = recommendWatchesV3(profile, seedCatalogue, { asOf });
    const projection = JSON.stringify({
      recommendations: result.recommendations.map((candidate) => candidate.id),
      verificationRequired: result.verificationRequired.map(
        (candidate) => candidate.id,
      ),
      whyNot: result.whyNot.map((candidate) => candidate.id),
    });
    if (projection !== firstProjection) deterministic = false;
  }
  const elapsedMs = performance.now() - start;
  const hardFilterViolations = first.recommendations.filter((candidate) => {
    const partition = expectedPartition[candidate.id];
    return (
      partition === undefined ||
      partition.hardReasons.length > 0 ||
      partition.missingFacts.length > 0
    );
  }).length;

  return {
    profile: index + 1,
    iterations,
    elapsedMs: Number(elapsedMs.toFixed(2)),
    averageMs: Number((elapsedMs / iterations).toFixed(4)),
    recommendations: first.recommendations.length,
    verificationRequired: first.verificationRequired.length,
    whyNot: first.whyNot.length,
    hardFilterViolations,
    deterministic,
    providerCostUsd: 0,
  };
});

console.log(
  JSON.stringify(
    {
      catalogueVariants: seedCatalogue.variants.length,
      asOf,
      profiles: rows,
      totals: {
        hardFilterViolations: rows.reduce(
          (total, row) => total + row.hardFilterViolations,
          0,
        ),
        nondeterministicProfiles: rows.filter((row) => !row.deterministic)
          .length,
        providerCostUsd: 0,
      },
    },
    null,
    2,
  ),
);
