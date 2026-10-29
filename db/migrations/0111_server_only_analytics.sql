-- Deploy the service-role callers before applying this reversible restriction.
-- HTTP routes retain schema validation and rate limiting; public database keys
-- must not bypass them or read admin-only aggregate analytics.
revoke all on function public.quiz_funnel_summary_v1(timestamptz,timestamptz) from public,anon,authenticated;
revoke all on function public.discovery_funnel_summary_v1(timestamptz,timestamptz) from public,anon,authenticated;
revoke all on function public.enqueue_discovery_research_v1(text,text,integer) from public,anon,authenticated;
revoke all on function public.record_discovery_funnel_event_v1(text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.record_quiz_funnel_event_v1(text,text,text,integer,integer,integer,integer,numeric,numeric,numeric,numeric,text) from public,anon,authenticated;
grant execute on function public.quiz_funnel_summary_v1(timestamptz,timestamptz),
  public.discovery_funnel_summary_v1(timestamptz,timestamptz),
  public.enqueue_discovery_research_v1(text,text,integer),
  public.record_discovery_funnel_event_v1(text,text,text,text,text),
  public.record_quiz_funnel_event_v1(text,text,text,integer,integer,integer,integer,numeric,numeric,numeric,numeric,text)
to service_role;

create function public.application_readiness_v2()
returns jsonb language sql stable security definer set search_path='' as $$
  select public.application_readiness_v1() || jsonb_build_object(
    'analyticsAccessProtected',coalesce((select bool_and(
      has_function_privilege('service_role',p.oid,'execute')
      and not has_function_privilege('anon',p.oid,'execute')
      and not has_function_privilege('authenticated',p.oid,'execute'))
      and count(*)=5
      from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in ('quiz_funnel_summary_v1',
        'discovery_funnel_summary_v1','enqueue_discovery_research_v1',
        'record_discovery_funnel_event_v1','record_quiz_funnel_event_v1')),false));
$$;
revoke all on function public.application_readiness_v2() from public,anon,authenticated;
grant execute on function public.application_readiness_v2() to service_role;
