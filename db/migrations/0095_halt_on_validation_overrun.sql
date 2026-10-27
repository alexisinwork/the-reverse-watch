-- Stop future metered validation if a provider reports spending above the
-- per-watch reservation. A reservation is kept for manual reconciliation;
-- the actual known amounts are retained instead of silently capping them.
create table private.ai_watch_validation_safety (
  id boolean primary key default true check (id),
  halted_at timestamptz,
  attempt_id uuid references private.ai_watch_validation_attempts(id)
);
insert into private.ai_watch_validation_safety(id) values (true);
alter table private.ai_watch_validation_safety enable row level security;
revoke all on private.ai_watch_validation_safety from public, anon, authenticated;

create table private.ai_watch_validation_overruns (
  attempt_id uuid primary key references private.ai_watch_validation_attempts(id),
  observed_costs jsonb not null check (jsonb_typeof(observed_costs) = 'array'),
  observed_at timestamptz not null default now()
);
alter table private.ai_watch_validation_overruns enable row level security;
revoke all on private.ai_watch_validation_overruns from public, anon, authenticated;

create function public.ai_watch_validation_reserve_v3(p_cache_key text, p_watch_count integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_halted timestamptz;
begin
  select halted_at into v_halted from private.ai_watch_validation_safety where id = true for update;
  if not found then raise exception 'validation safety record missing'; end if;
  if v_halted is not null then return jsonb_build_object('state','budget_halted'); end if;
  return public.ai_watch_validation_reserve_v2(p_cache_key,p_watch_count);
end;
$$;

create function public.ai_watch_validation_report_overrun_v1(p_attempt_id uuid, p_costs jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_count integer; v_item jsonb; v_overrun boolean := false;
begin
  -- The same singleton lock orders report and new reservations. Requests
  -- already reserved can still be in flight when the halt is recorded.
  perform 1 from private.ai_watch_validation_safety where id = true for update;
  if not found then raise exception 'validation safety record missing'; end if;
  select watch_count into v_count from private.ai_watch_validation_attempts
    where id=p_attempt_id and state='reserved' for update;
  if not found then return false; end if;
  if p_costs is null or jsonb_typeof(p_costs) <> 'array'
     or jsonb_array_length(p_costs) <> v_count then
    raise exception 'one observed cost per watch required';
  end if;
  for v_item in select value from jsonb_array_elements(p_costs) loop
    if jsonb_typeof(v_item) = 'null' then continue; end if;
    if jsonb_typeof(v_item) <> 'number' or (v_item #>> '{}')::numeric < 0
       or (v_item #>> '{}')::numeric > 100000 then
      raise exception 'invalid observed cost';
    end if;
    if (v_item #>> '{}')::numeric > 0.025 then v_overrun := true; end if;
  end loop;
  if not v_overrun then raise exception 'no overrun reported'; end if;
  insert into private.ai_watch_validation_overruns(attempt_id,observed_costs)
  values(p_attempt_id,p_costs) on conflict(attempt_id) do nothing;
  if not exists(select 1 from private.ai_watch_validation_overruns
    where attempt_id=p_attempt_id and observed_costs=p_costs) then
    raise exception 'overrun already reported with different costs';
  end if;
  update private.ai_watch_validation_safety set halted_at=coalesce(halted_at,now()),
    attempt_id=coalesce(attempt_id,p_attempt_id) where id=true;
  return true;
end;
$$;

revoke all on function public.ai_watch_validation_reserve_v3(text,integer) from public,anon,authenticated;
revoke all on function public.ai_watch_validation_report_overrun_v1(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.ai_watch_validation_reserve_v3(text,integer) to service_role;
grant execute on function public.ai_watch_validation_report_overrun_v1(uuid,jsonb) to service_role;
