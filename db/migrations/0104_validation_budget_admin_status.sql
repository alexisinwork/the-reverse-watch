-- Read-only service-role summary; exposes no visitor or query information.
create index ai_watch_validation_budget_month_idx on private.ai_watch_validation_attempts(budget_month);

create function public.ai_watch_validation_admin_status_v1()
returns jsonb language sql stable security definer set search_path = '' as $$
  with current_month as (
    select date_trunc('month',now() at time zone 'UTC')::date as month
  ), totals as (
    select count(*) as attempts,
      count(*) filter(where a.state='reserved') as in_progress,
      count(*) filter(where a.state='settled' and s.id is not null) as validated,
      count(*) filter(where a.state='settled' and s.id is null) as failed
    from private.ai_watch_validation_attempts a
    left join private.ai_watch_validated_cache_snapshots s on s.attempt_id=a.id
    where a.budget_month=(select month from current_month)
  )
  select jsonb_build_object('month',m.month,'spentUsd',coalesce(b.spent_usd,0),
    'reservedUsd',coalesce(b.reserved_usd,0),'limitUsd',100,
    'remainingUsd',greatest(0,100-coalesce(b.spent_usd,0)-coalesce(b.reserved_usd,0)),
    'halted',exists(select 1 from private.ai_watch_validation_safety where halted_at is not null),
    'attempts',t.attempts,'inProgress',t.in_progress,'validated',t.validated,'failed',t.failed)
  from current_month m cross join totals t
  left join private.ai_watch_validation_monthly_budget b on b.month_start=m.month;
$$;
revoke all on function public.ai_watch_validation_admin_status_v1() from public,anon,authenticated;
grant execute on function public.ai_watch_validation_admin_status_v1() to service_role;
