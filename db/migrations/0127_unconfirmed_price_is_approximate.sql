-- Owner decision 2026-11-28 (docs/OWNER_QUESTIONS.md #13, "да - примерная"):
-- a "confirmed" price that a new double check cannot reproduce is shown as
-- approximate at once, instead of keeping its label until the daily recheck
-- reaches it at 90 days. Until now a failed recheck also moved
-- price_checked_at to now, so such a label could stay "confirmed" for ever.
--
-- 1. watch_catalogue_price_v1, kind 'unconfirmed' (scripts/recheck-catalogue-
--    prices.ts and the catalogue build): a confirmed price becomes
--    approximate; the date of the last successful check is kept and the
--    attempt is recorded in price_recheck_attempted_at. Every other kind is
--    unchanged from migration 0073.
-- 2. catalogue_price_recheck_unverified_v1 (new): after a completed daily
--    recheck (migration 0112), the run's confirmed prices that it could not
--    reproduce become approximate. A watch changed since the run began is
--    left alone, as catalogue_price_recheck_finish_v1 does.
--
-- No data is removed. Rollback: re-create watch_catalogue_price_v1 from
-- migration 0073 and stop calling the new function
-- (app/domain/catalogue-price-refresh.server.ts).

create or replace function public.watch_catalogue_price_v1(p_id uuid, p_result jsonb)
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
  elsif v_kind = 'approximate' then
    -- A market price (new or unworn listings): never over a confirmed one.
    update private.watch_catalogue set price_checked_at = now(),
      price_amount = (p_result ->> 'amount')::numeric,
      price_currency = p_result ->> 'currency',
      price_status = 'approximate',
      price_evidence = coalesce(p_result -> 'evidence', '{}'::jsonb),
      updated_at = now()
    where id = p_id and price_status <> 'confirmed';
  elsif v_kind = 'unconfirmed' then
    -- The check could not reproduce the price: a confirmed one is shown as
    -- approximate from now on (owner, 2026-11-28); the last good check's
    -- date stays, so the daily recheck still reaches it.
    update private.watch_catalogue set
      price_status = case when price_status = 'confirmed' then 'approximate' else price_status end,
      price_recheck_attempted_at = now(),
      updated_at = now()
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

create function public.catalogue_price_recheck_unverified_v1(p_attempt_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare
  v_run private.catalogue_price_recheck_runs%rowtype;
  v_count integer;
begin
  select * into v_run from private.catalogue_price_recheck_runs where attempt_id=p_attempt_id;
  if not found or v_run.state<>'completed' then return 0; end if;
  update private.watch_catalogue w set price_status='approximate', updated_at=now()
  from jsonb_array_elements(v_run.watches) base
  where w.id=(base->>'id')::uuid
    and not exists(select 1 from jsonb_array_elements(coalesce(v_run.results,'[]'::jsonb)) r
      where r->>'id'=base->>'id')
    and w.price_status='confirmed' and w.price_change is null and w.review_status<>'rejected'
    and w.updated_at is not distinct from (base->>'updatedAt')::timestamptz;
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;
revoke all on function public.catalogue_price_recheck_unverified_v1(uuid) from public,anon,authenticated;
grant execute on function public.catalogue_price_recheck_unverified_v1(uuid) to service_role;
