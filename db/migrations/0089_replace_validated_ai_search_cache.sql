create or replace function public.ai_watch_search_replace_validated_v1(
  p_cache_key text, p_summary text, p_watches jsonb, p_cost_usd numeric
)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare v_search_id uuid; v_watch jsonb; v_watch_id uuid; v_rank smallint:=0; v_month date:=date_trunc('month',now())::date;
begin
  if jsonb_typeof(p_watches) <> 'array' or jsonb_array_length(p_watches) not between 1 and 8
     or p_cost_usd < 0 or p_cost_usd > .20 then raise exception 'invalid validated cache payload'; end if;
  select id into v_search_id from private.ai_watch_searches where cache_key=p_cache_key and validation_status='validating' for update;
  if not found then return false; end if;
  delete from private.ai_watch_search_results where search_id=v_search_id;
  for v_watch in select value from jsonb_array_elements(p_watches) loop
    v_rank:=v_rank+1;
    insert into private.ai_watches(brand,model,reference_code,source_url,image_url)
    values(v_watch->>'brand',v_watch->>'model',nullif(v_watch->>'referenceCode',''),v_watch->>'sourceUrl',nullif(v_watch->>'imageUrl',''))
    on conflict(identity_key) do update set image_url=coalesce(private.ai_watches.image_url,excluded.image_url)
    returning id into v_watch_id;
    insert into private.ai_watch_search_results(search_id,rank,watch_id,rationale,price_note,details)
    values(v_search_id,v_rank,v_watch_id,v_watch->>'rationale',nullif(v_watch->>'priceNote',''),case when jsonb_typeof(v_watch->'details')='object' then v_watch->'details' else '{}'::jsonb end);
  end loop;
  update private.ai_watch_searches set summary=p_summary, validation_status='valid',validated_at=now(),validation_error=null,validation_cost_usd=p_cost_usd where id=v_search_id;
  update private.ai_watch_validation_monthly_budget set reserved_usd=greatest(0,reserved_usd-.20),spent_usd=spent_usd+p_cost_usd,updated_at=now() where month_start=v_month;
  return true;
end;
$$;
revoke all on function public.ai_watch_search_replace_validated_v1(text,text,jsonb,numeric) from public,anon,authenticated;
grant execute on function public.ai_watch_search_replace_validated_v1(text,text,jsonb,numeric) to service_role;
