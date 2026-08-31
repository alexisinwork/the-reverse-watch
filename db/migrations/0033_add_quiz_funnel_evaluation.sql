-- Durable, aggregate-only Phase 7 funnel telemetry.
-- No profile answers, email addresses, IP addresses, or request identifiers.

create table public.quiz_funnel_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  event_name text not null check (event_name in ('start', 'evaluation', 'subscription')),
  intent text check (intent in ('core', 'refine')),
  catalogue_origin text check (catalogue_origin in ('supabase', 'bundled_seed')),
  recommendation_count integer check (recommendation_count >= 0),
  verification_count integer check (verification_count >= 0),
  why_not_count integer check (why_not_count >= 0),
  hard_filter_violation_count integer check (hard_filter_violation_count >= 0),
  evaluation_duration_ms numeric(12, 2) check (evaluation_duration_ms >= 0),
  provider_cost_usd numeric(12, 6) check (provider_cost_usd >= 0),
  top_recommendation_score numeric(10, 2) check (top_recommendation_score >= 0),
  mean_recommendation_score numeric(10, 2) check (mean_recommendation_score >= 0),
  subscription_status text check (
    subscription_status in (
      'sent',
      'partial',
      'unavailable',
      'failed',
      'already_requested'
    )
  ),
  check (
    (event_name = 'start' and intent is null and catalogue_origin is null)
    or (
      event_name = 'evaluation'
      and intent is not null
      and catalogue_origin is not null
      and recommendation_count is not null
      and verification_count is not null
      and why_not_count is not null
      and hard_filter_violation_count is not null
      and evaluation_duration_ms is not null
      and provider_cost_usd is not null
      and subscription_status is null
    )
    or (
      event_name = 'subscription'
      and intent is not null
      and catalogue_origin is not null
      and subscription_status is not null
    )
  )
);

create index quiz_funnel_events_occurred_at_idx
  on public.quiz_funnel_events (occurred_at desc);

alter table public.quiz_funnel_events enable row level security;
revoke all privileges on table public.quiz_funnel_events from anon, authenticated;
revoke all privileges on sequence public.quiz_funnel_events_id_seq from anon, authenticated;

create or replace function public.record_quiz_funnel_event_v1(
  p_event_name text,
  p_intent text default null,
  p_catalogue_origin text default null,
  p_recommendation_count integer default null,
  p_verification_count integer default null,
  p_why_not_count integer default null,
  p_hard_filter_violation_count integer default null,
  p_evaluation_duration_ms numeric default null,
  p_provider_cost_usd numeric default null,
  p_top_recommendation_score numeric default null,
  p_mean_recommendation_score numeric default null,
  p_subscription_status text default null
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.quiz_funnel_events (
    event_name,
    intent,
    catalogue_origin,
    recommendation_count,
    verification_count,
    why_not_count,
    hard_filter_violation_count,
    evaluation_duration_ms,
    provider_cost_usd,
    top_recommendation_score,
    mean_recommendation_score,
    subscription_status
  ) values (
    p_event_name,
    p_intent,
    p_catalogue_origin,
    p_recommendation_count,
    p_verification_count,
    p_why_not_count,
    p_hard_filter_violation_count,
    p_evaluation_duration_ms,
    p_provider_cost_usd,
    p_top_recommendation_score,
    p_mean_recommendation_score,
    p_subscription_status
  );
$$;

revoke all on function public.record_quiz_funnel_event_v1(
  text, text, text, integer, integer, integer, integer, numeric, numeric,
  numeric, numeric, text
) from public;
grant execute on function public.record_quiz_funnel_event_v1(
  text, text, text, integer, integer, integer, integer, numeric, numeric,
  numeric, numeric, text
) to anon, authenticated, service_role;

create or replace function public.quiz_funnel_summary_v1(
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
    select *
    from public.quiz_funnel_events
    where occurred_at >= p_since and occurred_at < p_until
  ), status_counts as (
    select subscription_status, count(*)::integer as total
    from filtered
    where event_name = 'subscription'
    group by subscription_status
  )
  select jsonb_build_object(
    'since', p_since,
    'until', p_until,
    'starts', count(*) filter (where event_name = 'start'),
    'coreEvaluations', count(*) filter (where event_name = 'evaluation' and intent = 'core'),
    'refineEvaluations', count(*) filter (where event_name = 'evaluation' and intent = 'refine'),
    'hardFilterViolations', coalesce(sum(hard_filter_violation_count) filter (where event_name = 'evaluation'), 0),
    'averageEvaluationDurationMs', round(avg(evaluation_duration_ms) filter (where event_name = 'evaluation'), 2),
    'providerCostUsd', coalesce(sum(provider_cost_usd) filter (where event_name = 'evaluation'), 0),
    'averageTopRecommendationScore', round(avg(top_recommendation_score) filter (where event_name = 'evaluation'), 2),
    'averageMeanRecommendationScore', round(avg(mean_recommendation_score) filter (where event_name = 'evaluation'), 2),
    'subscriptionStatuses', coalesce((select jsonb_object_agg(subscription_status, total) from status_counts), '{}'::jsonb)
  ) into summary
  from filtered;

  return summary;
end;
$$;

revoke all on function public.quiz_funnel_summary_v1(timestamptz, timestamptz) from public;
grant execute on function public.quiz_funnel_summary_v1(timestamptz, timestamptz)
  to anon, authenticated, service_role;

comment on table public.quiz_funnel_events is
  'Aggregate-only product evaluation events. Never stores questionnaire answers, contact data, IPs, or request identifiers.';
