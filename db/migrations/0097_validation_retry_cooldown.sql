-- Prevent repeated failed research for the same cache key from exhausting the
-- monthly budget. A published result always remains immediately available.
create index ai_watch_validation_recent_settled_idx
  on private.ai_watch_validation_attempts(cache_key, settled_at desc)
  where state = 'settled';

create function public.ai_watch_validation_reserve_v4(p_cache_key text, p_watch_count integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_last timestamptz;
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
  select max(settled_at) into v_last from private.ai_watch_validation_attempts
    where cache_key=p_cache_key and state='settled';
  if v_last > now() - interval '5 minutes' then
    return jsonb_build_object('state','retry_later');
  end if;
  return public.ai_watch_validation_reserve_v3(p_cache_key,p_watch_count);
end;
$$;

revoke all on function public.ai_watch_validation_reserve_v4(text,integer) from public,anon,authenticated;
grant execute on function public.ai_watch_validation_reserve_v4(text,integer) to service_role;
