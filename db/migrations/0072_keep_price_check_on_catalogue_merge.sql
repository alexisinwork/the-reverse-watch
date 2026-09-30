-- A repeat find (which carries no price check) must not wipe the price
-- check and evidence stored by the first find. Only a newer check replaces
-- an unconfirmed price; a confirmed price is never replaced by a merge.

create or replace function public.watch_catalogue_upsert_v1(p_watch jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_styles text[] := coalesce(
    array(select jsonb_array_elements_text(coalesce(p_watch -> 'styles', '[]'::jsonb))),
    '{}'
  );
  v_complications text[] := coalesce(
    array(select jsonb_array_elements_text(coalesce(p_watch -> 'complications', '[]'::jsonb))),
    '{}'
  );
  v_price_ok boolean := (p_watch ->> 'priceStatus') = 'confirmed';
begin
  insert into private.watch_catalogue as w (
    identity_key, brand, model, reference_code, reference_confirmed, styles,
    case_diameter_mm, case_thickness_mm, case_shape, water_resistance_m, movement,
    in_house_calibre, crystal, display_caseback, complications, case_material,
    caseback_material, strap_material, price_amount, price_currency, price_status,
    price_checked_at, price_evidence, source_url, source_kind, image_url, rationale,
    found_in
  )
  values (
    p_watch ->> 'identityKey',
    p_watch ->> 'brand',
    p_watch ->> 'model',
    nullif(p_watch ->> 'referenceCode', ''),
    coalesce((p_watch ->> 'referenceConfirmed')::boolean, false),
    v_styles,
    (p_watch ->> 'caseDiameterMm')::numeric,
    (p_watch ->> 'caseThicknessMm')::numeric,
    nullif(p_watch ->> 'caseShape', ''),
    (p_watch ->> 'waterResistanceM')::integer,
    nullif(p_watch ->> 'movement', ''),
    (p_watch ->> 'inHouseCalibre')::boolean,
    nullif(p_watch ->> 'crystal', ''),
    (p_watch ->> 'displayCaseback')::boolean,
    v_complications,
    nullif(p_watch ->> 'caseMaterial', ''),
    nullif(p_watch ->> 'casebackMaterial', ''),
    nullif(p_watch ->> 'strapMaterial', ''),
    case when v_price_ok then (p_watch ->> 'priceAmount')::numeric end,
    case when v_price_ok then p_watch ->> 'priceCurrency' end,
    case when v_price_ok then 'confirmed' else 'unconfirmed' end,
    (p_watch ->> 'priceCheckedAt')::timestamptz,
    coalesce(p_watch -> 'priceEvidence', '{}'::jsonb),
    nullif(p_watch ->> 'sourceUrl', ''),
    nullif(p_watch ->> 'sourceKind', ''),
    nullif(p_watch ->> 'imageUrl', ''),
    nullif(p_watch ->> 'rationale', ''),
    coalesce(p_watch -> 'foundIn', '[]'::jsonb)
  )
  on conflict (identity_key) do update set
    styles = array(select distinct unnest(w.styles || excluded.styles) order by 1),
    complications = case
      when cardinality(w.complications) = 0 then excluded.complications
      else w.complications
    end,
    reference_confirmed = w.reference_confirmed or excluded.reference_confirmed,
    reference_code = coalesce(w.reference_code, excluded.reference_code),
    case_diameter_mm = coalesce(w.case_diameter_mm, excluded.case_diameter_mm),
    case_thickness_mm = coalesce(w.case_thickness_mm, excluded.case_thickness_mm),
    case_shape = coalesce(w.case_shape, excluded.case_shape),
    water_resistance_m = coalesce(w.water_resistance_m, excluded.water_resistance_m),
    movement = coalesce(w.movement, excluded.movement),
    in_house_calibre = coalesce(w.in_house_calibre, excluded.in_house_calibre),
    crystal = coalesce(w.crystal, excluded.crystal),
    display_caseback = coalesce(w.display_caseback, excluded.display_caseback),
    case_material = coalesce(w.case_material, excluded.case_material),
    caseback_material = coalesce(w.caseback_material, excluded.caseback_material),
    strap_material = coalesce(w.strap_material, excluded.strap_material),
    -- Only a newer price check replaces an unconfirmed one; a repeat find
    -- that carries no check leaves the stored check and its evidence alone.
    price_amount = case when w.price_status <> 'confirmed' and excluded.price_checked_at is not null
      then excluded.price_amount else w.price_amount end,
    price_currency = case when w.price_status <> 'confirmed' and excluded.price_checked_at is not null
      then excluded.price_currency else w.price_currency end,
    price_status = case when w.price_status <> 'confirmed' and excluded.price_checked_at is not null
      then excluded.price_status else w.price_status end,
    price_checked_at = case when w.price_status <> 'confirmed' and excluded.price_checked_at is not null
      then excluded.price_checked_at else w.price_checked_at end,
    price_evidence = case when w.price_status <> 'confirmed' and excluded.price_checked_at is not null
      then excluded.price_evidence else w.price_evidence end,
    source_url = case
      when not w.reference_confirmed and excluded.reference_confirmed then excluded.source_url
      else coalesce(w.source_url, excluded.source_url)
    end,
    source_kind = case
      when not w.reference_confirmed and excluded.reference_confirmed then excluded.source_kind
      else coalesce(w.source_kind, excluded.source_kind)
    end,
    image_url = coalesce(w.image_url, excluded.image_url),
    rationale = coalesce(w.rationale, excluded.rationale),
    found_in = case
      when jsonb_array_length(w.found_in) >= 40 then w.found_in
      else w.found_in || excluded.found_in
    end,
    updated_at = now()
  returning w.id into v_id;
  return v_id;
end;
$$;

revoke all on function public.watch_catalogue_upsert_v1(jsonb) from public, anon, authenticated;
grant execute on function public.watch_catalogue_upsert_v1(jsonb) to service_role;
