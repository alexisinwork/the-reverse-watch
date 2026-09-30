-- The watch catalogue: individual watches with checked facts and a review
-- status. Filled by scripts/build-catalogue.ts (price ranges up to 10k x
-- wearing styles x runs) and by the live quiz search, which adds what it
-- finds as pending. Quiz answers are filtered from here in code.
--
-- Facts the search could not establish stay null; a null never satisfies a
-- hard quiz filter. A price is stored only after two independent Perplexity
-- lookups agree within 5% on a fresh or live source; otherwise the price
-- columns stay null and price_status is 'unconfirmed'.
--
-- Written and read only by the server with the service-role key.

create table private.watch_catalogue (
  id uuid primary key default gen_random_uuid(),
  identity_key text not null unique check (length(identity_key) between 3 and 400),
  brand text not null check (length(brand) between 1 and 160),
  model text not null check (length(model) between 1 and 200),
  reference_code text
    check (reference_code is null or length(reference_code) between 1 and 120),
  -- True only when a manufacturer or authorised-retailer page shows the
  -- exact reference.
  reference_confirmed boolean not null default false,
  styles text[] not null default '{}'
    check (styles <@ array['dress', 'everyday', 'sport', 'dive', 'field', 'travel']::text[]),
  case_diameter_mm numeric(5, 2) check (case_diameter_mm is null or case_diameter_mm between 15 and 70),
  case_thickness_mm numeric(5, 2) check (case_thickness_mm is null or case_thickness_mm between 2 and 40),
  case_shape text,
  water_resistance_m integer check (water_resistance_m is null or water_resistance_m between 0 and 20000),
  movement text check (
    movement is null
    or movement in ('automatic', 'manual', 'quartz', 'solar', 'spring_drive', 'hybrid')
  ),
  in_house_calibre boolean,
  crystal text,
  display_caseback boolean,
  complications text[] not null default '{}',
  case_material text,
  caseback_material text,
  strap_material text,
  price_amount numeric(12, 2) check (price_amount is null or price_amount > 0),
  price_currency text check (price_currency is null or price_currency ~ '^[A-Z]{3}$'),
  price_status text not null default 'unconfirmed'
    check (price_status in ('confirmed', 'unconfirmed')),
  price_checked_at timestamptz,
  -- Both lookups, their sources and dates, kept as evidence.
  price_evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(price_evidence) = 'object'),
  -- A recheck that found a different confirmed price parks it here for review.
  price_change jsonb check (price_change is null or jsonb_typeof(price_change) = 'object'),
  source_url text check (source_url is null or source_url ~ '^https?://'),
  source_kind text check (source_kind is null or source_kind in ('manufacturer', 'retailer')),
  image_url text check (image_url is null or image_url ~ '^https?://'),
  rationale text,
  -- Which build cells (range/style/run) or live searches found it.
  found_in jsonb not null default '[]'::jsonb check (jsonb_typeof(found_in) = 'array'),
  review_status text not null default 'pending'
    check (review_status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((price_amount is null) = (price_currency is null)),
  check (price_status = 'unconfirmed' or price_amount is not null)
);

create index watch_catalogue_review_status_idx on private.watch_catalogue (review_status);
create index watch_catalogue_price_checked_idx on private.watch_catalogue (price_checked_at);

alter table private.watch_catalogue enable row level security;

create function private.watch_catalogue_json(w private.watch_catalogue)
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
    'updatedAt', w.updated_at
  );
$$;

create function public.watch_catalogue_list_v1(p_include_rejected boolean default false)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(private.watch_catalogue_json(w) order by w.brand, w.model), '[]'::jsonb)
  from private.watch_catalogue w
  where p_include_rejected or w.review_status <> 'rejected';
$$;

create function public.watch_catalogue_identity_keys_v1()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(w.identity_key), '[]'::jsonb) from private.watch_catalogue w;
$$;

-- Inserts a new watch as pending, or merges a repeat find into the existing
-- row: styles and found_in are unioned, missing facts are filled, and facts
-- already stored are never overwritten (an edit is the only way to change
-- them). A reference, once confirmed, stays confirmed.
create function public.watch_catalogue_upsert_v1(p_watch jsonb)
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
    price_amount = case when w.price_status = 'confirmed' then w.price_amount else excluded.price_amount end,
    price_currency = case when w.price_status = 'confirmed' then w.price_currency else excluded.price_currency end,
    price_status = case when w.price_status = 'confirmed' then w.price_status else excluded.price_status end,
    price_checked_at = case when w.price_status = 'confirmed' then w.price_checked_at else excluded.price_checked_at end,
    price_evidence = case when w.price_status = 'confirmed' then w.price_evidence else excluded.price_evidence end,
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

-- Approve, reject or edit. p_patch holds only the fields being edited.
create function public.watch_catalogue_review_v1(p_id uuid, p_status text, p_patch jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_price_given boolean := p_patch ? 'priceAmount';
  v_amount numeric := nullif(p_patch ->> 'priceAmount', '')::numeric;
begin
  if p_status is not null and p_status not in ('pending', 'approved', 'rejected') then
    raise exception 'invalid review status';
  end if;
  update private.watch_catalogue w set
    review_status = coalesce(p_status, w.review_status),
    reviewed_at = case when p_status is null then w.reviewed_at else now() end,
    brand = coalesce(nullif(p_patch ->> 'brand', ''), w.brand),
    model = coalesce(nullif(p_patch ->> 'model', ''), w.model),
    reference_code = case when p_patch ? 'referenceCode' then nullif(p_patch ->> 'referenceCode', '') else w.reference_code end,
    reference_confirmed = case when p_patch ? 'referenceConfirmed' then (p_patch ->> 'referenceConfirmed')::boolean else w.reference_confirmed end,
    styles = case when p_patch ? 'styles'
      then array(select jsonb_array_elements_text(p_patch -> 'styles')) else w.styles end,
    case_diameter_mm = case when p_patch ? 'caseDiameterMm' then nullif(p_patch ->> 'caseDiameterMm', '')::numeric else w.case_diameter_mm end,
    case_thickness_mm = case when p_patch ? 'caseThicknessMm' then nullif(p_patch ->> 'caseThicknessMm', '')::numeric else w.case_thickness_mm end,
    water_resistance_m = case when p_patch ? 'waterResistanceM' then nullif(p_patch ->> 'waterResistanceM', '')::integer else w.water_resistance_m end,
    movement = case when p_patch ? 'movement' then nullif(p_patch ->> 'movement', '') else w.movement end,
    case_material = case when p_patch ? 'caseMaterial' then nullif(p_patch ->> 'caseMaterial', '') else w.case_material end,
    caseback_material = case when p_patch ? 'casebackMaterial' then nullif(p_patch ->> 'casebackMaterial', '') else w.caseback_material end,
    strap_material = case when p_patch ? 'strapMaterial' then nullif(p_patch ->> 'strapMaterial', '') else w.strap_material end,
    source_url = case when p_patch ? 'sourceUrl' then nullif(p_patch ->> 'sourceUrl', '') else w.source_url end,
    image_url = case when p_patch ? 'imageUrl' then nullif(p_patch ->> 'imageUrl', '') else w.image_url end,
    rationale = case when p_patch ? 'rationale' then nullif(p_patch ->> 'rationale', '') else w.rationale end,
    -- A price typed by the reviewer counts as checked by the reviewer.
    price_amount = case when v_price_given then v_amount else w.price_amount end,
    price_currency = case
      when v_price_given and v_amount is null then null
      when v_price_given then coalesce(nullif(p_patch ->> 'priceCurrency', ''), w.price_currency, 'USD')
      else w.price_currency
    end,
    price_status = case
      when v_price_given and v_amount is null then 'unconfirmed'
      when v_price_given then 'confirmed'
      else w.price_status
    end,
    price_checked_at = case when v_price_given then now() else w.price_checked_at end,
    price_evidence = case
      when v_price_given then jsonb_build_object('method', 'reviewer', 'at', now())
      else w.price_evidence
    end,
    price_change = case when v_price_given then null else w.price_change end,
    updated_at = now()
  where w.id = p_id;
  return found;
end;
$$;

-- Records a price recheck. p_result.kind:
--   'same'        confirmed again within 5%: refresh the check date
--   'changed'     confirmed at a different price: park it for review
--   'confirmed'   first confirmed price for a watch that had none
--   'unconfirmed' the recheck could not confirm: only the date moves
--   'accept'      reviewer accepts the parked change
--   'dismiss'     reviewer keeps the old price
create function public.watch_catalogue_price_v1(p_id uuid, p_result jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text := p_result ->> 'kind';
begin
  if v_kind = 'same' then
    update private.watch_catalogue set price_checked_at = now(),
      price_evidence = coalesce(p_result -> 'evidence', price_evidence), updated_at = now()
    where id = p_id;
  elsif v_kind = 'changed' then
    update private.watch_catalogue set price_checked_at = now(),
      price_change = jsonb_build_object(
        'amount', (p_result ->> 'amount')::numeric,
        'currency', p_result ->> 'currency',
        'foundAt', now(),
        'evidence', p_result -> 'evidence'
      ),
      updated_at = now()
    where id = p_id;
  elsif v_kind = 'confirmed' then
    update private.watch_catalogue set price_checked_at = now(),
      price_amount = (p_result ->> 'amount')::numeric,
      price_currency = p_result ->> 'currency',
      price_status = 'confirmed',
      price_evidence = coalesce(p_result -> 'evidence', '{}'::jsonb),
      updated_at = now()
    where id = p_id;
  elsif v_kind = 'unconfirmed' then
    update private.watch_catalogue set price_checked_at = now(), updated_at = now()
    where id = p_id;
  elsif v_kind = 'accept' then
    update private.watch_catalogue set
      price_amount = (price_change ->> 'amount')::numeric,
      price_currency = price_change ->> 'currency',
      price_status = 'confirmed',
      price_evidence = coalesce(price_change -> 'evidence', '{}'::jsonb),
      price_change = null,
      updated_at = now()
    where id = p_id and price_change is not null;
  elsif v_kind = 'dismiss' then
    update private.watch_catalogue set price_change = null, updated_at = now()
    where id = p_id;
  else
    raise exception 'invalid price result kind';
  end if;
  return found;
end;
$$;

-- Watches whose price was last checked before p_before (or never), oldest first.
create function public.watch_catalogue_price_due_v1(p_before timestamptz, p_limit integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(private.watch_catalogue_json(w)), '[]'::jsonb)
  from (
    select * from private.watch_catalogue
    where review_status <> 'rejected'
      and (price_checked_at is null or price_checked_at < p_before)
    order by price_checked_at nulls first
    limit least(greatest(p_limit, 1), 200)
  ) w;
$$;

revoke all on function private.watch_catalogue_json(private.watch_catalogue) from public, anon, authenticated;
revoke all on function public.watch_catalogue_list_v1(boolean) from public, anon, authenticated;
revoke all on function public.watch_catalogue_identity_keys_v1() from public, anon, authenticated;
revoke all on function public.watch_catalogue_upsert_v1(jsonb) from public, anon, authenticated;
revoke all on function public.watch_catalogue_review_v1(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.watch_catalogue_price_v1(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.watch_catalogue_price_due_v1(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.watch_catalogue_list_v1(boolean) to service_role;
grant execute on function public.watch_catalogue_identity_keys_v1() to service_role;
grant execute on function public.watch_catalogue_upsert_v1(jsonb) to service_role;
grant execute on function public.watch_catalogue_review_v1(uuid, text, jsonb) to service_role;
grant execute on function public.watch_catalogue_price_v1(uuid, jsonb) to service_role;
grant execute on function public.watch_catalogue_price_due_v1(timestamptz, integer) to service_role;
