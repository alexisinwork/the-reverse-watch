-- Backfill the scenario and complication join tables for the reviewed
-- variants, mirroring scripts/migrate-seed-catalogue-v3.ts exactly so the
-- relational catalogue and data/catalogue/seed-catalogue.json agree.
--
-- Migration 0065 added the tables and columns but left them empty; without
-- this backfill recommendation_hard_filter_v4 reports wearing_scenarios as a
-- missing fact for every variant and the parity audit cannot pass.
--
-- The remaining 0065 columns (case shape, display caseback, movement
-- construction, micro-adjustment, positioning) stay null: no sheet row has
-- been imported yet, and a missing fact is never given a plausible default.

insert into public.reference_variant_scenario (variant_id, vocabulary_id)
select distinct
  rv.id,
  cv.id
from public.reference_variants rv
join public.reference_deployment_profiles rdp
  on rdp.reference_variant_id = rv.id
  and rdp.review_status = 'accepted'
cross join lateral unnest(
  case rdp.environment::text
    when 'field_water_abuse' then array['sport', 'diving', 'field']
    when 'studio_desk_daily' then array['office', 'everyday', 'smart_casual']
    when 'formal_architectural' then array['suit', 'evening', 'reception']
    else array[]::text[]
  end
) as mapped(slug)
join public.catalogue_vocabulary cv
  on cv.kind = 'wearing_scenario'
  and cv.slug = mapped.slug
where rv.review_status = 'accepted'
on conflict (variant_id, vocabulary_id) do nothing;

with mapped_complications as (
  select
    rv.id as variant_id,
    rc.complication::text as slug
  from public.reference_variants rv
  join public.reference_complications rc
    on rc.reference_variant_id = rv.id
  where rv.review_status = 'accepted'
    and rc.complication::text <> 'other'
),
resolved as (
  select variant_id, slug from mapped_complications
  union
  -- A variant with no mapped function is time-only, matching the TypeScript
  -- forward migration rather than leaving the set empty.
  select rv.id, 'time_only'
  from public.reference_variants rv
  where rv.review_status = 'accepted'
    and not exists (
      select 1
      from mapped_complications mc
      where mc.variant_id = rv.id
    )
)
insert into public.reference_variant_complication (variant_id, vocabulary_id)
select distinct r.variant_id, cv.id
from resolved r
join public.catalogue_vocabulary cv
  on cv.kind = 'complication'
  and cv.slug = r.slug
on conflict (variant_id, vocabulary_id) do nothing;
