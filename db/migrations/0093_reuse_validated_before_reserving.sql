-- A request can observe a cache miss just before another request publishes.
-- Recheck the snapshot while holding the per-key transaction lock.
create or replace function public.ai_watch_validation_reserve_v2(p_cache_key text, p_watch_count integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_month date := date_trunc('month', now() at time zone 'UTC')::date;
  v_reserve numeric(10,5);
  v_id uuid;
begin
  if p_cache_key is null or p_cache_key !~ '^[0-9a-f]{64}$'
     or p_watch_count is null or p_watch_count not between 1 and 8 then
    raise exception 'invalid validation request';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_cache_key, 0));
  if exists (select 1 from private.ai_watch_validated_cache_snapshots where cache_key=p_cache_key and policy_version='source-v1') then
    return jsonb_build_object('state', 'valid');
  end if;
  if exists (select 1 from private.ai_watch_validation_attempts where cache_key=p_cache_key and state='reserved') then
    return jsonb_build_object('state', 'in_progress');
  end if;
  v_reserve := p_watch_count * 0.025;
  insert into private.ai_watch_validation_monthly_budget(month_start)
  values(v_month) on conflict(month_start) do nothing;
  update private.ai_watch_validation_monthly_budget
  set reserved_usd=reserved_usd+v_reserve,updated_at=now()
  where month_start=v_month and spent_usd+reserved_usd+v_reserve<=100;
  if not found then return jsonb_build_object('state','monthly_limit'); end if;
  insert into private.ai_watch_validation_attempts(cache_key,budget_month,watch_count,reserved_usd,state)
  values(p_cache_key,v_month,p_watch_count,v_reserve,'reserved') returning id into v_id;
  return jsonb_build_object('state','reserved','attemptId',v_id,'reservedUsd',v_reserve);
end;
$$;

revoke all on function public.ai_watch_validation_reserve_v2(text,integer) from public,anon,authenticated;
grant execute on function public.ai_watch_validation_reserve_v2(text,integer) to service_role;
