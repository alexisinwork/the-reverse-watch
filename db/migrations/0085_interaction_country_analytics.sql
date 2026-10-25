-- Country-level analytics from the hosting platform. No IP or coordinates are
-- retained; a country code is the most granular location stored.
alter table public.partner_interaction_events
  add column country_code text
  check (country_code is null or country_code ~ '^[A-Z]{2}$');

create function public.record_partner_interaction_v2(
  p_session_id uuid,
  p_site_key text,
  p_event_name text,
  p_feature text,
  p_page_path text,
  p_control text default null,
  p_target text default null,
  p_traffic_source text default null,
  p_campaign text default null,
  p_helpful boolean default null,
  p_country_code text default null
) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_site_id uuid;
  v_country text;
begin
  if p_site_key is not null then
    select id into v_site_id from private.partner_sites
      where public_key = p_site_key and active;
    if v_site_id is null then raise exception 'Unknown partner site'; end if;
  end if;
  v_country := case when p_country_code ~ '^[A-Z]{2}$' then p_country_code else null end;
  insert into public.partner_interaction_events(
    session_id, partner_site_id, event_name, feature, page_path,
    control, target, traffic_source, campaign, helpful, country_code
  ) values (
    p_session_id, v_site_id, p_event_name, p_feature, p_page_path,
    nullif(left(p_control, 100), ''), nullif(left(p_target, 160), ''),
    nullif(left(p_traffic_source, 120), ''), nullif(left(p_campaign, 120), ''),
    p_helpful, v_country
  );
end;
$$;
revoke all on function public.record_partner_interaction_v2(uuid,text,text,text,text,text,text,text,text,boolean,text)
  from public, anon, authenticated;
grant execute on function public.record_partner_interaction_v2(uuid,text,text,text,text,text,text,text,text,boolean,text)
  to service_role;

create or replace function public.partner_interaction_analytics_v1(
  p_since timestamptz,
  p_until timestamptz,
  p_site_id uuid default null
) returns jsonb
language plpgsql stable security definer set search_path = '' set jit = off as $$
declare
  v_result jsonb;
begin
  if p_since is null or p_until is null or p_since >= p_until
    or p_until - p_since > interval '90 days' then
    raise exception 'Invalid analytics window';
  end if;

  with filtered as (
    select e.*, coalesce(s.name, 'The Reserve') site_name,
      coalesce(e.traffic_source,
        case when e.partner_site_id is null then 'direct / unknown' else 'partner embed' end
      ) source_name
    from public.partner_interaction_events e
    left join private.partner_sites s on s.id = e.partner_site_id
    where e.occurred_at >= p_since and e.occurred_at < p_until
      and (p_site_id is null or e.partner_site_id = p_site_id)
  ), journeys as (
    select session_id, max(site_name) site_name, max(country_code) country_code,
      min(occurred_at) started, max(occurred_at) last_seen, count(*) event_count,
      jsonb_agg(jsonb_build_object(
        'at', occurred_at, 'name', event_name, 'feature', feature,
        'page', page_path, 'control', control, 'target', target,
        'helpful', helpful
      ) order by occurred_at) events
    from (select * from filtered order by occurred_at desc limit 10000) f
    group by session_id
  )
  select jsonb_build_object(
    'since', p_since,
    'until', p_until,
    'totals', jsonb_build_object(
      'events', count(*),
      'sessions', count(distinct session_id),
      'pageViews', count(*) filter (where event_name = 'page_view'),
      'clicks', count(*) filter (where event_name = 'click'),
      'completions', count(*) filter (where event_name = 'service_complete'),
      'liked', count(*) filter (where event_name = 'result_feedback' and helpful),
      'disliked', count(*) filter (where event_name = 'result_feedback' and not helpful)
    ),
    'byFeature', coalesce((
      select jsonb_agg(jsonb_build_object(
        'feature', feature, 'events', events, 'sessions', sessions,
        'completions', completions, 'liked', liked, 'disliked', disliked
      ))
      from (
        select feature, count(*) events, count(distinct session_id) sessions,
          count(*) filter (where event_name = 'service_complete') completions,
          count(*) filter (where event_name = 'result_feedback' and helpful) liked,
          count(*) filter (where event_name = 'result_feedback' and not helpful) disliked
        from filtered group by feature
      ) x
    ), '[]'::jsonb),
    'bySite', coalesce((
      select jsonb_agg(jsonb_build_object('site', site_name, 'events', events, 'sessions', sessions))
      from (select site_name, count(*) events, count(distinct session_id) sessions
        from filtered group by site_name) x
    ), '[]'::jsonb),
    'bySource', coalesce((
      select jsonb_agg(jsonb_build_object('source', source_name, 'sessions', sessions))
      from (select source_name, count(distinct session_id) sessions
        from filtered group by source_name) x
    ), '[]'::jsonb),
    'byCampaign', coalesce((
      select jsonb_agg(jsonb_build_object('campaign', campaign, 'source', source_name, 'sessions', sessions))
      from (select campaign, source_name, count(distinct session_id) sessions
        from filtered where campaign is not null group by campaign, source_name) x
    ), '[]'::jsonb),
    'byCountry', coalesce((
      select jsonb_agg(jsonb_build_object('country', country_code, 'sessions', sessions) order by sessions desc)
      from (select country_code, count(distinct session_id) sessions
        from filtered where country_code is not null group by country_code) x
    ), '[]'::jsonb),
    'byControl', coalesce((
      select jsonb_agg(jsonb_build_object('control', control, 'feature', feature, 'clicks', clicks))
      from (select control, feature, count(*) clicks from filtered
        where event_name = 'click' and control is not null
        group by control, feature order by count(*) desc limit 50) x
    ), '[]'::jsonb),
    'journeys', coalesce((
      select jsonb_agg(jsonb_build_object(
        'session', session_id, 'site', site_name, 'country', country_code,
        'started', started, 'lastSeen', last_seen, 'eventCount', event_count, 'events', events
      ) order by last_seen desc)
      from (select * from journeys order by last_seen desc limit 100) x
    ), '[]'::jsonb)
  ) into v_result from filtered;

  return coalesce(v_result, jsonb_build_object(
    'since', p_since, 'until', p_until,
    'totals', jsonb_build_object('events', 0, 'sessions', 0, 'pageViews', 0,
      'clicks', 0, 'completions', 0, 'liked', 0, 'disliked', 0),
    'byFeature', '[]'::jsonb, 'bySite', '[]'::jsonb, 'bySource', '[]'::jsonb,
    'byCampaign', '[]'::jsonb, 'byCountry', '[]'::jsonb,
    'byControl', '[]'::jsonb, 'journeys', '[]'::jsonb
  ));
end;
$$;
revoke all on function public.partner_interaction_analytics_v1(timestamptz,timestamptz,uuid)
  from public, anon, authenticated;
grant execute on function public.partner_interaction_analytics_v1(timestamptz,timestamptz,uuid)
  to service_role;

comment on column public.partner_interaction_events.country_code is
  'Optional 2-letter country code from the hosting edge; no IP or precise location is retained.';
