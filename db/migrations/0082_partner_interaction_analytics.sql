-- Owner requested anonymous journey analytics across first-party and embedded
-- tools. Store neither identity, answers, email, IP, nor raw referrer/query.
create table public.partner_interaction_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  session_id uuid not null,
  partner_site_id uuid references private.partner_sites(id),
  event_name text not null check (event_name in ('page_view','click','quiz_start','service_complete','result_feedback')),
  feature text not null check (feature in ('quiz','find','alternatives','archetype','stories','site')),
  page_path text not null check (length(page_path) between 1 and 120 and page_path !~ '[?&#]'),
  control text check (control is null or length(control) <= 100),
  target text check (target is null or length(target) <= 160),
  traffic_source text check (traffic_source is null or length(traffic_source) <= 120),
  campaign text check (campaign is null or length(campaign) <= 120),
  helpful boolean
);
create index partner_interaction_events_time_idx on public.partner_interaction_events(occurred_at desc);
create index partner_interaction_events_site_time_idx on public.partner_interaction_events(partner_site_id,occurred_at desc);
create index partner_interaction_events_session_time_idx on public.partner_interaction_events(session_id,occurred_at);
alter table public.partner_interaction_events enable row level security;
revoke all on public.partner_interaction_events from public,anon,authenticated;

create function public.record_partner_interaction_v1(
  p_session_id uuid,p_site_key text,p_event_name text,p_feature text,p_page_path text,
  p_control text default null,p_target text default null,p_traffic_source text default null,
  p_campaign text default null,p_helpful boolean default null
) returns void language plpgsql volatile security definer set search_path='' as $$
declare v_site_id uuid;
begin
  if p_site_key is not null then
    select id into v_site_id from private.partner_sites where public_key=p_site_key and active;
    if v_site_id is null then raise exception 'Unknown partner site'; end if;
  end if;
  insert into public.partner_interaction_events(session_id,partner_site_id,event_name,feature,page_path,control,target,traffic_source,campaign,helpful)
  values(p_session_id,v_site_id,p_event_name,p_feature,p_page_path,nullif(left(p_control,100),''),nullif(left(p_target,160),''),nullif(left(p_traffic_source,120),''),nullif(left(p_campaign,120),''),p_helpful);
end; $$;
revoke all on function public.record_partner_interaction_v1(uuid,text,text,text,text,text,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.record_partner_interaction_v1(uuid,text,text,text,text,text,text,text,text,boolean) to service_role;

create function public.partner_interaction_analytics_v1(p_since timestamptz,p_until timestamptz,p_site_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' set jit=off as $$
declare v_result jsonb;
begin
  if p_since is null or p_until is null or p_since>=p_until or p_until-p_since>interval '90 days' then raise exception 'Invalid analytics window'; end if;
  with filtered as (
    select e.*,coalesce(s.name,'The Reserve') site_name,
      coalesce(e.traffic_source,case when e.partner_site_id is null then 'direct / unknown' else 'partner embed' end) source_name
    from public.partner_interaction_events e left join private.partner_sites s on s.id=e.partner_site_id
    where e.occurred_at>=p_since and e.occurred_at<p_until and (p_site_id is null or e.partner_site_id=p_site_id)
  ), journeys as (
    select session_id,max(site_name) site_name,min(occurred_at) started,max(occurred_at) last_seen,
      count(*) event_count,jsonb_agg(jsonb_build_object('at',occurred_at,'name',event_name,'feature',feature,'page',page_path,'control',control,'target',target,'helpful',helpful) order by occurred_at) events
    from (select * from filtered order by occurred_at desc limit 10000) f group by session_id
  )
  select jsonb_build_object(
    'since',p_since,'until',p_until,
    'totals',jsonb_build_object('events',count(*),'sessions',count(distinct session_id),'pageViews',count(*) filter(where event_name='page_view'),'clicks',count(*) filter(where event_name='click'),'completions',count(*) filter(where event_name='service_complete'),'liked',count(*) filter(where event_name='result_feedback' and helpful),'disliked',count(*) filter(where event_name='result_feedback' and not helpful)),
    'byFeature',coalesce((select jsonb_agg(jsonb_build_object('feature',feature,'events',events,'sessions',sessions,'completions',completions,'liked',liked,'disliked',disliked)) from (select feature,count(*) events,count(distinct session_id) sessions,count(*) filter(where event_name='service_complete') completions,count(*) filter(where event_name='result_feedback' and helpful) liked,count(*) filter(where event_name='result_feedback' and not helpful) disliked from filtered group by feature) x),'[]'::jsonb),
    'bySite',coalesce((select jsonb_agg(jsonb_build_object('site',site_name,'events',events,'sessions',sessions)) from (select site_name,count(*) events,count(distinct session_id) sessions from filtered group by site_name) x),'[]'::jsonb),
    'bySource',coalesce((select jsonb_agg(jsonb_build_object('source',source_name,'sessions',sessions)) from (select source_name,count(distinct session_id) sessions from filtered group by source_name) x),'[]'::jsonb),
    'byCampaign',coalesce((select jsonb_agg(jsonb_build_object('campaign',campaign,'source',source_name,'sessions',sessions)) from (select campaign,source_name,count(distinct session_id) sessions from filtered where campaign is not null group by campaign,source_name) x),'[]'::jsonb),
    'byControl',coalesce((select jsonb_agg(jsonb_build_object('control',control,'feature',feature,'clicks',clicks)) from (select control,feature,count(*) clicks from filtered where event_name='click' and control is not null group by control,feature order by count(*) desc limit 50) x),'[]'::jsonb),
    'journeys',coalesce((select jsonb_agg(jsonb_build_object('session',session_id,'site',site_name,'started',started,'lastSeen',last_seen,'eventCount',event_count,'events',events) order by last_seen desc) from (select * from journeys order by last_seen desc limit 100) x),'[]'::jsonb)
  ) into v_result from filtered;
  return coalesce(v_result,jsonb_build_object('since',p_since,'until',p_until,'totals',jsonb_build_object('events',0,'sessions',0,'pageViews',0,'clicks',0,'completions',0,'liked',0,'disliked',0),'byFeature','[]'::jsonb,'bySite','[]'::jsonb,'bySource','[]'::jsonb,'byControl','[]'::jsonb,'journeys','[]'::jsonb));
end; $$;
revoke all on function public.partner_interaction_analytics_v1(timestamptz,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.partner_interaction_analytics_v1(timestamptz,timestamptz,uuid) to service_role;
comment on table public.partner_interaction_events is 'Owner-authorized anonymous per-page-session interaction analytics. No identity, IP, answers, email or raw URL query/referrer is stored.';
