-- The v1 predicate used SQL three-valued logic for an absent refinement
-- object. TypeScript correctly treats an omitted speculative-risk opt-in as
-- rejection, but SQL evaluated NOT(NULL) as NULL and omitted the hard reason.
-- Keep the existing v2 predicates and v3 applicability correction, then add a
-- fail-closed speculative correction from the latest accepted market row.

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
latest_prices as (
  select distinct on (ps.reference_variant_id)
    ps.reference_variant_id,
    ps.market_country_code
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
latest_markets as (
  select distinct on (ms.reference_variant_id, ms.market_country_code)
    ms.reference_variant_id,
    ms.market_country_code,
    ms.speculative_bubble
  from public.market_snapshots ms
  where ms.review_status = 'accepted'
  order by
    ms.reference_variant_id,
    ms.market_country_code,
    ms.observed_at desc,
    ms.id
),
speculative_states as (
  select
    rv.variant_key,
    coalesce(market.speculative_bubble, false) as speculative_bubble
  from public.reference_variants rv
  join latest_prices price on price.reference_variant_id = rv.id
  left join latest_markets market
    on market.reference_variant_id = rv.id
   and market.market_country_code = price.market_country_code
  where rv.review_status = 'accepted'
),
entries as (
  select entry.key as variant_key, entry.value as evaluation
  from base
  cross join lateral jsonb_each(base.evaluation) as entry(key, value)
),
applicability_corrected as (
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
),
speculative_corrected as (
  select
    corrected.variant_key,
    case
      when coalesce(state.speculative_bubble, false)
        and not (
          coalesce(
            p_profile #>> '{refinement,speculativeRiskTolerance}' = 'accept',
            false
          )
          and (
            coalesce(
              p_profile #> '{refinement,acquisitionChannels}'
                ? 'grey_market',
              false
            )
            or coalesce(
              p_profile #> '{refinement,acquisitionChannels}'
                ? 'secondary_market',
              false
            )
          )
        )
      then jsonb_set(
        corrected.evaluation,
        '{hardReasons}',
        case
          when corrected.evaluation -> 'hardReasons'
            ? 'speculative_suppressed'
          then corrected.evaluation -> 'hardReasons'
          else corrected.evaluation -> 'hardReasons'
            || jsonb_build_array('speculative_suppressed')
        end,
        true
      )
      else corrected.evaluation
    end as evaluation
  from applicability_corrected corrected
  left join speculative_states state
    on state.variant_key = corrected.variant_key
)
select coalesce(
  jsonb_object_agg(
    corrected.variant_key,
    corrected.evaluation
    order by corrected.variant_key
  ),
  '{}'::jsonb
)
from speculative_corrected corrected;
$$;

revoke all on function public.recommendation_hard_filter_v3(jsonb, timestamptz)
  from public;
grant execute on function public.recommendation_hard_filter_v3(jsonb, timestamptz)
  to anon, service_role;

comment on function public.recommendation_hard_filter_v3(jsonb, timestamptz) is
  'Versioned SQL hard filters with applicability and fail-closed speculative-risk parity.';
