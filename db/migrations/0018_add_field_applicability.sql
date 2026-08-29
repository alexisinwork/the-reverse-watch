-- Distinguish an unknown null field from a reviewed physical non-applicability.
-- The first supported case is a proprietary/central-lug construction for which
-- a conventional between-lugs width does not exist. Existing evidence remains
-- observed by default; no historical null is reclassified automatically.

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_type t
    join pg_catalog.pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'field_value_state'
  ) then
    create type public.field_value_state as enum (
      'observed',
      'not_applicable'
    );
  end if;
end
$$;

alter table public.field_evidence
  add column if not exists value_state public.field_value_state
  not null default 'observed';

create index if not exists field_evidence_applicability_idx
  on public.field_evidence (
    subject_type,
    subject_id,
    field_name,
    value_state
  )
  where tier = 'verified';

-- Version 3 adds a sparse fieldApplicability object. An empty object means no
-- reviewed non-applicable exception; unknown values remain null and unevidenced.
create or replace function public.recommendation_catalogue_v3()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with base as (
  select public.recommendation_catalogue_v2() as catalogue
),
enriched_variants as (
  select
    variant.value ->> 'id' as variant_key,
    jsonb_set(
      variant.value,
      '{fieldApplicability}',
      coalesce(
        (
          select jsonb_object_agg(
            applicable.field_name,
            to_jsonb('not_applicable'::text)
            order by applicable.field_name
          )
          from (
            select distinct fe.field_name
            from public.field_evidence fe
            where fe.subject_type = 'reference_variant'
              and fe.subject_id = rv.id
              and fe.tier = 'verified'
              and fe.value_state = 'not_applicable'
          ) applicable
        ),
        '{}'::jsonb
      ),
      true
    ) as variant
  from base
  cross join lateral jsonb_array_elements(base.catalogue -> 'variants')
    as variant(value)
  join public.reference_variants rv
    on rv.variant_key = variant.value ->> 'id'
),
variant_set as (
  select coalesce(
    jsonb_agg(ev.variant order by ev.variant_key),
    '[]'::jsonb
  ) as variants
  from enriched_variants ev
)
select jsonb_set(
  jsonb_set(base.catalogue, '{variants}', variant_set.variants, true),
  '{catalogueVersion}',
  '2'::jsonb,
  true
)
from base
cross join variant_set;
$$;

-- Version 3 delegates every existing predicate to v2 and changes only the
-- reviewed non-applicable lug-width branch. Unknown null remains a missing fact.
create or replace function public.recommendation_hard_filter_v3(
  p_profile jsonb,
  p_as_of timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with base as (
  select public.recommendation_hard_filter_v2(p_profile, p_as_of) as evaluation
),
lug_width_states as (
  select
    rv.variant_key,
    exists (
      select 1
      from public.field_evidence fe
      where fe.subject_type = 'reference_variant'
        and fe.subject_id = rv.id
        and fe.field_name = 'lugWidthMm'
        and fe.tier = 'verified'
        and fe.value_state = 'not_applicable'
    ) as not_applicable
  from public.reference_variants rv
  where rv.review_status = 'accepted'
),
entries as (
  select entry.key as variant_key, entry.value as evaluation
  from base
  cross join lateral jsonb_each(base.evaluation) as entry(key, value)
),
corrected as (
  select
    entry.variant_key,
    case
      when (p_profile #>> '{refinement,requiredLugWidthMm}')::numeric is not null
        and coalesce(state.not_applicable, false)
      then jsonb_set(
        jsonb_set(
          entry.evaluation,
          '{missingFacts}',
          coalesce(
            (
              select jsonb_agg(missing.value order by missing.ordinality)
              from jsonb_array_elements(entry.evaluation -> 'missingFacts')
                with ordinality as missing(value, ordinality)
              where missing.value <> to_jsonb('lug_width'::text)
            ),
            '[]'::jsonb
          ),
          true
        ),
        '{hardReasons}',
        case
          when entry.evaluation -> 'hardReasons'
            ? 'lug_width_not_applicable'
          then entry.evaluation -> 'hardReasons'
          else entry.evaluation -> 'hardReasons'
            || jsonb_build_array('lug_width_not_applicable')
        end,
        true
      )
      else entry.evaluation
    end as evaluation
  from entries entry
  left join lug_width_states state
    on state.variant_key = entry.variant_key
)
select coalesce(
  jsonb_object_agg(
    corrected.variant_key,
    corrected.evaluation
    order by corrected.variant_key
  ),
  '{}'::jsonb
)
from corrected;
$$;

revoke all on function public.recommendation_catalogue_v3() from public;
revoke all on function public.recommendation_hard_filter_v3(jsonb, timestamptz)
  from public;
grant execute on function public.recommendation_catalogue_v3()
  to anon, service_role;
grant execute on function public.recommendation_hard_filter_v3(jsonb, timestamptz)
  to anon, service_role;

revoke execute on function public.recommendation_catalogue_v2()
  from anon, authenticated, service_role;
revoke execute on function public.recommendation_hard_filter_v2(jsonb, timestamptz)
  from anon, authenticated, service_role;

comment on column public.field_evidence.value_state is
  'Observed is a sourced value; not_applicable is a reviewed physical exception, never an unknown null.';
comment on function public.recommendation_catalogue_v3() is
  'Accepted catalogue facts with sparse reviewed per-field applicability states.';
comment on function public.recommendation_hard_filter_v3(jsonb, timestamptz) is
  'Versioned SQL hard-filter codes distinguishing verified non-applicability from missing lug-width evidence.';
