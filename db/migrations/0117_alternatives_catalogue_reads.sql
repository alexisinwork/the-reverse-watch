-- The cheaper-alternative finder no longer loads the whole recommendation
-- pool (owner decision, 2026-11-25: hard filters run in the database).
--
-- 1. watch_catalogue_name_index_v1: the few facts resolveNamedWatch reads,
--    for every pool row, so a typed name still matches any watch in the
--    catalogue (word aliases and near misses run in code).
-- 2. watch_catalogue_alternatives_window_v1: every row rankAlternatives could
--    keep for one target and budget: a style shared with the target, the
--    target's size, water-resistance and mechanical limits, and a new price
--    inside the budget (converted per currency by the caller) or a pre-owned
--    price. The exact rules, scores and order still run in code.
--
-- Additive, service-role only, read-only.

create function public.watch_catalogue_name_index_v1()
returns jsonb
language sql
stable
security definer
set search_path = ''
set jit = off
as $$
  select jsonb_build_object(
    'columns', jsonb_build_array(
      'id', 'brand', 'model', 'referenceCode', 'referenceConfirmed',
      'reviewStatus', 'styles', 'caseShape', 'caseDiameterMm', 'movement',
      'waterResistanceM', 'designTraits'
    ),
    'rows', coalesce(jsonb_agg(jsonb_build_array(
      w.id, w.brand, w.model, w.reference_code, w.reference_confirmed,
      w.review_status, to_jsonb(w.styles), w.case_shape, w.case_diameter_mm,
      w.movement, w.water_resistance_m, w.design_traits
    ) order by w.brand, w.model, w.id), '[]'::jsonb)
  )
  from private.watch_catalogue w
  where w.review_status <> 'rejected'
    and (w.import_source is null or (w.price_amount is not null and w.price_status <> 'unconfirmed'));
$$;

create function public.watch_catalogue_alternatives_window_v1(
  p_price_bounds jsonb,
  p_styles text[],
  p_min_diameter numeric default null,
  p_max_diameter numeric default null,
  p_min_water_resistance numeric default null,
  p_mechanical_only boolean default false
)
returns jsonb
language sql
stable
security definer
set search_path = ''
set jit = off
as $$
  with bounds as (
    select upper(b.currency) as currency,
      min(b.minimum) as minimum,
      case when bool_or(b.maximum is null) then null else max(b.maximum) end as maximum
    from jsonb_to_recordset(coalesce(p_price_bounds, '[]'::jsonb))
      as b(currency text, minimum numeric, maximum numeric)
    where b.currency is not null and b.minimum is not null
    group by upper(b.currency)
    limit 200
  ),
  window_rows as (
    select w.*
    from private.watch_catalogue w
    where w.review_status <> 'rejected'
      and (w.import_source is null or (w.price_amount is not null and w.price_status <> 'unconfirmed'))
      and w.styles && coalesce(p_styles, '{}'::text[])
      and (p_min_diameter is null or w.case_diameter_mm >= p_min_diameter)
      and (p_max_diameter is null or w.case_diameter_mm <= p_max_diameter)
      and (p_min_water_resistance is null or w.water_resistance_m >= p_min_water_resistance)
      and (
        not coalesce(p_mechanical_only, false)
        or w.movement in ('automatic', 'manual', 'spring_drive')
      )
      and (
        w.preowned_price is not null
        or exists (
          select 1 from bounds
          where w.price_amount is not null
            and w.price_status <> 'unconfirmed'
            and upper(w.price_currency) = bounds.currency
            and w.price_amount >= bounds.minimum
            and (bounds.maximum is null or w.price_amount <= bounds.maximum)
        )
      )
  )
  select jsonb_build_object(
    'columns', jsonb_build_array(
      'id', 'identityKey', 'brand', 'model', 'referenceCode',
      'referenceConfirmed', 'styles', 'caseDiameterMm', 'caseThicknessMm',
      'caseShape', 'waterResistanceM', 'movement', 'inHouseCalibre', 'crystal',
      'displayCaseback', 'complications', 'caseMaterial', 'casebackMaterial',
      'strapMaterial', 'priceAmount', 'priceCurrency', 'priceStatus',
      'sourceUrl', 'imageUrl', 'reviewStatus', 'designTraits', 'preownedPrice'
    ),
    'rows', coalesce(jsonb_agg(jsonb_build_array(
      w.id, w.identity_key, w.brand, w.model, w.reference_code,
      w.reference_confirmed, to_jsonb(w.styles), w.case_diameter_mm,
      w.case_thickness_mm, w.case_shape, w.water_resistance_m, w.movement,
      w.in_house_calibre, w.crystal, w.display_caseback,
      to_jsonb(w.complications), w.case_material, w.caseback_material,
      w.strap_material, w.price_amount, w.price_currency, w.price_status,
      w.source_url, w.image_url, w.review_status, w.design_traits,
      w.preowned_price
    ) order by w.brand, w.model, w.id), '[]'::jsonb)
  )
  from window_rows w;
$$;

revoke all on function public.watch_catalogue_name_index_v1() from public, anon, authenticated;
grant execute on function public.watch_catalogue_name_index_v1() to service_role;
revoke all on function public.watch_catalogue_alternatives_window_v1(jsonb, text[], numeric, numeric, numeric, boolean) from public, anon, authenticated;
grant execute on function public.watch_catalogue_alternatives_window_v1(jsonb, text[], numeric, numeric, numeric, boolean) to service_role;
