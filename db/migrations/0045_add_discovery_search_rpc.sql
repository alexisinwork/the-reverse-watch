-- D3 accepted-record search. The browser receives only compact disambiguation
-- cards through this RPC, never raw discovery rows or aliases.

create or replace function public.discovery_search_v1(
  p_anchor text,
  p_query text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_query text;
  search_pattern text;
begin
  if p_anchor not in ('work', 'public_figure', 'character') then
    raise exception 'A supported discovery anchor is required.';
  end if;

  normalized_query := lower(regexp_replace(btrim(coalesce(p_query, '')), '\s+', ' ', 'g'));
  if char_length(normalized_query) < 2 or char_length(normalized_query) > 160
    or normalized_query ~ '[[:cntrl:]]' then
    raise exception 'Discovery search must contain 2 to 160 printable characters.';
  end if;

  search_pattern := '%' || replace(replace(replace(
    normalized_query,
    chr(92),
    chr(92) || chr(92)
  ), '%', chr(92) || '%'), '_', chr(92) || '_') || '%';

  return coalesce((
    select jsonb_agg(result order by result ->> 'label', result ->> 'slug')
    from (
      select jsonb_build_object(
        'anchor', 'work',
        'slug', work.slug,
        'label', work.title,
        'descriptor', concat_ws(' · ', extract(year from work.release_date)::text, replace(work.work_kind, '_', ' '))
      ) as result
      from public.discovery_works work
      where p_anchor = 'work'
        and work.review_status = 'accepted'
        and exists (
          select 1 from public.discovery_attributions attribution
          where attribution.work_id = work.id
            and attribution.review_status = 'accepted'
            and attribution.published_at is not null
        )
        and (
          lower(work.title) like search_pattern escape chr(92)
          or exists (
            select 1 from public.discovery_work_aliases alias
            where alias.work_id = work.id
              and alias.review_status = 'accepted'
              and alias.normalized_alias like search_pattern escape chr(92)
          )
        )
      union all
      select jsonb_build_object(
        'anchor', case when entity.entity_kind = 'public_figure' then 'public_figure' else 'character' end,
        'slug', entity.slug,
        'label', entity.display_name,
        'descriptor', case when entity.entity_kind = 'fictional_character' then (
          select concat_ws(' · ', work.title, extract(year from work.release_date)::text)
          from public.discovery_attributions attribution
          join public.discovery_works work on work.id = attribution.work_id
          where attribution.entity_id = entity.id
            and attribution.review_status = 'accepted'
            and attribution.published_at is not null
          order by work.release_date nulls last, work.slug
          limit 1
        ) else entity.disambiguation end
      ) as result
      from public.discovery_entities entity
      where (
          (p_anchor = 'public_figure' and entity.entity_kind = 'public_figure')
          or (p_anchor = 'character' and entity.entity_kind = 'fictional_character')
        )
        and entity.review_status = 'accepted'
        and exists (
          select 1 from public.discovery_attributions attribution
          where attribution.entity_id = entity.id
            and attribution.review_status = 'accepted'
            and attribution.published_at is not null
        )
        and (
          lower(entity.display_name) like search_pattern escape chr(92)
          or exists (
            select 1 from public.discovery_entity_aliases alias
            where alias.entity_id = entity.id
              and alias.review_status = 'accepted'
              and alias.normalized_alias like search_pattern escape chr(92)
          )
        )
      limit 12
    ) candidates
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.discovery_search_v1(text, text) from public;
grant execute on function public.discovery_search_v1(text, text)
  to anon, authenticated, service_role;

comment on function public.discovery_search_v1(text, text) is
  'Bounded accepted-record discovery search with reviewed aliases and compact disambiguation only.';
