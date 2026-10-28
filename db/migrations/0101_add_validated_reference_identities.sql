-- Add a bare pending identity only for a newly source-checked exact reference.
-- Ambiguous and rejected matches remain in intake for review.
create function public.ai_watch_validated_cache_publish_v7(
  p_attempt_id uuid, p_summary text, p_watches jsonb, p_costs_usd jsonb
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_ok boolean; v_lock record; v_item record; v_brand text; v_ref text;
  v_key text; v_count integer; v_id uuid; v_observation jsonb; v_facts jsonb; v_image jsonb;
begin
  if p_watches is null or jsonb_typeof(p_watches)<>'array' or jsonb_array_length(p_watches) not between 1 and 8 then
    raise exception 'invalid result'; end if;
  -- Serialize new identities in stable order, before the existing publication
  -- path locks any catalogue rows. Existing matching rows are never changed here.
  for v_lock in select distinct
    lower(regexp_replace(e->>'brand','[^a-zA-Z0-9]','','g')) || '|r:' ||
      lower(regexp_replace(e->>'referenceCode','[^a-zA-Z0-9]','','g')) as identity
    from jsonb_array_elements(p_watches) e order by identity
  loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('validated-identity:' || v_lock.identity,0));
  end loop;
  v_ok := public.ai_watch_validated_cache_publish_v6(p_attempt_id,p_summary,p_watches,p_costs_usd);
  if not v_ok then return false; end if;
  for v_item in
    select e.value as watch,e.ordinal,i.watch_id from jsonb_array_elements(p_watches)
      with ordinality e(value,ordinal)
    join private.watch_catalogue_intake i on i.source='validated-cache' and i.snapshot='source-v1'
      and i.source_record_id=p_attempt_id::text || ':' || e.ordinal::text
    where i.watch_id is null order by e.ordinal
  loop
    -- Avoid inventing SQL transliterations for non-ASCII identities: leave
    -- those in the review queue instead of creating a potentially duplicate key.
    if v_item.watch->>'brand' !~ '^[A-Za-z0-9 .&''-]+$'
       or v_item.watch->>'referenceCode' !~ '^[A-Za-z0-9 ._/-]+$' then continue; end if;
    v_brand := lower(regexp_replace(v_item.watch->>'brand','[^a-zA-Z0-9]','','g'));
    v_ref := lower(regexp_replace(v_item.watch->>'referenceCode','[^a-zA-Z0-9]','','g'));
    if length(v_brand)<3 or length(v_ref)<3 then continue; end if;
    select count(*) into v_count from private.watch_catalogue w
      where lower(regexp_replace(w.brand,'[^a-zA-Z0-9]','','g'))=v_brand
        and lower(regexp_replace(w.reference_code,'[^a-zA-Z0-9]','','g'))=v_ref;
    if v_count<>0 then raise exception 'reference is rejected or ambiguous'; end if;
    v_key := v_brand || '|r:' || v_ref;
    v_facts := coalesce(v_item.watch->'details'->'validationFacts','[]'::jsonb);
    v_observation := v_item.watch->'details'->'priceObservation';
    v_image := v_item.watch->'details'->'imageEvidence';
    insert into private.watch_catalogue(
      identity_key,brand,model,reference_code,reference_confirmed,styles,
      case_diameter_mm,water_resistance_m,movement,price_amount,price_currency,
      price_status,price_checked_at,price_evidence,source_url,image_url,import_source
    ) values (
      v_key,v_item.watch->>'brand',v_item.watch->>'referenceCode',v_item.watch->>'referenceCode',false,'{}',
      case when exists(select 1 from jsonb_array_elements(v_facts) f where f->>'field'='caseDiameterMm') then (v_item.watch->'details'->>'caseDiameterMm')::numeric end,
      case when exists(select 1 from jsonb_array_elements(v_facts) f where f->>'field'='waterResistanceM') then (v_item.watch->'details'->>'waterResistanceM')::integer end,
      case when exists(select 1 from jsonb_array_elements(v_facts) f where f->>'field'='movementType') then v_item.watch->'details'->>'movement' end,
      case when v_observation is not null then (v_item.watch->'details'->'price'->>'amount')::numeric end,
      case when v_observation is not null then v_item.watch->'details'->'price'->>'currency' end,
      case when v_observation is not null then 'approximate' else 'unconfirmed' end,
      case when v_observation is not null then now() end,
      case when v_observation is not null then jsonb_build_object('method','two_source_approximate','sources',v_observation->'sources') else '{}'::jsonb end,
      v_item.watch->>'sourceUrl',case when v_image is not null then v_image->>'imageUrl' end,'validated-cache'
    ) on conflict(identity_key) do nothing returning id into v_id;
    if v_id is not null then
      update private.watch_catalogue_intake set watch_id=v_id,state='needs_evidence',updated_at=now()
      where source='validated-cache' and snapshot='source-v1'
        and source_record_id=p_attempt_id::text || ':' || v_item.ordinal::text;
    end if;
    v_id := null;
  end loop;
  return true;
end;
$$;

revoke all on function public.ai_watch_validated_cache_publish_v7(uuid,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.ai_watch_validated_cache_publish_v7(uuid,text,jsonb,jsonb) to service_role;
