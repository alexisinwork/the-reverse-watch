-- One bounded maintenance batch per UTC day. It shares the visitor validation
-- ledger and never turns the unpriced import archive into a paid bulk queue.
alter table private.watch_catalogue add column price_recheck_attempted_at timestamptz;
create index watch_catalogue_priced_refresh_idx on private.watch_catalogue(price_checked_at,id)
where review_status<>'rejected' and reference_confirmed and price_amount>0
  and price_status<>'unconfirmed' and price_change is null;

create table private.catalogue_price_recheck_runs (
  run_date date primary key,
  attempt_id uuid unique references private.ai_watch_validation_attempts(id),
  state text not null check(state in ('validating','completed','empty','abandoned')),
  watches jsonb not null check(jsonb_typeof(watches)='array'),
  results jsonb,
  costs jsonb,
  outcomes jsonb,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  check((state='empty' and attempt_id is null and jsonb_array_length(watches)=0)
    or (state<>'empty' and attempt_id is not null and jsonb_array_length(watches) between 1 and 8))
);
alter table private.catalogue_price_recheck_runs enable row level security;
revoke all on private.catalogue_price_recheck_runs from public,anon,authenticated;

create function public.catalogue_price_recheck_reserve_v1()
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_day date:=(now() at time zone 'UTC')::date;
  v_key text; v_watches jsonb; v_reserved jsonb; v_old record; v_slots integer;
  v_run private.catalogue_price_recheck_runs%rowtype;
begin
  -- Same safety -> key -> attempt/budget ordering as visitor validation.
  perform 1 from private.ai_watch_validation_safety where id=true for update;
  if not found then raise exception 'validation safety record missing'; end if;
  if exists(select 1 from private.ai_watch_validation_safety where halted_at is not null) then
    return jsonb_build_object('state','budget_halted');
  end if;
  -- Abandoned maintenance runs settle conservatively without restarting the
  -- same day's batch or forgetting possible provider charges.
  for v_old in select r.run_date,r.attempt_id,jsonb_array_length(r.watches) as slots,a.state as attempt_state
    from private.catalogue_price_recheck_runs r join private.ai_watch_validation_attempts a on a.id=r.attempt_id
    where r.state='validating' and r.created_at<now()-interval '15 minutes'
    order by r.run_date for update of r
  loop
    if exists(select 1 from private.ai_watch_validation_overruns where attempt_id=v_old.attempt_id) then
      return jsonb_build_object('state','budget_halted');
    end if;
    if v_old.attempt_state='reserved' and not public.ai_watch_validation_settle_v2(v_old.attempt_id,
      (select jsonb_agg(0.025) from generate_series(1,v_old.slots))) then
      raise exception 'maintenance reservation recovery failed';
    end if;
    update private.catalogue_price_recheck_runs set state='abandoned',finished_at=now() where run_date=v_old.run_date;
  end loop;
  select * into v_run from private.catalogue_price_recheck_runs where run_date=v_day;
  if found then return jsonb_build_object('state',case when v_run.state='empty' then 'no_due'
    when v_run.state='validating' then 'in_progress' else 'already_run' end); end if;
  select least(8,greatest(0,floor((100-coalesce((select spent_usd+reserved_usd
    from private.ai_watch_validation_monthly_budget where month_start=date_trunc('month',v_day)::date),0))/0.025)::integer)) into v_slots;
  if v_slots=0 then return jsonb_build_object('state','monthly_limit'); end if;
  select coalesce(jsonb_agg(private.watch_catalogue_json(w)),'[]'::jsonb) into v_watches
  from (select * from private.watch_catalogue
    where review_status<>'rejected' and reference_confirmed and reference_code ~ '[0-9]'
      and price_amount>0 and price_status<>'unconfirmed' and price_change is null
      and price_checked_at<now()-interval '90 days'
      and (price_recheck_attempted_at is null or price_recheck_attempted_at<now()-interval '7 days')
    order by price_checked_at,id limit v_slots) w;
  if jsonb_array_length(v_watches)=0 then
    insert into private.catalogue_price_recheck_runs(run_date,state,watches,finished_at)
    values(v_day,'empty','[]',now());
    return jsonb_build_object('state','no_due');
  end if;
  v_key:=encode(sha256(convert_to('catalogue-price-refresh-v1|'||v_day::text,'UTF8')),'hex');
  v_reserved:=public.ai_watch_validation_reserve_v5(v_key,jsonb_array_length(v_watches));
  if v_reserved->>'state'<>'reserved' then return v_reserved; end if;
  insert into private.catalogue_price_recheck_runs(run_date,attempt_id,state,watches)
    values(v_day,(v_reserved->>'attemptId')::uuid,'validating',v_watches);
  update private.watch_catalogue set price_recheck_attempted_at=now()
    where id in(select (item->>'id')::uuid from jsonb_array_elements(v_watches) item);
  return v_reserved||jsonb_build_object('watches',v_watches);
end;
$$;

create function public.application_readiness_v3()
returns jsonb language sql stable security definer set search_path='' as $$
  select public.application_readiness_v2()||jsonb_build_object(
    'priceRefreshContractReady',coalesce((select bool_and(p.oid is not null
      and has_function_privilege('service_role',p.oid,'execute')
      and not has_function_privilege('anon',p.oid,'execute')
      and not has_function_privilege('authenticated',p.oid,'execute'))
      from (values ('public.catalogue_price_recheck_reserve_v1()'),
        ('public.catalogue_price_recheck_finish_v1(uuid,jsonb,jsonb)'),
        ('public.watch_catalogue_price_review_v2(uuid,jsonb)')) expected(signature)
      left join pg_catalog.pg_proc p on p.oid=pg_catalog.to_regprocedure(expected.signature)),false),
    'priceRefreshLastRunAt',(select max(finished_at) from private.catalogue_price_recheck_runs where state in ('empty','completed')),
    'priceRefreshOverdue',not exists(select 1 from private.catalogue_price_recheck_runs
      where state in ('empty','completed') and finished_at>now()-interval '48 hours'));
$$;
revoke all on function public.application_readiness_v3() from public,anon,authenticated;
grant execute on function public.application_readiness_v3() to service_role;

create function public.catalogue_price_recheck_finish_v1(p_attempt_id uuid,p_results jsonb,p_costs_usd jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare
  v_run private.catalogue_price_recheck_runs%rowtype;
  v_item jsonb; v_base jsonb; v_evidence jsonb; v_source jsonb; v_prices numeric[]; v_currencies text[];
  v_primary numeric; v_watch private.watch_catalogue%rowtype;
  v_refreshed integer:=0; v_pending integer:=0; v_superseded integer:=0;
begin
  perform 1 from private.ai_watch_validation_safety where id=true for update;
  if not found then raise exception 'validation safety record missing'; end if;
  if exists(select 1 from private.ai_watch_validation_safety where halted_at is not null) then return false; end if;
  select * into v_run from private.catalogue_price_recheck_runs where attempt_id=p_attempt_id for update;
  if not found then return false; end if;
  if v_run.state='completed' then
    if v_run.results is distinct from p_results or v_run.costs is distinct from p_costs_usd then
      raise exception 'maintenance attempt already settled with different results';
    end if;
    return true;
  end if;
  if v_run.state<>'validating' then return false; end if;
  if p_results is null or jsonb_typeof(p_results)<>'array' or jsonb_array_length(p_results)>jsonb_array_length(v_run.watches)
    or length(p_results::text)>262144 then raise exception 'invalid maintenance results'; end if;
  if (select count(*) from jsonb_array_elements(p_results))<>(select count(distinct i->>'id') from jsonb_array_elements(p_results) i) then
    raise exception 'duplicate maintenance watch';
  end if;
  for v_item in select value from jsonb_array_elements(p_results) loop
    select i into v_base from jsonb_array_elements(v_run.watches) i where i->>'id'=v_item->>'id';
    if not found then raise exception 'watch was not reserved'; end if;
    v_evidence:=v_item->'evidence';
    if coalesce((v_item->>'amount')::numeric,0)<=0 or (v_item->>'amount')::numeric>1000000000
      or coalesce(v_item->>'currency','') not in ('USD','EUR','GBP','CHF')
      or coalesce(v_item->>'priceStatus','') not in ('confirmed','approximate')
      or coalesce(v_evidence->>'policy','')<>'metered-price-v1'
      or coalesce(jsonb_typeof(v_evidence->'priceObservation'->'sources'),'')<>'array' then
      raise exception 'invalid maintenance price';
    end if;
    if jsonb_array_length(v_evidence->'priceObservation'->'sources')<>2
      or (select count(distinct s->>'provider') from jsonb_array_elements(v_evidence->'priceObservation'->'sources') s
        where s->>'provider' in ('perplexity','muse'))<>2
      or (select count(distinct lower(regexp_replace(split_part(split_part(s->>'sourceUrl','://',2),'/',1),'^www\.','')))
        from jsonb_array_elements(v_evidence->'priceObservation'->'sources') s)<>2 then
      raise exception 'independent price evidence required';
    end if;
    v_prices:='{}'; v_currencies:='{}'; v_primary:=null;
    for v_source in select value from jsonb_array_elements(v_evidence->'priceObservation'->'sources') loop
      if coalesce(v_source->>'value','') !~ '^(USD|EUR|GBP|CHF) [0-9]+(\.[0-9]{1,2})?$'
        or coalesce(v_source->>'sourceUrl','') !~ '^https?://'
        or nullif(v_source->>'checkedAt','') is null
        or (v_source->>'checkedAt')::timestamptz<now()-interval '1 hour'
        or (v_source->>'checkedAt')::timestamptz>now()+interval '5 minutes'
        or position(regexp_replace(lower(v_base->>'referenceCode'),'[^a-z0-9]','','g')
          in regexp_replace(lower(coalesce(v_source->>'quote','')),'[^a-z0-9]','','g'))=0 then
        raise exception 'invalid price source';
      end if;
      v_prices:=array_append(v_prices,split_part(v_source->>'value',' ',2)::numeric);
      v_currencies:=array_append(v_currencies,split_part(v_source->>'value',' ',1));
      if v_source->>'provider'='perplexity' then v_primary:=split_part(v_source->>'value',' ',2)::numeric; end if;
    end loop;
    if v_prices[1]<=0 or v_prices[2]<=0 or v_currencies[1]<>v_currencies[2]
      or v_currencies[1]<>v_item->>'currency' or v_primary is distinct from (v_item->>'amount')::numeric
      or abs(v_prices[1]-v_prices[2])/greatest(v_prices[1],v_prices[2])>0.05 then
      raise exception 'price sources disagree';
    end if;
    select * into v_watch from private.watch_catalogue where id=(v_item->>'id')::uuid for update;
    if not found or v_watch.updated_at is distinct from (v_base->>'updatedAt')::timestamptz
      or v_watch.review_status='rejected' or v_watch.price_change is not null then
      v_superseded:=v_superseded+1; continue;
    end if;
    if v_watch.price_status=v_item->>'priceStatus' and v_watch.price_currency=v_item->>'currency'
      and abs(v_watch.price_amount-(v_item->>'amount')::numeric)/v_watch.price_amount<=0.05 then
      update private.watch_catalogue set price_checked_at=now(),price_evidence=v_evidence,updated_at=now() where id=v_watch.id;
      v_refreshed:=v_refreshed+1;
    else
      update private.watch_catalogue set price_checked_at=now(),price_change=jsonb_build_object(
        'amount',(v_item->>'amount')::numeric,'currency',v_item->>'currency','priceStatus',v_item->>'priceStatus',
        'foundAt',now(),'evidence',v_evidence,'previousAmount',v_watch.price_amount,
        'previousCurrency',v_watch.price_currency,'previousStatus',v_watch.price_status),updated_at=now() where id=v_watch.id;
      v_pending:=v_pending+1;
    end if;
  end loop;
  if not public.ai_watch_validation_settle_v2(p_attempt_id,p_costs_usd) then raise exception 'maintenance settlement failed'; end if;
  update private.catalogue_price_recheck_runs set state='completed',finished_at=now(),results=p_results,costs=p_costs_usd,
    outcomes=jsonb_build_object('refreshed',v_refreshed,'pending',v_pending,'superseded',v_superseded,
      'unverified',jsonb_array_length(watches)-jsonb_array_length(p_results)) where attempt_id=p_attempt_id;
  return true;
end;
$$;

-- Review retains the estimate label and invalidates only snapshots containing
-- the accepted identity; old snapshots/raw cache rows remain as audit evidence.
create function public.watch_catalogue_price_review_v2(p_id uuid,p_result jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_watch private.watch_catalogue%rowtype; v_status text;
begin
  if p_result->>'kind'<>'accept' then return public.watch_catalogue_price_v1(p_id,p_result); end if;
  -- Match snapshot publication's safety -> watch ordering before invalidation.
  perform 1 from private.ai_watch_validation_safety where id=true for update;
  select * into v_watch from private.watch_catalogue where id=p_id for update;
  if not found or v_watch.price_change is null then return false; end if;
  if v_watch.price_change->>'previousStatus' is not null and (
    v_watch.price_amount is distinct from (v_watch.price_change->>'previousAmount')::numeric
    or v_watch.price_currency is distinct from v_watch.price_change->>'previousCurrency'
    or v_watch.price_status is distinct from v_watch.price_change->>'previousStatus') then return false; end if;
  v_status:=case when v_watch.price_change->>'priceStatus'='approximate' then 'approximate' else 'confirmed' end;
  if not public.watch_catalogue_price_v1(p_id,p_result) then return false; end if;
  update private.watch_catalogue set price_status=v_status,price_checked_at=now() where id=p_id;
  update private.ai_watch_validated_cache_snapshots s set policy_version='price-review-invalidated-v1'
    where s.policy_version='source-v1' and exists(select 1 from jsonb_array_elements(s.watches) w
      where regexp_replace(lower(w->>'brand'),'[^a-z0-9]','','g')=regexp_replace(lower(v_watch.brand),'[^a-z0-9]','','g')
        and regexp_replace(lower(w->>'referenceCode'),'[^a-z0-9]','','g')=regexp_replace(lower(v_watch.reference_code),'[^a-z0-9]','','g'));
  return true;
end;
$$;

revoke all on function public.catalogue_price_recheck_reserve_v1(),public.catalogue_price_recheck_finish_v1(uuid,jsonb,jsonb),
  public.watch_catalogue_price_review_v2(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.catalogue_price_recheck_reserve_v1(),public.catalogue_price_recheck_finish_v1(uuid,jsonb,jsonb),
  public.watch_catalogue_price_review_v2(uuid,jsonb) to service_role;

-- Separate maintenance outcome counts from unsuccessful visitor validations.
create or replace function public.ai_watch_validation_admin_status_v1()
returns jsonb language sql stable security definer set search_path='' as $$
  with current_month as (select date_trunc('month',now() at time zone 'UTC')::date as month), totals as (
    select count(*) as attempts,count(*) filter(where a.state='reserved') as in_progress,
      count(*) filter(where a.state='settled' and s.id is not null and s.policy_version='source-v1') as validated,
      count(*) filter(where a.state='settled' and s.id is null and r.attempt_id is null) as failed,
      count(*) filter(where s.id is not null and s.policy_version<>'source-v1') as invalidated,
      count(*) filter(where r.attempt_id is not null) as price_runs
    from private.ai_watch_validation_attempts a
    left join private.ai_watch_validated_cache_snapshots s on s.attempt_id=a.id
    left join private.catalogue_price_recheck_runs r on r.attempt_id=a.id
    where a.budget_month=(select month from current_month))
  select jsonb_build_object('month',m.month,'spentUsd',coalesce(b.spent_usd,0),'reservedUsd',coalesce(b.reserved_usd,0),
    'limitUsd',100,'remainingUsd',greatest(0,100-coalesce(b.spent_usd,0)-coalesce(b.reserved_usd,0)),
    'halted',exists(select 1 from private.ai_watch_validation_safety where halted_at is not null),
    'attempts',t.attempts,'inProgress',t.in_progress,'validated',t.validated,'failed',t.failed,
    'invalidated',t.invalidated,'priceRefreshRuns',t.price_runs)
  from current_month m cross join totals t left join private.ai_watch_validation_monthly_budget b on b.month_start=m.month;
$$;
