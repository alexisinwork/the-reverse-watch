create or replace function public.ai_watch_search_get_v1(p_cache_key text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'validationStatus', s.validation_status,
    'summary', s.summary,
    'watches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'brand', w.brand, 'model', w.model, 'referenceCode', w.reference_code,
        'sourceUrl', w.source_url, 'imageUrl', w.image_url,
        'priceNote', r.price_note, 'rationale', r.rationale, 'details', r.details
      ) order by r.rank)
      from private.ai_watch_search_results r join private.ai_watches w on w.id=r.watch_id
      where r.search_id=s.id
    ), '[]'::jsonb)
  ) from private.ai_watch_searches s where s.cache_key=p_cache_key;
$$;

create or replace function public.ai_watch_search_finish_validation_v1(
  p_cache_key text, p_status text, p_cost_usd numeric, p_error text default null
)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare v_month date := date_trunc('month', now())::date;
begin
  if p_status not in ('valid','failed') or p_cost_usd < 0 or p_cost_usd > 0.20 then
    raise exception 'invalid validation completion';
  end if;
  update private.ai_watch_searches
  set validation_status=p_status, validated_at=case when p_status='valid' then now() else null end,
      validation_error=case when p_status='failed' then left(coalesce(p_error,'validation failed'),400) else null end,
      validation_cost_usd=p_cost_usd
  where cache_key=p_cache_key and validation_status='validating';
  if not found then return false; end if;
  update private.ai_watch_validation_monthly_budget
  set reserved_usd=greatest(0,reserved_usd-p_cost_usd), spent_usd=spent_usd+p_cost_usd, updated_at=now()
  where month_start=v_month;
  return true;
end;
$$;

revoke all on function public.ai_watch_search_finish_validation_v1(text,text,numeric,text) from public, anon, authenticated;
grant execute on function public.ai_watch_search_finish_validation_v1(text,text,numeric,text) to service_role;
