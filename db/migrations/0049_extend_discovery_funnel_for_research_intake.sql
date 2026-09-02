-- D4 research telemetry remains aggregate-only: no topic text, tokens,
-- identifiers, IP addresses, reviewer notes, URLs, or profile data.

alter table public.discovery_funnel_events
  add column anchor_kind text,
  add column research_status text;

alter table public.discovery_funnel_events
  add constraint discovery_funnel_events_anchor_kind_check check (
    anchor_kind is null
    or anchor_kind in ('work', 'public_figure', 'character')
  ) not valid,
  add constraint discovery_funnel_events_research_status_check check (
    research_status is null
    or research_status in (
      'needs_clarification', 'queued', 'researching', 'review_pending',
      'matched', 'no_evidence', 'failed'
    )
  ) not valid;

alter table public.discovery_funnel_events
  validate constraint discovery_funnel_events_anchor_kind_check;
alter table public.discovery_funnel_events
  validate constraint discovery_funnel_events_research_status_check;

alter table public.discovery_funnel_events
  add constraint discovery_funnel_events_event_shape_v2_check check (
    (event_name = 'page_view'
      and surface is not null
      and archetype_id is null
      and anchor_kind is null
      and research_status is null)
    or (event_name in ('archetype_completion', 'share', 'core_handoff')
      and surface is null
      and archetype_id is not null
      and anchor_kind is null
      and research_status is null)
    or (event_name = 'outbound_market_click'
      and surface is not null
      and archetype_id is null
      and anchor_kind is null
      and research_status is null)
    or (event_name in ('archetype_start', 'qualified_recommendation', 'opt_in')
      and surface is null
      and archetype_id is null
      and anchor_kind is null
      and research_status is null)
    or (event_name in ('cultural_anchor_selected', 'research_request_submitted')
      and surface is null
      and archetype_id is null
      and anchor_kind is not null
      and research_status is null)
    or (event_name = 'research_status_seen'
      and surface is null
      and archetype_id is null
      and anchor_kind is null
      and research_status is not null)
  ) not valid;

alter table public.discovery_funnel_events
  validate constraint discovery_funnel_events_event_shape_v2_check;
alter table public.discovery_funnel_events
  drop constraint discovery_funnel_events_event_name_check,
  drop constraint discovery_funnel_events_check;
alter table public.discovery_funnel_events
  rename constraint discovery_funnel_events_event_shape_v2_check
  to discovery_funnel_events_check;

alter table public.discovery_funnel_events
  add constraint discovery_funnel_events_event_name_check check (
    event_name in (
      'page_view',
      'archetype_start',
      'archetype_completion',
      'share',
      'core_handoff',
      'qualified_recommendation',
      'opt_in',
      'outbound_market_click',
      'cultural_anchor_selected',
      'research_request_submitted',
      'research_status_seen'
    )
  ) not valid;
alter table public.discovery_funnel_events
  validate constraint discovery_funnel_events_event_name_check;

drop function public.record_discovery_funnel_event_v1(text, text, text);

create function public.record_discovery_funnel_event_v1(
  p_event_name text,
  p_surface text default null,
  p_archetype_id text default null,
  p_anchor_kind text default null,
  p_research_status text default null
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.discovery_funnel_events (
    event_name,
    surface,
    archetype_id,
    anchor_kind,
    research_status
  ) values (
    p_event_name,
    p_surface,
    p_archetype_id,
    p_anchor_kind,
    p_research_status
  );
$$;

revoke all on function public.record_discovery_funnel_event_v1(
  text, text, text, text, text
) from public;
grant execute on function public.record_discovery_funnel_event_v1(
  text, text, text, text, text
) to anon, authenticated, service_role;

comment on column public.discovery_funnel_events.anchor_kind is
  'Aggregate D4 cultural-anchor dimension. Never stores submitted topic text.';
comment on column public.discovery_funnel_events.research_status is
  'Aggregate D4 request status dimension. Never stores request tokens or IDs.';
