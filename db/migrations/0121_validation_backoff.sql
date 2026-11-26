-- The cost rule (2026-11-26): a saved search whose paid check keeps failing
-- waited only five minutes between re-checks, so the saved film search for
-- Heat was re-checked 30 times from 28 October to 25 November without a
-- published result ($0.24). The wait now grows with every failed check of
-- the same cache key: 5 minutes after the first, 1 hour after the second,
-- 1 day after the third and 7 days after each later one. A published result
-- still returns 'valid' at once, and v5 still recovers abandoned attempts
-- first. Every caller (searches, the price recheck cron) goes through v4.
-- Rollback: re-apply the v4 body from 0097_validation_retry_cooldown.sql.
create or replace function public.ai_watch_validation_reserve_v4(p_cache_key text, p_watch_count integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_last timestamptz; v_failures integer; v_wait interval;
begin
  if p_cache_key is null or p_cache_key !~ '^[0-9a-f]{64}$'
     or p_watch_count is null or p_watch_count not between 1 and 8 then
    raise exception 'invalid validation request';
  end if;
  -- Use the same safety -> key lock order as v3/v2.
  perform 1 from private.ai_watch_validation_safety where id=true for update;
  if not found then raise exception 'validation safety record missing'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_cache_key,0));
  if exists(select 1 from private.ai_watch_validated_cache_snapshots
      where cache_key=p_cache_key and policy_version='source-v1') then
    return jsonb_build_object('state','valid');
  end if;
  -- With no published snapshot, every settled attempt was a failed check.
  select count(*), max(settled_at) into v_failures, v_last
    from private.ai_watch_validation_attempts
    where cache_key=p_cache_key and state='settled';
  v_wait := case
    when v_failures <= 1 then interval '5 minutes'
    when v_failures = 2 then interval '1 hour'
    when v_failures = 3 then interval '1 day'
    else interval '7 days'
  end;
  if v_last > now() - v_wait then
    return jsonb_build_object('state','retry_later');
  end if;
  return public.ai_watch_validation_reserve_v3(p_cache_key,p_watch_count);
end;
$$;

revoke all on function public.ai_watch_validation_reserve_v4(text,integer) from public,anon,authenticated;
grant execute on function public.ai_watch_validation_reserve_v4(text,integer) to service_role;
