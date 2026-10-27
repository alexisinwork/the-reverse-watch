-- The first validation runtime cannot yet prove source checks or enforce
-- provider costs. Keep existing entries intact and pause new claims until the
-- complete validator and its budget ledger are deployed together.
create or replace function public.ai_watch_search_claim_validation_v1(
  p_cache_key text, p_reserve_usd numeric
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object('state', 'monthly_limit');
$$;

revoke all on function public.ai_watch_search_claim_validation_v1(text, numeric)
  from public, anon, authenticated;
grant execute on function public.ai_watch_search_claim_validation_v1(text, numeric)
  to service_role;
