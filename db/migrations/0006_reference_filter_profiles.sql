-- Typed query surfaces for reviewed deployment and ownership-friction profiles.
-- These classifications were previously retained only in field evidence and
-- therefore could not participate in SQL hard filters.

do $$
begin
  create type deployment_environment as enum (
    'field_water_abuse',
    'studio_desk_daily',
    'formal_architectural'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type ownership_friction_level as enum (
    'zero_maintenance',
    'workhorse_mechanical',
    'specialist_mechanical'
  );
exception
  when duplicate_object then null;
end
$$;

create table if not exists reference_deployment_profiles (
  reference_variant_id uuid not null references reference_variants(id),
  environment deployment_environment not null,
  review_status review_state not null default 'draft',
  primary key (reference_variant_id, environment)
);

create table if not exists reference_ownership_friction_profiles (
  reference_variant_id uuid not null references reference_variants(id),
  friction_level ownership_friction_level not null,
  review_status review_state not null default 'draft',
  primary key (reference_variant_id, friction_level)
);

with seed_profiles (variant_key, environments) as (
  values
    ('timex-tw2y40300', array['field_water_abuse', 'studio_desk_daily']),
    ('citizen-bn0150-28e', array['field_water_abuse', 'studio_desk_daily']),
    ('hamilton-h69439131', array['studio_desk_daily']),
    ('tissot-t1372071104100', array['studio_desk_daily', 'formal_architectural']),
    ('seiko-ssc813', array['field_water_abuse', 'studio_desk_daily']),
    ('mido-m0495261104100', array['studio_desk_daily', 'formal_architectural']),
    ('nomos-746', array['studio_desk_daily', 'formal_architectural']),
    ('grand-seiko-sbgn029', array['field_water_abuse', 'studio_desk_daily']),
    ('longines-l38024636', array['field_water_abuse', 'studio_desk_daily']),
    ('rolex-124270', array['field_water_abuse', 'studio_desk_daily', 'formal_architectural']),
    ('rolex-124273', array['field_water_abuse', 'studio_desk_daily', 'formal_architectural']),
    ('jlc-q3988481', array['studio_desk_daily', 'formal_architectural'])
)
insert into reference_deployment_profiles (
  reference_variant_id,
  environment,
  review_status
)
select
  rv.id,
  environment.value::deployment_environment,
  'accepted'
from seed_profiles profile
join reference_variants rv on rv.variant_key = profile.variant_key
cross join lateral unnest(profile.environments) as environment(value)
on conflict (reference_variant_id, environment) do update set
  review_status = excluded.review_status;

with seed_profiles (variant_key, friction_levels) as (
  values
    ('timex-tw2y40300', array['zero_maintenance']),
    ('citizen-bn0150-28e', array['zero_maintenance']),
    ('hamilton-h69439131', array['workhorse_mechanical']),
    ('tissot-t1372071104100', array['workhorse_mechanical']),
    ('seiko-ssc813', array['zero_maintenance']),
    ('mido-m0495261104100', array['workhorse_mechanical']),
    ('nomos-746', array['specialist_mechanical']),
    ('grand-seiko-sbgn029', array['zero_maintenance']),
    ('longines-l38024636', array['workhorse_mechanical']),
    ('rolex-124270', array['workhorse_mechanical']),
    ('rolex-124273', array['workhorse_mechanical']),
    ('jlc-q3988481', array['specialist_mechanical'])
)
insert into reference_ownership_friction_profiles (
  reference_variant_id,
  friction_level,
  review_status
)
select
  rv.id,
  friction.value::ownership_friction_level,
  'accepted'
from seed_profiles profile
join reference_variants rv on rv.variant_key = profile.variant_key
cross join lateral unnest(profile.friction_levels) as friction(value)
on conflict (reference_variant_id, friction_level) do update set
  review_status = excluded.review_status;

create index if not exists reference_deployment_profiles_environment_idx
  on reference_deployment_profiles (environment, reference_variant_id);

create index if not exists reference_ownership_friction_profiles_level_idx
  on reference_ownership_friction_profiles (friction_level, reference_variant_id);

revoke all privileges on table
  reference_deployment_profiles,
  reference_ownership_friction_profiles
from anon, authenticated;

comment on table reference_deployment_profiles is
  'Reviewed reference-level deployment compatibility used by SQL hard filters.';

comment on table reference_ownership_friction_profiles is
  'Reviewed reference-level movement and service tolerance used by SQL hard filters.';
