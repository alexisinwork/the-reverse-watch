-- D2 import and public-read boundary. The importer is service-role-only and
-- consumes the reviewed local pilot as one PostgreSQL transaction. Browser
-- roles receive only the projection returned by the versioned read RPC.

alter table public.discovery_attributions
  add column public_slug text unique check (
    public_slug is null or public_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  add column headline text check (
    headline is null or length(btrim(headline)) > 0
  ),
  add column summary text check (
    summary is null or length(btrim(summary)) > 0
  );

create unique index discovery_attribution_evidence_import_key_idx
  on public.discovery_attribution_evidence (attribution_id, source_id, (coalesce(source_locator, '')));

create or replace function public.import_discovery_pilot_v1(p_corpus jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  story jsonb;
  evidence jsonb;
  entity_id bigint;
  work_id bigint;
  event_id bigint;
  imported_attribution_id bigint;
  imported_source_id uuid;
  story_count integer;
begin
  if p_corpus is null
    or p_corpus ->> 'version' <> '1'
    or jsonb_typeof(p_corpus -> 'stories') <> 'array' then
    raise exception 'Discovery pilot import requires a version 1 corpus with stories.';
  end if;

  story_count := jsonb_array_length(p_corpus -> 'stories');
  if story_count <> 21 then
    raise exception 'Discovery pilot import requires exactly 21 reviewed stories.';
  end if;

  for story in select value from jsonb_array_elements(p_corpus -> 'stories') loop
    insert into public.discovery_entities (
      entity_kind, slug, display_name, disambiguation, review_status
    ) values (
      story #>> '{entity,entityKind}',
      story #>> '{entity,slug}',
      story #>> '{entity,displayName}',
      nullif(story #>> '{entity,disambiguation}', ''),
      story #>> '{entity,reviewStatus}'
    ) on conflict (slug) do update set
      entity_kind = excluded.entity_kind,
      display_name = excluded.display_name,
      disambiguation = excluded.disambiguation,
      review_status = excluded.review_status,
      updated_at = now()
    returning id into entity_id;

    work_id := null;
    if story -> 'work' is not null and story -> 'work' <> 'null'::jsonb then
      insert into public.discovery_works (
        work_kind, slug, title, release_date, season_number, episode_number,
        review_status
      ) values (
        story #>> '{work,workKind}',
        story #>> '{work,slug}',
        story #>> '{work,title}',
        nullif(story #>> '{work,releaseDate}', '')::date,
        nullif(story #>> '{work,seasonNumber}', '')::integer,
        nullif(story #>> '{work,episodeNumber}', '')::integer,
        story #>> '{work,reviewStatus}'
      ) on conflict (slug) do update set
        work_kind = excluded.work_kind,
        title = excluded.title,
        release_date = excluded.release_date,
        season_number = excluded.season_number,
        episode_number = excluded.episode_number,
        review_status = excluded.review_status,
        updated_at = now()
      returning id into work_id;
    end if;

    event_id := null;
    if story -> 'event' is not null and story -> 'event' <> 'null'::jsonb then
      insert into public.discovery_events (
        event_kind, slug, title, occurred_on, ended_on, location, review_status
      ) values (
        story #>> '{event,eventKind}',
        story #>> '{event,slug}',
        story #>> '{event,title}',
        nullif(story #>> '{event,occurredOn}', '')::date,
        nullif(story #>> '{event,endedOn}', '')::date,
        nullif(story #>> '{event,location}', ''),
        story #>> '{event,reviewStatus}'
      ) on conflict (slug) do update set
        event_kind = excluded.event_kind,
        title = excluded.title,
        occurred_on = excluded.occurred_on,
        ended_on = excluded.ended_on,
        location = excluded.location,
        review_status = excluded.review_status,
        updated_at = now()
      returning id into event_id;
    end if;

    insert into public.discovery_attributions (
      entity_id, work_id, event_id, reference_variant_id, claim_type,
      identification_precision, identified_brand, identified_model_family,
      identified_reference_code, confidence_code, dispute_state, observed_on,
      scene_locator, editorial_note, review_status, published_at, public_slug,
      headline, summary
    ) values (
      entity_id,
      work_id,
      event_id,
      nullif(story #>> '{publication,attribution,referenceVariantId}', '')::uuid,
      story #>> '{publication,attribution,claimType}',
      story #>> '{publication,attribution,identificationPrecision}',
      nullif(story #>> '{publication,attribution,identifiedBrand}', ''),
      nullif(story #>> '{publication,attribution,identifiedModelFamily}', ''),
      nullif(story #>> '{publication,attribution,identifiedReferenceCode}', ''),
      story #>> '{publication,attribution,confidenceCode}',
      story #>> '{publication,attribution,disputeState}',
      nullif(story #>> '{publication,attribution,observedOn}', '')::date,
      nullif(story #>> '{publication,attribution,sceneLocator}', ''),
      nullif(story #>> '{publication,attribution,editorialNote}', ''),
      story #>> '{publication,attribution,reviewStatus}',
      null,
      story ->> 'slug',
      story ->> 'headline',
      story ->> 'summary'
    ) on conflict (public_slug) do update set
      entity_id = excluded.entity_id,
      work_id = excluded.work_id,
      event_id = excluded.event_id,
      reference_variant_id = excluded.reference_variant_id,
      claim_type = excluded.claim_type,
      identification_precision = excluded.identification_precision,
      identified_brand = excluded.identified_brand,
      identified_model_family = excluded.identified_model_family,
      identified_reference_code = excluded.identified_reference_code,
      confidence_code = excluded.confidence_code,
      dispute_state = excluded.dispute_state,
      observed_on = excluded.observed_on,
      scene_locator = excluded.scene_locator,
      editorial_note = excluded.editorial_note,
      review_status = excluded.review_status,
      published_at = null,
      headline = excluded.headline,
      summary = excluded.summary,
      updated_at = now()
    returning id into imported_attribution_id;

    for evidence in select value from jsonb_array_elements(story #> '{publication,evidence}') loop
      insert into public.sources (
        url, title, publisher, source_type, published_at, retrieved_at, archived_url
      ) values (
        evidence #>> '{source,url}',
        nullif(evidence #>> '{source,title}', ''),
        nullif(evidence #>> '{source,publisher}', ''),
        evidence #>> '{source,sourceType}',
        nullif(evidence #>> '{source,publishedAt}', '')::timestamptz,
        (evidence #>> '{source,retrievedAt}')::timestamptz,
        nullif(evidence #>> '{source,archivedUrl}', '')
      ) on conflict (url, retrieved_at) do update set
        title = excluded.title,
        publisher = excluded.publisher,
        source_type = excluded.source_type,
        published_at = excluded.published_at,
        archived_url = excluded.archived_url
      returning id into imported_source_id;

      insert into public.discovery_attribution_evidence (
        attribution_id, source_id, stance, source_role, source_locator, excerpt,
        editorial_note, observed_at, review_status, reviewed_at
      ) values (
        imported_attribution_id,
        imported_source_id,
        evidence ->> 'stance',
        evidence ->> 'sourceRole',
        nullif(evidence ->> 'sourceLocator', ''),
        nullif(evidence ->> 'excerpt', ''),
        nullif(evidence ->> 'editorialNote', ''),
        nullif(evidence ->> 'observedAt', '')::timestamptz,
        evidence ->> 'reviewStatus',
        nullif(evidence ->> 'reviewedAt', '')::timestamptz
      ) on conflict (attribution_id, source_id, (coalesce(source_locator, ''))) do update set
        stance = excluded.stance,
        source_role = excluded.source_role,
        excerpt = excluded.excerpt,
        editorial_note = excluded.editorial_note,
        observed_at = excluded.observed_at,
        review_status = excluded.review_status,
        reviewed_at = excluded.reviewed_at;
    end loop;

    insert into public.discovery_image_rights (
      attribution_id, image_state, asset_url, rights_basis, rights_holder,
      licence_name, licence_url, credit_line, expires_at, reviewed_at, editorial_note
    ) values (
      imported_attribution_id,
      story #>> '{publication,imageRights,imageState}',
      nullif(story #>> '{publication,imageRights,assetUrl}', ''),
      nullif(story #>> '{publication,imageRights,rightsBasis}', ''),
      nullif(story #>> '{publication,imageRights,rightsHolder}', ''),
      nullif(story #>> '{publication,imageRights,licenceName}', ''),
      nullif(story #>> '{publication,imageRights,licenceUrl}', ''),
      nullif(story #>> '{publication,imageRights,creditLine}', ''),
      nullif(story #>> '{publication,imageRights,expiresAt}', '')::timestamptz,
      (story #>> '{publication,imageRights,reviewedAt}')::timestamptz,
      nullif(story #>> '{publication,imageRights,editorialNote}', '')
    ) on conflict (attribution_id) do update set
      image_state = excluded.image_state,
      asset_url = excluded.asset_url,
      rights_basis = excluded.rights_basis,
      rights_holder = excluded.rights_holder,
      licence_name = excluded.licence_name,
      licence_url = excluded.licence_url,
      credit_line = excluded.credit_line,
      expires_at = excluded.expires_at,
      reviewed_at = excluded.reviewed_at,
      editorial_note = excluded.editorial_note;

    update public.discovery_attributions
      set published_at = (story #>> '{publication,attribution,publishedAt}')::timestamptz,
          updated_at = now()
      where id = imported_attribution_id;
  end loop;

  return story_count;
end;
$$;

revoke all on function public.import_discovery_pilot_v1(jsonb)
  from public, anon, authenticated;
grant execute on function public.import_discovery_pilot_v1(jsonb) to service_role;

create or replace function public.discovery_published_stories_v1()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(story order by story ->> 'slug'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'slug', attribution.public_slug,
      'headline', attribution.headline,
      'summary', attribution.summary,
      'entity', jsonb_build_object(
        'kind', entity.entity_kind,
        'slug', entity.slug,
        'name', entity.display_name,
        'disambiguation', entity.disambiguation
      ),
      'work', case when work.id is null then null else jsonb_build_object(
        'slug', work.slug,
        'title', work.title,
        'kind', work.work_kind,
        'releaseDate', work.release_date
      ) end,
      'event', case when event.id is null then null else jsonb_build_object(
        'title', event.title,
        'occurredOn', event.occurred_on,
        'location', event.location
      ) end,
      'attribution', jsonb_build_object(
        'claimType', attribution.claim_type,
        'precision', attribution.identification_precision,
        'brand', attribution.identified_brand,
        'model', attribution.identified_model_family,
        'reference', attribution.identified_reference_code,
        'confidence', attribution.confidence_code,
        'confidenceLabel', case
          when attribution.confidence_code = 'confirmed' then 'Confirmed identification'
          when attribution.confidence_code = 'disputed' then 'Disputed identification'
          when attribution.confidence_code = 'family_only' then 'Model family only'
          else 'Unconfirmed identification'
        end,
        'observedOn', attribution.observed_on,
        'sceneLocator', attribution.scene_locator,
        'note', attribution.editorial_note,
        'publishedAt', attribution.published_at
      ),
      'citations', coalesce((
        select jsonb_agg(jsonb_build_object(
          'url', source.url,
          'title', source.title,
          'publisher', source.publisher,
          'retrievedAt', source.retrieved_at,
          'locator', evidence.source_locator
        ) order by evidence.id)
        from public.discovery_attribution_evidence evidence
        join public.sources source on source.id = evidence.source_id
        where evidence.attribution_id = attribution.id
          and evidence.review_status = 'accepted'
          and evidence.stance = 'supports'
      ), '[]'::jsonb),
      'corrections', coalesce((
        select jsonb_agg(jsonb_build_object(
          'status', correction.correction_status,
          'note', coalesce(correction.public_note, correction.summary)
        ) order by correction.opened_at)
        from public.discovery_corrections correction
        where correction.attribution_id = attribution.id
      ), '[]'::jsonb),
      'imageState', rights.image_state
    ) as story
    from public.discovery_attributions attribution
    join public.discovery_entities entity on entity.id = attribution.entity_id
    left join public.discovery_works work on work.id = attribution.work_id
    left join public.discovery_events event on event.id = attribution.event_id
    join public.discovery_image_rights rights on rights.attribution_id = attribution.id
    where attribution.review_status = 'accepted'
      and attribution.published_at is not null
      and attribution.public_slug is not null
      and attribution.headline is not null
      and attribution.summary is not null
  ) projected;
$$;

revoke all on function public.discovery_published_stories_v1() from public;
grant execute on function public.discovery_published_stories_v1()
  to anon, authenticated, service_role;

comment on function public.import_discovery_pilot_v1(jsonb) is
  'Service-role-only transactional import of the reviewed 21-story local discovery pilot.';
comment on function public.discovery_published_stories_v1() is
  'Narrow public projection of accepted, evidence-gated discovery stories; raw canonical tables remain private.';
