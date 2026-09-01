-- Aggregate-only Phase 8 discovery funnel telemetry.
-- No answers, URLs, contact data, IPs, user identifiers, or request IDs.

create table public.discovery_funnel_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  event_name text not null check (
    event_name in (
      'page_view',
      'archetype_start',
      'archetype_completion',
      'share',
      'core_handoff',
      'qualified_recommendation',
      'opt_in',
      'outbound_market_click'
    )
  ),
  surface text check (
    surface in ('index', 'entity', 'work', 'story', 'archetype')
  ),
  archetype_id text check (
    archetype_id in (
      'field_rationalist',
      'quiet_custodian',
      'architectural_modernist',
      'expressive_collector'
    )
  ),
  check (
    (event_name = 'page_view' and surface is not null and archetype_id is null)
    or (
      event_name in ('archetype_completion', 'share', 'core_handoff')
      and surface is null
      and archetype_id is not null
    )
    or (
      event_name = 'outbound_market_click'
      and surface is not null
      and archetype_id is null
    )
    or (
      event_name in (
        'archetype_start',
        'qualified_recommendation',
        'opt_in'
      )
      and surface is null
      and archetype_id is null
    )
  )
);

create index discovery_funnel_events_name_occurred_at_idx
  on public.discovery_funnel_events (event_name, occurred_at desc);

alter table public.discovery_funnel_events enable row level security;
revoke all privileges on table public.discovery_funnel_events
  from anon, authenticated;
revoke all privileges on sequence public.discovery_funnel_events_id_seq
  from anon, authenticated;

create function public.record_discovery_funnel_event_v1(
  p_event_name text,
  p_surface text default null,
  p_archetype_id text default null
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
    archetype_id
  ) values (
    p_event_name,
    p_surface,
    p_archetype_id
  );
$$;

revoke all on function public.record_discovery_funnel_event_v1(
  text, text, text
) from public;
grant execute on function public.record_discovery_funnel_event_v1(
  text, text, text
) to anon, authenticated, service_role;

create function public.discovery_funnel_summary_v1(
  p_since timestamptz,
  p_until timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  summary jsonb;
begin
  if p_since is null or p_until is null or p_since >= p_until then
    raise exception 'A valid ascending evaluation window is required.';
  end if;
  if p_until - p_since > interval '90 days' then
    raise exception 'Evaluation windows cannot exceed 90 days.';
  end if;

  with filtered as (
    select event_name, surface, archetype_id
    from public.discovery_funnel_events
    where occurred_at >= p_since and occurred_at < p_until
  ), surface_counts as (
    select surface, count(*)::integer as total
    from filtered
    where event_name = 'page_view'
    group by surface
  ), archetype_counts as (
    select archetype_id, count(*)::integer as total
    from filtered
    where event_name = 'archetype_completion'
    group by archetype_id
  )
  select jsonb_build_object(
    'since', p_since,
    'until', p_until,
    'pageViews', count(*) filter (where event_name = 'page_view'),
    'pageViewsBySurface', coalesce(
      (select jsonb_object_agg(surface, total) from surface_counts),
      '{}'::jsonb
    ),
    'archetypeStarts', count(*) filter (where event_name = 'archetype_start'),
    'archetypeCompletions', count(*) filter (where event_name = 'archetype_completion'),
    'shares', count(*) filter (where event_name = 'share'),
    'coreHandoffs', count(*) filter (where event_name = 'core_handoff'),
    'qualifiedRecommendations', count(*) filter (where event_name = 'qualified_recommendation'),
    'optIns', count(*) filter (where event_name = 'opt_in'),
    'outboundMarketClicks', count(*) filter (where event_name = 'outbound_market_click'),
    'archetypeCompletionsByType', coalesce(
      (select jsonb_object_agg(archetype_id, total) from archetype_counts),
      '{}'::jsonb
    )
  ) into summary
  from filtered;

  return summary;
end;
$$;

revoke all on function public.discovery_funnel_summary_v1(
  timestamptz, timestamptz
) from public;
grant execute on function public.discovery_funnel_summary_v1(
  timestamptz, timestamptz
) to anon, authenticated, service_role;

comment on table public.discovery_funnel_events is
  'Aggregate-only Phase 8 funnel events. Never stores answers, URLs, contact data, IPs, user IDs, or request IDs.';
