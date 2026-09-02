-- D5 private worker boundary. Browser roles remain unable to inspect or write
-- queue, run, candidate, or source records.

alter table private.discovery_research_topics enable row level security;
alter table private.discovery_research_runs enable row level security;
alter table private.discovery_research_candidates enable row level security;
alter table private.discovery_research_candidate_sources enable row level security;

alter table private.discovery_research_runs
  add column lease_token uuid unique,
  add column lease_expires_at timestamptz,
  add column raw_response jsonb,
  add constraint discovery_research_runs_lease_check check (
    (status = 'leased') = (lease_token is not null and lease_expires_at is not null)
  ),
  add constraint discovery_research_runs_raw_response_size_check check (
    raw_response is null or pg_column_size(raw_response) <= 220000
  );

create index discovery_research_runs_lease_idx
  on private.discovery_research_runs (lease_expires_at)
  where status = 'leased';

create or replace function public.claim_discovery_research_runs_v1(
  p_limit integer,
  p_lease_seconds integer,
  p_model text,
  p_contract_version text,
  p_daily_cost_cap_usd numeric
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if p_limit is null or p_limit < 1 or p_limit > 10 then
    raise exception 'Worker limit is outside the supported range.';
  end if;
  if p_lease_seconds is null or p_lease_seconds < 60 or p_lease_seconds > 1800 then
    raise exception 'Worker lease is outside the supported range.';
  end if;
  if p_model is null or char_length(btrim(p_model)) < 1 or char_length(p_model) > 128 then
    raise exception 'Worker model is required.';
  end if;
  if p_contract_version is null or char_length(btrim(p_contract_version)) < 1
    or char_length(p_contract_version) > 128 then
    raise exception 'Worker contract version is required.';
  end if;
  if p_daily_cost_cap_usd is null or p_daily_cost_cap_usd <= 0 then
    raise exception 'A positive daily cost cap is required.';
  end if;

  -- One project-local lock makes the daily spend check and claim atomic if a
  -- scheduler is accidentally invoked concurrently.
  perform pg_advisory_xact_lock(7184050);

  -- A crashed invocation releases its work only after the bounded lease. The
  -- next claim reuses the same topic and increments retry_count.
  update private.discovery_research_runs
  set status = 'queued',
      lease_token = null,
      lease_expires_at = null,
      started_at = null,
      updated_at = now()
  where status = 'leased'
    and lease_expires_at < now();

  update private.discovery_research_topics topic
  set status = 'queued', updated_at = now()
  where topic.status = 'researching'
    and exists (
      select 1
      from private.discovery_research_runs run
      where run.topic_id = topic.id
        and run.status = 'queued'
    );

  if coalesce((
    select sum(run.cost_usd)
    from private.discovery_research_runs run
    where run.status = 'succeeded'
      and run.completed_at >= date_trunc('day', now())
  ), 0) >= p_daily_cost_cap_usd then
    return '[]'::jsonb;
  end if;

  with locked_topics as (
    select topic.id,
           topic.anchor_kind,
           topic.display_text,
           topic.normalized_text,
           topic.release_year
    from private.discovery_research_topics topic
    where topic.status = 'queued'
      and not exists (
        select 1
        from private.discovery_research_runs active_run
        where active_run.topic_id = topic.id
          and active_run.status in ('leased', 'succeeded')
      )
      and coalesce((
        select max(previous_run.retry_count)
        from private.discovery_research_runs previous_run
        where previous_run.topic_id = topic.id
      ), 0) < 3
    order by topic.created_at, topic.id
    limit p_limit
    for update of topic skip locked
  ), marked_topics as (
    update private.discovery_research_topics topic
    set status = 'researching', updated_at = now()
    from locked_topics locked
    where topic.id = locked.id
    returning topic.id, topic.anchor_kind, topic.display_text,
              topic.normalized_text, topic.release_year
  ), inserted_runs as (
    insert into private.discovery_research_runs (
      topic_id, provider, model, preset, contract_version, status,
      retry_count, started_at, lease_token, lease_expires_at
    )
    select marked.id, 'perplexity', p_model, p_model, p_contract_version,
           'leased', coalesce((
             select max(previous_run.retry_count)
             from private.discovery_research_runs previous_run
             where previous_run.topic_id = marked.id
           ), 0) + 1, now(), gen_random_uuid(),
           now() + make_interval(secs => p_lease_seconds)
    from marked_topics marked
    returning id, topic_id, lease_token, retry_count
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'runId', run.id,
        'topicId', topic.id,
        'leaseToken', run.lease_token,
        'anchor', topic.anchor_kind,
        'displayText', topic.display_text,
        'normalizedText', topic.normalized_text,
        'releaseYear', topic.release_year,
        'attempt', run.retry_count
      ) order by run.id
    ),
    '[]'::jsonb
  )
  into result
  from inserted_runs run
  join private.discovery_research_topics topic on topic.id = run.topic_id;

  return result;
end;
$$;

create or replace function public.complete_discovery_research_run_v1(
  p_run_id bigint,
  p_lease_token uuid,
  p_provider_request_id text,
  p_model text,
  p_contract_version text,
  p_outcome text,
  p_normalized_artifact jsonb,
  p_raw_response jsonb,
  p_candidates jsonb,
  p_input_tokens integer,
  p_output_tokens integer,
  p_cost_usd numeric
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  run private.discovery_research_runs;
  candidate jsonb;
  source jsonb;
  candidate_id bigint;
  candidate_count integer;
begin
  if p_outcome not in ('review_pending', 'needs_clarification', 'no_evidence') then
    raise exception 'Worker outcome is not supported.';
  end if;
  if p_candidates is null or jsonb_typeof(p_candidates) <> 'array'
    or jsonb_array_length(p_candidates) > 12 then
    raise exception 'Candidate payload is outside the supported range.';
  end if;
  if p_normalized_artifact is null or pg_column_size(p_normalized_artifact) > 220000 then
    raise exception 'Normalized artifact is outside the supported range.';
  end if;
  if p_raw_response is not null and pg_column_size(p_raw_response) > 220000 then
    raise exception 'Raw response is outside the supported range.';
  end if;
  if p_input_tokens is not null and p_input_tokens < 0 then
    raise exception 'Input token count cannot be negative.';
  end if;
  if p_output_tokens is not null and p_output_tokens < 0 then
    raise exception 'Output token count cannot be negative.';
  end if;
  if p_cost_usd is not null and p_cost_usd < 0 then
    raise exception 'Provider cost cannot be negative.';
  end if;

  select * into run
  from private.discovery_research_runs
  where id = p_run_id and status = 'leased' and lease_token = p_lease_token
  for update;
  if not found then
    raise exception 'Research run lease is no longer valid.';
  end if;

  update private.discovery_research_runs
  set status = 'succeeded',
      model = p_model,
      preset = p_model,
      contract_version = p_contract_version,
      provider_request_id = nullif(btrim(p_provider_request_id), ''),
      completed_at = now(),
      input_tokens = p_input_tokens,
      output_tokens = p_output_tokens,
      cost_usd = p_cost_usd,
      normalized_artifact = p_normalized_artifact,
      raw_response = p_raw_response,
      lease_token = null,
      lease_expires_at = null,
      updated_at = now()
  where id = p_run_id;

  for candidate in select value from jsonb_array_elements(p_candidates) loop
    insert into private.discovery_research_candidates (
      run_id, entity_name, work_title, character_name, claim_type,
      identification_precision, identified_brand, identified_model_family,
      identified_reference_code, custom_prop_possible, contradiction_state,
      normalization_status, review_status
    ) values (
      p_run_id,
      nullif(candidate->>'entity_name', ''),
      nullif(candidate->>'work_title', ''),
      nullif(candidate->>'character_name', ''),
      nullif(candidate->>'claim_type', ''),
      nullif(candidate->>'identification_precision', ''),
      nullif(candidate->>'identified_brand', ''),
      nullif(candidate->>'identified_model_family', ''),
      nullif(candidate->>'identified_reference_code', ''),
      coalesce((candidate->>'custom_prop_possible')::boolean, false),
      coalesce(nullif(candidate->>'contradiction_state', ''), 'unknown'),
      coalesce(nullif(candidate->>'normalization_status', ''), 'normalized'),
      'draft'
    ) returning id into candidate_id;

    if jsonb_typeof(candidate->'sources') <> 'array'
      or jsonb_array_length(candidate->'sources') < 1
      or jsonb_array_length(candidate->'sources') > 12 then
      raise exception 'Candidate sources are outside the supported range.';
    end if;
    for source in select value from jsonb_array_elements(candidate->'sources') loop
      insert into private.discovery_research_candidate_sources (
        candidate_id, canonical_url, source_role, stance, locator, retrieved_at
      ) values (
        candidate_id,
        source->>'canonical_url',
        source->>'source_role',
        source->>'stance',
        nullif(source->>'locator', ''),
        coalesce((source->>'retrieved_at')::timestamptz, now())
      );
    end loop;
  end loop;

  select count(*) into candidate_count
  from private.discovery_research_candidates
  where run_id = p_run_id;

  update private.discovery_research_topics
  set status = p_outcome, updated_at = now()
  where id = run.topic_id;
  return jsonb_build_object('status', p_outcome, 'candidateCount', candidate_count);
end;
$$;

create or replace function public.fail_discovery_research_run_v1(
  p_run_id bigint,
  p_lease_token uuid,
  p_failure_category text,
  p_retryable boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  run private.discovery_research_runs;
  next_status text;
begin
  if p_failure_category is null or p_failure_category !~ '^[a-z_]{1,64}$' then
    raise exception 'Failure category is invalid.';
  end if;
  select * into run
  from private.discovery_research_runs
  where id = p_run_id and status = 'leased' and lease_token = p_lease_token
  for update;
  if not found then
    raise exception 'Research run lease is no longer valid.';
  end if;

  next_status := case
    when p_retryable and run.retry_count < 3 then 'queued'
    else 'failed'
  end;
  update private.discovery_research_runs
  set status = 'failed',
      completed_at = now(),
      redacted_failure_category = p_failure_category,
      lease_token = null,
      lease_expires_at = null,
      updated_at = now()
  where id = p_run_id;
  update private.discovery_research_topics
  set status = next_status, updated_at = now()
  where id = run.topic_id;
  return jsonb_build_object('status', next_status, 'retryable', p_retryable);
end;
$$;

revoke all on function public.claim_discovery_research_runs_v1(integer, integer, text, text, numeric)
  from public, anon, authenticated;
revoke all on function public.complete_discovery_research_run_v1(bigint, uuid, text, text, text, text, jsonb, jsonb, jsonb, integer, integer, numeric)
  from public, anon, authenticated;
revoke all on function public.fail_discovery_research_run_v1(bigint, uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.claim_discovery_research_runs_v1(integer, integer, text, text, numeric)
  to service_role;
grant execute on function public.complete_discovery_research_run_v1(bigint, uuid, text, text, text, text, jsonb, jsonb, jsonb, integer, integer, numeric)
  to service_role;
grant execute on function public.fail_discovery_research_run_v1(bigint, uuid, text, boolean)
  to service_role;

comment on column private.discovery_research_runs.raw_response is
  'Bounded private provider response metadata and structured output; never published.';
