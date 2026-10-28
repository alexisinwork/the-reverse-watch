-- Publish the checked snapshot, retain fact-level evidence and fill missing
-- catalogue fields in a single transaction. Existing facts are never replaced.
create function public.ai_watch_validated_cache_publish_v4(
  p_attempt_id uuid, p_summary text, p_watches jsonb, p_costs_usd jsonb
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_ok boolean;
  v_item record;
  v_fact jsonb;
  v_source jsonb;
  v_facts jsonb;
  v_field text;
  v_fields text[];
  v_value jsonb;
  v_count integer;
  v_current private.watch_catalogue%rowtype;
begin
  v_ok := public.ai_watch_validated_cache_publish_v3(p_attempt_id,p_summary,p_watches,p_costs_usd);
  if not v_ok then return false; end if;
  -- A stable row order prevents different results from locking catalogue rows
  -- in opposite order. Unmatched identities are archived without a write.
  for v_item in
    select e.value as watch, e.ordinal, i.watch_id
    from jsonb_array_elements(p_watches) with ordinality e(value,ordinal)
    join private.watch_catalogue_intake i on i.source='validated-cache'
      and i.snapshot='source-v1' and i.source_record_id=p_attempt_id::text || ':' || e.ordinal::text
    order by i.watch_id nulls last, e.ordinal
  loop
    v_facts := v_item.watch->'details'->'validationFacts';
    if v_facts is null then continue; end if;
    if jsonb_typeof(v_facts) <> 'array' or jsonb_array_length(v_facts) > 3 then
      raise exception 'invalid fact evidence';
    end if;
    if v_item.watch_id is not null then
      select * into v_current from private.watch_catalogue
      where id=v_item.watch_id and review_status<>'rejected' for no key update;
      if not found then raise exception 'catalogue identity no longer eligible'; end if;
    end if;
    v_fields := '{}'::text[];
    for v_fact in select value from jsonb_array_elements(v_facts) loop
      v_field := v_fact->>'field';
      v_value := v_fact->'value';
      if v_field is null or v_field not in ('caseDiameterMm','waterResistanceM','movementType')
         or v_field=any(v_fields) or v_value is null then raise exception 'invalid fact'; end if;
      v_fields := array_append(v_fields,v_field);
      if jsonb_typeof(v_fact->'sources') <> 'array' or jsonb_array_length(v_fact->'sources') <> 2 then
        raise exception 'two fact sources required';
      end if;
      select count(distinct source->>'provider') into v_count
        from jsonb_array_elements(v_fact->'sources') source
        where source->>'provider' in ('perplexity','muse');
      if v_count <> 2 then raise exception 'two different providers required'; end if;
      for v_source in select value from jsonb_array_elements(v_fact->'sources') loop
        if nullif(v_source->>'quote','') is null or length(v_source->>'quote') > 280
           or nullif(v_source->>'checkedAt','') is null or not exists(
             select 1 from jsonb_array_elements(v_item.watch->'details'->'validationEvidence') e
             where e->>'provider'=v_source->>'provider' and e->>'sourceUrl'=v_source->>'sourceUrl'
           ) then raise exception 'invalid fact provenance'; end if;
      end loop;
      if v_field='caseDiameterMm' then
        if jsonb_typeof(v_value)<>'number' or (v_value #>> '{}')::numeric not between 15 and 70
           or v_item.watch->'details'->'caseDiameterMm' is distinct from v_value then
          raise exception 'invalid diameter'; end if;
        if v_item.watch_id is not null then
          if v_current.case_diameter_mm is not null and v_current.case_diameter_mm<>(v_value #>> '{}')::numeric then
            raise exception 'diameter conflicts with catalogue'; end if;
          update private.watch_catalogue set case_diameter_mm=coalesce(case_diameter_mm,(v_value #>> '{}')::numeric), updated_at=now()
          where id=v_item.watch_id and review_status<>'rejected';
        end if;
      elsif v_field='waterResistanceM' then
        if jsonb_typeof(v_value)<>'number' or (v_value #>> '{}')::numeric not between 0 and 12000
           or trunc((v_value #>> '{}')::numeric)<>(v_value #>> '{}')::numeric
           or v_item.watch->'details'->'waterResistanceM' is distinct from v_value then
          raise exception 'invalid water resistance'; end if;
        if v_item.watch_id is not null then
          if v_current.water_resistance_m is not null and v_current.water_resistance_m<>(v_value #>> '{}')::numeric then
            raise exception 'water resistance conflicts with catalogue'; end if;
          update private.watch_catalogue set water_resistance_m=coalesce(water_resistance_m,(v_value #>> '{}')::integer), updated_at=now()
          where id=v_item.watch_id and review_status<>'rejected';
        end if;
      else
        if jsonb_typeof(v_value)<>'string' or (v_value #>> '{}') not in ('automatic','manual','quartz','solar','spring_drive','hybrid')
           or v_item.watch->'details'->'movement' is distinct from v_value then
          raise exception 'invalid movement'; end if;
        if v_item.watch_id is not null then
          if v_current.movement is not null and v_current.movement<>(v_value #>> '{}') then
            raise exception 'movement conflicts with catalogue'; end if;
          update private.watch_catalogue set movement=coalesce(movement,v_value #>> '{}'), updated_at=now()
          where id=v_item.watch_id and review_status<>'rejected';
        end if;
      end if;
    end loop;
    update private.watch_catalogue_intake set payload=payload || jsonb_build_object('validationFacts',v_facts),updated_at=now()
    where source='validated-cache' and snapshot='source-v1'
      and source_record_id=p_attempt_id::text || ':' || v_item.ordinal::text;
  end loop;
  return true;
end;
$$;

revoke all on function public.ai_watch_validated_cache_publish_v4(uuid,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.ai_watch_validated_cache_publish_v4(uuid,text,jsonb,jsonb) to service_role;
