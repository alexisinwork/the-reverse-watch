-- Archive source-level reference evidence in the catalogue intake together
-- with cache publication and budget settlement. Do not turn a sighting into
-- a manufacturer confirmation or overwrite catalogue specifications.
create function public.ai_watch_validated_cache_publish_v3(
  p_attempt_id uuid, p_summary text, p_watches jsonb, p_costs_usd jsonb
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_ok boolean;
  v_watch jsonb;
  v_number bigint;
  v_matches uuid[];
  v_watch_id uuid;
begin
  v_ok := public.ai_watch_validated_cache_publish_v2(
    p_attempt_id, p_summary, p_watches, p_costs_usd
  );
  if not v_ok then return false; end if;

  for v_watch, v_number in
    select value, ordinal from jsonb_array_elements(p_watches)
      with ordinality as entry(value, ordinal)
  loop
    -- Include rejected records in the ambiguity check, but never associate
    -- evidence to a rejected record or pick an arbitrary duplicate.
    v_matches := null;
    if length(regexp_replace(v_watch->>'brand','[^a-zA-Z0-9]','','g')) >= 3
       and length(regexp_replace(v_watch->>'referenceCode','[^a-zA-Z0-9]','','g')) >= 3 then
      select array_agg(w.id order by w.id) into v_matches
      from private.watch_catalogue w
      where lower(regexp_replace(w.brand,'[^a-zA-Z0-9]','','g')) =
            lower(regexp_replace(v_watch->>'brand','[^a-zA-Z0-9]','','g'))
        and lower(regexp_replace(w.reference_code,'[^a-zA-Z0-9]','','g')) =
            lower(regexp_replace(v_watch->>'referenceCode','[^a-zA-Z0-9]','','g'));
    end if;
    v_watch_id := null;
    if cardinality(v_matches) = 1 then
      select w.id into v_watch_id from private.watch_catalogue w
      where w.id = v_matches[1] and w.review_status <> 'rejected';
    end if;

    insert into private.watch_catalogue_intake(
      source, snapshot, source_record_id, watch_id, payload, state
    ) values (
      'validated-cache', 'source-v1', p_attempt_id::text || ':' || v_number::text,
      v_watch_id,
      jsonb_build_object(
        'brand', v_watch->>'brand',
        'referenceCode', v_watch->>'referenceCode',
        'validationEvidence', v_watch->'details'->'validationEvidence'
      ),
      case when v_watch_id is null then 'blocked_identity' else 'needs_evidence' end
    ) on conflict (source, snapshot, source_record_id) do nothing;
  end loop;
  return true;
end;
$$;

revoke all on function public.ai_watch_validated_cache_publish_v3(uuid,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.ai_watch_validated_cache_publish_v3(uuid,text,jsonb,jsonb) to service_role;
