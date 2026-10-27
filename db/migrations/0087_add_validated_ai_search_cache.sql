-- Cached AI results are drafts until one visitor-triggered validation finishes.
-- The cache stores search constraints only; no visitor identity is retained.
alter table private.ai_watch_searches
  add column if not exists validation_status text not null default 'unverified'
    check (validation_status in ('unverified', 'validating', 'valid', 'failed')),
  add column if not exists validated_at timestamptz,
  add column if not exists validation_started_at timestamptz,
  add column if not exists validation_error text,
  add column if not exists validation_cost_usd numeric(8,4) not null default 0
    check (validation_cost_usd >= 0 and validation_cost_usd <= 0.20);

-- Old entries must be served through the first-view validation path.
update private.ai_watch_searches
set validation_status = 'unverified', validated_at = null,
    validation_started_at = null, validation_error = null
where validation_status <> 'unverified';

create table if not exists private.ai_watch_validation_monthly_budget (
  month_start date primary key,
  reserved_usd numeric(10,4) not null default 0 check (reserved_usd >= 0),
  spent_usd numeric(10,4) not null default 0 check (spent_usd >= 0),
  updated_at timestamptz not null default now()
);

alter table private.ai_watch_validation_monthly_budget enable row level security;

create or replace function public.ai_watch_search_claim_validation_v1(
  p_cache_key text,
  p_reserve_usd numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_search private.ai_watch_searches%rowtype;
  v_budget private.ai_watch_validation_monthly_budget%rowtype;
  v_month date := date_trunc('month', now())::date;
begin
  if p_reserve_usd <= 0 or p_reserve_usd > 0.20 then
    raise exception 'validation reserve must be between 0 and 0.20';
  end if;
  select * into v_search from private.ai_watch_searches
  where cache_key = p_cache_key for update;
  if not found then return jsonb_build_object('state', 'missing'); end if;
  if v_search.validation_status = 'valid' then return jsonb_build_object('state', 'valid'); end if;
  if v_search.validation_status = 'validating'
     and v_search.validation_started_at > now() - interval '2 minutes' then
    return jsonb_build_object('state', 'in_progress');
  end if;
  insert into private.ai_watch_validation_monthly_budget(month_start)
  values (v_month) on conflict (month_start) do nothing;
  update private.ai_watch_validation_monthly_budget
  set reserved_usd = reserved_usd + p_reserve_usd, updated_at = now()
  where month_start = v_month and spent_usd + reserved_usd + p_reserve_usd <= 100
  returning * into strict v_budget; -- raises when the monthly cap is reached
  update private.ai_watch_searches
  set validation_status='validating', validation_started_at=now(), validation_error=null,
      validation_cost_usd=p_reserve_usd
  where id=v_search.id;
  return jsonb_build_object('state', 'claimed');
exception when no_data_found then
  return jsonb_build_object('state', 'monthly_limit');
end;
$$;

revoke all on function public.ai_watch_search_claim_validation_v1(text, numeric)
  from public, anon, authenticated;
grant execute on function public.ai_watch_search_claim_validation_v1(text, numeric)
  to service_role;
