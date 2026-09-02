-- D4 private, provider-free research intake. Nothing in this schema is exposed
-- through PostgREST; anonymous callers use only the two bounded public RPCs.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.discovery_research_topics (
  id bigint generated always as identity primary key,
  public_token text not null unique check (public_token ~ '^[a-f0-9]{48}$'),
  anchor_kind text not null check (anchor_kind in ('work', 'public_figure', 'character')),
  display_text text not null check (char_length(btrim(display_text)) between 2 and 160),
  normalized_text text not null check (char_length(normalized_text) between 2 and 160),
  release_year integer check (release_year between 1888 and 2100),
  deduplication_key text not null unique,
  status text not null default 'queued' check (status in (
    'needs_clarification', 'queued', 'researching', 'review_pending',
    'matched', 'no_evidence', 'failed'
  )),
  matched_entity_id bigint references public.discovery_entities(id),
  matched_work_id bigint references public.discovery_works(id),
  request_count integer not null default 1 check (request_count > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (matched_entity_id is null or matched_work_id is null)
);

create index discovery_research_topics_queue_idx
  on private.discovery_research_topics (created_at)
  where status = 'queued';
create index discovery_research_topics_matched_entity_idx
  on private.discovery_research_topics (matched_entity_id)
  where matched_entity_id is not null;
create index discovery_research_topics_matched_work_idx
  on private.discovery_research_topics (matched_work_id)
  where matched_work_id is not null;

create table private.discovery_research_runs (
  id bigint generated always as identity primary key,
  topic_id bigint not null references private.discovery_research_topics(id),
  provider text,
  model text,
  preset text,
  contract_version text,
  status text not null default 'queued' check (status in (
    'queued', 'leased', 'succeeded', 'failed', 'cancelled'
  )),
  retry_count integer not null default 0 check (retry_count >= 0 and retry_count <= 3),
  provider_request_id text,
  started_at timestamptz,
  completed_at timestamptz,
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  cost_usd numeric(12,6) check (cost_usd >= 0),
  normalized_artifact jsonb,
  raw_response_pointer text,
  redacted_failure_category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status in ('succeeded', 'failed', 'cancelled')) = (completed_at is not null))
);

create index discovery_research_runs_topic_idx
  on private.discovery_research_runs (topic_id, created_at desc);
create index discovery_research_runs_queue_idx
  on private.discovery_research_runs (created_at)
  where status = 'queued';

create table private.discovery_research_candidates (
  id bigint generated always as identity primary key,
  run_id bigint not null references private.discovery_research_runs(id),
  entity_name text,
  work_title text,
  character_name text,
  claim_type text check (claim_type in ('owned', 'worn_publicly', 'screen_worn', 'reported', 'unconfirmed')),
  identification_precision text check (identification_precision in ('exact_reference', 'model_family', 'brand_only', 'unidentified')),
  identified_brand text,
  identified_model_family text,
  identified_reference_code text,
  custom_prop_possible boolean not null default false,
  contradiction_state text not null default 'unknown' check (contradiction_state in ('clear', 'possible', 'confirmed', 'unknown')),
  normalization_status text not null default 'pending' check (normalization_status in ('pending', 'normalized', 'rejected')),
  review_status text not null default 'draft' check (review_status in ('draft', 'in_review', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index discovery_research_candidates_run_idx
  on private.discovery_research_candidates (run_id, review_status);

create table private.discovery_research_candidate_sources (
  id bigint generated always as identity primary key,
  candidate_id bigint not null references private.discovery_research_candidates(id),
  canonical_url text not null check (canonical_url ~ '^https?://'),
  source_role text not null check (source_role in (
    'official_production_record', 'direct_interview', 'primary_visual',
    'contemporaneous_reporting', 'specialist_corroboration', 'other'
  )),
  stance text not null check (stance in ('supports', 'contradicts', 'context')),
  locator text,
  retrieved_at timestamptz not null default now(),
  independently_fetched boolean not null default false,
  review_status text not null default 'pending' check (review_status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  unique (candidate_id, canonical_url)
);

create index discovery_research_candidate_sources_candidate_idx
  on private.discovery_research_candidate_sources (candidate_id, review_status);

create or replace function public.enqueue_discovery_research_v1(
  p_anchor_kind text,
  p_display_text text,
  p_release_year integer default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  normalized_text text;
  topic private.discovery_research_topics;
begin
  if p_anchor_kind not in ('work', 'public_figure', 'character') then
    raise exception 'A supported discovery anchor is required.';
  end if;
  normalized_text := lower(regexp_replace(btrim(coalesce(p_display_text, '')), '\s+', ' ', 'g'));
  if char_length(normalized_text) < 2 or char_length(normalized_text) > 160
    or normalized_text ~ '[[:cntrl:]]' or normalized_text ~* 'https?://' then
    raise exception 'Research text must be a bounded name or title.';
  end if;
  if p_release_year is not null and p_release_year not between 1888 and 2100 then
    raise exception 'Release year is outside the supported range.';
  end if;

  insert into private.discovery_research_topics (
    public_token, anchor_kind, display_text, normalized_text, release_year,
    deduplication_key
  ) values (
    replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16), p_anchor_kind, btrim(p_display_text),
    normalized_text, p_release_year,
    p_anchor_kind || ':' || normalized_text || ':' || coalesce(p_release_year::text, '')
  ) on conflict (deduplication_key) do update set
    request_count = private.discovery_research_topics.request_count + 1,
    updated_at = now()
  returning * into topic;

  return jsonb_build_object('token', topic.public_token, 'status', topic.status);
end;
$$;

create or replace function public.discovery_research_status_v1(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('status', topic.status)
  from private.discovery_research_topics topic
  where topic.public_token = p_token
    and p_token ~ '^[a-f0-9]{48}$';
$$;

revoke all on function public.enqueue_discovery_research_v1(text, text, integer)
  from public;
revoke all on function public.discovery_research_status_v1(text) from public;
grant execute on function public.enqueue_discovery_research_v1(text, text, integer)
  to anon, authenticated, service_role;
grant execute on function public.discovery_research_status_v1(text)
  to anon, authenticated, service_role;

comment on schema private is 'Private discovery research queue. Browser roles have no schema or table access.';
