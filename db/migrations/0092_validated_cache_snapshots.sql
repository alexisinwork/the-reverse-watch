-- Immutable validated snapshots preserve the older cached results. Budget
-- settlement and publication are one short transaction; AI calls happen before it.
create table private.ai_watch_validated_cache_snapshots (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references private.ai_watch_validation_attempts(id),
  cache_key text not null check (cache_key ~ '^[0-9a-f]{64}$'),
  summary text not null check (length(summary) between 1 and 4000),
  watches jsonb not null check (jsonb_typeof(watches) = 'array'),
  policy_version text not null default 'source-v1',
  validated_at timestamptz not null default now()
);
create index ai_watch_validated_cache_latest
  on private.ai_watch_validated_cache_snapshots (cache_key, validated_at desc, id desc);
alter table private.ai_watch_validated_cache_snapshots enable row level security;
revoke all on private.ai_watch_validated_cache_snapshots from public, anon, authenticated;

create function public.ai_watch_validated_cache_publish_v2(
  p_attempt_id uuid, p_summary text, p_watches jsonb, p_costs_usd jsonb
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_attempt private.ai_watch_validation_attempts%rowtype;
  v_existing private.ai_watch_validated_cache_snapshots%rowtype;
  v_watch jsonb;
  v_evidence jsonb;
  v_settled boolean;
begin
  select * into v_attempt from private.ai_watch_validation_attempts where id=p_attempt_id for update;
  if not found then return false; end if;
  select * into v_existing from private.ai_watch_validated_cache_snapshots where attempt_id=p_attempt_id;
  if found then
    if v_existing.summary is distinct from p_summary or v_existing.watches is distinct from p_watches then
      raise exception 'attempt already published with a different result';
    end if;
    return true;
  end if;
  if v_attempt.state <> 'reserved' then return false; end if;
  if p_summary is null or length(p_summary) not between 1 and 4000
     or p_watches is null or jsonb_typeof(p_watches) <> 'array' then
    raise exception 'invalid validated result';
  end if;
  if jsonb_array_length(p_watches) not between 1 and v_attempt.watch_count
     or length(p_watches::text) > 262144 then raise exception 'invalid result size'; end if;
  for v_watch in select value from jsonb_array_elements(p_watches) loop
    if jsonb_typeof(v_watch) <> 'object'
       or nullif(btrim(v_watch->>'brand'),'') is null
       or nullif(btrim(v_watch->>'model'),'') is null
       or nullif(btrim(v_watch->>'referenceCode'),'') is null
       or jsonb_typeof(v_watch->'details') <> 'object' then
      raise exception 'invalid validated watch';
    end if;
    v_evidence := v_watch->'details'->'validationEvidence';
    if v_evidence is null or jsonb_typeof(v_evidence) <> 'array' then
      raise exception 'provider evidence required';
    end if;
    if jsonb_array_length(v_evidence) <> 2
       or not exists(select 1 from jsonb_array_elements(v_evidence) e where e->>'provider'='perplexity' and e->>'sourceUrl' ~ '^https?://' and nullif(e->>'checkedAt','') is not null)
       or not exists(select 1 from jsonb_array_elements(v_evidence) e where e->>'provider'='muse' and e->>'sourceUrl' ~ '^https?://' and nullif(e->>'checkedAt','') is not null) then
      raise exception 'two provider sources required';
    end if;
  end loop;
  select public.ai_watch_validation_settle_v2(p_attempt_id,p_costs_usd) into v_settled;
  if not v_settled then raise exception 'reservation could not be settled'; end if;
  insert into private.ai_watch_validated_cache_snapshots(attempt_id,cache_key,summary,watches)
  values(p_attempt_id,v_attempt.cache_key,p_summary,p_watches);
  return true;
end;
$$;

create function public.ai_watch_validated_cache_get_v2(p_cache_key text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('validationStatus','valid','summary',summary,'watches',watches,'validatedAt',validated_at,'policyVersion',policy_version)
  from private.ai_watch_validated_cache_snapshots
  where cache_key=p_cache_key and policy_version='source-v1'
  order by validated_at desc,id desc limit 1;
$$;

revoke all on function public.ai_watch_validated_cache_publish_v2(uuid,text,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.ai_watch_validated_cache_get_v2(text) from public,anon,authenticated;
grant execute on function public.ai_watch_validated_cache_publish_v2(uuid,text,jsonb,jsonb) to service_role;
grant execute on function public.ai_watch_validated_cache_get_v2(text) to service_role;
