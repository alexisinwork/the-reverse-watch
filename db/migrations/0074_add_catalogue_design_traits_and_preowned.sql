-- Cheaper-alternative finder (owner, 2026-10-01). Additive only.
--
-- design_traits: how a watch looks, read once from its product photo
--   (dial colour, hands, bezel, lume, bracelet, case shape, era…).
-- preowned_price: established-dealer pre-owned asking prices, with the
--   low/median/high in one currency, the listings and when they were read.

alter table private.watch_catalogue
  add column if not exists design_traits jsonb
    check (design_traits is null or jsonb_typeof(design_traits) = 'object'),
  add column if not exists preowned_price jsonb
    check (preowned_price is null or jsonb_typeof(preowned_price) = 'object');

create or replace function private.watch_catalogue_json(w private.watch_catalogue)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', w.id,
    'identityKey', w.identity_key,
    'brand', w.brand,
    'model', w.model,
    'referenceCode', w.reference_code,
    'referenceConfirmed', w.reference_confirmed,
    'styles', to_jsonb(w.styles),
    'caseDiameterMm', w.case_diameter_mm,
    'caseThicknessMm', w.case_thickness_mm,
    'caseShape', w.case_shape,
    'waterResistanceM', w.water_resistance_m,
    'movement', w.movement,
    'inHouseCalibre', w.in_house_calibre,
    'crystal', w.crystal,
    'displayCaseback', w.display_caseback,
    'complications', to_jsonb(w.complications),
    'caseMaterial', w.case_material,
    'casebackMaterial', w.caseback_material,
    'strapMaterial', w.strap_material,
    'priceAmount', w.price_amount,
    'priceCurrency', w.price_currency,
    'priceStatus', w.price_status,
    'priceCheckedAt', w.price_checked_at,
    'priceEvidence', w.price_evidence,
    'priceChange', w.price_change,
    'sourceUrl', w.source_url,
    'sourceKind', w.source_kind,
    'imageUrl', w.image_url,
    'rationale', w.rationale,
    'foundIn', w.found_in,
    'reviewStatus', w.review_status,
    'reviewedAt', w.reviewed_at,
    'createdAt', w.created_at,
    'updatedAt', w.updated_at,
    'designTraits', w.design_traits,
    'preownedPrice', w.preowned_price
  );
$$;

create function public.watch_catalogue_traits_v1(p_id uuid, p_traits jsonb)
returns boolean
language sql
security definer
set search_path = ''
as $$
  update private.watch_catalogue
  set design_traits = p_traits, updated_at = now()
  where id = p_id
  returning true;
$$;

create function public.watch_catalogue_preowned_v1(p_id uuid, p_price jsonb)
returns boolean
language sql
security definer
set search_path = ''
as $$
  update private.watch_catalogue
  set preowned_price = p_price, updated_at = now()
  where id = p_id
  returning true;
$$;

revoke all on function public.watch_catalogue_traits_v1(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.watch_catalogue_preowned_v1(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.watch_catalogue_traits_v1(uuid, jsonb) to service_role;
grant execute on function public.watch_catalogue_preowned_v1(uuid, jsonb) to service_role;
