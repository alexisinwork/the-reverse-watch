-- Narrow read-only catalogue contract for the server recommendation action.
-- The browser roles still have no direct table privileges. This SECURITY
-- DEFINER function exposes accepted catalogue facts only and fixes search_path.

alter table reference_variants
  add column if not exists product_url text;

update reference_variants as rv
set product_url = seed.product_url
from (
  values
    ('timex-tw2y40300', 'https://timex.com/products/deepwater-meridian-200-38mm-hnbr-rubber-strap-watch-tw2y40300'),
    ('citizen-bn0150-28e', 'https://www.citizenwatch.com/us/en/product/BN0150-28E'),
    ('hamilton-h69439131', 'https://www.hamiltonwatch.com/en-us/h69439131-khaki-field-mechanical.html'),
    ('tissot-t1372071104100', 'https://www.tissotwatches.com/en-us/T1372071104100.html'),
    ('seiko-ssc813', 'https://www.seikowatches.com/us-en/products/prospex/ssc813'),
    ('mido-m0495261104100', 'https://www.midowatches.com/us/multifort-tv-big-date-m0495261104100.html'),
    ('nomos-746', 'https://nomos-glashuette.com/en-us/club/club-sport-neomatik-petrol-746?strap=5840.M'),
    ('grand-seiko-sbgn029', 'https://www.grand-seiko.com/us-en/collections/sbgn029g'),
    ('longines-l38024636', 'https://www.longines.com/en-us/p/watch-longines-spirit-zulu-time-l3-802-4-63-6'),
    ('rolex-124270', 'https://www.rolex.com/en-us/watches/explorer/m124270-0001'),
    ('rolex-124273', 'https://www.rolex.com/en-us/watches/explorer/m124273-0001'),
    ('jlc-q3988481', 'https://www.jaeger-lecoultre.com/us-en/watches/reverso/reverso-tribute/reverso-tribute-duoface-small-seconds-q3988481')
) as seed(variant_key, product_url)
where rv.variant_key = seed.variant_key
  and rv.product_url is distinct from seed.product_url;

create or replace function recommendation_catalogue_v1()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with latest_prices as (
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
complication_sets as (
  select
    rc.reference_variant_id,
    array_agg(rc.complication::text order by rc.complication::text)
      filter (where rc.complication <> 'date') as complications,
    bool_or(rc.complication = 'date') as has_date
  from public.reference_complications rc
  group by rc.reference_variant_id
),
deployment_sets as (
  select
    rdp.reference_variant_id,
    array_agg(rdp.environment::text order by rdp.environment::text) as environments
  from public.reference_deployment_profiles rdp
  where rdp.review_status = 'accepted'
  group by rdp.reference_variant_id
),
friction_sets as (
  select
    rofp.reference_variant_id,
    array_agg(rofp.friction_level::text order by rofp.friction_level::text) as friction_levels
  from public.reference_ownership_friction_profiles rofp
  where rofp.review_status = 'accepted'
  group by rofp.reference_variant_id
),
trait_sets as (
  select
    rt.reference_variant_id,
    max(rt.value) filter (where rt.axis = 'primary_archetype') as primary_archetype,
    array_agg(rt.value order by rt.value)
      filter (where rt.axis = 'social_signal') as social_signals,
    array_agg(rt.value order by rt.value)
      filter (where rt.axis = 'aesthetic_dna') as aesthetic_dna,
    array_agg(rt.value order by rt.value)
      filter (where rt.axis = 'emotional_objective') as emotional_objectives
  from public.reference_traits rt
  where rt.review_status = 'accepted'
  group by rt.reference_variant_id
),
service_sets as (
  select
    bsr.brand_id,
    array_agg(bsr.country_code::text order by bsr.country_code::text)
      filter (where bsr.manufacturer_service_available) as service_countries
  from public.brand_service_regions bsr
  where bsr.review_status = 'accepted'
  group by bsr.brand_id
),
evidence_rows as (
  select
    fe.subject_id as reference_variant_id,
    fe.source_id,
    fe.field_name
  from public.field_evidence fe
  where fe.subject_type = 'reference_variant'
    and fe.tier = 'verified'

  union all

  select
    ps.reference_variant_id,
    fe.source_id,
    'price'::text as field_name
  from public.field_evidence fe
  join public.price_snapshots ps on ps.id = fe.subject_id
  where fe.subject_type = 'price_snapshot'
    and fe.tier = 'verified'
    and fe.field_name = 'amount_low_minor'

  union all

  select
    ms.reference_variant_id,
    fe.source_id,
    case
      when fe.field_name = 'availability' then 'availability'
      else 'market'
    end as field_name
  from public.field_evidence fe
  join public.market_snapshots ms on ms.id = fe.subject_id
  where fe.subject_type = 'market_snapshot'
    and fe.tier = 'verified'
),
evidence_groups as (
  select
    grouped.reference_variant_id,
    jsonb_agg(
      jsonb_build_object(
        'sourceId', grouped.source_id::text,
        'fields', to_jsonb(grouped.fields)
      )
      order by grouped.source_id::text
    ) as evidence
  from (
    select
      er.reference_variant_id,
      er.source_id,
      array_agg(distinct er.field_name order by er.field_name) as fields
    from evidence_rows er
    group by er.reference_variant_id, er.source_id
  ) grouped
  group by grouped.reference_variant_id
),
source_register as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id::text,
        'url', s.url,
        'title', s.title,
        'publisher', s.publisher,
        'sourceType', s.source_type,
        'retrievedAt', to_char(
          s.retrieved_at at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        )
      )
      order by s.id::text
    ),
    '[]'::jsonb
  ) as sources
  from public.sources s
  where s.title is not null
    and s.publisher is not null
),
fx_batch as (
  select
    fx.base_currency,
    fx.observed_at,
    max(fx.stale_after) as stale_after,
    (array_agg(fx.source_id order by fx.source_id))[1] as source_id,
    jsonb_object_agg(fx.quote_currency, fx.rate order by fx.quote_currency) as rates
  from public.fx_rate_snapshots fx
  where fx.review_status = 'accepted'
    and fx.observed_at = (
      select max(inner_fx.observed_at)
      from public.fx_rate_snapshots inner_fx
      where inner_fx.review_status = 'accepted'
        and inner_fx.base_currency = 'EUR'
    )
    and fx.base_currency = 'EUR'
  group by fx.base_currency, fx.observed_at
),
variant_rows as (
  select
    rv.variant_key,
    jsonb_build_object(
      'id', rv.variant_key,
      'brand', jsonb_build_object(
        'slug', b.slug,
        'name', b.name,
        'serviceCountries', to_jsonb(ss.service_countries)
      ),
      'collection', c.name,
      'model', rm.model_name,
      'referenceCode', rv.reference_code,
      'variantName', rv.variant_name,
      'productUrl', rv.product_url,
      'price', jsonb_build_object(
        'amountMinor', lp.amount_low_minor,
        'currency', lp.currency::text,
        'marketCountry', lp.market_country_code::text,
        'observedAt', to_char(
          lp.observed_at at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'staleAfter', to_char(
          lp.stale_after at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'availability', case lm.availability
          when 'in_stock' then 'in_stock'
          when 'partial_waitlist' then 'short_wait'
          when 'waitlist' then 'waitlist_or_allocation'
          when 'allocation' then 'waitlist_or_allocation'
          when 'unavailable' then 'unavailable'
          else 'unknown'
        end,
        'availabilityObservedAt', case
          when lm.id is null then null
          else to_char(
            lm.observed_at at time zone 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
          )
        end,
        'availabilityStaleAfter', case
          when lm.stale_after is null then null
          else to_char(
            lm.stale_after at time zone 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
          )
        end,
        'channels', jsonb_build_array(case lp.kind
          when 'grey_market_ask' then 'grey_market'
          when 'secondary_ask' then 'secondary_market'
          when 'secondary_transaction' then 'secondary_market'
          else 'authorized_dealer'
        end),
        'conditions', jsonb_build_array(lp.condition::text)
      ),
      'materials', jsonb_build_object(
        'case', rv.case_material,
        'caseback', rv.caseback_material,
        'bracelet', rv.bracelet_material,
        'strap', rv.strap_material
      ),
      'productionStatus', rv.production_status::text,
      'geometry', jsonb_build_object(
        'caseDiameterMm', rv.case_diameter_mm,
        'caseThicknessMm', rv.case_thickness_mm,
        'lugToLugMm', rv.lug_to_lug_mm,
        'lugWidthMm', rv.lug_width_mm,
        'weightFullG', rv.weight_full_g,
        'lugCurvature', rv.lug_curvature::text,
        'integratedBracelet', rv.integrated_bracelet
      ),
      'movement', jsonb_build_object(
        'type', rv.movement_type::text,
        'caliber', rv.caliber_ref,
        'powerReserveHours', rv.power_reserve_h,
        'accuracyLowerSeconds', rv.accuracy_lower_seconds,
        'accuracyUpperSeconds', rv.accuracy_upper_seconds,
        'accuracyPeriodDays', rv.accuracy_period_days
      ),
      'operation', jsonb_build_object(
        'waterResistanceM', rv.water_resistance_m,
        'crownType', rv.crown_type::text,
        'crownPosition', rv.crown_position::text,
        'crystal', rv.crystal::text,
        'lumeGrade', rv.lume_grade::text,
        'attachmentType', rv.bracelet_attachment::text,
        'shockResistant', rv.shock_resistant,
        'nickelContactRisk', rv.nickel_contact_risk::text
      ),
      'complications', to_jsonb(coalesce(cs.complications, array[]::text[])),
      'dateStatus', case when coalesce(cs.has_date, false) then 'present' else 'absent' end,
      'eligibleEnvironments', to_jsonb(ds.environments),
      'ownershipFrictionLevels', to_jsonb(fs.friction_levels),
      'traits', jsonb_build_object(
        'primaryArchetype', ts.primary_archetype,
        'socialSignals', to_jsonb(coalesce(ts.social_signals, array[]::text[])),
        'aestheticDna', to_jsonb(coalesce(ts.aesthetic_dna, array[]::text[])),
        'emotionalObjectives', to_jsonb(coalesce(ts.emotional_objectives, array[]::text[]))
      ),
      'market', jsonb_build_object(
        'speculativeBubble', lm.speculative_bubble,
        'hypeRisk', lm.hype_risk::text,
        'secondaryRatioLow', lm.secondary_ratio_low,
        'secondaryRatioHigh', lm.secondary_ratio_high
      ),
      'evidence', eg.evidence
    ) as variant
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
  join deployment_sets ds on ds.reference_variant_id = rv.id
  join friction_sets fs on fs.reference_variant_id = rv.id
  join trait_sets ts on ts.reference_variant_id = rv.id
  join evidence_groups eg on eg.reference_variant_id = rv.id
  left join complication_sets cs on cs.reference_variant_id = rv.id
  left join service_sets ss on ss.brand_id = b.id
  where rv.review_status = 'accepted'
    and rv.product_url is not null
    and rv.reference_code is not null
    and rv.production_status is not null
    and lp.market_country_code is not null
    and lp.stale_after is not null
    and ts.primary_archetype is not null
)
select jsonb_build_object(
  'catalogueVersion', 1,
  'sources', sr.sources,
  'fx', jsonb_build_object(
    'baseCurrency', fb.base_currency::text,
    'observedAt', to_char(
      fb.observed_at at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ),
    'staleAfter', to_char(
      fb.stale_after at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ),
    'sourceId', fb.source_id::text,
    'rates', fb.rates
  ),
  'variants', coalesce(
    (
      select jsonb_agg(vr.variant order by vr.variant_key)
      from variant_rows vr
    ),
    '[]'::jsonb
  )
)
from source_register sr
cross join fx_batch fb;
$$;

revoke all on function recommendation_catalogue_v1() from public;
grant execute on function recommendation_catalogue_v1() to anon, authenticated, service_role;

comment on function recommendation_catalogue_v1() is
  'Accepted, source-backed catalogue facts for the server recommendation action. No direct table access is granted.';
