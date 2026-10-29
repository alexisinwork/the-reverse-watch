-- Existing anonymous events retain a null delivery ID. New callers can retry
-- an unknown write outcome without double-counting a click or feedback vote.
alter table public.partner_interaction_events add column event_id uuid;
create unique index partner_interaction_delivery_id_idx on public.partner_interaction_events(event_id) where event_id is not null;

create function public.record_partner_interaction_v3(
  p_event_id uuid,p_session_id uuid,p_site_key text,p_event_name text,p_feature text,p_page_path text,
  p_control text default null,p_target text default null,p_traffic_source text default null,
  p_campaign text default null,p_helpful boolean default null,p_country_code text default null
) returns boolean language plpgsql volatile security definer set search_path='' as $$
declare v_site_id uuid; v_inserted bigint;
begin
  if p_event_id is null then raise exception 'event delivery id required'; end if;
  if p_site_key is not null then
    select id into v_site_id from private.partner_sites where public_key=p_site_key and active;
    if v_site_id is null then raise exception 'Unknown partner site'; end if;
  end if;
  insert into public.partner_interaction_events(event_id,session_id,partner_site_id,event_name,feature,page_path,
    control,target,traffic_source,campaign,helpful,country_code)
  values(p_event_id,p_session_id,v_site_id,p_event_name,p_feature,p_page_path,
    nullif(left(p_control,100),''),nullif(left(p_target,160),''),nullif(left(p_traffic_source,120),''),
    nullif(left(p_campaign,120),''),p_helpful,case when p_country_code ~ '^[A-Z]{2}$' then p_country_code else null end)
  on conflict(event_id) where event_id is not null do nothing returning id into v_inserted;
  if v_inserted is not null then return true; end if;
  -- Host-supplied country can change during a retry; preserve the first value.
  -- The original event payload must match. A collision never overwrites it.
  return exists(select 1 from public.partner_interaction_events e where e.event_id=p_event_id
    and row(e.session_id,e.partner_site_id,e.event_name,e.feature,e.page_path,e.control,e.target,e.traffic_source,e.campaign,e.helpful)
      is not distinct from row(p_session_id,v_site_id,p_event_name,p_feature,p_page_path,
        nullif(left(p_control,100),''),nullif(left(p_target,160),''),nullif(left(p_traffic_source,120),''),nullif(left(p_campaign,120),''),p_helpful));
end;
$$;
revoke all on function public.record_partner_interaction_v3(uuid,uuid,text,text,text,text,text,text,text,text,boolean,text)
  from public,anon,authenticated;
grant execute on function public.record_partner_interaction_v3(uuid,uuid,text,text,text,text,text,text,text,text,boolean,text)
  to service_role;

create function public.application_readiness_v4()
returns jsonb language sql stable security definer set search_path='' as $$
  select public.application_readiness_v3()||jsonb_build_object('analyticsDeliveryReady',coalesce((
    select has_function_privilege('service_role',p.oid,'execute')
      and not has_function_privilege('anon',p.oid,'execute')
      and not has_function_privilege('authenticated',p.oid,'execute')
    from pg_catalog.pg_proc p where p.oid=pg_catalog.to_regprocedure(
      'public.record_partner_interaction_v3(uuid,uuid,text,text,text,text,text,text,text,text,boolean,text)')),false));
$$;
revoke all on function public.application_readiness_v4() from public,anon,authenticated;
grant execute on function public.application_readiness_v4() to service_role;
