-- Atomic, conservative reservation for one search, including a cache miss.
-- No visitor identifiers or search text are retained, only a cache-key hash.
create table private.ai_watch_validation_attempts (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null check (cache_key ~ '^[0-9a-f]{64}$'),
  budget_month date not null,
  watch_count smallint not null check (watch_count between 1 and 8),
  reserved_usd numeric(10,5) not null check (reserved_usd > 0 and reserved_usd <= 0.20),
  charged_usd numeric(10,5) check (charged_usd >= 0 and charged_usd <= reserved_usd),
  state text not null check (state in ('reserved', 'settled')),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
alter table private.ai_watch_validation_attempts enable row level security;
revoke all on private.ai_watch_validation_attempts from public, anon, authenticated;
create unique index ai_watch_validation_one_active_per_key
  on private.ai_watch_validation_attempts (cache_key) where state = 'reserved';

create function public.ai_watch_validation_reserve_v2(p_cache_key text, p_watch_count integer)
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
  -- Keep the lock only for the database transaction; never while calling AI.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_cache_key, 0));
  if exists (select 1 from private.ai_watch_validation_attempts where cache_key = p_cache_key and state = 'reserved') then
    return jsonb_build_object('state', 'in_progress');
  end if;
  v_reserve := p_watch_count * 0.025;
  insert into private.ai_watch_validation_monthly_budget(month_start)
  values (v_month) on conflict (month_start) do nothing;
  update private.ai_watch_validation_monthly_budget
  set reserved_usd = reserved_usd + v_reserve, updated_at = now()
  where month_start = v_month and spent_usd + reserved_usd + v_reserve <= 100;
  if not found then return jsonb_build_object('state', 'monthly_limit'); end if;
  insert into private.ai_watch_validation_attempts(cache_key,budget_month,watch_count,reserved_usd,state)
  values(p_cache_key,v_month,p_watch_count,v_reserve,'reserved') returning id into v_id;
  return jsonb_build_object('state','reserved','attemptId',v_id,'reservedUsd',v_reserve);
end;
$$;

create function public.ai_watch_validation_settle_v2(p_attempt_id uuid, p_costs_usd jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_attempt private.ai_watch_validation_attempts%rowtype;
  v_cost numeric := 0;
  v_item jsonb;
  v_amount numeric;
begin
  select * into v_attempt from private.ai_watch_validation_attempts where id=p_attempt_id for update;
  if not found or v_attempt.state <> 'reserved' then return false; end if;
  if p_costs_usd is null or jsonb_typeof(p_costs_usd) <> 'array' or jsonb_array_length(p_costs_usd) <> v_attempt.watch_count then
    raise exception 'one cost per reserved watch is required';
  end if;
  for v_item in select value from jsonb_array_elements(p_costs_usd) loop
    if jsonb_typeof(v_item) <> 'number' then raise exception 'invalid watch cost'; end if;
    v_amount := (v_item #>> '{}')::numeric;
    if v_amount < 0 or v_amount > 0.025 then raise exception 'watch cost exceeds reserve'; end if;
    v_cost := v_cost + v_amount;
  end loop;
  if v_cost > v_attempt.reserved_usd then raise exception 'attempt cost exceeds reserve'; end if;
  update private.ai_watch_validation_monthly_budget
  set reserved_usd=reserved_usd-v_attempt.reserved_usd,
      spent_usd=spent_usd+ceil(v_cost*10000)/10000, updated_at=now()
  where month_start=v_attempt.budget_month and reserved_usd >= v_attempt.reserved_usd;
  if not found then raise exception 'missing budget reservation'; end if;
  update private.ai_watch_validation_attempts set state='settled', charged_usd=v_cost, settled_at=now()
  where id=p_attempt_id;
  return true;
end;
$$;

revoke all on function public.ai_watch_validation_reserve_v2(text,integer) from public,anon,authenticated;
revoke all on function public.ai_watch_validation_settle_v2(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.ai_watch_validation_reserve_v2(text,integer) to service_role;
grant execute on function public.ai_watch_validation_settle_v2(uuid,jsonb) to service_role;
