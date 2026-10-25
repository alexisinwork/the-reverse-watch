-- Store the complete structured, non-image Dials specification separately
-- from the exact hard-filter columns and preserve all original fields in intake.
alter table private.watch_catalogue
  add column source_details jsonb not null default '{}'::jsonb
  check (jsonb_typeof(source_details) = 'object');

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
    'preownedPrice', w.preowned_price,
    'sourceDetails', w.source_details
  );
$$;
