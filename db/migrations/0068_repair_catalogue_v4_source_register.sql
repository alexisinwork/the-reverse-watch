-- The catalogue RPC returned every row in public.sources, including the
-- discovery sources added for celebrity/cinema attribution. Their source types
-- are outside the recommendation catalogue's contract, so seedCatalogueSchema
-- rejected the whole payload and the server fell back to the bundled snapshot.
-- recommendation_catalogue_v3 has the same defect and is left untouched for
-- rollback.
--
-- The source register is now what it claims to be: the sources the returned
-- variants cite, plus the FX source.

create or replace function public.recommendation_catalogue_v4()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with base as (
  select public.recommendation_catalogue_v3() as catalogue
),
scenario_sets as (
  select
    rvs.variant_id,
    jsonb_agg(cv.slug order by cv.slug) as slugs
  from public.reference_variant_scenario rvs
  join public.catalogue_vocabulary cv
    on cv.id = rvs.vocabulary_id
    and cv.kind = 'wearing_scenario'
    and cv.active
  group by rvs.variant_id
),
complication_sets as (
  select
    rvc.variant_id,
    jsonb_agg(cv.slug order by cv.slug) as slugs
  from public.reference_variant_complication rvc
  join public.catalogue_vocabulary cv
    on cv.id = rvc.vocabulary_id
    and cv.kind = 'complication'
    and cv.active
  group by rvc.variant_id
),
enriched_variants as (
  select
    variant.value ->> 'id' as variant_key,
    variant.value
      || jsonb_build_object(
           'positioningLine', rv.positioning_line,
           'positioningGroup', rv.positioning_group,
           'wearingScenarios', coalesce(ss.slugs, '[]'::jsonb),
           'complicationSlugs', coalesce(cs.slugs, '[]'::jsonb),
           'geometry',
             (variant.value -> 'geometry')
               || jsonb_build_object('caseShape', rv.case_shape),
           'materials',
             (variant.value -> 'materials')
               || jsonb_build_object('displayCaseback', rv.display_caseback),
           'movement',
             (variant.value -> 'movement')
               || jsonb_build_object(
                    'construction', rv.movement_construction
                  ),
           'operation',
             (variant.value -> 'operation')
               || jsonb_build_object(
                    'microAdjustment',
                    case
                      when rv.micro_adjustment_present is null then null
                      else jsonb_build_object(
                        'present', rv.micro_adjustment_present,
                        'systemName', rv.micro_adjustment_system,
                        'rangeMm', rv.micro_adjustment_range_mm
                      )
                    end
                  )
         ) as variant
  from base
  cross join lateral jsonb_array_elements(base.catalogue -> 'variants')
    as variant(value)
  join public.reference_variants rv
    on rv.variant_key = variant.value ->> 'id'
  left join scenario_sets ss on ss.variant_id = rv.id
  left join complication_sets cs on cs.variant_id = rv.id
),
variant_set as (
  select coalesce(
    jsonb_agg(ev.variant order by ev.variant_key),
    '[]'::jsonb
  ) as variants
  from enriched_variants ev
),
cited_source_ids as (
  select distinct evidence.value ->> 'sourceId' as source_id
  from enriched_variants ev
  cross join lateral jsonb_array_elements(ev.variant -> 'evidence')
    as evidence(value)
  union
  select base.catalogue #>> '{fx,sourceId}'
  from base
),
source_set as (
  select coalesce(
    jsonb_agg(source.value order by source.value ->> 'id'),
    '[]'::jsonb
  ) as sources
  from base
  cross join lateral jsonb_array_elements(base.catalogue -> 'sources')
    as source(value)
  where source.value ->> 'id' in (select source_id from cited_source_ids)
)
select jsonb_set(
  jsonb_set(base.catalogue, '{variants}', variant_set.variants, true),
  '{sources}',
  source_set.sources,
  true
)
from base
cross join variant_set
cross join source_set;
$$;

comment on function public.recommendation_catalogue_v4() is
  'Accepted recommendation catalogue with the sheet-native variant fields and only the sources its variants cite.';
