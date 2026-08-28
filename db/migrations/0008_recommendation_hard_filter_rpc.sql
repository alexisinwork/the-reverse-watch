-- Deterministic hard-filter partition over accepted relational facts.
-- Returns codes only; the TypeScript layer owns user-facing copy, scoring,
-- diversity, and the explicit bundled fallback.

create or replace function recommendation_hard_filter_v1(
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
    p_profile #>> '{core,budgetCurrency}' as budget_currency,
    (p_profile #>> '{core,budgetMax}')::numeric as budget_max,
    (p_profile #>> '{core,wristCircumferenceMm}')::numeric as wrist_mm,
    p_profile #>> '{core,deploymentEnvironment}' as deployment_environment,
    p_profile #>> '{core,ownershipFriction}' as ownership_friction,
    p_profile #>> '{core,accuracyTolerance}' as accuracy_tolerance,
    p_profile #>> '{core,weightLimit}' as weight_limit,
    coalesce(p_profile #> '{core,requiredComplications}', '[]'::jsonb) as required_complications,
    p_profile #>> '{core,datePreference}' as date_preference,
    p_profile #>> '{refinement,speculativeRiskTolerance}' as speculative_risk_tolerance,
    p_profile #>> '{refinement,requiredLugCurvature}' as required_lug_curvature,
    p_profile #>> '{refinement,requiredAttachmentType}' as required_attachment_type,
    (p_profile #>> '{refinement,requiredLugWidthMm}')::numeric as required_lug_width_mm,
    (p_profile #>> '{refinement,quickReleaseRequired}')::boolean as quick_release_required,
    p_profile #> '{refinement,acquisitionChannels}' as acquisition_channels,
    p_profile #>> '{refinement,availabilityTolerance}' as availability_tolerance,
    coalesce((p_profile #>> '{refinement,premiumAllowancePercent}')::numeric, 0) as premium_percent,
    p_profile #>> '{refinement,liquidityPreference}' as liquidity_preference,
    p_profile #>> '{refinement,lumePreference}' as lume_preference,
    p_profile #>> '{refinement,crownPosition}' as required_crown_position,
    p_profile #>> '{refinement,purchaseCountry}' as purchase_country,
    p_profile #>> '{refinement,serviceCountry}' as service_country,
    p_profile #> '{refinement,acceptedConditions}' as accepted_conditions,
    p_profile #>> '{refinement,allergyConstraint}' as allergy_constraint
),
latest_prices as (
  select distinct on (ps.reference_variant_id)
    ps.*,
    case ps.kind
      when 'grey_market_ask' then 'grey_market'
      when 'secondary_ask' then 'secondary_market'
      when 'secondary_transaction' then 'secondary_market'
      else 'authorized_dealer'
    end as acquisition_channel
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
    ms.*
  from public.market_snapshots ms
  where ms.review_status = 'accepted'
  order by
    ms.reference_variant_id,
    ms.market_country_code,
    ms.observed_at desc,
    ms.id
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
    bool_or(fe.tier = 'verified' and fe.field_name = 'amount_low_minor') as verified
  from public.price_snapshots ps
  left join public.field_evidence fe
    on fe.subject_type = 'price_snapshot'
    and fe.subject_id = ps.id
  group by ps.id
),
market_evidence as (
  select
    ms.id as market_snapshot_id,
    bool_or(fe.tier = 'verified' and fe.field_name = 'availability') as availability_verified,
    bool_or(fe.tier = 'verified' and fe.field_name <> 'availability') as market_verified
  from public.market_snapshots ms
  left join public.field_evidence fe
    on fe.subject_type = 'market_snapshot'
    and fe.subject_id = ms.id
  group by ms.id
),
complication_sets as (
  select
    rc.reference_variant_id,
    array_agg(rc.complication::text)
      filter (where rc.complication <> 'date') as complications,
    bool_or(rc.complication = 'date') as has_date
  from public.reference_complications rc
  group by rc.reference_variant_id
),
deployment_sets as (
  select
    rdp.reference_variant_id,
    array_agg(rdp.environment::text) as environments
  from public.reference_deployment_profiles rdp
  where rdp.review_status = 'accepted'
  group by rdp.reference_variant_id
),
friction_sets as (
  select
    rofp.reference_variant_id,
    array_agg(rofp.friction_level::text) as friction_levels
  from public.reference_ownership_friction_profiles rofp
  where rofp.review_status = 'accepted'
  group by rofp.reference_variant_id
),
service_sets as (
  select
    bsr.brand_id,
    array_agg(bsr.country_code::text)
      filter (where bsr.manufacturer_service_available) as service_countries
  from public.brand_service_regions bsr
  where bsr.review_status = 'accepted'
  group by bsr.brand_id
),
service_evidence as (
  select
    fe.subject_id as brand_id,
    bool_or(fe.tier = 'verified' and fe.field_name = 'serviceCountries') as verified
  from public.field_evidence fe
  where fe.subject_type = 'brand'
  group by fe.subject_id
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
candidate_facts as (
  select
    rv.variant_key,
    rv.id as reference_variant_id,
    b.id as brand_id,
    lp.id as price_snapshot_id,
    lm.id as market_snapshot_id,
    lp.amount_low_minor,
    lp.currency::text as price_currency,
    lp.market_country_code::text as market_country,
    lp.condition::text as condition,
    lp.acquisition_channel,
    lp.stale_after as price_stale_after,
    coalesce(pe.verified, false) as price_verified,
    lm.availability::text as availability,
    lm.stale_after as market_stale_after,
    coalesce(me.availability_verified, false) as availability_verified,
    coalesce(me.market_verified, false) as market_verified,
    lm.secondary_ratio_low,
    lm.speculative_bubble,
    rv.lug_to_lug_mm,
    rv.weight_full_g,
    rv.accuracy_lower_seconds,
    rv.accuracy_upper_seconds,
    rv.accuracy_period_days,
    rv.lug_curvature::text as lug_curvature,
    rv.bracelet_attachment::text as attachment_type,
    rv.lug_width_mm,
    rv.lume_grade::text as lume_grade,
    rv.crown_position::text as fact_crown_position,
    rv.nickel_contact_risk::text as nickel_contact_risk,
    coalesce(re.fields, array[]::text[]) as evidence_fields,
    coalesce(cs.complications, array[]::text[]) as complications,
    coalesce(cs.has_date, false) as has_date,
    coalesce(ds.environments, array[]::text[]) as environments,
    coalesce(fs.friction_levels, array[]::text[]) as friction_levels,
    ss.service_countries,
    coalesce(se.verified, false) as service_verified,
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
  left join latest_markets lm
    on lm.reference_variant_id = rv.id
    and lm.market_country_code = lp.market_country_code
  left join reference_evidence re on re.reference_variant_id = rv.id
  left join price_evidence pe on pe.price_snapshot_id = lp.id
  left join market_evidence me on me.market_snapshot_id = lm.id
  left join complication_sets cs on cs.reference_variant_id = rv.id
  left join deployment_sets ds on ds.reference_variant_id = rv.id
  left join friction_sets fs on fs.reference_variant_id = rv.id
  left join service_sets ss on ss.brand_id = b.id
  left join service_evidence se on se.brand_id = b.id
  left join fx_batch source_fx on source_fx.quote_currency = lp.currency
  cross join params p
  left join fx_batch target_fx on target_fx.quote_currency = p.budget_currency
  where rv.review_status = 'accepted'
),
normalized as (
  select
    cf.*,
    p.*,
    case
      when cf.price_currency = p.budget_currency then cf.amount_low_minor::numeric
      when cf.source_fx_rate is null or cf.target_fx_rate is null then null
      else round(cf.amount_low_minor::numeric / cf.source_fx_rate * cf.target_fx_rate)
    end as converted_price_minor,
    round(
      p.budget_max * 100 * (
        1 + case
          when cf.acquisition_channel in ('grey_market', 'secondary_market')
            and p.acquisition_channels ? cf.acquisition_channel
          then p.premium_percent / 100
          else 0
        end
      )
    ) as effective_budget_minor,
    case p.weight_limit
      when 'under_80_g' then 80
      when 'under_120_g' then 120
      when 'under_160_g' then 160
      else null
    end as weight_limit_g,
    case p.liquidity_preference
      when 'require_80_percent_plus' then 0.8
      when 'prefer_60_percent_plus' then 0.6
      else null
    end as liquidity_floor
  from candidate_facts cf
  cross join params p
),
evaluated as (
  select
    n.variant_key,
    array_remove(array[
      case when
        n.price_verified
        and n.price_stale_after >= p_as_of
        and (
          n.price_currency = n.budget_currency
          or (
            n.source_fx_rate is not null
            and n.target_fx_rate is not null
            and n.fx_stale_after >= p_as_of
          )
        )
        and n.converted_price_minor > n.effective_budget_minor
      then 'over_budget' end,
      case when
        n.lug_to_lug_mm is not null
        and 'lugToLugMm' = any(n.evidence_fields)
        and n.lug_to_lug_mm > n.wrist_mm * 0.31
      then 'fit_exceeds_wrist' end,
      case when not (n.deployment_environment = any(n.environments))
      then 'deployment_mismatch' end,
      case when not (n.ownership_friction = any(n.friction_levels))
      then 'ownership_mismatch' end,
      case when
        n.accuracy_tolerance <> 'no_requirement'
        and n.accuracy_period_days is not null
        and 'accuracy' = any(n.evidence_fields)
        and not case n.accuracy_tolerance
          when 'seconds_per_month' then
            greatest(
              abs(n.accuracy_lower_seconds / n.accuracy_period_days),
              abs(n.accuracy_upper_seconds / n.accuracy_period_days)
            ) <= 1
          when 'within_5_seconds_per_day' then
            n.accuracy_lower_seconds / n.accuracy_period_days >= -5
            and n.accuracy_upper_seconds / n.accuracy_period_days <= 5
          when 'within_15_seconds_per_day' then
            n.accuracy_lower_seconds / n.accuracy_period_days >= -15
            and n.accuracy_upper_seconds / n.accuracy_period_days <= 15
          else true
        end
      then 'accuracy_mismatch' end,
      case when
        n.weight_limit_g is not null
        and n.weight_full_g is not null
        and 'weightFullG' = any(n.evidence_fields)
        and n.weight_full_g >= n.weight_limit_g
      then 'weight_exceeds_limit' end,
      case when exists (
        select 1
        from jsonb_array_elements_text(n.required_complications) required(value)
        where not (required.value = any(n.complications))
      ) then 'missing_complication' end,
      case when n.date_preference = 'required' and not n.has_date
      then 'date_required' end,
      case when n.date_preference = 'forbidden' and n.has_date
      then 'date_forbidden' end,
      case when
        n.required_lug_curvature is not null
        and n.lug_curvature is not null
        and 'lugCurvature' = any(n.evidence_fields)
        and n.lug_curvature <> n.required_lug_curvature
      then 'lug_curvature_mismatch' end,
      case when
        n.required_attachment_type is not null
        and n.attachment_type is not null
        and 'attachmentType' = any(n.evidence_fields)
        and n.attachment_type <> n.required_attachment_type
      then 'attachment_mismatch' end,
      case when
        n.required_lug_width_mm is not null
        and n.lug_width_mm is not null
        and 'lugWidthMm' = any(n.evidence_fields)
        and n.lug_width_mm <> n.required_lug_width_mm
      then 'lug_width_mismatch' end,
      case when
        n.quick_release_required
        and n.attachment_type is not null
        and 'attachmentType' = any(n.evidence_fields)
        and n.attachment_type <> 'quick_release'
      then 'quick_release_required' end,
      case when
        n.acquisition_channels is not null
        and not (n.acquisition_channels ? n.acquisition_channel)
      then 'channel_mismatch' end,
      case when
        n.availability_tolerance is not null
        and n.market_snapshot_id is not null
        and n.availability_verified
        and n.market_stale_after >= p_as_of
        and not case n.availability_tolerance
          when 'in_stock_only' then n.availability = 'in_stock'
          when 'short_wait' then n.availability in ('in_stock', 'partial_waitlist')
          when 'waitlist_or_allocation' then n.availability in ('in_stock', 'partial_waitlist', 'waitlist', 'allocation')
          else true
        end
      then 'availability_mismatch' end,
      case when
        n.accepted_conditions is not null
        and not (n.accepted_conditions ? n.condition)
      then 'condition_mismatch' end,
      case when
        n.liquidity_floor is not null
        and n.market_verified
        and n.secondary_ratio_low is not null
        and n.secondary_ratio_low < n.liquidity_floor
      then 'liquidity_mismatch' end,
      case when
        n.lume_preference is not null
        and n.lume_preference <> 'not_important'
        and n.lume_grade is not null
        and 'lumeGrade' = any(n.evidence_fields)
        and not case n.lume_preference
          when 'strong_lume' then n.lume_grade = 'strong'
          else n.lume_grade <> 'none'
        end
      then 'lume_mismatch' end,
      case when
        n.required_crown_position is not null
        and n.fact_crown_position is not null
        and 'crownPosition' = any(n.evidence_fields)
        and n.fact_crown_position <> n.required_crown_position
      then 'crown_mismatch' end,
      case when
        n.service_country is not null
        and n.service_verified
        and n.service_countries is not null
        and not (n.service_country = any(n.service_countries))
      then 'service_country_mismatch' end,
      case when
        n.allergy_constraint = 'nickel_contact'
        and n.nickel_contact_risk is not null
        and 'nickelContactRisk' = any(n.evidence_fields)
        and n.nickel_contact_risk <> 'none_known'
      then 'allergy_risk' end,
      case when
        n.speculative_bubble
        and not (
          n.speculative_risk_tolerance = 'accept'
          and (
            n.acquisition_channels ? 'grey_market'
            or n.acquisition_channels ? 'secondary_market'
          )
        )
      then 'speculative_suppressed' end
    ]::text[], null) as hard_reasons,
    array_remove(array[
      case when
        n.price_currency <> n.budget_currency
        and (
          n.source_fx_rate is null
          or n.target_fx_rate is null
          or n.fx_stale_after < p_as_of
        )
      then 'fx_rate' end,
      case when
        not n.price_verified
        or n.price_stale_after is null
        or n.price_stale_after < p_as_of
      then 'price' end,
      case when
        n.lug_to_lug_mm is null
        or not ('lugToLugMm' = any(n.evidence_fields))
      then 'lug_to_lug' end,
      case when
        n.accuracy_tolerance <> 'no_requirement'
        and (
          n.accuracy_period_days is null
          or not ('accuracy' = any(n.evidence_fields))
        )
      then 'accuracy' end,
      case when
        n.weight_limit_g is not null
        and (
          n.weight_full_g is null
          or not ('weightFullG' = any(n.evidence_fields))
        )
      then 'weight' end,
      case when
        n.required_lug_curvature is not null
        and (
          n.lug_curvature is null
          or not ('lugCurvature' = any(n.evidence_fields))
        )
      then 'lug_curvature' end,
      case when
        (n.required_attachment_type is not null or n.quick_release_required)
        and (
          n.attachment_type is null
          or not ('attachmentType' = any(n.evidence_fields))
        )
      then 'attachment' end,
      case when
        n.required_lug_width_mm is not null
        and (
          n.lug_width_mm is null
          or not ('lugWidthMm' = any(n.evidence_fields))
        )
      then 'lug_width' end,
      case when
        n.availability_tolerance is not null
        and (
          n.market_snapshot_id is null
          or not n.availability_verified
          or n.availability is null
          or n.market_stale_after is null
          or n.market_stale_after < p_as_of
        )
      then 'availability' end,
      case when
        n.liquidity_floor is not null
        and (
          not n.market_verified
          or n.secondary_ratio_low is null
        )
      then 'liquidity' end,
      case when
        n.lume_preference is not null
        and n.lume_preference <> 'not_important'
        and (
          n.lume_grade is null
          or not ('lumeGrade' = any(n.evidence_fields))
        )
      then 'lume' end,
      case when
        n.required_crown_position is not null
        and (
          n.fact_crown_position is null
          or not ('crownPosition' = any(n.evidence_fields))
        )
      then 'crown_position' end,
      case when
        n.purchase_country is not null
        and n.purchase_country <> n.market_country
      then 'purchase_country' end,
      case when
        n.service_country is not null
        and (
          not n.service_verified
          or n.service_countries is null
        )
      then 'service_country' end,
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

revoke all on function recommendation_hard_filter_v1(jsonb, timestamptz) from public;
grant execute on function recommendation_hard_filter_v1(jsonb, timestamptz)
  to anon, authenticated, service_role;

comment on function recommendation_hard_filter_v1(jsonb, timestamptz) is
  'Versioned SQL hard-filter codes for accepted recommendation catalogue facts.';
