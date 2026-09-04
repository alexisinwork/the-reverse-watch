-- Version-4 catalogue and hard-filter RPCs for the sheet-native questionnaire.
-- Additive only: the v3 functions stay in place for rollback.
--
-- recommendation_hard_filter_v4 mirrors evaluateHardFiltersV3 in
-- app/domain/recommendation.ts check for check, including its rule that an
-- unverified fact is reported as missing rather than passing the filter.
-- scripts/audit-catalogue-parity.ts is the gate that holds the two together.

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
)
select jsonb_set(base.catalogue, '{variants}', variant_set.variants, true)
from base
cross join variant_set;
$$;

revoke all on function public.recommendation_catalogue_v4() from public;
grant execute on function public.recommendation_catalogue_v4()
  to anon, service_role;

comment on function public.recommendation_catalogue_v4() is
  'Accepted recommendation catalogue with the sheet-native variant fields.';

create or replace function public.recommendation_hard_filter_v4(
  p_profile jsonb,
  p_as_of timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with params as (
  select
    p_profile ->> 'budgetCurrency' as budget_currency,
    (p_profile ->> 'budgetMax')::numeric as budget_max,
    coalesce(p_profile -> 'wearingScenarios', '[]'::jsonb) as wearing_scenarios,
    coalesce((p_profile ->> 'minimumWaterResistanceM')::numeric, 0)
      as minimum_water_resistance_m,
    (p_profile ->> 'caseDiameterMinMm')::numeric as case_diameter_min_mm,
    (p_profile ->> 'caseDiameterMaxMm')::numeric as case_diameter_max_mm,
    coalesce(p_profile -> 'movementTypes', '[]'::jsonb) as movement_types,
    coalesce(p_profile -> 'requiredComplications', '[]'::jsonb)
      as required_complications,
    p_profile ->> 'allergyConstraint' as allergy_constraint
),
latest_prices as (
  select distinct on (ps.reference_variant_id)
    ps.*
  from public.price_snapshots ps
  where ps.review_status = 'accepted'
  order by
    ps.reference_variant_id,
    case ps.kind
      when 'retail' then 0
      when 'authorized_dealer' then 1
      when 'grey_market_ask' then 2
      when 'secondary_ask' then 3
      when 'secondary_transaction' then 4
    end,
    ps.observed_at desc,
    ps.id
),
reference_evidence as (
  select
    fe.subject_id as reference_variant_id,
    array_agg(distinct fe.field_name) as fields
  from public.field_evidence fe
  where fe.subject_type = 'reference_variant'
    and fe.tier = 'verified'
  group by fe.subject_id
),
price_evidence as (
  select
    ps.id as price_snapshot_id,
    bool_or(fe.tier = 'verified' and fe.field_name = 'amount_low_minor')
      as verified
  from public.price_snapshots ps
  left join public.field_evidence fe
    on fe.subject_type = 'price_snapshot'
    and fe.subject_id = ps.id
  group by ps.id
),
fx_batch as (
  select
    fx.quote_currency,
    fx.rate,
    fx.stale_after
  from public.fx_rate_snapshots fx
  where fx.review_status = 'accepted'
    and fx.base_currency = 'EUR'
    and fx.observed_at = (
      select max(inner_fx.observed_at)
      from public.fx_rate_snapshots inner_fx
      where inner_fx.review_status = 'accepted'
        and inner_fx.base_currency = 'EUR'
    )
),
scenario_sets as (
  select
    rvs.variant_id,
    array_agg(cv.slug) as slugs
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
    array_agg(cv.slug) as slugs
  from public.reference_variant_complication rvc
  join public.catalogue_vocabulary cv
    on cv.id = rvc.vocabulary_id
    and cv.kind = 'complication'
    and cv.active
  group by rvc.variant_id
),
candidate_facts as (
  select
    rv.variant_key,
    lp.amount_low_minor,
    lp.currency::text as price_currency,
    lp.stale_after as price_stale_after,
    coalesce(pe.verified, false) as price_verified,
    rv.case_diameter_mm,
    rv.case_thickness_mm,
    rv.water_resistance_m,
    rv.movement_type::text as movement_type,
    rv.nickel_contact_risk::text as nickel_contact_risk,
    coalesce(re.fields, array[]::text[]) as evidence_fields,
    coalesce(ss.slugs, array[]::text[]) as scenario_slugs,
    coalesce(cs.slugs, array[]::text[]) as complication_slugs,
    source_fx.rate as source_fx_rate,
    target_fx.rate as target_fx_rate,
    least(source_fx.stale_after, target_fx.stale_after) as fx_stale_after
  from public.reference_variants rv
  join public.reference_models rm
    on rm.id = rv.reference_model_id
    and rm.review_status = 'accepted'
  join public.collections c
    on c.id = rm.collection_id
    and c.review_status = 'accepted'
  join public.brands b
    on b.id = c.brand_id
    and b.review_status = 'accepted'
  join latest_prices lp on lp.reference_variant_id = rv.id
  left join reference_evidence re on re.reference_variant_id = rv.id
  left join price_evidence pe on pe.price_snapshot_id = lp.id
  left join scenario_sets ss on ss.variant_id = rv.id
  left join complication_sets cs on cs.variant_id = rv.id
  left join fx_batch source_fx on source_fx.quote_currency = lp.currency
  cross join params p
  left join fx_batch target_fx on target_fx.quote_currency = p.budget_currency
  where rv.review_status = 'accepted'
),
normalized as (
  select
    cf.*,
    p.*,
    -- The TypeScript predicate treats an absent or expired rate as unusable
    -- rather than converting with a stale number.
    (
      cf.price_currency <> p.budget_currency
      and (
        cf.source_fx_rate is null
        or cf.target_fx_rate is null
        or cf.fx_stale_after < p_as_of
      )
    ) as fx_unusable,
    case
      when cf.price_currency = p.budget_currency then cf.amount_low_minor::numeric
      when cf.source_fx_rate is null or cf.target_fx_rate is null then null
      else round(cf.amount_low_minor::numeric / cf.source_fx_rate * cf.target_fx_rate)
    end as converted_price_minor,
    round(p.budget_max * 100) as budget_ceiling_minor,
    (
      cf.price_verified is not true
      or cf.price_stale_after < p_as_of
    ) as price_missing
  from candidate_facts cf
  cross join params p
),
evaluated as (
  select
    n.variant_key,
    array_remove(array[
      case when
        not n.price_missing
        and not n.fx_unusable
        and n.converted_price_minor > n.budget_ceiling_minor
      then 'over_budget' end,
      case when
        n.case_diameter_mm is not null
        and 'caseDiameterMm' = any(n.evidence_fields)
        and (
          n.case_diameter_mm < n.case_diameter_min_mm
          or n.case_diameter_mm > n.case_diameter_max_mm
        )
      then 'case_diameter_out_of_range' end,
      case when
        n.minimum_water_resistance_m > 0
        and n.water_resistance_m is not null
        and 'waterResistanceM' = any(n.evidence_fields)
        and n.water_resistance_m < n.minimum_water_resistance_m
      then 'water_resistance_below_minimum' end,
      case when
        not (n.movement_types ? coalesce(n.movement_type, ''))
      then 'movement_type_mismatch' end,
      case when
        cardinality(n.scenario_slugs) > 0
        and not exists (
          select 1
          from jsonb_array_elements_text(n.wearing_scenarios) as wanted(slug)
          where wanted.slug = any(n.scenario_slugs)
        )
      then 'scenario_mismatch' end,
      case when
        exists (
          select 1
          from jsonb_array_elements_text(n.required_complications)
            as required(slug)
          where not (required.slug = any(n.complication_slugs))
        )
      then 'missing_complication' end,
      case when
        n.allergy_constraint = 'nickel_contact'
        and n.nickel_contact_risk is not null
        and 'nickelContactRisk' = any(n.evidence_fields)
        and n.nickel_contact_risk <> 'none_known'
      then 'allergy_risk' end
    ]::text[], null) as hard_reasons,
    array_remove(array[
      case when n.fx_unusable then 'fx_rate' end,
      case when n.price_missing then 'price' end,
      case when
        n.case_diameter_mm is null
        or not ('caseDiameterMm' = any(n.evidence_fields))
      then 'case_diameter' end,
      case when
        n.minimum_water_resistance_m > 0
        and (
          n.water_resistance_m is null
          or not ('waterResistanceM' = any(n.evidence_fields))
        )
      then 'water_resistance' end,
      case when cardinality(n.scenario_slugs) = 0
      then 'wearing_scenarios' end,
      case when
        n.allergy_constraint = 'nickel_contact'
        and (
          n.nickel_contact_risk is null
          or not ('nickelContactRisk' = any(n.evidence_fields))
        )
      then 'nickel_contact_risk' end
    ]::text[], null) as missing_facts
  from normalized n
)
select coalesce(
  jsonb_object_agg(
    e.variant_key,
    jsonb_build_object(
      'hardReasons', to_jsonb(e.hard_reasons),
      'missingFacts', to_jsonb(e.missing_facts)
    )
    order by e.variant_key
  ),
  '{}'::jsonb
)
from evaluated e;
$$;

revoke all on function public.recommendation_hard_filter_v4(jsonb, timestamptz)
  from public;
grant execute on function public.recommendation_hard_filter_v4(jsonb, timestamptz)
  to anon, service_role;

comment on function public.recommendation_hard_filter_v4(jsonb, timestamptz) is
  'Version-3 questionnaire hard-filter codes over accepted catalogue facts.';
