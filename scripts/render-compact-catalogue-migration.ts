import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type {
  EvidenceField,
  SeedReferenceVariant,
} from "../app/domain/catalogue";
import { evidenceFields, priceSnapshotKind } from "../app/domain/catalogue";
import { seedCatalogue } from "../app/domain/seed-catalogue";

const outputPath = path.resolve(
  process.cwd(),
  process.argv[2] ??
    "db/migrations/0037_approve_rolex_workbook_recommendations.sql",
);
const requestedBrand =
  process.argv
    .find((argument) => argument.startsWith("--brand="))
    ?.slice("--brand=".length) ?? "rolex";
const selectedVariants = seedCatalogue.variants.filter(
  (variant) => variant.brand.slug === requestedBrand,
);

if (selectedVariants.length === 0) {
  throw new Error(`No catalogue variants found for brand: ${requestedBrand}.`);
}

function slug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function hashValue(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
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
    caseWidthMm: variant.geometry.caseWidthMm,
    caseLengthMm: variant.geometry.caseLengthMm,
    caseThicknessMm: variant.geometry.caseThicknessMm,
    lugToLugMm: variant.geometry.lugToLugMm,
    lugWidthMm: variant.geometry.lugWidthMm,
    lugCurvature: variant.geometry.lugCurvature,
    integratedBracelet: variant.geometry.integratedBracelet,
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
    complicationSlugs: variant.complicationSlugs,
    caseShape: variant.geometry.caseShape,
    displayCaseback: variant.materials.displayCaseback,
    movementConstruction: variant.movement.construction,
    microAdjustment: variant.operation.microAdjustment,
    positioning: {
      line: variant.positioningLine,
      group: variant.positioningGroup,
    },
    wearingScenarios: variant.wearingScenarios,
    dateStatus: variant.dateStatus,
    eligibleEnvironments: variant.eligibleEnvironments,
    ownershipFrictionLevels: variant.ownershipFrictionLevels,
    serviceCountries: variant.brand.serviceCountries,
    traits: variant.traits,
    market: variant.market,
  };
  return values[field as EvidenceField];
}

function completeness(variant: SeedReferenceVariant) {
  const verified = evidenceFields(variant);
  const geometry: EvidenceField[] =
    variant.geometry.caseDiameterMm !== null
      ? ["caseDiameterMm"]
      : ["caseWidthMm", "caseLengthMm"];
  const wearingSpan: EvidenceField =
    variant.geometry.lugToLugMm !== null
      ? "lugToLugMm"
      : variant.geometry.caseLengthMm !== null
        ? "caseLengthMm"
        : "lugToLugMm";
  const geometryAndFit = [...new Set([...geometry, wearingSpan])];
  const levels: Array<["m0" | "m1" | "m2", EvidenceField[]]> = [
    [
      "m0",
      ["identity", "price", ...geometryAndFit, "movement", "waterResistanceM"],
    ],
    [
      "m1",
      [
        "identity",
        "price",
        ...geometryAndFit,
        "caseThicknessMm",
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
  return levels.map(([level, fields]) => {
    const missing = fields.filter((field) => !verified.has(field));
    return {
      l: level,
      c: missing.length === 0,
      s: Number(((fields.length - missing.length) / fields.length).toFixed(4)),
      m: missing,
    };
  });
}

const selectedSourceIds = new Set(
  selectedVariants.flatMap((variant) =>
    variant.evidence.map((entry) => entry.sourceId),
  ),
);
const sources = seedCatalogue.sources
  .filter((source) => selectedSourceIds.has(source.id))
  .map((source) => ({
    i: source.id,
    u: source.url,
    t: source.title,
    p: source.publisher,
    y: source.sourceType,
    r: source.retrievedAt,
  }));

const variants = selectedVariants.map((variant) => {
  const complicationRows = [
    ...variant.complications,
    ...(variant.dateStatus === "present" ? (["date"] as const) : []),
  ];
  const traits = [
    ["primary_archetype", variant.traits.primaryArchetype],
    ...variant.traits.socialSignals.map((value) => ["social_signal", value]),
    ...variant.traits.aestheticDna.map((value) => ["aesthetic_dna", value]),
    ...variant.traits.emotionalObjectives.map((value) => [
      "emotional_objective",
      value,
    ]),
  ];
  const referenceEvidence = variant.evidence.flatMap((entry) =>
    entry.fields
      .filter((field) => field !== "price" && field !== "availability")
      .map((field) => ({
        s: entry.sourceId,
        f: field,
        h: hashValue(valueForEvidence(variant, field)),
      })),
  );
  const priceEvidence = variant.evidence
    .filter((entry) => entry.fields.includes("price"))
    .map((entry) => ({
      s: entry.sourceId,
      h: hashValue(variant.price.amountMinor),
    }));
  const availabilityEvidence = variant.evidence
    .filter((entry) => entry.fields.includes("availability"))
    .map((entry) => ({
      s: entry.sourceId,
      h: hashValue(variant.price.availability),
    }));
  const marketEvidence = variant.evidence
    .filter((entry) => entry.fields.includes("market"))
    .map((entry) => ({
      s: entry.sourceId,
      h: hashValue(variant.market),
    }));
  const availability = {
    in_stock: "in_stock",
    short_wait: "partial_waitlist",
    waitlist_or_allocation: "waitlist",
    unavailable: "unavailable",
    unknown: null,
  } as const;

  return {
    k: variant.id,
    rc: variant.referenceCode,
    vn: variant.variantName,
    pu: variant.productUrl,
    c: variant.collection,
    cs: slug(variant.collection),
    m: variant.model,
    ms: slug(variant.model),
    cm: variant.materials.case,
    cb: variant.materials.caseback,
    bm: variant.materials.bracelet,
    sm: variant.materials.strap,
    nr: variant.operation.nickelContactRisk,
    cd: variant.geometry.caseDiameterMm,
    cw: variant.geometry.caseWidthMm,
    cl: variant.geometry.caseLengthMm,
    ct: variant.geometry.caseThicknessMm,
    ll: variant.geometry.lugToLugMm,
    lw: variant.geometry.lugWidthMm,
    lc: variant.geometry.lugCurvature,
    ib: variant.geometry.integratedBracelet,
    w: variant.geometry.weightFullG,
    mt: variant.movement.type,
    cal: variant.movement.caliber,
    pr: variant.movement.powerReserveHours,
    al: variant.movement.accuracyLowerSeconds,
    au: variant.movement.accuracyUpperSeconds,
    ap: variant.movement.accuracyPeriodDays,
    wr: variant.operation.waterResistanceM,
    cr: variant.operation.crownType,
    cp: variant.operation.crownPosition,
    cy: variant.operation.crystal,
    lu: variant.operation.lumeGrade,
    ba: variant.operation.attachmentType,
    sr: variant.operation.shockResistant,
    ps: variant.productionStatus,
    comp: complicationRows,
    env: variant.eligibleEnvironments,
    fr: variant.ownershipFrictionLevels,
    tr: traits,
    p: {
      k: priceSnapshotKind(variant.price.channels),
      c: variant.price.conditions[0],
      x: variant.price.currency,
      a: variant.price.amountMinor,
      mc: variant.price.marketCountry,
      o: variant.price.observedAt,
      s: variant.price.staleAfter,
    },
    mk: {
      a: availability[variant.price.availability],
      o: variant.price.availabilityObservedAt ?? variant.price.observedAt,
      s: variant.price.availabilityStaleAfter ?? variant.price.staleAfter,
      rl: variant.market.secondaryRatioLow,
      rh: variant.market.secondaryRatioHigh,
      hr: variant.market.hypeRisk,
      sb: variant.market.speculativeBubble,
    },
    e: referenceEvidence,
    pe: priceEvidence,
    ae: availabilityEvidence,
    me: marketEvidence,
    ce: completeness(variant),
  };
});

const payload = JSON.stringify({ b: requestedBrand, sources, variants });
const sql = `-- Compact additive catalogue promotion generated from the reviewed seed bundle.
-- The JSON payload is unpacked into typed relational rows; no factual null is defaulted.

create temporary table _catalogue_payload (payload jsonb not null) on commit drop;
insert into _catalogue_payload values ($catalogue$${payload}$catalogue$::jsonb);

insert into public.sources (url, canonical_url, title, publisher, source_type, retrieved_at)
select s->>'u', s->>'u', s->>'t', s->>'p', s->>'y', (s->>'r')::timestamptz
from _catalogue_payload p
cross join lateral jsonb_array_elements(p.payload->'sources') s
on conflict (url, retrieved_at) do update set
  canonical_url = excluded.canonical_url,
  title = excluded.title,
  publisher = excluded.publisher,
  source_type = excluded.source_type;

create temporary table _catalogue_source_map on commit drop as
select s->>'i' as seed_id, source.id
from _catalogue_payload p
cross join lateral jsonb_array_elements(p.payload->'sources') s
join public.sources source
  on source.url = s->>'u'
 and source.retrieved_at = (s->>'r')::timestamptz;

insert into public.brands (slug, name, review_status)
values ('rolex', 'Rolex', 'accepted')
on conflict (slug) do update set
  name = excluded.name,
  review_status = 'accepted',
  updated_at = now();

insert into public.collections (brand_id, slug, name, review_status)
select distinct brand.id, v->>'cs', v->>'c', 'accepted'::public.review_state
from _catalogue_payload p
cross join lateral jsonb_array_elements(p.payload->'variants') v
join public.brands brand on brand.slug = p.payload->>'b'
on conflict (brand_id, slug) do update set
  name = excluded.name,
  review_status = 'accepted',
  updated_at = now();

insert into public.reference_models (collection_id, slug, model_name, review_status)
select distinct collection.id, v->>'ms', v->>'m', 'accepted'::public.review_state
from _catalogue_payload p
cross join lateral jsonb_array_elements(p.payload->'variants') v
join public.brands brand on brand.slug = p.payload->>'b'
join public.collections collection
  on collection.brand_id = brand.id and collection.slug = v->>'cs'
on conflict (collection_id, slug) do update set
  model_name = excluded.model_name,
  review_status = 'accepted',
  updated_at = now();

insert into public.reference_variants (
  reference_model_id, variant_key, reference_code, variant_name,
  case_material, caseback_material, bracelet_material, strap_material,
  nickel_contact_risk, case_diameter_mm, case_width_mm, case_length_mm,
  case_thickness_mm, lug_to_lug_mm, lug_to_lug_measured, lug_width_mm,
  lug_curvature, integrated_bracelet, weight_full_g, movement_type,
  caliber_ref, power_reserve_h, accuracy_lower_seconds,
  accuracy_upper_seconds, accuracy_period_days, water_resistance_m,
  crown_type, crown_position, crystal, lume_grade, bracelet_attachment,
  shock_resistant, production_status, review_status
)
select
  model.id, v->>'k', v->>'rc', v->>'vn',
  v->>'cm', v->>'cb', v->>'bm', v->>'sm',
  (v->>'nr')::public.contact_risk, (v->>'cd')::numeric,
  (v->>'cw')::numeric, (v->>'cl')::numeric, (v->>'ct')::numeric,
  (v->>'ll')::numeric, case when v->>'ll' is null then null else false end,
  (v->>'lw')::numeric, (v->>'lc')::public.lug_curvature,
  (v->>'ib')::boolean, (v->>'w')::numeric,
  (v->>'mt')::public.movement_type, v->>'cal', (v->>'pr')::numeric,
  (v->>'al')::numeric, (v->>'au')::numeric, (v->>'ap')::numeric,
  (v->>'wr')::integer, (v->>'cr')::public.crown_type,
  (v->>'cp')::public.crown_position, (v->>'cy')::public.crystal_type,
  (v->>'lu')::public.lume_grade, (v->>'ba')::public.attachment_type,
  (v->>'sr')::boolean, (v->>'ps')::public.production_status,
  'accepted'::public.review_state
from _catalogue_payload p
cross join lateral jsonb_array_elements(p.payload->'variants') v
join public.brands brand on brand.slug = p.payload->>'b'
join public.collections collection
  on collection.brand_id = brand.id and collection.slug = v->>'cs'
join public.reference_models model
  on model.collection_id = collection.id and model.slug = v->>'ms'
on conflict (reference_model_id, variant_key) do update set
  reference_code = excluded.reference_code,
  variant_name = excluded.variant_name,
  case_material = excluded.case_material,
  caseback_material = excluded.caseback_material,
  bracelet_material = excluded.bracelet_material,
  strap_material = excluded.strap_material,
  nickel_contact_risk = excluded.nickel_contact_risk,
  case_diameter_mm = excluded.case_diameter_mm,
  case_width_mm = excluded.case_width_mm,
  case_length_mm = excluded.case_length_mm,
  case_thickness_mm = excluded.case_thickness_mm,
  lug_to_lug_mm = excluded.lug_to_lug_mm,
  lug_to_lug_measured = coalesce(public.reference_variants.lug_to_lug_measured, excluded.lug_to_lug_measured),
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
  updated_at = now();

create temporary table _catalogue_variant_map on commit drop as
select v->>'k' as variant_key, variant.id
from _catalogue_payload p
cross join lateral jsonb_array_elements(p.payload->'variants') v
join public.reference_variants variant on variant.variant_key = v->>'k';

update public.reference_variants variant
set product_url = v->>'pu', updated_at = now()
from _catalogue_payload p
cross join lateral jsonb_array_elements(p.payload->'variants') v
where variant.variant_key = v->>'k'
  and variant.product_url is distinct from v->>'pu';

insert into public.reference_complications (reference_variant_id, complication)
select vm.id, complication.value::public.complication_type
from _catalogue_payload p
cross join lateral jsonb_array_elements(p.payload->'variants') v
join _catalogue_variant_map vm on vm.variant_key = v->>'k'
cross join lateral jsonb_array_elements_text(v->'comp') complication(value)
on conflict (reference_variant_id, complication) do nothing;

insert into public.reference_deployment_profiles (reference_variant_id, environment, review_status)
select vm.id, environment.value::public.deployment_environment, 'accepted'::public.review_state
from _catalogue_payload p
cross join lateral jsonb_array_elements(p.payload->'variants') v
join _catalogue_variant_map vm on vm.variant_key = v->>'k'
cross join lateral jsonb_array_elements_text(v->'env') environment(value)
on conflict (reference_variant_id, environment) do update set review_status = 'accepted';

insert into public.reference_ownership_friction_profiles (reference_variant_id, friction_level, review_status)
select vm.id, friction.value::public.ownership_friction_level, 'accepted'::public.review_state
from _catalogue_payload p
cross join lateral jsonb_array_elements(p.payload->'variants') v
join _catalogue_variant_map vm on vm.variant_key = v->>'k'
cross join lateral jsonb_array_elements_text(v->'fr') friction(value)
on conflict (reference_variant_id, friction_level) do update set review_status = 'accepted';

insert into public.reference_traits (reference_variant_id, axis, value, weight, review_status)
select vm.id, (trait->>0)::public.trait_axis, trait->>1, 1, 'accepted'::public.review_state
from _catalogue_payload p
cross join lateral jsonb_array_elements(p.payload->'variants') v
join _catalogue_variant_map vm on vm.variant_key = v->>'k'
cross join lateral jsonb_array_elements(v->'tr') trait
on conflict (reference_variant_id, axis, value) do update set
  weight = 1,
  review_status = 'accepted';

insert into public.price_snapshots (
  reference_variant_id, kind, condition, currency, amount_low_minor,
  market_country_code, observed_at, stale_after, review_status
)
select vm.id, (v#>>'{p,k}')::public.price_kind,
  (v#>>'{p,c}')::public.watch_condition, v#>>'{p,x}',
  (v#>>'{p,a}')::bigint, v#>>'{p,mc}', (v#>>'{p,o}')::timestamptz,
  (v#>>'{p,s}')::timestamptz, 'accepted'::public.review_state
from _catalogue_payload p
cross join lateral jsonb_array_elements(p.payload->'variants') v
join _catalogue_variant_map vm on vm.variant_key = v->>'k'
where not exists (
  select 1 from public.price_snapshots existing
  where existing.reference_variant_id = vm.id
    and existing.kind = (v#>>'{p,k}')::public.price_kind
    and existing.condition = (v#>>'{p,c}')::public.watch_condition
    and existing.currency = v#>>'{p,x}'
    and existing.observed_at = (v#>>'{p,o}')::timestamptz
);

insert into public.market_snapshots (
  reference_variant_id, market_country_code, availability,
  secondary_ratio_low, secondary_ratio_high, hype_risk,
  speculative_bubble, observed_at, stale_after, review_status
)
select vm.id, v#>>'{p,mc}', (v#>>'{mk,a}')::public.availability_state,
  (v#>>'{mk,rl}')::numeric, (v#>>'{mk,rh}')::numeric,
  (v#>>'{mk,hr}')::public.hype_risk, (v#>>'{mk,sb}')::boolean,
  (v#>>'{mk,o}')::timestamptz, (v#>>'{mk,s}')::timestamptz,
  'accepted'::public.review_state
from _catalogue_payload p
cross join lateral jsonb_array_elements(p.payload->'variants') v
join _catalogue_variant_map vm on vm.variant_key = v->>'k'
where (
  v#>>'{mk,a}' is not null or v#>>'{mk,rl}' is not null or
  v#>>'{mk,rh}' is not null or v#>>'{mk,hr}' is not null or
  v#>>'{mk,sb}' is not null
)
and not exists (
  select 1 from public.market_snapshots existing
  where existing.reference_variant_id = vm.id
    and existing.market_country_code = v#>>'{p,mc}'
    and existing.observed_at = (v#>>'{mk,o}')::timestamptz
);

insert into public.field_evidence (
  subject_type, subject_id, field_name, value_hash, source_id,
  observed_at, retrieved_at, verified_at, tier, reviewer
)
select 'reference_variant'::public.entity_type, vm.id, evidence->>'f',
  evidence->>'h', sm.id, (v#>>'{p,o}')::timestamptz,
  source.retrieved_at, source.retrieved_at, 'verified'::public.verification_tier,
  'owner-catalogue-approval-v1'
from _catalogue_payload p
cross join lateral jsonb_array_elements(p.payload->'variants') v
join _catalogue_variant_map vm on vm.variant_key = v->>'k'
cross join lateral jsonb_array_elements(v->'e') evidence
join _catalogue_source_map sm on sm.seed_id = evidence->>'s'
join public.sources source on source.id = sm.id
on conflict (subject_type, subject_id, field_name, value_hash, source_id) do update set
  verified_at = excluded.verified_at,
  tier = 'verified';

insert into public.field_evidence (
  subject_type, subject_id, field_name, value_hash, source_id,
  observed_at, retrieved_at, verified_at, stale_after, tier, reviewer
)
select 'price_snapshot'::public.entity_type, price.id, 'amount_low_minor',
  evidence->>'h', sm.id, price.observed_at, source.retrieved_at,
  source.retrieved_at, price.stale_after, 'verified'::public.verification_tier,
  'owner-catalogue-approval-v1'
from _catalogue_payload p
cross join lateral jsonb_array_elements(p.payload->'variants') v
join _catalogue_variant_map vm on vm.variant_key = v->>'k'
join public.price_snapshots price
  on price.reference_variant_id = vm.id
 and price.kind = (v#>>'{p,k}')::public.price_kind
 and price.condition = (v#>>'{p,c}')::public.watch_condition
 and price.currency = v#>>'{p,x}'
 and price.observed_at = (v#>>'{p,o}')::timestamptz
cross join lateral jsonb_array_elements(v->'pe') evidence
join _catalogue_source_map sm on sm.seed_id = evidence->>'s'
join public.sources source on source.id = sm.id
on conflict (subject_type, subject_id, field_name, value_hash, source_id) do update set
  verified_at = excluded.verified_at,
  stale_after = excluded.stale_after,
  tier = 'verified';

insert into public.field_evidence (
  subject_type, subject_id, field_name, value_hash, source_id,
  observed_at, retrieved_at, verified_at, stale_after, tier, reviewer
)
select 'market_snapshot'::public.entity_type, market.id, evidence.field_name,
  evidence.value_hash, sm.id, market.observed_at, source.retrieved_at,
  source.retrieved_at, market.stale_after, 'verified'::public.verification_tier,
  'owner-catalogue-approval-v1'
from _catalogue_payload p
cross join lateral jsonb_array_elements(p.payload->'variants') v
join _catalogue_variant_map vm on vm.variant_key = v->>'k'
join public.market_snapshots market
  on market.reference_variant_id = vm.id
 and market.market_country_code = v#>>'{p,mc}'
 and market.observed_at = (v#>>'{mk,o}')::timestamptz
cross join lateral (
  select 'availability'::text as field_name, item->>'h' as value_hash, item->>'s' as seed_id
  from jsonb_array_elements(v->'ae') item
  where v#>>'{mk,a}' is not null
  union all
  select 'market', item->>'h', item->>'s'
  from jsonb_array_elements(v->'me') item
) evidence
join _catalogue_source_map sm on sm.seed_id = evidence.seed_id
join public.sources source on source.id = sm.id
on conflict (subject_type, subject_id, field_name, value_hash, source_id) do update set
  verified_at = excluded.verified_at,
  stale_after = excluded.stale_after,
  tier = 'verified';

insert into public.completeness_evaluations (
  subject_type, subject_id, level, filter_contract_version, complete,
  completeness_score, missing_fields, evaluated_at
)
select 'reference_variant'::public.entity_type, vm.id,
  (evaluation->>'l')::public.completeness_level, 1,
  (evaluation->>'c')::boolean, (evaluation->>'s')::numeric,
  array(select jsonb_array_elements_text(evaluation->'m')),
  (v#>>'{p,o}')::timestamptz
from _catalogue_payload p
cross join lateral jsonb_array_elements(p.payload->'variants') v
join _catalogue_variant_map vm on vm.variant_key = v->>'k'
cross join lateral jsonb_array_elements(v->'ce') evaluation
on conflict (subject_type, subject_id, level, filter_contract_version) do update set
  complete = excluded.complete,
  completeness_score = excluded.completeness_score,
  missing_fields = excluded.missing_fields,
  evaluated_at = excluded.evaluated_at;
`;

fs.writeFileSync(outputPath, sql);
console.log(
  `Rendered compact ${requestedBrand} promotion (${selectedVariants.length} variants, ${sources.length} sources, ${Buffer.byteLength(sql)} bytes) to ${path.relative(process.cwd(), outputPath)}.`,
);
