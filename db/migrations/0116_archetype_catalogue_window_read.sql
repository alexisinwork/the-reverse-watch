-- The archetype quiz no longer loads the whole recommendation pool to pick
-- its catalogue supplements (owner decision, 2026-11-25: hard filters run in
-- the database). This window returns every row rankEnrichedArchetype could
-- keep, and the code still applies that function's exact rules and order.
--
-- A supplement must have a confirmed reference, a confirmed or approximate
-- price inside the archetype's USD band (the caller converts the band into
-- each currency and widens it), a style in the archetype's roles, a source
-- entry from catalogue enrichment, Dials or Space City, and a source URL to
-- become a card. Mechanical-only and non-round archetypes narrow it further.
--
-- Additive, service-role only, read-only.

create function public.watch_catalogue_archetype_window_v1(
  p_price_bounds jsonb,
  p_styles text[],
  p_movements text[] default '{}',
  p_shapes text[] default '{}'
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
    from bounds
    join private.watch_catalogue w
      on upper(w.price_currency) = bounds.currency
     and w.price_amount >= bounds.minimum
     and (bounds.maximum is null or w.price_amount <= bounds.maximum)
    where w.review_status <> 'rejected'
      and w.source_url is not null
      and w.price_amount is not null
      and w.price_status in ('confirmed', 'approximate')
      and w.price_currency is not null
      and w.reference_confirmed
      and w.styles && coalesce(p_styles, '{}'::text[])
      and jsonb_path_exists(
        w.found_in,
        '$[*] ? (@.source == "catalogue_enrichment" || @.source == "dials" || @.source == "spacecity")'
      )
      and (coalesce(cardinality(p_movements), 0) = 0 or w.movement = any(p_movements))
      and (coalesce(cardinality(p_shapes), 0) = 0 or w.case_shape = any(p_shapes))
  )
  select jsonb_build_object(
    'columns', jsonb_build_array(
      'id', 'identityKey', 'brand', 'model', 'referenceCode',
      'referenceConfirmed', 'styles', 'caseDiameterMm', 'caseThicknessMm',
      'caseShape', 'waterResistanceM', 'movement', 'inHouseCalibre', 'crystal',
      'displayCaseback', 'complications', 'caseMaterial', 'casebackMaterial',
      'strapMaterial', 'priceAmount', 'priceCurrency', 'priceStatus',
      'sourceUrl', 'imageUrl', 'reviewStatus', 'foundIn', 'updatedAt'
    ),
    'rows', coalesce(jsonb_agg(jsonb_build_array(
      w.id, w.identity_key, w.brand, w.model, w.reference_code,
      w.reference_confirmed, to_jsonb(w.styles), w.case_diameter_mm,
      w.case_thickness_mm, w.case_shape, w.water_resistance_m, w.movement,
      w.in_house_calibre, w.crystal, w.display_caseback,
      to_jsonb(w.complications), w.case_material, w.caseback_material,
      w.strap_material, w.price_amount, w.price_currency, w.price_status,
      w.source_url, w.image_url, w.review_status,
      -- Only the source names: the ranking reads nothing else from found_in.
      coalesce((
        select jsonb_agg(jsonb_build_object('source', item->'source'))
        from jsonb_array_elements(
          case when jsonb_typeof(w.found_in) = 'array' then w.found_in else '[]'::jsonb end
        ) as item
        where jsonb_typeof(item) = 'object' and item ? 'source'
      ), '[]'::jsonb),
      w.updated_at
    ) order by w.brand, w.model, w.id), '[]'::jsonb)
  )
  from window_rows w;
$$;

revoke all on function public.watch_catalogue_archetype_window_v1(jsonb, text[], text[], text[]) from public, anon, authenticated;
grant execute on function public.watch_catalogue_archetype_window_v1(jsonb, text[], text[], text[]) to service_role;
