import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type {
  EvidenceField,
  SeedReferenceVariant,
} from "../app/domain/catalogue";
import { evidenceFields } from "../app/domain/catalogue";
import { seedCatalogue } from "../app/domain/seed-catalogue";

const args = process.argv.slice(2);
const outputArgument = args.find((argument) => !argument.startsWith("--"));
const onlyArgument = args.find((argument) => argument.startsWith("--only="));
const requestedVariantIds = onlyArgument
  ?.slice("--only=".length)
  .split(",")
  .filter(Boolean);
const expansionMode = requestedVariantIds !== undefined;
const outputPath = path.resolve(
  process.cwd(),
  outputArgument ?? "db/migrations/0004_seed_reference_catalogue.sql",
);
const selectedVariants = expansionMode
  ? requestedVariantIds.map((variantId) => {
      const variant = seedCatalogue.variants.find(
        (candidate) => candidate.id === variantId,
      );
      if (!variant) throw new Error(`Unknown seed variant: ${variantId}`);
      return variant;
    })
  : seedCatalogue.variants;
const selectedSourceIds = new Set(
  selectedVariants.flatMap((variant) =>
    variant.evidence.map((entry) => entry.sourceId),
  ),
);
const selectedSources = expansionMode
  ? seedCatalogue.sources.filter((source) => selectedSourceIds.has(source.id))
  : seedCatalogue.sources;
const reviewer = expansionMode ? "catalogue-expansion-v1" : "seed-v1";

if (expansionMode && selectedVariants.length === 0) {
  throw new Error("--only requires at least one seed variant ID.");
}
if (
  expansionMode &&
  new Set(requestedVariantIds).size !== requestedVariantIds.length
) {
  throw new Error("--only variant IDs must be unique.");
}

function q(value: string | null) {
  return value === null ? "null" : `'${value.replaceAll("'", "''")}'`;
}

function n(value: number | null) {
  return value === null ? "null" : String(value);
}

function b(value: boolean | null) {
  return value === null ? "null" : value ? "true" : "false";
}

function slug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function valueForEvidence(variant: SeedReferenceVariant, field: string) {
  const values: Record<EvidenceField, unknown> = {
    identity: {
      brand: variant.brand,
      collection: variant.collection,
      model: variant.model,
      referenceCode: variant.referenceCode,
      variantName: variant.variantName,
    },
    price: variant.price,
    availability: {
      availability: variant.price.availability,
      observedAt: variant.price.availabilityObservedAt,
      staleAfter: variant.price.availabilityStaleAfter,
    },
    materials: variant.materials,
    productionStatus: variant.productionStatus,
    caseDiameterMm: variant.geometry.caseDiameterMm,
    caseThicknessMm: variant.geometry.caseThicknessMm,
    lugToLugMm: variant.geometry.lugToLugMm,
    lugWidthMm: variant.geometry.lugWidthMm,
    lugCurvature: variant.geometry.lugCurvature,
    weightFullG: variant.geometry.weightFullG,
    movement: {
      type: variant.movement.type,
      caliber: variant.movement.caliber,
      powerReserveHours: variant.movement.powerReserveHours,
    },
    accuracy: {
      lower: variant.movement.accuracyLowerSeconds,
      upper: variant.movement.accuracyUpperSeconds,
      periodDays: variant.movement.accuracyPeriodDays,
    },
    waterResistanceM: variant.operation.waterResistanceM,
    crownType: variant.operation.crownType,
    crownPosition: variant.operation.crownPosition,
    crystal: variant.operation.crystal,
    lumeGrade: variant.operation.lumeGrade,
    attachmentType: variant.operation.attachmentType,
    shockResistant: variant.operation.shockResistant,
    nickelContactRisk: variant.operation.nickelContactRisk,
    complications: variant.complications,
    dateStatus: variant.dateStatus,
    eligibleEnvironments: variant.eligibleEnvironments,
    ownershipFrictionLevels: variant.ownershipFrictionLevels,
    serviceCountries: variant.brand.serviceCountries,
    traits: variant.traits,
    market: variant.market,
  };
  return values[field as EvidenceField];
}

function hashValue(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function sourceIdSql(sourceId: string) {
  const source = seedCatalogue.sources.find(
    (candidate) => candidate.id === sourceId,
  );
  if (!source) throw new Error(`Unknown source: ${sourceId}`);
  return `(select id from public.sources where url = ${q(source.url)} and retrieved_at = ${q(source.retrievedAt)}::timestamptz)`;
}

function variantIdSql(variant: SeedReferenceVariant) {
  return `(select rv.id from public.reference_variants rv join public.reference_models rm on rm.id = rv.reference_model_id join public.collections c on c.id = rm.collection_id join public.brands b on b.id = c.brand_id where b.slug = ${q(variant.brand.slug)} and rv.variant_key = ${q(variant.id)})`;
}

function modelIdSql(variant: SeedReferenceVariant) {
  return `(select rm.id from public.reference_models rm join public.collections c on c.id = rm.collection_id join public.brands b on b.id = c.brand_id where b.slug = ${q(variant.brand.slug)} and c.slug = ${q(slug(variant.collection))} and rm.slug = ${q(slug(variant.model))})`;
}

function renderSources() {
  return selectedSources
    .map(
      (source) => `insert into public.sources
  (url, canonical_url, title, publisher, source_type, retrieved_at)
values
  (${q(source.url)}, ${q(source.url)}, ${q(source.title)}, ${q(source.publisher)}, ${q(source.sourceType)}, ${q(source.retrievedAt)}::timestamptz)
on conflict (url, retrieved_at) do update set
  canonical_url = excluded.canonical_url,
  title = excluded.title,
  publisher = excluded.publisher,
  source_type = excluded.source_type;`,
    )
    .join("\n\n");
}

function renderBrands() {
  const brands = new Map(
    selectedVariants.map((variant) => [variant.brand.slug, variant.brand]),
  );
  return [...brands.values()]
    .map(
      (brand) => `insert into public.brands (slug, name, review_status)
values (${q(brand.slug)}, ${q(brand.name)}, 'accepted')
on conflict (slug) do update set name = excluded.name, review_status = 'accepted', updated_at = now();`,
    )
    .join("\n\n");
}

function renderCollections() {
  const collections = new Map(
    selectedVariants.map((variant) => [
      `${variant.brand.slug}:${variant.collection}`,
      variant,
    ]),
  );
  return [...collections.values()]
    .map(
      (
        variant,
      ) => `insert into public.collections (brand_id, slug, name, review_status)
select id, ${q(slug(variant.collection))}, ${q(variant.collection)}, 'accepted'
from public.brands where slug = ${q(variant.brand.slug)}
on conflict (brand_id, slug) do update set name = excluded.name, review_status = 'accepted', updated_at = now();`,
    )
    .join("\n\n");
}

function renderModels() {
  const models = new Map(
    selectedVariants.map((variant) => [
      `${variant.brand.slug}:${variant.collection}:${variant.model}`,
      variant,
    ]),
  );
  return [...models.values()]
    .map(
      (
        variant,
      ) => `insert into public.reference_models (collection_id, slug, model_name, review_status)
select c.id, ${q(slug(variant.model))}, ${q(variant.model)}, 'accepted'
from public.collections c join public.brands b on b.id = c.brand_id
where b.slug = ${q(variant.brand.slug)} and c.slug = ${q(slug(variant.collection))}
on conflict (collection_id, slug) do update set model_name = excluded.model_name, review_status = 'accepted', updated_at = now();`,
    )
    .join("\n\n");
}

function renderVariant(variant: SeedReferenceVariant) {
  return `insert into public.reference_variants (
  reference_model_id, variant_key, reference_code, variant_name,
  case_material, caseback_material, bracelet_material, strap_material,
  nickel_contact_risk, case_diameter_mm, case_thickness_mm, lug_to_lug_mm,
  lug_to_lug_measured, lug_width_mm, lug_curvature, integrated_bracelet,
  weight_full_g, movement_type, caliber_ref, power_reserve_h,
  accuracy_lower_seconds, accuracy_upper_seconds, accuracy_period_days,
  water_resistance_m, crown_type, crown_position, crystal, lume_grade,
  bracelet_attachment, shock_resistant, production_status, review_status
)
values (
  ${modelIdSql(variant)}, ${q(variant.id)}, ${q(variant.referenceCode)}, ${q(variant.variantName)},
  ${q(variant.materials.case)}, ${q(variant.materials.caseback)}, ${q(variant.materials.bracelet)}, ${q(variant.materials.strap)},
  ${q(variant.operation.nickelContactRisk)}, ${n(variant.geometry.caseDiameterMm)}, ${n(variant.geometry.caseThicknessMm)}, ${n(variant.geometry.lugToLugMm)},
  ${variant.geometry.lugToLugMm === null ? "null" : "false"}, ${n(variant.geometry.lugWidthMm)}, ${q(variant.geometry.lugCurvature)}, ${b(variant.geometry.integratedBracelet)},
  ${n(variant.geometry.weightFullG)}, ${q(variant.movement.type)}, ${q(variant.movement.caliber)}, ${n(variant.movement.powerReserveHours)},
  ${n(variant.movement.accuracyLowerSeconds)}, ${n(variant.movement.accuracyUpperSeconds)}, ${n(variant.movement.accuracyPeriodDays)},
  ${n(variant.operation.waterResistanceM)}, ${q(variant.operation.crownType)}, ${q(variant.operation.crownPosition)}, ${q(variant.operation.crystal)}, ${q(variant.operation.lumeGrade)},
  ${q(variant.operation.attachmentType)}, ${b(variant.operation.shockResistant)}, ${q(variant.productionStatus)}, 'accepted'
)
on conflict (reference_model_id, variant_key) do update set
  reference_code = excluded.reference_code,
  variant_name = excluded.variant_name,
  case_material = excluded.case_material,
  caseback_material = excluded.caseback_material,
  bracelet_material = excluded.bracelet_material,
  strap_material = excluded.strap_material,
  nickel_contact_risk = excluded.nickel_contact_risk,
  case_diameter_mm = excluded.case_diameter_mm,
  case_thickness_mm = excluded.case_thickness_mm,
  lug_to_lug_mm = excluded.lug_to_lug_mm,
  lug_to_lug_measured = excluded.lug_to_lug_measured,
  lug_width_mm = excluded.lug_width_mm,
  lug_curvature = excluded.lug_curvature,
  integrated_bracelet = excluded.integrated_bracelet,
  weight_full_g = excluded.weight_full_g,
  movement_type = excluded.movement_type,
  caliber_ref = excluded.caliber_ref,
  power_reserve_h = excluded.power_reserve_h,
  accuracy_lower_seconds = excluded.accuracy_lower_seconds,
  accuracy_upper_seconds = excluded.accuracy_upper_seconds,
  accuracy_period_days = excluded.accuracy_period_days,
  water_resistance_m = excluded.water_resistance_m,
  crown_type = excluded.crown_type,
  crown_position = excluded.crown_position,
  crystal = excluded.crystal,
  lume_grade = excluded.lume_grade,
  bracelet_attachment = excluded.bracelet_attachment,
  shock_resistant = excluded.shock_resistant,
  production_status = excluded.production_status,
  review_status = 'accepted',
  updated_at = now();`;
}

function renderProductUrl(variant: SeedReferenceVariant) {
  return `update public.reference_variants
set product_url = ${q(variant.productUrl)}, updated_at = now()
where id = ${variantIdSql(variant)}
  and product_url is distinct from ${q(variant.productUrl)};`;
}

function renderDeploymentProfiles(variant: SeedReferenceVariant) {
  return variant.eligibleEnvironments
    .map(
      (environment) => `insert into public.reference_deployment_profiles (
  reference_variant_id, environment, review_status
)
values (${variantIdSql(variant)}, ${q(environment)}, 'accepted')
on conflict (reference_variant_id, environment) do update set
  review_status = 'accepted';`,
    )
    .join("\n\n");
}

function renderOwnershipFrictionProfiles(variant: SeedReferenceVariant) {
  return variant.ownershipFrictionLevels
    .map(
      (
        frictionLevel,
      ) => `insert into public.reference_ownership_friction_profiles (
  reference_variant_id, friction_level, review_status
)
values (${variantIdSql(variant)}, ${q(frictionLevel)}, 'accepted')
on conflict (reference_variant_id, friction_level) do update set
  review_status = 'accepted';`,
    )
    .join("\n\n");
}

function renderComplications(variant: SeedReferenceVariant) {
  const complications = [
    ...variant.complications,
    ...(variant.dateStatus === "present" ? (["date"] as const) : []),
  ];
  return complications
    .map(
      (
        complication,
      ) => `insert into public.reference_complications (reference_variant_id, complication)
values (${variantIdSql(variant)}, ${q(complication)})
on conflict (reference_variant_id, complication) do nothing;`,
    )
    .join("\n\n");
}

function renderPrice(variant: SeedReferenceVariant) {
  const priceKind = variant.price.channels.includes("secondary_market")
    ? "secondary_ask"
    : variant.price.channels.includes("grey_market")
      ? "grey_market_ask"
      : "retail";
  const condition = variant.price.conditions[0];
  if (!condition) throw new Error(`Missing price condition: ${variant.id}`);
  return `insert into public.price_snapshots (
  reference_variant_id, kind, condition, currency, amount_low_minor,
  market_country_code, observed_at, stale_after, review_status
)
select ${variantIdSql(variant)}, ${q(priceKind)}, ${q(condition)}, ${q(variant.price.currency)}, ${variant.price.amountMinor},
  ${q(variant.price.marketCountry)}, ${q(variant.price.observedAt)}::timestamptz, ${q(variant.price.staleAfter)}::timestamptz, 'accepted'
where not exists (
  select 1 from public.price_snapshots ps
  where ps.reference_variant_id = ${variantIdSql(variant)}
    and ps.kind = ${q(priceKind)} and ps.condition = ${q(condition)}
    and ps.currency = ${q(variant.price.currency)}
    and ps.observed_at = ${q(variant.price.observedAt)}::timestamptz
);`;
}

function renderAvailability(variant: SeedReferenceVariant) {
  if (variant.price.availability === "unknown") return "";
  const availabilityMap = {
    in_stock: "in_stock",
    short_wait: "partial_waitlist",
    waitlist_or_allocation: "waitlist",
    unavailable: "unavailable",
  } as const;
  const availability = availabilityMap[variant.price.availability];
  return `insert into public.market_snapshots (
  reference_variant_id, market_country_code, availability, observed_at,
  stale_after, review_status
)
  select ${variantIdSql(variant)}, ${q(variant.price.marketCountry)}, ${q(availability)},
  ${q(variant.price.availabilityObservedAt)}::timestamptz,
  ${q(variant.price.availabilityStaleAfter)}::timestamptz, 'accepted'
where not exists (
  select 1 from public.market_snapshots ms
  where ms.reference_variant_id = ${variantIdSql(variant)}
    and ms.market_country_code = ${q(variant.price.marketCountry)}
    and ms.observed_at = ${q(variant.price.availabilityObservedAt)}::timestamptz
);`;
}

function renderTraits(variant: SeedReferenceVariant) {
  const traits = [
    ["primary_archetype", variant.traits.primaryArchetype],
    ...variant.traits.socialSignals.map((value) => ["social_signal", value]),
    ...variant.traits.aestheticDna.map((value) => ["aesthetic_dna", value]),
    ...variant.traits.emotionalObjectives.map((value) => [
      "emotional_objective",
      value,
    ]),
  ] as const;
  return traits
    .map(
      ([
        axis,
        value,
      ]) => `insert into public.reference_traits (reference_variant_id, axis, value, weight, review_status)
values (${variantIdSql(variant)}, ${q(axis)}, ${q(value)}, 1, 'accepted')
on conflict (reference_variant_id, axis, value) do update set weight = 1, review_status = 'accepted';`,
    )
    .join("\n\n");
}

function renderVariantEvidence(variant: SeedReferenceVariant) {
  return variant.evidence
    .flatMap((entry) =>
      entry.fields
        .filter((field) => field !== "price" && field !== "availability")
        .map((field) => {
          const valueHash = hashValue(valueForEvidence(variant, field));
          return `insert into public.field_evidence (
  subject_type, subject_id, field_name, value_hash, source_id,
  observed_at, retrieved_at, verified_at, tier, reviewer
)
values (
  'reference_variant', ${variantIdSql(variant)}, ${q(field)}, ${q(valueHash)}, ${sourceIdSql(entry.sourceId)},
  ${q(variant.price.observedAt)}::timestamptz, ${q(seedCatalogue.sources.find((source) => source.id === entry.sourceId)!.retrievedAt)}::timestamptz,
  ${q(seedCatalogue.sources.find((source) => source.id === entry.sourceId)!.retrievedAt)}::timestamptz, 'verified', ${q(reviewer)}
)
on conflict (subject_type, subject_id, field_name, value_hash, source_id) do update set
  verified_at = excluded.verified_at, tier = 'verified', reviewer = ${q(reviewer)};`;
        }),
    )
    .join("\n\n");
}

function renderPriceEvidence(variant: SeedReferenceVariant) {
  const entry = variant.evidence.find((candidate) =>
    candidate.fields.includes("price"),
  );
  if (!entry) return "";
  return `insert into public.field_evidence (
  subject_type, subject_id, field_name, value_hash, source_id,
  observed_at, retrieved_at, verified_at, stale_after, tier, reviewer
)
select 'price_snapshot', ps.id, 'amount_low_minor', ${q(hashValue(variant.price.amountMinor))}, ${sourceIdSql(entry.sourceId)},
  ps.observed_at, ${q(seedCatalogue.sources.find((source) => source.id === entry.sourceId)!.retrievedAt)}::timestamptz,
  ${q(seedCatalogue.sources.find((source) => source.id === entry.sourceId)!.retrievedAt)}::timestamptz,
  ps.stale_after, 'verified', ${q(reviewer)}
from public.price_snapshots ps
where ps.reference_variant_id = ${variantIdSql(variant)}
  and ps.kind = 'retail' and ps.condition = 'new'
  and ps.currency = ${q(variant.price.currency)}
  and ps.observed_at = ${q(variant.price.observedAt)}::timestamptz
on conflict (subject_type, subject_id, field_name, value_hash, source_id) do update set
  verified_at = excluded.verified_at, stale_after = excluded.stale_after,
  tier = 'verified', reviewer = ${q(reviewer)};`;
}

function renderAvailabilityEvidence(variant: SeedReferenceVariant) {
  if (variant.price.availability === "unknown") return "";
  const entry = variant.evidence.find((candidate) =>
    candidate.fields.includes("availability"),
  );
  if (!entry) return "";
  return `insert into public.field_evidence (
  subject_type, subject_id, field_name, value_hash, source_id,
  observed_at, retrieved_at, verified_at, stale_after, tier, reviewer
)
select 'market_snapshot', ms.id, 'availability', ${q(hashValue(variant.price.availability))}, ${sourceIdSql(entry.sourceId)},
  ms.observed_at, ${q(seedCatalogue.sources.find((source) => source.id === entry.sourceId)!.retrievedAt)}::timestamptz,
  ${q(seedCatalogue.sources.find((source) => source.id === entry.sourceId)!.retrievedAt)}::timestamptz,
  ms.stale_after, 'verified', ${q(reviewer)}
from public.market_snapshots ms
where ms.reference_variant_id = ${variantIdSql(variant)}
  and ms.market_country_code = ${q(variant.price.marketCountry)}
  and ms.observed_at = ${q(variant.price.availabilityObservedAt)}::timestamptz
on conflict (subject_type, subject_id, field_name, value_hash, source_id) do update set
  verified_at = excluded.verified_at, stale_after = excluded.stale_after,
  tier = 'verified', reviewer = ${q(reviewer)};`;
}

function renderCompleteness(variant: SeedReferenceVariant) {
  const verified = evidenceFields(variant);
  const levels: ["m0" | "m1" | "m2", EvidenceField[]][] = [
    [
      "m0",
      [
        "identity",
        "price",
        "caseDiameterMm",
        "lugToLugMm",
        "movement",
        "waterResistanceM",
      ],
    ],
    [
      "m1",
      [
        "identity",
        "price",
        "caseDiameterMm",
        "caseThicknessMm",
        "lugToLugMm",
        "lugWidthMm",
        "weightFullG",
        "movement",
        "accuracy",
        "waterResistanceM",
        "lumeGrade",
        "attachmentType",
        "dateStatus",
      ],
    ],
    ["m2", ["identity", "traits", "market"]],
  ];
  return levels
    .map(([level, fields]) => {
      const missing = fields.filter((field) => !verified.has(field));
      const score = (fields.length - missing.length) / fields.length;
      const missingSql =
        missing.length === 0
          ? "array[]::text[]"
          : `array[${missing.map((field) => q(field)).join(", ")}]::text[]`;
      return `insert into public.completeness_evaluations (
  subject_type, subject_id, level, filter_contract_version, complete,
  completeness_score, missing_fields, evaluated_at
)
values (
  'reference_variant', ${variantIdSql(variant)}, ${q(level)}, 1,
  ${missing.length === 0 ? "true" : "false"}, ${score.toFixed(4)}, ${missingSql},
  ${q(expansionMode ? variant.price.observedAt : "2026-08-28T18:30:00Z")}::timestamptz
)
on conflict (subject_type, subject_id, level, filter_contract_version) do update set
  complete = excluded.complete,
  completeness_score = excluded.completeness_score,
  missing_fields = excluded.missing_fields,
  evaluated_at = excluded.evaluated_at;`;
    })
    .join("\n\n");
}

function renderFx() {
  return Object.entries(seedCatalogue.fx.rates)
    .map(
      ([quote, rate]) => `insert into public.fx_rate_snapshots (
  base_currency, quote_currency, rate, observed_at, stale_after, source_id, review_status
)
values (
  ${q(seedCatalogue.fx.baseCurrency)}, ${q(quote)}, ${rate},
  ${q(seedCatalogue.fx.observedAt)}::timestamptz,
  ${q(seedCatalogue.fx.staleAfter)}::timestamptz,
  ${sourceIdSql(seedCatalogue.fx.sourceId)}, 'accepted'
)
on conflict (base_currency, quote_currency, observed_at) do update set
  rate = excluded.rate,
  stale_after = excluded.stale_after,
  source_id = excluded.source_id,
  review_status = 'accepted';`,
    )
    .join("\n\n");
}

const sql = `-- Generated by scripts/render-seed-migration.ts from the reviewed seed bundle.
-- ${expansionMode ? `Additive expansion for: ${selectedVariants.map((variant) => variant.id).join(", ")}.` : "Re-render after changing data/catalogue/seed-catalogue.json."}

${renderSources()}

${renderBrands()}

${renderCollections()}

${renderModels()}

${selectedVariants.map(renderVariant).join("\n\n")}

${expansionMode ? selectedVariants.map(renderProductUrl).join("\n\n") : ""}

${selectedVariants.map(renderComplications).filter(Boolean).join("\n\n")}

${selectedVariants.map(renderPrice).join("\n\n")}

${selectedVariants.map(renderAvailability).filter(Boolean).join("\n\n")}

${expansionMode ? selectedVariants.map(renderDeploymentProfiles).join("\n\n") : ""}

${expansionMode ? selectedVariants.map(renderOwnershipFrictionProfiles).join("\n\n") : ""}

${selectedVariants.map(renderTraits).join("\n\n")}

${selectedVariants.map(renderVariantEvidence).join("\n\n")}

${selectedVariants.map(renderPriceEvidence).join("\n\n")}

${selectedVariants.map(renderAvailabilityEvidence).filter(Boolean).join("\n\n")}

${selectedVariants.map(renderCompleteness).join("\n\n")}

${expansionMode ? "" : renderFx()}
`;

fs.writeFileSync(outputPath, `${sql.trimEnd()}\n`);
console.log(
  `Rendered catalogue v${seedCatalogue.catalogueVersion} (${selectedVariants.length} variants) to ${path.relative(process.cwd(), outputPath)}.`,
);
