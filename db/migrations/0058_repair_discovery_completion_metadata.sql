-- Preserve D5 structured work metadata and claim summaries for D6 review.

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
      run_id, entity_name, work_title, work_kind, work_release_year,
      work_season, work_episode, work_scene, work_timecode, character_name,
      claim_type, identification_precision, identified_brand,
      identified_model_family, identified_reference_code, custom_prop_possible,
      contradiction_state, normalization_status, review_status, claim_summary
    ) values (
      p_run_id,
      nullif(candidate->>'entity_name', ''),
      nullif(candidate->>'work_title', ''),
      nullif(candidate->>'work_kind', ''),
      nullif(candidate->>'work_release_year', '')::integer,
      nullif(candidate->>'work_season', '')::integer,
      nullif(candidate->>'work_episode', '')::integer,
      nullif(candidate->>'work_scene', ''),
      nullif(candidate->>'work_timecode', ''),
      nullif(candidate->>'character_name', ''),
      nullif(candidate->>'claim_type', ''),
      nullif(candidate->>'identification_precision', ''),
      nullif(candidate->>'identified_brand', ''),
      nullif(candidate->>'identified_model_family', ''),
      nullif(candidate->>'identified_reference_code', ''),
      coalesce((candidate->>'custom_prop_possible')::boolean, false),
      coalesce(nullif(candidate->>'contradiction_state', ''), 'unknown'),
      coalesce(nullif(candidate->>'normalization_status', ''), 'normalized'),
      'draft',
      nullif(candidate->>'claim_summary', '')
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
