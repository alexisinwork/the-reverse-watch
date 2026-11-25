-- The quiz no longer loads the whole recommendation pool into every server
-- (25,014 rows, 61 MB of JSON on 2026-11-25). PostgreSQL returns only the
-- rows one quiz answer could select, and the code still applies every exact
-- rule to them (owner decision, 2026-11-25: hard filters run in the database).
--
-- A row can appear in a quiz shortlist, close fit or broader close fit only
-- when its price is known and inside the visitor's budget, its case diameter
-- is within 3 mm of the chosen range and its movement is stated. The window
-- below is that superset. The caller converts the budget into each currency
-- and widens every bound slightly, so rounding can only add rows.
--
-- All reads are additive, service-role only, and bounded.

create index watch_catalogue_quiz_window_idx
  on private.watch_catalogue (upper(price_currency), price_amount)
  where review_status <> 'rejected'
    and source_url is not null
    and price_amount is not null
    and price_status <> 'unconfirmed'
    and price_currency is not null;

-- Only the facts the quiz rules and ranking read, as columns plus rows: the
-- evidence, history and source details stay in the database until a watch is
-- actually shown (watch_catalogue_rows_by_id_v1).
create function public.watch_catalogue_quiz_window_v1(
  p_price_bounds jsonb,
  p_min_diameter numeric,
  p_max_diameter numeric,
  p_require_nickel_facts boolean default false
)
returns jsonb
language sql
stable
security definer
set search_path = ''
set jit = off
as $$
  with bounds as (
    -- One bound per currency: duplicates merge into their widest range.
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
      and w.price_status <> 'unconfirmed'
      and w.price_currency is not null
      and w.case_diameter_mm >= p_min_diameter
      and w.case_diameter_mm <= p_max_diameter
      and nullif(btrim(w.movement), '') is not null
      and (
        not coalesce(p_require_nickel_facts, false)
        or (
          coalesce(w.caseback_material, w.case_material) is not null
          and w.strap_material is not null
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
      'sourceUrl', 'imageUrl', 'reviewStatus'
    ),
    'rows', coalesce(jsonb_agg(jsonb_build_array(
      w.id, w.identity_key, w.brand, w.model, w.reference_code,
      w.reference_confirmed, to_jsonb(w.styles), w.case_diameter_mm,
      w.case_thickness_mm, w.case_shape, w.water_resistance_m, w.movement,
      w.in_house_calibre, w.crystal, w.display_caseback,
      to_jsonb(w.complications), w.case_material, w.caseback_material,
      w.strap_material, w.price_amount, w.price_currency, w.price_status,
      w.source_url, w.image_url, w.review_status
    ) order by w.brand, w.model, w.id), '[]'::jsonb)
  )
  from window_rows w;
$$;

-- Full rows for the watches a result actually shows.
create function public.watch_catalogue_rows_by_id_v1(p_ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path = ''
set jit = off
as $$
  select coalesce(jsonb_agg(private.watch_catalogue_json(w) order by w.brand, w.model, w.id), '[]'::jsonb)
  from private.watch_catalogue w
  where w.id = any((coalesce(p_ids, '{}'::uuid[]))[1:200])
    and w.review_status <> 'rejected'
    and (w.import_source is null or (w.price_amount is not null and w.price_status <> 'unconfirmed'));
$$;

-- Pool rows for specific watches: by identity key, or by brand and reference
-- normalized the same way as watch_catalogue_exact_reference_idx.
create function public.watch_catalogue_pool_lookup_v1(
  p_identity_keys text[],
  p_references jsonb
)
returns jsonb
language sql
stable
security definer
set search_path = ''
set jit = off
as $$
  with refs as (
    select distinct
      lower(regexp_replace(k.value->>'brand', '[^a-zA-Z0-9]', '', 'g')) as brand_key,
      lower(regexp_replace(k.value->>'referenceCode', '[^a-zA-Z0-9]', '', 'g')) as reference_key
    from jsonb_array_elements(coalesce(p_references, '[]'::jsonb)) with ordinality as k(value, n)
    where k.n <= 100
      and k.value->>'brand' is not null
      and k.value->>'referenceCode' is not null
  ),
  keys as (
    select distinct key
    from unnest((coalesce(p_identity_keys, '{}'::text[]))[1:100]) as key
  ),
  matched as (
    select w.id
    from refs
    join private.watch_catalogue w
      on lower(regexp_replace(w.brand, '[^a-zA-Z0-9]', '', 'g')) = refs.brand_key
     and lower(regexp_replace(w.reference_code, '[^a-zA-Z0-9]', '', 'g')) = refs.reference_key
    union
    select w.id
    from keys
    join private.watch_catalogue w on w.identity_key = keys.key
  )
  select coalesce(jsonb_agg(private.watch_catalogue_json(w) order by w.brand, w.model, w.id), '[]'::jsonb)
  from private.watch_catalogue w
  join matched on matched.id = w.id
  where w.review_status <> 'rejected'
    and (w.import_source is null or (w.price_amount is not null and w.price_status <> 'unconfirmed'));
$$;

-- Every identity in the recommendation pool: lets saved research tell a
-- watch the catalogue already holds from a new suggestion.
create function public.watch_catalogue_pool_identity_keys_v1()
returns jsonb
language sql
stable
security definer
set search_path = ''
set jit = off
as $$
  select coalesce(jsonb_agg(w.identity_key order by w.identity_key), '[]'::jsonb)
  from private.watch_catalogue w
  where w.review_status <> 'rejected'
    and (w.import_source is null or (w.price_amount is not null and w.price_status <> 'unconfirmed'));
$$;

revoke all on function public.watch_catalogue_quiz_window_v1(jsonb, numeric, numeric, boolean) from public, anon, authenticated;
grant execute on function public.watch_catalogue_quiz_window_v1(jsonb, numeric, numeric, boolean) to service_role;
revoke all on function public.watch_catalogue_rows_by_id_v1(uuid[]) from public, anon, authenticated;
grant execute on function public.watch_catalogue_rows_by_id_v1(uuid[]) to service_role;
revoke all on function public.watch_catalogue_pool_lookup_v1(text[], jsonb) from public, anon, authenticated;
grant execute on function public.watch_catalogue_pool_lookup_v1(text[], jsonb) to service_role;
revoke all on function public.watch_catalogue_pool_identity_keys_v1() from public, anon, authenticated;
grant execute on function public.watch_catalogue_pool_identity_keys_v1() to service_role;
