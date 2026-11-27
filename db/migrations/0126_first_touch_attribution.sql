-- First-touch attribution for The Reserve's own pages (2026-11-27). The owner
-- wants to see, per platform and per episode, not only visits but quiz starts,
-- completions and newsletter sign-ups. The browser now remembers how a tab's
-- visit began (utm tags, or the referring site's platform, or "direct") and
-- sends it with every event of that tab. Additive: two nullable columns, one
-- more event name, a v4 writer beside v3 and a read-only summary function.
-- Nothing identifying is stored: no email, no address, no full URL.

alter table public.partner_interaction_events
  add column traffic_medium text
    check (traffic_medium is null or traffic_medium ~ '^[a-z0-9_.-]{1,60}$'),
  add column landing_page text
    check (landing_page is null or (length(landing_page) between 1 and 120 and landing_page !~ '[?&#]'));

comment on column public.partner_interaction_events.traffic_source is
  'Until 2026-11-27: the referring host or utm_source of the page itself. Since migration 0126, first-party events carry the tab session''s first touch (utm_source, instagram/tiktok/youtube for those sites, another site''s host, or direct); partner frames keep the per-page value.';
comment on column public.partner_interaction_events.traffic_medium is
  'First touch utm_medium (video, shorts, short_video, social), or referral/none without tags. Null before migration 0126 and in partner frames.';
comment on column public.partner_interaction_events.landing_page is
  'The first page of the tab session (path only, ids masked). Null before migration 0126 and in partner frames.';

-- Widen the allowed event names with the newsletter sign-up. The new check
-- is a superset of the old one, so every stored row still satisfies it.
do $$
declare v_name text;
begin
  for v_name in
    select conname from pg_catalog.pg_constraint
    where conrelid = 'public.partner_interaction_events'::regclass
      and contype = 'c'
      and pg_catalog.pg_get_constraintdef(oid) like '%event_name%'
  loop
    execute format('alter table public.partner_interaction_events drop constraint %I', v_name);
  end loop;
end $$;
alter table public.partner_interaction_events
  add constraint partner_interaction_events_event_name_check
  check (event_name in ('page_view','click','quiz_start','service_complete','result_feedback','newsletter_signup'));

-- The v3 writer plus medium and entry page. Same idempotency: an identical
-- replay of one event ID is acknowledged, a changed payload is refused.
create function public.record_partner_interaction_v4(
  p_event_id uuid,p_session_id uuid,p_site_key text,p_event_name text,p_feature text,p_page_path text,
  p_control text default null,p_target text default null,p_traffic_source text default null,
  p_campaign text default null,p_helpful boolean default null,p_country_code text default null,
  p_traffic_medium text default null,p_landing_page text default null
) returns boolean language plpgsql volatile security definer set search_path='' as $$
declare v_site_id uuid; v_inserted bigint; v_medium text; v_landing text;
begin
  if p_event_id is null then raise exception 'event delivery id required'; end if;
  if p_site_key is not null then
    select id into v_site_id from private.partner_sites where public_key=p_site_key and active;
    if v_site_id is null then raise exception 'Unknown partner site'; end if;
  end if;
  v_medium := case when p_traffic_medium ~ '^[a-z0-9_.-]{1,60}$' then p_traffic_medium else null end;
  v_landing := case when length(p_landing_page) between 1 and 120 and p_landing_page !~ '[?&#]' then p_landing_page else null end;
  insert into public.partner_interaction_events(event_id,session_id,partner_site_id,event_name,feature,page_path,
    control,target,traffic_source,campaign,helpful,country_code,traffic_medium,landing_page)
  values(p_event_id,p_session_id,v_site_id,p_event_name,p_feature,p_page_path,
    nullif(left(p_control,100),''),nullif(left(p_target,160),''),nullif(left(p_traffic_source,120),''),
    nullif(left(p_campaign,120),''),p_helpful,case when p_country_code ~ '^[A-Z]{2}$' then p_country_code else null end,
    v_medium,v_landing)
  on conflict(event_id) where event_id is not null do nothing returning id into v_inserted;
  if v_inserted is not null then return true; end if;
  return exists(select 1 from public.partner_interaction_events e where e.event_id=p_event_id
    and row(e.session_id,e.partner_site_id,e.event_name,e.feature,e.page_path,e.control,e.target,e.traffic_source,e.campaign,e.helpful,e.traffic_medium,e.landing_page)
      is not distinct from row(p_session_id,v_site_id,p_event_name,p_feature,p_page_path,
        nullif(left(p_control,100),''),nullif(left(p_target,160),''),nullif(left(p_traffic_source,120),''),nullif(left(p_campaign,120),''),p_helpful,
        v_medium,v_landing));
end;
$$;
revoke all on function public.record_partner_interaction_v4(uuid,uuid,text,text,text,text,text,text,text,text,boolean,text,text,text)
  from public,anon,authenticated;
grant execute on function public.record_partner_interaction_v4(uuid,uuid,text,text,text,text,text,text,text,text,boolean,text,text,text)
  to service_role;

-- Each tab session counts once, under how it began: the earliest event in the
-- window. Sessions recorded before 0126 fall back to that event's own source
-- (the landing page's referrer or tags), and to "direct" without one.
create function public.partner_interaction_attribution_v1(p_since timestamptz,p_until timestamptz,p_site_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' set jit=off as $$
declare v_result jsonb;
begin
  if p_since is null or p_until is null or p_since>=p_until or p_until-p_since>interval '90 days' then
    raise exception 'Invalid analytics window';
  end if;
  with filtered as (
    select e.id,e.session_id,e.occurred_at,e.event_name,e.feature,e.partner_site_id,
      e.traffic_source,e.traffic_medium,e.campaign,e.landing_page
    from public.partner_interaction_events e
    where e.occurred_at>=p_since and e.occurred_at<p_until
      and (p_site_id is null or e.partner_site_id=p_site_id)
  ), firsts as (
    select distinct on (session_id) session_id,
      coalesce(traffic_source,case when partner_site_id is null then 'direct' else 'partner embed' end) source,
      traffic_medium medium,campaign,landing_page landing
    from filtered order by session_id,occurred_at,id
  ), outcomes as (
    select session_id,
      bool_or(event_name='quiz_start') quiz_started,
      bool_or(event_name='service_complete' and feature in ('quiz','archetype')) quiz_completed,
      bool_or(event_name='service_complete') tool_completed,
      bool_or(event_name='newsletter_signup') subscribed
    from filtered group by session_id
  ), sessions as (
    select f.*,o.quiz_started,o.quiz_completed,o.tool_completed,o.subscribed
    from firsts f join outcomes o using(session_id)
  )
  select jsonb_build_object(
    'since',p_since,'until',p_until,
    'rows',coalesce((
      select jsonb_agg(jsonb_build_object('source',source,'medium',medium,'campaign',campaign,
        'sessions',sessions,'quizStarts',quiz_starts,'quizCompletions',quiz_completions,
        'toolCompletions',tool_completions,'subscriptions',subscriptions)
        order by sessions desc,source,medium nulls first,campaign nulls first)
      from (select source,medium,campaign,count(*) sessions,
          count(*) filter(where quiz_started) quiz_starts,
          count(*) filter(where quiz_completed) quiz_completions,
          count(*) filter(where tool_completed) tool_completions,
          count(*) filter(where subscribed) subscriptions
        from sessions group by source,medium,campaign) x
    ),'[]'::jsonb),
    'byLanding',coalesce((
      select jsonb_agg(jsonb_build_object('landing',landing,'sessions',sessions,'subscriptions',subscriptions)
        order by sessions desc,landing)
      from (select landing,count(*) sessions,count(*) filter(where subscribed) subscriptions
        from sessions where landing is not null group by landing order by count(*) desc limit 30) x
    ),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.partner_interaction_attribution_v1(timestamptz,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.partner_interaction_attribution_v1(timestamptz,timestamptz,uuid) to service_role;

-- Operations readiness also checks the new writer the analytics route uses.
create or replace function public.application_readiness_v4()
returns jsonb language sql stable security definer set search_path='' as $$
  select public.application_readiness_v3()||jsonb_build_object('analyticsDeliveryReady',coalesce((
    select bool_and(has_function_privilege('service_role',p.oid,'execute')
      and not has_function_privilege('anon',p.oid,'execute')
      and not has_function_privilege('authenticated',p.oid,'execute')) and count(*)=2
    from pg_catalog.pg_proc p where p.oid in (
      pg_catalog.to_regprocedure('public.record_partner_interaction_v3(uuid,uuid,text,text,text,text,text,text,text,text,boolean,text)'),
      pg_catalog.to_regprocedure('public.record_partner_interaction_v4(uuid,uuid,text,text,text,text,text,text,text,text,boolean,text,text,text)'))),false));
$$;
revoke all on function public.application_readiness_v4() from public,anon,authenticated;
grant execute on function public.application_readiness_v4() to service_role;
