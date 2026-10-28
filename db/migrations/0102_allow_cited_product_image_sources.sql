-- A product image may come from another page that the same provider cited
-- during the original validation call and that the server subsequently opened.
create or replace function public.ai_watch_validated_cache_publish_v6(
  p_attempt_id uuid, p_summary text, p_watches jsonb, p_costs_usd jsonb
) returns boolean language plpgsql security definer set search_path = '' as $$
declare v_ok boolean; v_item record; v_image jsonb; v_current private.watch_catalogue%rowtype;
begin
  v_ok := public.ai_watch_validated_cache_publish_v5(p_attempt_id,p_summary,p_watches,p_costs_usd);
  if not v_ok then return false; end if;
  for v_item in
    select e.value as watch,e.ordinal,i.watch_id from jsonb_array_elements(p_watches)
      with ordinality e(value,ordinal)
    join private.watch_catalogue_intake i on i.source='validated-cache' and i.snapshot='source-v1'
      and i.source_record_id=p_attempt_id::text || ':' || e.ordinal::text
    order by i.watch_id nulls last,e.ordinal
  loop
    v_image := v_item.watch->'details'->'imageEvidence';
    if v_image is null then continue; end if;
    if jsonb_typeof(v_image)<>'object' or nullif(v_image->>'imageUrl','') is null or v_image->>'imageUrl' !~ '^https?://'
       or nullif(v_image->>'sourceUrl','') is null or v_image->>'sourceUrl' !~ '^https?://'
       or v_item.watch->>'imageUrl' is distinct from v_image->>'imageUrl'
       or nullif(v_image->>'referenceCode','') is null or length(regexp_replace(v_image->>'referenceCode','[^a-zA-Z0-9]','','g'))<3
       or lower(regexp_replace(v_image->>'referenceCode','[^a-zA-Z0-9]','','g')) is distinct from
          lower(regexp_replace(v_item.watch->>'referenceCode','[^a-zA-Z0-9]','','g'))
       or nullif(v_image->>'checkedAt','') is null or not exists (
         select 1 from jsonb_array_elements(v_item.watch->'details'->'validationEvidence') e
         where e->>'sourceUrl'=v_image->>'sourceUrl'
           or (e->>'provider'=v_image->>'provider' and v_image->>'citedUrl' ~ '^https?://'
             and coalesce(e->'citedUrls','[]'::jsonb) ? (v_image->>'citedUrl'))
       ) then raise exception 'invalid image evidence'; end if;
    if v_item.watch_id is not null then
      select * into v_current from private.watch_catalogue
        where id=v_item.watch_id and review_status<>'rejected' for no key update;
      if not found then raise exception 'catalogue identity no longer eligible'; end if;
      if v_current.image_url is not null and v_current.image_url<>v_image->>'imageUrl' then
        raise exception 'image conflicts with catalogue'; end if;
      update private.watch_catalogue set image_url=v_image->>'imageUrl',updated_at=now()
        where id=v_item.watch_id and image_url is null and review_status<>'rejected';
    end if;
    update private.watch_catalogue_intake set payload=payload || jsonb_build_object('imageEvidence',v_image),updated_at=now()
      where source='validated-cache' and snapshot='source-v1'
        and source_record_id=p_attempt_id::text || ':' || v_item.ordinal::text;
  end loop;
  return true;
end;
$$;

revoke all on function public.ai_watch_validated_cache_publish_v6(uuid,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.ai_watch_validated_cache_publish_v6(uuid,text,jsonb,jsonb) to service_role;
