-- A killed server must not leave a cache key validating forever. Fifteen
-- minutes exceeds the deployed function's five-minute execution limit.
create function public.ai_watch_validation_reserve_v5(p_cache_key text, p_watch_count integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_halted timestamptz; v_old record; v_expired boolean:=false; v_costs jsonb;
begin
  if p_cache_key is null or p_cache_key !~ '^[0-9a-f]{64}$'
    or p_watch_count is null or p_watch_count not between 1 and 8 then
    raise exception 'invalid validation request';
  end if;
  -- Preserve the shared safety -> key -> attempt/budget lock order.
  select halted_at into v_halted from private.ai_watch_validation_safety where id=true for update;
  if not found then raise exception 'validation safety record missing'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_cache_key,0));
  if exists(select 1 from private.ai_watch_validated_cache_snapshots
    where cache_key=p_cache_key and policy_version='source-v1') then
    return jsonb_build_object('state','valid');
  end if;
  if v_halted is not null then return jsonb_build_object('state','budget_halted'); end if;
  for v_old in select a.id,a.watch_count from private.ai_watch_validation_attempts a
    where a.cache_key=p_cache_key and a.state='reserved'
      and a.created_at<now()-interval '15 minutes'
      and not exists(select 1 from private.ai_watch_validation_overruns o where o.attempt_id=a.id)
    order by a.id for update
  loop
    -- Unknown charges consume the entire old reserve, never a guessed zero.
    select jsonb_agg(0.025) into v_costs from generate_series(1,v_old.watch_count);
    if not public.ai_watch_validation_settle_v2(v_old.id,v_costs) then
      raise exception 'abandoned validation settlement failed';
    end if;
    v_expired:=true;
  end loop;
  if v_expired then
    -- This request already waited out a dead worker, not a fresh failed check.
    return public.ai_watch_validation_reserve_v3(p_cache_key,p_watch_count);
  end if;
  return public.ai_watch_validation_reserve_v4(p_cache_key,p_watch_count);
end;
$$;
revoke all on function public.ai_watch_validation_reserve_v5(text,integer) from public,anon,authenticated;
grant execute on function public.ai_watch_validation_reserve_v5(text,integer) to service_role;
