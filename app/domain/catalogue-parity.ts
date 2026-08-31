import type { SeedCatalogue, SeedReferenceVariant } from "./catalogue";

function normalizeDate(value: string | null) {
  return value === null ? null : new Date(value).toISOString();
}

function sorted(values: readonly string[]) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function projectVariant(
  variant: SeedReferenceVariant,
  sourceKeyById: ReadonlyMap<string, string>,
) {
  return {
    ...variant,
    brand: {
      ...variant.brand,
      serviceCountries:
        variant.brand.serviceCountries === null
          ? null
          : sorted(variant.brand.serviceCountries),
    },
    price: {
      ...variant.price,
      observedAt: normalizeDate(variant.price.observedAt),
      staleAfter: normalizeDate(variant.price.staleAfter),
      availabilityObservedAt: normalizeDate(
        variant.price.availabilityObservedAt,
      ),
      availabilityStaleAfter: normalizeDate(
        variant.price.availabilityStaleAfter,
      ),
      channels: sorted(variant.price.channels),
      conditions: sorted(variant.price.conditions),
    },
    complications: sorted(variant.complications),
    eligibleEnvironments: sorted(variant.eligibleEnvironments),
    ownershipFrictionLevels: sorted(variant.ownershipFrictionLevels),
    traits: {
      ...variant.traits,
      socialSignals: sorted(variant.traits.socialSignals),
      aestheticDna: sorted(variant.traits.aestheticDna),
      emotionalObjectives: sorted(variant.traits.emotionalObjectives),
    },
    evidence: variant.evidence
      .map((entry) => ({
        source:
          sourceKeyById.get(entry.sourceId) ?? `missing:${entry.sourceId}`,
        fields: sorted(entry.fields),
      }))
      .sort((left, right) =>
        JSON.stringify(left).localeCompare(JSON.stringify(right)),
      ),
  };
}

function projectCatalogue(catalogue: SeedCatalogue) {
  const projectedSources = catalogue.sources.map((source) => ({
    url: source.url,
    title: source.title,
    publisher: source.publisher,
    sourceType: source.sourceType,
    retrievedAt: normalizeDate(source.retrievedAt),
  }));
  const sourceKeyById = new Map(
    catalogue.sources.map((source, index) => [
      source.id,
      JSON.stringify(projectedSources[index]),
    ]),
  );
  return {
    catalogueVersion: catalogue.catalogueVersion,
    sources: projectedSources.sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    ),
    fx: {
      ...catalogue.fx,
      source: sourceKeyById.get(catalogue.fx.sourceId) ?? null,
      sourceId: undefined,
      observedAt: normalizeDate(catalogue.fx.observedAt),
      staleAfter: normalizeDate(catalogue.fx.staleAfter),
    },
    variants: catalogue.variants
      .map((variant) => projectVariant(variant, sourceKeyById))
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
}

export function catalogueParityMismatches(
  expected: SeedCatalogue,
  actual: SeedCatalogue,
) {
  const expectedProjection = projectCatalogue(expected);
  const actualProjection = projectCatalogue(actual);
  const mismatches: string[] = [];

  if (
    JSON.stringify(expectedProjection.catalogueVersion) !==
    JSON.stringify(actualProjection.catalogueVersion)
  ) {
    mismatches.push("catalogueVersion");
  }
  if (
    JSON.stringify(expectedProjection.sources) !==
    JSON.stringify(actualProjection.sources)
  ) {
    mismatches.push("sources");
  }
  if (
    JSON.stringify(expectedProjection.fx) !==
    JSON.stringify(actualProjection.fx)
  ) {
    mismatches.push("fx");
  }

  const actualVariants = new Map(
    actualProjection.variants.map((variant) => [variant.id, variant]),
  );
  for (const expectedVariant of expectedProjection.variants) {
    const actualVariant = actualVariants.get(expectedVariant.id);
    if (!actualVariant) {
      mismatches.push(`variant:${expectedVariant.id}:missing`);
      continue;
    }
    if (JSON.stringify(expectedVariant) !== JSON.stringify(actualVariant)) {
      mismatches.push(`variant:${expectedVariant.id}:facts`);
    }
    actualVariants.delete(expectedVariant.id);
  }
  for (const id of actualVariants.keys()) {
    mismatches.push(`variant:${id}:unexpected`);
  }
  return mismatches;
}
