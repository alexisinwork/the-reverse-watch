-- D6 review boundary. Provider candidates become canonical discovery drafts only
-- after independent source verification. Publication remains evidence/rights
-- gated and never creates or accepts a catalogue variant.

alter table private.discovery_research_candidate_sources
  add column independent_fetch_status text not null default 'pending',
  add column independent_fetched_at timestamptz,
  add column independent_content_hash text,
  add column independent_failure_category text,
  add constraint discovery_candidate_sources_fetch_status_check check (
    independent_fetch_status in ('pending', 'verified', 'failed')
  ),
  add constraint discovery_candidate_sources_fetch_metadata_check check (
    (independent_fetch_status = 'verified'
      and independent_fetched_at is not null
      and independently_fetched = true
      and independent_content_hash ~ '^[a-f0-9]{64}$')
    or (independent_fetch_status <> 'verified'
      and independently_fetched = false)
  );

alter table private.discovery_research_candidates
  add column claim_summary text check (char_length(claim_summary) <= 1000),
  add column work_kind text check (work_kind in ('film', 'tv_series', 'episode', 'other')),
  add column work_release_year integer check (work_release_year between 1888 and 2100),
  add column work_season integer check (work_season > 0),
  add column work_episode integer check (work_episode > 0),
  add column work_scene text,
  add column work_timecode text,
  add column reviewer_note text,
  add column reviewed_at timestamptz,
  add column canonical_attribution_id bigint references public.discovery_attributions(id),
  add constraint discovery_research_candidates_review_metadata_check check (
    (review_status in ('accepted', 'rejected')) = (reviewed_at is not null)
  );

create unique index discovery_research_candidates_canonical_idx
  on private.discovery_research_candidates (canonical_attribution_id)
  where canonical_attribution_id is not null;

create or replace function public.list_discovery_candidate_sources_v1(
  p_candidate_id bigint
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object('id', source.id, 'url', source.canonical_url)
      order by source.id
    ),
    '[]'::jsonb
  )
  from private.discovery_research_candidate_sources source
  where source.candidate_id = p_candidate_id;
$$;

create or replace function public.record_discovery_candidate_source_fetch_v1(
  p_candidate_id bigint,
  p_source_id bigint,
  p_status text,
  p_fetched_at timestamptz,
  p_content_hash text,
  p_failure_category text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_status not in ('verified', 'failed') then
    raise exception 'Source fetch status is not supported.';
  end if;
  if p_status = 'verified' and (
    p_fetched_at is null or p_content_hash is null
    or p_content_hash !~ '^[a-f0-9]{64}$'
  ) then
    raise exception 'Verified sources require a timestamp and SHA-256 hash.';
  end if;
  if p_status = 'failed' and (p_failure_category is null
    or p_failure_category !~ '^[a-z_]{1,64}$') then
    raise exception 'Failed sources require a redacted category.';
  end if;
  if not exists (
    select 1
    from private.discovery_research_candidate_sources source
    where source.id = p_source_id and source.candidate_id = p_candidate_id
  ) then
    raise exception 'Candidate source does not exist.';
  end if;

  update private.discovery_research_candidate_sources
  set independently_fetched = p_status = 'verified',
      independent_fetch_status = p_status,
      independent_fetched_at = case when p_status = 'verified' then p_fetched_at else null end,
      independent_content_hash = case when p_status = 'verified' then p_content_hash else null end,
      independent_failure_category = case when p_status = 'failed' then p_failure_category else null end
  where id = p_source_id and candidate_id = p_candidate_id;
  return jsonb_build_object('status', p_status, 'sourceId', p_source_id);
end;
$$;

create or replace function public.review_discovery_candidate_v1(
  p_candidate_id bigint,
  p_decision text,
  p_publish boolean,
  p_reviewer_note text,
  p_reference_variant_id uuid,
  p_rights jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  candidate private.discovery_research_candidates;
  run private.discovery_research_runs;
  topic private.discovery_research_topics;
  artifact jsonb;
  rights jsonb;
  source private.discovery_research_candidate_sources;
  source_id uuid;
  entity_id bigint;
  work_id bigint;
  attribution_id bigint;
  entity_name text;
  entity_kind text;
  entity_slug text;
  work_slug text;
  work_kind text;
  confidence_code text;
  dispute_state text;
  canonical_review_status text;
  evidence_review_status text;
  evidence_reviewed_at timestamptz;
  source_count integer;
begin
  if p_decision not in ('accepted', 'rejected') then
    raise exception 'Candidate review decision is not supported.';
  end if;
  if p_reviewer_note is not null and char_length(p_reviewer_note) > 1000 then
    raise exception 'Reviewer note is too long.';
  end if;
  if p_decision = 'rejected' then
    if p_publish then
      raise exception 'A rejected candidate cannot be published.';
    end if;
    update private.discovery_research_candidates
    set review_status = 'rejected', reviewed_at = now(),
        reviewer_note = nullif(btrim(p_reviewer_note), ''), updated_at = now()
    where id = p_candidate_id;
    if not found then
      raise exception 'Discovery candidate does not exist.';
    end if;
    return jsonb_build_object('status', 'rejected');
  end if;
  if p_publish and p_rights is null then
    raise exception 'Publication requires an image-rights decision.';
  end if;

  select * into candidate
  from private.discovery_research_candidates item
  where item.id = p_candidate_id
  for update;
  if not found then
    raise exception 'Discovery candidate does not exist.';
  end if;
  if candidate.canonical_attribution_id is not null then
    raise exception 'Discovery candidate has already been promoted.';
  end if;
  if candidate.entity_name is not null and candidate.character_name is not null then
    raise exception 'A canonical attribution cannot merge a public figure with a character.';
  end if;
  if candidate.claim_type in ('owned', 'worn_publicly')
    and candidate.work_title is not null then
    raise exception 'Ownership and public-wear claims cannot carry a work.';
  end if;
  if candidate.claim_type = 'screen_worn'
    and (candidate.character_name is null or candidate.work_title is null) then
    raise exception 'Screen-worn claims require a character and a work.';
  end if;
  select item.* into run
  from private.discovery_research_runs item
  where item.id = candidate.run_id;
  select item.* into topic
  from private.discovery_research_topics item
  where item.id = run.topic_id;
  artifact := run.normalized_artifact;

  select count(*) into source_count
  from private.discovery_research_candidate_sources source
  where source.candidate_id = candidate.id;
  if source_count < 1 or exists (
    select 1
    from private.discovery_research_candidate_sources source
    where source.candidate_id = candidate.id
      and (source.independent_fetch_status <> 'verified'
        or source.canonical_url ~* '^https://(www\\.)?thereserve\\.watch(/|$)'
        or source.canonical_url !~* '^https://')
  ) then
    raise exception 'Every candidate source requires an independent verification.';
  end if;

  if p_publish and (
    coalesce((artifact #>> '{result,targetMismatch}')::boolean, false)
    or coalesce((artifact #>> '{result,ambiguous}')::boolean, false)
    or coalesce((artifact #>> '{result,insufficientEvidence}')::boolean, false)
  ) then
    raise exception 'Mismatched, ambiguous, or insufficient research cannot publish.';
  end if;
  if p_publish and candidate.contradiction_state <> 'clear' then
    raise exception 'Unresolved contradictions cannot publish.';
  end if;
  if p_publish and candidate.custom_prop_possible then
    raise exception 'A possible custom prop cannot publish as a retail attribution.';
  end if;
  if p_publish and candidate.identification_precision <> 'exact_reference' then
    raise exception 'Publication requires an exact-reference identification.';
  end if;
  if p_reference_variant_id is not null and candidate.identification_precision <> 'exact_reference' then
    raise exception 'Only exact-reference candidates may link a catalogue variant.';
  end if;
  if p_publish and p_reference_variant_id is null then
    raise exception 'Publication requires a reviewed exact catalogue variant.';
  end if;
  if p_reference_variant_id is not null and not exists (
    select 1
    from public.reference_variants variant
    join public.reference_models model on model.id = variant.reference_model_id
    join public.collections collection on collection.id = model.collection_id
    join public.brands brand on brand.id = collection.brand_id
    where variant.id = p_reference_variant_id
      and variant.review_status = 'accepted'
      and model.review_status = 'accepted'
      and collection.review_status = 'accepted'
      and brand.review_status = 'accepted'
      and (candidate.identified_reference_code is null
        or variant.reference_code = candidate.identified_reference_code)
  ) then
    raise exception 'Catalogue links require a reviewed exact variant with matching reference evidence.';
  end if;

  if p_publish then
    rights := p_rights;
    if jsonb_typeof(rights) <> 'object'
      or rights->>'imageState' is null
      or rights->>'reviewedAt' is null
      or rights->>'reviewedAt' !~ '^20[0-9]{2}-'
      or rights->>'imageState' not in (
        'no_image_stored', 'licensed_asset', 'owned_asset',
        'public_domain_asset', 'external_embed_cleared'
      ) then
      raise exception 'The image-rights decision is invalid.';
    end if;
    if rights->>'imageState' = 'no_image_stored'
      and rights->>'assetUrl' is not null then
      raise exception 'No-image rights cannot include an asset.';
    end if;
    if rights->>'imageState' <> 'no_image_stored'
      and (rights->>'assetUrl' is null or rights->>'rightsBasis' is null) then
      raise exception 'An image asset requires a rights basis and URL.';
    end if;
  end if;

  entity_name := coalesce(candidate.entity_name, candidate.character_name);
  if entity_name is null then
    raise exception 'A reviewed candidate requires a separate entity name.';
  end if;
  entity_kind := case when candidate.character_name is not null
    then 'fictional_character' else 'public_figure' end;
  entity_slug := lower(regexp_replace(
    regexp_replace(btrim(entity_name), '[^a-zA-Z0-9]+', '-', 'g'),
    '(^-|-$)', '', 'g'
  ));
  if entity_slug = '' then
    entity_slug := 'discovery-' || candidate.id::text;
  end if;
  if exists (
    select 1 from public.discovery_entities entity
    where entity.slug = entity_slug and entity.entity_kind <> entity_kind
  ) then
    raise exception 'The candidate entity conflicts with an existing entity kind.';
  end if;
  insert into public.discovery_entities (
    entity_kind, slug, display_name, review_status
  ) values (
    entity_kind, entity_slug, entity_name,
    case when p_publish then 'accepted' else 'in_review' end
  ) on conflict (slug) do update set
    display_name = excluded.display_name,
    review_status = case
      when public.discovery_entities.review_status = 'accepted' then 'accepted'
      else excluded.review_status
    end,
    updated_at = now()
  returning id into entity_id;
  insert into public.discovery_entity_aliases (
    entity_id, display_alias, normalized_alias, locale, review_status, reviewed_at
  ) values (
    entity_id, topic.display_text, lower(btrim(topic.display_text)), 'und',
    case when p_publish then 'accepted' else 'in_review' end,
    case when p_publish then now() else null end
  ) on conflict (entity_id, normalized_alias, locale) do update set
    review_status = case
      when public.discovery_entity_aliases.review_status = 'accepted' then 'accepted'
      else excluded.review_status
    end,
    reviewed_at = case
      when public.discovery_entity_aliases.review_status = 'accepted'
        then public.discovery_entity_aliases.reviewed_at
      else excluded.reviewed_at
    end,
    updated_at = now();

  if candidate.work_title is not null then
    work_kind := case candidate.work_kind
      when 'film' then 'film'
      when 'tv_series' then 'television_series'
      when 'episode' then 'television_episode'
      else 'other'
    end;
    work_slug := lower(regexp_replace(
      regexp_replace(btrim(candidate.work_title), '[^a-zA-Z0-9]+', '-', 'g'),
      '(^-|-$)', '', 'g'
    ));
    if work_slug = '' then work_slug := 'discovery-work-' || candidate.id::text; end if;
    insert into public.discovery_works (
      work_kind, slug, title, release_date, season_number, episode_number,
      review_status
    ) values (work_kind, work_slug, candidate.work_title, null,
      case when work_kind = 'television_episode' then candidate.work_season else null end,
      case when work_kind = 'television_episode' then candidate.work_episode else null end,
      case when p_publish then 'accepted' else 'in_review' end)
    on conflict (slug) do update set
      title = excluded.title,
      review_status = case
        when public.discovery_works.review_status = 'accepted' then 'accepted'
        else excluded.review_status
      end,
      updated_at = now()
    returning id into work_id;
    insert into public.discovery_work_aliases (
      work_id, display_alias, normalized_alias, locale, review_status, reviewed_at
    ) values (
      work_id, candidate.work_title, lower(btrim(candidate.work_title)), 'und',
      case when p_publish then 'accepted' else 'in_review' end,
      case when p_publish then now() else null end
    ) on conflict (work_id, normalized_alias, locale) do nothing;
  end if;

  confidence_code := case
    when candidate.contradiction_state <> 'clear' then 'disputed'
    when candidate.identification_precision = 'exact_reference' then 'confirmed'
    when candidate.identification_precision in ('model_family', 'brand_only') then 'family_only'
    else 'unconfirmed'
  end;
  dispute_state := case when candidate.contradiction_state = 'clear' then 'clear' else 'disputed' end;
  canonical_review_status := case when p_publish then 'accepted' else 'draft' end;
  evidence_review_status := case when p_publish then 'accepted' else 'pending' end;
  evidence_reviewed_at := case when p_publish then now() else null end;

  insert into public.discovery_attributions (
    entity_id, work_id, claim_type, identification_precision, identified_brand,
    identified_model_family, identified_reference_code, confidence_code,
    dispute_state, scene_locator, editorial_note, review_status, published_at,
    reference_variant_id
  ) values (
    entity_id, work_id, candidate.claim_type, candidate.identification_precision,
    candidate.identified_brand, candidate.identified_model_family,
    candidate.identified_reference_code, confidence_code, dispute_state,
    nullif(candidate.character_name, ''),
    left(concat_ws(E'\n\n', candidate.claim_summary, p_reviewer_note), 2_000),
    'draft', null, p_reference_variant_id
  ) returning id into attribution_id;

  for source in select item.*
    from private.discovery_research_candidate_sources item
    where item.candidate_id = candidate.id
    order by item.id loop
    insert into public.sources (
      url, canonical_url, source_type, retrieved_at
    ) values (
      source.canonical_url, source.canonical_url, 'discovery_research',
      coalesce(source.independent_fetched_at, now())
    ) on conflict (url, retrieved_at) do update set
      canonical_url = excluded.canonical_url,
      source_type = excluded.source_type;
    select public.sources.id into source_id
    from public.sources
    where public.sources.url = source.canonical_url
      and public.sources.retrieved_at = coalesce(source.independent_fetched_at, now())
    order by public.sources.created_at desc
    limit 1;
    insert into public.discovery_attribution_evidence (
      attribution_id, source_id, stance, source_role, source_locator,
      review_status, reviewed_at
    ) values (
      attribution_id, source_id, source.stance, source.source_role,
      source.locator, evidence_review_status, evidence_reviewed_at
    );
    if p_publish then
      update private.discovery_research_candidate_sources
      set review_status = 'accepted'
      where id = source.id;
    end if;
  end loop;

  if p_publish then
    insert into public.discovery_image_rights (
      attribution_id, image_state, asset_url, rights_basis, rights_holder,
      licence_name, licence_url, credit_line, expires_at, reviewed_at,
      editorial_note
    ) values (
      attribution_id, rights->>'imageState', nullif(rights->>'assetUrl', ''),
      nullif(rights->>'rightsBasis', ''), nullif(rights->>'rightsHolder', ''),
      nullif(rights->>'licenceName', ''), nullif(rights->>'licenceUrl', ''),
      nullif(rights->>'creditLine', ''), nullif(rights->>'expiresAt', '')::timestamptz,
      (rights->>'reviewedAt')::timestamptz, nullif(rights->>'editorialNote', '')
    );
    update public.discovery_attributions
    set review_status = canonical_review_status, published_at = now(), updated_at = now()
    where id = attribution_id;
  end if;

  update private.discovery_research_candidates
  set review_status = 'accepted', reviewed_at = now(),
      reviewer_note = nullif(btrim(p_reviewer_note), ''),
      canonical_attribution_id = attribution_id, updated_at = now()
  where id = candidate.id;
  update private.discovery_research_topics
  set status = 'matched', updated_at = now()
  where id = topic.id;
  return jsonb_build_object(
    'status', canonical_review_status,
    'attributionId', attribution_id,
    'published', p_publish,
    'referenceVariantId', p_reference_variant_id
  );
end;
$$;

revoke all on function public.list_discovery_candidate_sources_v1(bigint)
  from public, anon, authenticated;
revoke all on function public.record_discovery_candidate_source_fetch_v1(
  bigint, bigint, text, timestamptz, text, text
) from public, anon, authenticated;
revoke all on function public.review_discovery_candidate_v1(
  bigint, text, boolean, text, uuid, jsonb
) from public, anon, authenticated;
grant execute on function public.list_discovery_candidate_sources_v1(bigint)
  to service_role;
grant execute on function public.record_discovery_candidate_source_fetch_v1(
  bigint, bigint, text, timestamptz, text, text
) to service_role;
grant execute on function public.review_discovery_candidate_v1(
  bigint, text, boolean, text, uuid, jsonb
) to service_role;
