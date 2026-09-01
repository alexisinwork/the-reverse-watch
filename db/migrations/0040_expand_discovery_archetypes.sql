-- Expand the aggregate discovery funnel to accept the two additional editorial
-- archetypes without changing its event, privacy, RLS, or RPC boundaries.

alter table public.discovery_funnel_events
  add constraint discovery_funnel_events_archetype_id_v2_check check (
    archetype_id in (
      'field_rationalist',
      'quiet_custodian',
      'architectural_modernist',
      'expressive_collector',
      'mechanical_connoisseur',
      'recognised_standard_bearer'
    )
  ) not valid;

alter table public.discovery_funnel_events
  validate constraint discovery_funnel_events_archetype_id_v2_check;

alter table public.discovery_funnel_events
  drop constraint discovery_funnel_events_archetype_id_check;

alter table public.discovery_funnel_events
  rename constraint discovery_funnel_events_archetype_id_v2_check
  to discovery_funnel_events_archetype_id_check;
