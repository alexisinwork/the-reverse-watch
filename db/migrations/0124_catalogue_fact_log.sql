-- Catalogue repair (owner, 2026-11-27: "Делай шаг 2 и шаг 3 на все часы и
-- детально дополни существующий каталог ... даю добро на траты до 100
-- долларов"). Every fact the repair checks is logged with the value it
-- replaced, where it came from and how, so each change can be checked and
-- each run undone:
--
--   watch_catalogue_fact_apply_v1(watch, run, facts)  writes one watch's facts
--   watch_catalogue_fact_revert_v1(run)                undoes a whole run
--
-- A fact is written only when the repair has a source for it: a maker's or
-- an authorised retailer's page that our server opened and that shows the
-- reference and the passage (method maker_page or retailer_page), the
-- record's own watch database (database), a rule over facts that have a
-- source (derived), or a model's classification of styles from those facts
-- (model). Confirmed and unconfirmed checks are logged too, so a stored
-- value's provenance is kept even when it does not change.
-- Additive: one new table and two functions; nothing existing changes.
-- Rollback: watch_catalogue_fact_revert_v1 for each run, then drop the two
-- functions and the table.

create table private.watch_catalogue_fact_log (
  id bigint generated always as identity primary key,
  watch_id uuid not null references private.watch_catalogue (id),
  run text not null check (run ~ '^[a-z0-9-]{1,60}$'),
  field text not null check (field in (
    'model', 'referenceConfirmed', 'styles', 'caseDiameterMm', 'caseThicknessMm',
    'waterResistanceM', 'movement', 'inHouseCalibre', 'caseMaterial',
    'casebackMaterial', 'strapMaterial', 'crystal', 'imageUrl', 'sourceUrl',
    'sourceKind', 'priceStatus')),
  status text not null check (status in ('confirmed', 'corrected', 'filled', 'unconfirmed')),
  old_value jsonb,
  new_value jsonb,
  method text not null check (method in ('maker_page', 'retailer_page', 'database', 'derived', 'model')),
  source_url text check (source_url is null or source_url ~ '^https://'),
  passage text check (passage is null or length(passage) <= 600),
  model text check (model is null or length(model) <= 80),
  checked_at timestamptz not null default now(),
  reverted_at timestamptz
);
create index watch_catalogue_fact_log_watch_idx on private.watch_catalogue_fact_log (watch_id);
create index watch_catalogue_fact_log_run_idx on private.watch_catalogue_fact_log (run);
alter table private.watch_catalogue_fact_log enable row level security;
revoke all on private.watch_catalogue_fact_log from public, anon, authenticated;

-- The column a fact belongs to, as jsonb, for the log's old_value.
create function private.watch_catalogue_fact_value(w private.watch_catalogue, p_field text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select case p_field
    when 'model' then to_jsonb(w.model)
    when 'referenceConfirmed' then to_jsonb(w.reference_confirmed)
    when 'styles' then to_jsonb(w.styles)
    when 'caseDiameterMm' then to_jsonb(w.case_diameter_mm)
    when 'caseThicknessMm' then to_jsonb(w.case_thickness_mm)
    when 'waterResistanceM' then to_jsonb(w.water_resistance_m)
    when 'movement' then to_jsonb(w.movement)
    when 'inHouseCalibre' then to_jsonb(w.in_house_calibre)
    when 'caseMaterial' then to_jsonb(w.case_material)
    when 'casebackMaterial' then to_jsonb(w.caseback_material)
    when 'strapMaterial' then to_jsonb(w.strap_material)
    when 'crystal' then to_jsonb(w.crystal)
    when 'imageUrl' then to_jsonb(w.image_url)
    when 'sourceUrl' then to_jsonb(w.source_url)
    when 'sourceKind' then to_jsonb(w.source_kind)
    when 'priceStatus' then to_jsonb(w.price_status)
  end
$$;

-- Writes one column from a jsonb value; the table's own checks still apply.
create function private.watch_catalogue_fact_set(p_id uuid, p_field text, p_value jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_text text := case when p_value is null or jsonb_typeof(p_value) = 'null' then null else p_value #>> '{}' end;
begin
  if p_field = 'model' then
    if v_text is null then raise exception 'a model name cannot be empty'; end if;
    update private.watch_catalogue set model = v_text where id = p_id;
  elsif p_field = 'referenceConfirmed' then
    update private.watch_catalogue set reference_confirmed = coalesce(v_text::boolean, false) where id = p_id;
  elsif p_field = 'styles' then
    update private.watch_catalogue
      set styles = coalesce(array(select jsonb_array_elements_text(p_value)), '{}')
      where id = p_id;
  elsif p_field = 'caseDiameterMm' then
    update private.watch_catalogue set case_diameter_mm = v_text::numeric where id = p_id;
  elsif p_field = 'caseThicknessMm' then
    update private.watch_catalogue set case_thickness_mm = v_text::numeric where id = p_id;
  elsif p_field = 'waterResistanceM' then
    update private.watch_catalogue set water_resistance_m = v_text::numeric::integer where id = p_id;
  elsif p_field = 'movement' then
    update private.watch_catalogue set movement = v_text where id = p_id;
  elsif p_field = 'inHouseCalibre' then
    update private.watch_catalogue set in_house_calibre = v_text::boolean where id = p_id;
  elsif p_field = 'caseMaterial' then
    update private.watch_catalogue set case_material = v_text where id = p_id;
  elsif p_field = 'casebackMaterial' then
    update private.watch_catalogue set caseback_material = v_text where id = p_id;
  elsif p_field = 'strapMaterial' then
    update private.watch_catalogue set strap_material = v_text where id = p_id;
  elsif p_field = 'crystal' then
    update private.watch_catalogue set crystal = v_text where id = p_id;
  elsif p_field = 'imageUrl' then
    if v_text is not null and v_text !~ '^https://' then raise exception 'an image address must be https'; end if;
    update private.watch_catalogue set image_url = v_text where id = p_id;
  elsif p_field = 'sourceUrl' then
    -- A run may only set an https page; a revert may restore no page.
    if v_text is not null and v_text !~ '^https?://' then raise exception 'invalid source address'; end if;
    update private.watch_catalogue set source_url = v_text where id = p_id;
  elsif p_field = 'sourceKind' then
    if v_text is not null and v_text not in ('manufacturer', 'retailer', 'catalogue') then
      raise exception 'invalid source kind';
    end if;
    update private.watch_catalogue set source_kind = v_text where id = p_id;
  elsif p_field = 'priceStatus' then
    if v_text not in ('confirmed', 'approximate', 'unconfirmed') then raise exception 'invalid price status'; end if;
    update private.watch_catalogue set price_status = v_text where id = p_id;
  else
    raise exception 'unknown field %', p_field;
  end if;
end;
$$;

-- p_facts: [{field, status, value, method, sourceUrl, passage, model}]. Only
-- 'corrected' and 'filled' change the record; every entry is logged. A new
-- source page (field sourceUrl, value https only) comes with its sourceKind
-- as a fact of its own. Returns the number of columns changed.
create function public.watch_catalogue_fact_apply_v1(p_watch_id uuid, p_run text, p_facts jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_watch private.watch_catalogue;
  v_fact jsonb;
  v_changed integer := 0;
  v_status text;
  v_field text;
  v_summary jsonb := '{}'::jsonb;
begin
  if p_run is null or p_run !~ '^[a-z0-9-]{1,60}$' then raise exception 'invalid run'; end if;
  if jsonb_typeof(p_facts) <> 'array' or jsonb_array_length(p_facts) > 30 then
    raise exception 'facts must be an array of at most 30 entries';
  end if;
  select * into v_watch from private.watch_catalogue where id = p_watch_id for update;
  if not found then raise exception 'unknown watch'; end if;
  for v_fact in select value from jsonb_array_elements(p_facts) loop
    v_field := v_fact ->> 'field';
    v_status := v_fact ->> 'status';
    insert into private.watch_catalogue_fact_log
      (watch_id, run, field, status, old_value, new_value, method, source_url, passage, model)
    values (
      p_watch_id, p_run, v_field, v_status,
      private.watch_catalogue_fact_value(v_watch, v_field),
      v_fact -> 'value',
      v_fact ->> 'method',
      nullif(v_fact ->> 'sourceUrl', ''),
      left(nullif(v_fact ->> 'passage', ''), 600),
      nullif(v_fact ->> 'model', '')
    );
    if v_status in ('corrected', 'filled') then
      if v_field = 'sourceUrl' and coalesce(v_fact ->> 'value', '') !~ '^https://' then
        raise exception 'a new source page must be https';
      end if;
      perform private.watch_catalogue_fact_set(p_watch_id, v_field, v_fact -> 'value');
      v_changed := v_changed + 1;
    end if;
    v_summary := v_summary || jsonb_build_object(v_field,
      concat_ws(' · ', v_status, v_fact ->> 'method',
        nullif(split_part(regexp_replace(coalesce(v_fact ->> 'sourceUrl', ''), '^https://(www\.)?', ''), '/', 1), ''),
        to_char(now(), 'YYYY-MM-DD')));
  end loop;
  update private.watch_catalogue
    set source_details = source_details || jsonb_build_object('factCheck',
          coalesce(source_details -> 'factCheck', '{}'::jsonb) || v_summary),
        updated_at = now()
    where id = p_watch_id;
  return v_changed;
end;
$$;

-- Undoes one run: every change it made, newest first, back to the logged
-- old value. Returns the number of columns restored.
create function public.watch_catalogue_fact_revert_v1(p_run text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_count integer := 0;
begin
  if p_run is null or p_run !~ '^[a-z0-9-]{1,60}$' then raise exception 'invalid run'; end if;
  for v_row in
    select id, watch_id, field, old_value from private.watch_catalogue_fact_log
    where run = p_run and status in ('corrected', 'filled') and reverted_at is null
    order by id desc
  loop
    perform private.watch_catalogue_fact_set(v_row.watch_id, v_row.field, v_row.old_value);
    update private.watch_catalogue set updated_at = now() where id = v_row.watch_id;
    update private.watch_catalogue_fact_log set reverted_at = now() where id = v_row.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function private.watch_catalogue_fact_value(private.watch_catalogue, text) from public, anon, authenticated;
revoke all on function private.watch_catalogue_fact_set(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.watch_catalogue_fact_apply_v1(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.watch_catalogue_fact_revert_v1(text) from public, anon, authenticated;
grant execute on function public.watch_catalogue_fact_apply_v1(uuid, text, jsonb) to service_role;
grant execute on function public.watch_catalogue_fact_revert_v1(text) to service_role;
