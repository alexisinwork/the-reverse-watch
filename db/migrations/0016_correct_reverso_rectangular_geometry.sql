-- Correct the accepted Reverso Q3988481 geometry after adding explicit
-- rectangular dimensions in migration 0015. Jaeger-LeCoultre publishes the
-- case as L x W = 47 x 28.3 mm and explicitly defines L as lug-to-lug.

update public.reference_variants
set
  case_diameter_mm = null,
  case_width_mm = 28.3,
  case_length_mm = 47,
  updated_at = now()
where variant_key = 'jlc-q3988481'
  and (
    case_diameter_mm is not null
    or case_width_mm is distinct from 28.3
    or case_length_mm is distinct from 47
  );

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'reference_variants_rectangular_pair_check'
      and conrelid = 'public.reference_variants'::regclass
  ) then
    alter table public.reference_variants
      add constraint reference_variants_rectangular_pair_check
      check (
        (case_width_mm is null and case_length_mm is null)
        or (case_width_mm is not null and case_length_mm is not null)
      );
  end if;
end
$$;

delete from public.field_evidence
where subject_type = 'reference_variant'
  and subject_id = (
    select id
    from public.reference_variants
    where variant_key = 'jlc-q3988481'
  )
  and field_name = 'caseDiameterMm';

insert into public.field_evidence (
  subject_type, subject_id, field_name, value_hash, source_id,
  observed_at, retrieved_at, verified_at, tier, reviewer
)
select
  'reference_variant',
  rv.id,
  evidence.field_name,
  evidence.value_hash,
  s.id,
  s.retrieved_at,
  s.retrieved_at,
  now(),
  'verified',
  'rectangular-geometry-v1'
from public.reference_variants rv
cross join (
  values
    ('caseWidthMm', 'b836434a71278918ed521f3ae59d02c7acc9fdd90ac46c9356366ef8fc94c949'),
    ('caseLengthMm', '31489056e0916d59fe3add79e63f095af3ffb81604691f21cad442a85c7be617')
) as evidence(field_name, value_hash)
join public.sources s
  on s.url = 'https://www.jaeger-lecoultre.com/us-en/watches/reverso/reverso-tribute/reverso-tribute-duoface-small-seconds-q3988481'
  and s.retrieved_at = '2026-08-28T18:30:00Z'::timestamptz
where rv.variant_key = 'jlc-q3988481'
on conflict (subject_type, subject_id, field_name, value_hash, source_id)
do update set
  observed_at = excluded.observed_at,
  retrieved_at = excluded.retrieved_at,
  verified_at = excluded.verified_at,
  tier = 'verified',
  reviewer = excluded.reviewer;

insert into public.completeness_evaluations (
  subject_type, subject_id, level, filter_contract_version, complete,
  completeness_score, missing_fields, evaluated_at
)
select
  'reference_variant',
  rv.id,
  evaluation.level::completeness_level,
  1,
  evaluation.complete,
  evaluation.completeness_score,
  evaluation.missing_fields,
  now()
from public.reference_variants rv
cross join (
  values
    ('m0', true, 1.0000::numeric, array[]::text[]),
    ('m1', false, 0.8571::numeric, array['weightFullG', 'accuracy']::text[])
) as evaluation(level, complete, completeness_score, missing_fields)
where rv.variant_key = 'jlc-q3988481'
on conflict (subject_type, subject_id, level, filter_contract_version)
do update set
  complete = excluded.complete,
  completeness_score = excluded.completeness_score,
  missing_fields = excluded.missing_fields,
  evaluated_at = excluded.evaluated_at;

-- Version 2 enriches every accepted variant with explicit nullable width and
-- length while retaining the existing source-backed v1 projection internally.
create or replace function public.recommendation_catalogue_v2()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with base as (
  select public.recommendation_catalogue_v1() as catalogue
),
enriched_variants as (
  select
    variant.value ->> 'id' as variant_key,
    jsonb_set(
      jsonb_set(
        variant.value,
        '{geometry,caseWidthMm}',
        coalesce(to_jsonb(rv.case_width_mm), 'null'::jsonb),
        true
      ),
      '{geometry,caseLengthMm}',
      coalesce(to_jsonb(rv.case_length_mm), 'null'::jsonb),
      true
    ) as variant
  from base
  cross join lateral jsonb_array_elements(base.catalogue -> 'variants') as variant(value)
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
select jsonb_set(base.catalogue, '{variants}', variant_set.variants, true)
from base
cross join variant_set;
$$;

-- Version 2 delegates the unchanged predicates to v1, then replaces only the
-- fit decision for variants that have verified overall case length but no
-- verified conventional lug-to-lug. This is the SQL equivalent of
-- verifiedCaseWearingSpanMm in the TypeScript engine.
create or replace function public.recommendation_hard_filter_v2(
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
  select public.recommendation_hard_filter_v1(p_profile, p_as_of) as evaluation
),
case_length_fallbacks as (
  select
    rv.variant_key,
    rv.case_length_mm,
    exists (
      select 1
      from public.field_evidence fe
      where fe.subject_type = 'reference_variant'
        and fe.subject_id = rv.id
        and fe.field_name = 'caseLengthMm'
        and fe.tier = 'verified'
    ) as case_length_verified,
    rv.lug_to_lug_mm is not null
      and exists (
        select 1
        from public.field_evidence fe
        where fe.subject_type = 'reference_variant'
          and fe.subject_id = rv.id
          and fe.field_name = 'lugToLugMm'
          and fe.tier = 'verified'
      ) as lug_to_lug_verified
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
      when fallback.case_length_mm is not null
        and fallback.case_length_verified
        and not fallback.lug_to_lug_verified
      then jsonb_set(
        jsonb_set(
          entry.evaluation,
          '{missingFacts}',
          coalesce(
            (
              select jsonb_agg(missing.value order by missing.ordinality)
              from jsonb_array_elements(entry.evaluation -> 'missingFacts')
                with ordinality as missing(value, ordinality)
              where missing.value <> to_jsonb('lug_to_lug'::text)
            ),
            '[]'::jsonb
          ),
          true
        ),
        '{hardReasons}',
        case
          when fallback.case_length_mm
              > (p_profile #>> '{core,wristCircumferenceMm}')::numeric * 0.31
            and not (entry.evaluation -> 'hardReasons' ? 'fit_exceeds_wrist')
          then (entry.evaluation -> 'hardReasons')
            || jsonb_build_array('fit_exceeds_wrist')
          else entry.evaluation -> 'hardReasons'
        end,
        true
      )
      else entry.evaluation
    end as evaluation
  from entries entry
  left join case_length_fallbacks fallback
    on fallback.variant_key = entry.variant_key
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

revoke all on function public.recommendation_catalogue_v2() from public;
revoke all on function public.recommendation_hard_filter_v2(jsonb, timestamptz)
  from public;
grant execute on function public.recommendation_catalogue_v2()
  to anon, service_role;
grant execute on function public.recommendation_hard_filter_v2(jsonb, timestamptz)
  to anon, service_role;

revoke execute on function public.recommendation_catalogue_v1()
  from anon, authenticated, service_role;
revoke execute on function public.recommendation_hard_filter_v1(jsonb, timestamptz)
  from anon, authenticated, service_role;

comment on function public.recommendation_catalogue_v2() is
  'Accepted catalogue facts with explicit round or non-round case geometry.';
comment on function public.recommendation_hard_filter_v2(jsonb, timestamptz) is
  'Versioned SQL hard-filter codes with verified non-round case-length fit fallback.';
