-- The Reserve canonical catalogue foundation.
-- Additive only. Deliberately does not enable pgvector or create embedding data.

create extension if not exists pgcrypto;

create type ownership_type as enum (
  'foundation',
  'family',
  'independent_private',
  'public_company',
  'conglomerate',
  'state_owned',
  'other'
);

create type lineage_continuity as enum (
  'continuous',
  'dormant_revival',
  'trademark_revival',
  'successor',
  'disputed'
);

create type review_state as enum (
  'draft',
  'in_review',
  'accepted',
  'quarantined',
  'excluded'
);

create type verification_tier as enum (
  'verified',
  'provisional',
  'rejected'
);

create type entity_type as enum (
  'brand',
  'ownership_period',
  'service_region',
  'collection',
  'reference_model',
  'reference_variant',
  'price_snapshot',
  'market_snapshot',
  'editorial_claim'
);

create type lug_curvature as enum ('flat', 'moderate', 'steep');
create type movement_type as enum (
  'automatic',
  'manual',
  'quartz',
  'solar',
  'spring_drive',
  'hybrid'
);
create type movement_source_type as enum (
  'in_house',
  'group_shared',
  'third_party_base',
  'third_party_finished'
);
create type crown_type as enum ('screw_down', 'push_pull');
create type crown_position as enum ('3', '4', '9_destro', 'other');
create type crystal_type as enum ('sapphire', 'mineral', 'acrylic', 'other');
create type lume_grade as enum ('none', 'weak', 'moderate', 'strong');
create type attachment_type as enum (
  'spring_bar',
  'quick_release',
  'proprietary',
  'integrated'
);
create type clasp_microadjustment as enum (
  'none',
  'half_links',
  'tool_adjusted',
  'tool_free_extension'
);
create type production_status as enum (
  'announced',
  'current',
  'discontinued'
);
create type contact_risk as enum ('none_known', 'possible', 'confirmed');
create type complication_type as enum (
  'date',
  'gmt',
  'chronograph',
  'moonphase',
  'power_reserve',
  'alarm',
  'world_time',
  'perpetual_calendar',
  'other'
);
create type price_kind as enum (
  'retail',
  'authorized_dealer',
  'grey_market_ask',
  'secondary_ask',
  'secondary_transaction'
);
create type watch_condition as enum (
  'new',
  'certified_pre_owned',
  'pre_owned',
  'vintage'
);
create type availability_state as enum (
  'in_stock',
  'partial_waitlist',
  'waitlist',
  'allocation',
  'unavailable'
);
create type hype_risk as enum ('low', 'medium', 'high');
create type liquidity_level as enum ('low', 'medium', 'high');
create type market_momentum as enum ('falling', 'stable', 'rising', 'volatile');
create type trait_axis as enum (
  'social_signal',
  'aesthetic_dna',
  'emotional_objective',
  'market_stance',
  'primary_archetype'
);
create type claim_kind as enum (
  'history',
  'ownership',
  'psychology',
  'perception',
  'design',
  'service',
  'risk',
  'buyer_remorse',
  'technology',
  'other'
);
create type completeness_level as enum ('m0', 'm1', 'm2');

create table sources (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  canonical_url text,
  title text,
  publisher text,
  source_type text not null,
  published_at timestamptz,
  retrieved_at timestamptz not null,
  archived_url text,
  content_hash text,
  created_at timestamptz not null default now(),
  unique (url, retrieved_at)
);

create table brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  founded_year integer check (founded_year between 1200 and 2200),
  lineage lineage_continuity,
  headquarters_country_code char(2),
  review_status review_state not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table brand_ownership_periods (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id),
  owner_name text not null,
  owner_type ownership_type,
  valid_from date,
  valid_to date,
  is_current boolean not null default false,
  review_status review_state not null default 'draft',
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_from is null or valid_to >= valid_from)
);

create unique index one_current_ownership_per_brand
  on brand_ownership_periods (brand_id)
  where is_current;

create table brand_service_regions (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id),
  country_code char(2) not null,
  manufacturer_service_available boolean,
  independent_parts_access boolean,
  typical_lead_time_days_low integer check (typical_lead_time_days_low >= 0),
  typical_lead_time_days_high integer check (typical_lead_time_days_high >= 0),
  review_status review_state not null default 'draft',
  created_at timestamptz not null default now(),
  unique (brand_id, country_code),
  check (
    typical_lead_time_days_high is null
    or typical_lead_time_days_low is null
    or typical_lead_time_days_high >= typical_lead_time_days_low
  )
);

create table collections (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id),
  slug text not null,
  name text not null,
  launched_year integer check (launched_year between 1200 and 2200),
  discontinued_year integer check (discontinued_year between 1200 and 2200),
  review_status review_state not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, slug),
  check (
    discontinued_year is null
    or launched_year is null
    or discontinued_year >= launched_year
  )
);

create table reference_models (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references collections(id),
  slug text not null,
  model_name text not null,
  production_start_year integer check (production_start_year between 1200 and 2200),
  production_end_year integer check (production_end_year between 1200 and 2200),
  review_status review_state not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (collection_id, slug),
  check (
    production_end_year is null
    or production_start_year is null
    or production_end_year >= production_start_year
  )
);

-- Ranking and filtering operate on this table, never on brand rollups or a
-- marketing family row that mixes sizes/materials.
create table reference_variants (
  id uuid primary key default gen_random_uuid(),
  reference_model_id uuid not null references reference_models(id),
  variant_key text not null,
  reference_code text,
  variant_name text not null,
  dial_variant text,
  case_material text,
  caseback_material text,
  bracelet_material text,
  strap_material text,
  nickel_contact_risk contact_risk,
  case_diameter_mm numeric(6, 2) check (case_diameter_mm > 0),
  case_thickness_mm numeric(6, 2) check (case_thickness_mm > 0),
  lug_to_lug_mm numeric(6, 2) check (lug_to_lug_mm > 0),
  lug_to_lug_measured boolean,
  lug_width_mm numeric(6, 2) check (lug_width_mm > 0),
  lug_curvature lug_curvature,
  integrated_bracelet boolean,
  weight_head_g numeric(7, 2) check (weight_head_g > 0),
  weight_full_g numeric(7, 2) check (weight_full_g > 0),
  movement_type movement_type,
  movement_source movement_source_type,
  caliber_ref text,
  power_reserve_h numeric(7, 2) check (power_reserve_h > 0),
  accuracy_lower_seconds numeric(9, 3),
  accuracy_upper_seconds numeric(9, 3),
  accuracy_period_days numeric(8, 3) check (accuracy_period_days > 0),
  accuracy_basis text,
  antimagnetic_gauss numeric(12, 2) check (antimagnetic_gauss >= 0),
  antimagnetic_spec text,
  water_resistance_m integer check (water_resistance_m >= 0),
  crown_type crown_type,
  crown_position crown_position,
  crystal crystal_type,
  lume_grade lume_grade,
  bracelet_attachment attachment_type,
  clasp_microadjust clasp_microadjustment,
  shock_resistant boolean,
  shock_resistance_spec text,
  production_status production_status,
  production_start_year integer check (production_start_year between 1200 and 2200),
  production_end_year integer check (production_end_year between 1200 and 2200),
  review_status review_state not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reference_model_id, variant_key),
  check (
    accuracy_upper_seconds is null
    or accuracy_lower_seconds is null
    or accuracy_upper_seconds >= accuracy_lower_seconds
  ),
  check (
    production_end_year is null
    or production_start_year is null
    or production_end_year >= production_start_year
  )
);

create table reference_complications (
  reference_variant_id uuid not null references reference_variants(id),
  complication complication_type not null,
  detail text,
  primary key (reference_variant_id, complication)
);

create table price_snapshots (
  id uuid primary key default gen_random_uuid(),
  reference_variant_id uuid not null references reference_variants(id),
  kind price_kind not null,
  condition watch_condition not null,
  currency char(3) not null,
  amount_low_minor bigint not null check (amount_low_minor >= 0),
  amount_high_minor bigint check (amount_high_minor >= 0),
  market_country_code char(2),
  observed_at timestamptz not null,
  stale_after timestamptz,
  review_status review_state not null default 'draft',
  created_at timestamptz not null default now(),
  check (
    amount_high_minor is null
    or amount_high_minor >= amount_low_minor
  ),
  check (stale_after is null or stale_after >= observed_at)
);

create table market_snapshots (
  id uuid primary key default gen_random_uuid(),
  reference_variant_id uuid not null references reference_variants(id),
  market_country_code char(2),
  availability availability_state,
  secondary_ratio_low numeric(7, 4) check (secondary_ratio_low >= 0),
  secondary_ratio_high numeric(7, 4) check (secondary_ratio_high >= 0),
  hype_risk hype_risk,
  liquidity liquidity_level,
  estimated_sale_days_low integer check (estimated_sale_days_low >= 0),
  estimated_sale_days_high integer check (estimated_sale_days_high >= 0),
  typical_sale_spread_percent numeric(7, 3) check (
    typical_sale_spread_percent between 0 and 100
  ),
  momentum market_momentum,
  speculative_bubble boolean,
  observed_at timestamptz not null,
  stale_after timestamptz,
  review_status review_state not null default 'draft',
  created_at timestamptz not null default now(),
  check (
    secondary_ratio_high is null
    or secondary_ratio_low is null
    or secondary_ratio_high >= secondary_ratio_low
  ),
  check (
    estimated_sale_days_high is null
    or estimated_sale_days_low is null
    or estimated_sale_days_high >= estimated_sale_days_low
  ),
  check (stale_after is null or stale_after >= observed_at)
);

create table reference_traits (
  reference_variant_id uuid not null references reference_variants(id),
  axis trait_axis not null,
  value text not null,
  weight numeric(5, 4) check (weight between 0 and 1),
  review_status review_state not null default 'draft',
  primary key (reference_variant_id, axis, value)
);

create table brand_traits (
  brand_id uuid not null references brands(id),
  axis trait_axis not null,
  value text not null,
  weight numeric(5, 4) check (weight between 0 and 1),
  review_status review_state not null default 'draft',
  primary key (brand_id, axis, value)
);

create table editorial_claims (
  id uuid primary key default gen_random_uuid(),
  subject_type entity_type not null,
  subject_id uuid not null,
  kind claim_kind not null,
  body text not null,
  decision_relevant boolean not null default false,
  review_status review_state not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table claim_sources (
  editorial_claim_id uuid not null references editorial_claims(id),
  source_id uuid not null references sources(id),
  supports_claim boolean not null,
  note text,
  primary key (editorial_claim_id, source_id)
);

-- Evidence is attached to the accepted value of one field. Query columns stay
-- typed and fast; this sidecar avoids turning the catalogue into an EAV store.
create table field_evidence (
  id uuid primary key default gen_random_uuid(),
  subject_type entity_type not null,
  subject_id uuid not null,
  field_name text not null,
  value_hash text not null,
  source_id uuid not null references sources(id),
  observed_at timestamptz,
  retrieved_at timestamptz not null,
  verified_at timestamptz,
  stale_after timestamptz,
  tier verification_tier not null,
  reviewer text,
  review_note text,
  created_at timestamptz not null default now(),
  unique (subject_type, subject_id, field_name, value_hash, source_id),
  check (
    stale_after is null
    or observed_at is null
    or stale_after >= observed_at
  )
);

create table completeness_evaluations (
  id uuid primary key default gen_random_uuid(),
  subject_type entity_type not null,
  subject_id uuid not null,
  level completeness_level not null,
  filter_contract_version integer not null check (filter_contract_version > 0),
  complete boolean not null,
  completeness_score numeric(5, 4) not null check (
    completeness_score between 0 and 1
  ),
  missing_fields text[] not null,
  evaluated_at timestamptz not null,
  unique (subject_type, subject_id, level, filter_contract_version)
);

create table review_queue (
  id uuid primary key default gen_random_uuid(),
  subject_type entity_type not null,
  subject_id uuid not null,
  reason text not null,
  status review_state not null default 'draft',
  priority smallint not null default 0,
  assigned_to text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index reference_variants_filter_geometry_idx
  on reference_variants (
    case_diameter_mm,
    lug_to_lug_mm,
    case_thickness_mm,
    weight_full_g
  );
create index reference_variants_filter_operation_idx
  on reference_variants (
    movement_type,
    water_resistance_m,
    production_status
  );
create index price_snapshots_current_lookup_idx
  on price_snapshots (reference_variant_id, kind, condition, currency, observed_at desc);
create index market_snapshots_current_lookup_idx
  on market_snapshots (reference_variant_id, observed_at desc);
create index field_evidence_subject_field_idx
  on field_evidence (subject_type, subject_id, field_name, tier);
create index field_evidence_staleness_idx
  on field_evidence (stale_after)
  where stale_after is not null;
create index editorial_claims_subject_idx
  on editorial_claims (subject_type, subject_id, kind, review_status);
create index review_queue_open_idx
  on review_queue (priority desc, created_at)
  where status in ('draft', 'in_review', 'quarantined');

comment on table brands is
  'Brand-level ownership, lineage, and contextual identity. Never a ranking unit.';
comment on table reference_variants is
  'Materially, dimensionally, mechanically, and commercially homogeneous ranking unit.';
comment on table field_evidence is
  'Per-field provenance and staleness sidecar for typed canonical facts.';
comment on column market_snapshots.hype_risk is
  'Scarcity and premium behavior; not a proxy for resale speed.';
comment on column market_snapshots.liquidity is
  'Expected resale speed/spread; orthogonal to hype risk.';
