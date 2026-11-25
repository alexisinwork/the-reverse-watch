-- Faster name lookups (follows 0118; nothing used 0118's functions yet).
--
-- Measured 2026-11-26 (database time): one index condition per search was
-- not enough. "Tudor Black Bay 58" looked up every row holding "black"
-- (8,349 rows, 52 ms in named_v2; 3,140 pool rows, 436 ms in
-- name_candidates_v1). Requiring the three longest words at the index cuts
-- that to about 440 rows; decomposing only names that are not plain ASCII
-- makes each remaining check cheaper. Results are unchanged.
--
-- 1. private.watch_name_fold: an ASCII name is already decomposed, so it is
--    only lowercased (same output for every input); its index is rebuilt.
-- 2. watch_catalogue_named_v2: the three longest words go to the index.
-- 3. watch_catalogue_name_candidates_v2: up to three regular expressions
--    that every candidate contains go to the index (nameCandidateQuery in
--    app/domain/alternatives.server.ts builds them). v1 stays, unused.
--
-- Additive, service-role only, read-only.

create or replace function private.watch_name_fold(value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select translate(
    case when octet_length(value) = length(value) then value else normalize(value, NFD) end,
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'
  );
$$;

reindex index private.watch_catalogue_pool_name_fold_trgm_idx;

create or replace function public.watch_catalogue_named_v2(p_query text, p_reference text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_patterns text[];
begin
  -- A reference, when given, is the only test (as in v1).
  if nullif(p_reference, '') is not null then
    return (
      select coalesce(jsonb_agg(private.watch_catalogue_json(w)
        order by w.reference_confirmed desc, w.updated_at desc, w.id), '[]'::jsonb)
      from (
        select w.* from private.watch_catalogue w
        where w.review_status <> 'rejected'
          and lower(regexp_replace(w.reference_code, '[^a-zA-Z0-9]', '', 'g'))
            = lower(regexp_replace(p_reference, '[^a-zA-Z0-9]', '', 'g'))
        order by w.reference_confirmed desc, w.updated_at desc, w.id
        limit 30
      ) w
    );
  end if;
  if coalesce(length(p_query), 0) not between 3 and 180 then
    return '[]'::jsonb;
  end if;
  -- v1 kept a row when every typed word is a substring of its text. LIKE
  -- with %, _ and \ escaped tests exactly that. The three longest words go
  -- to the trigram index ('%' when fewer were typed); LIKE ALL checks all.
  select array_agg(
           '%' || replace(replace(replace(term, '\', '\\'), '%', '\%'), '_', '\_') || '%'
           order by length(term) desc, term)
    into v_patterns
  from regexp_split_to_table(lower(p_query), '\s+') as term;
  return (
    select coalesce(jsonb_agg(private.watch_catalogue_json(w)
      order by w.reference_confirmed desc, w.updated_at desc, w.id), '[]'::jsonb)
    from (
      select w.* from private.watch_catalogue w
      where w.review_status <> 'rejected'
        and lower(w.brand || ' ' || w.model || ' ' || coalesce(w.reference_code, '')) like coalesce(v_patterns[1], '%')
        and lower(w.brand || ' ' || w.model || ' ' || coalesce(w.reference_code, '')) like coalesce(v_patterns[2], '%')
        and lower(w.brand || ' ' || w.model || ' ' || coalesce(w.reference_code, '')) like coalesce(v_patterns[3], '%')
        and lower(w.brand || ' ' || w.model || ' ' || coalesce(w.reference_code, '')) like all (v_patterns)
      order by w.reference_confirmed desc, w.updated_at desc, w.id
      limit 30
    ) w
  );
end;
$$;

-- p_reference_key: normalizeReference of the typed reference, or ''.
-- p_terms: one regular expression per typed word, its stored spellings
--   joined by | (such as 58|fifty); only [a-z0-9] and |.
-- p_min_hits: how many of p_terms a row must contain (0: no name search).
-- p_required: up to three regular expressions every such row contains, for
--   the index.
create function public.watch_catalogue_name_candidates_v2(
  p_reference_key text,
  p_terms text[],
  p_min_hits integer,
  p_required text[]
)
returns jsonb
language sql
stable
security definer
set search_path = ''
set jit = off
as $$
  with candidate_ids as (
    select w.id
    from private.watch_catalogue w
    where coalesce(p_reference_key, '') <> ''
      and w.review_status <> 'rejected'
      and (w.import_source is null or (w.price_amount is not null and w.price_status <> 'unconfirmed'))
      and private.watch_reference_key(w.reference_code) = p_reference_key
    union
    select w.id
    from private.watch_catalogue w
    cross join lateral (
      select private.watch_name_fold(w.brand || ' ' || w.model || ' ' || coalesce(w.reference_code, '')) as text
      offset 0
    ) folded
    where coalesce(p_min_hits, 0) > 0
      and w.review_status <> 'rejected'
      and (w.import_source is null or (w.price_amount is not null and w.price_status <> 'unconfirmed'))
      and private.watch_name_fold(w.brand || ' ' || w.model || ' ' || coalesce(w.reference_code, '')) ~ coalesce(p_required[1], '')
      and private.watch_name_fold(w.brand || ' ' || w.model || ' ' || coalesce(w.reference_code, '')) ~ coalesce(p_required[2], '')
      and private.watch_name_fold(w.brand || ' ' || w.model || ' ' || coalesce(w.reference_code, '')) ~ coalesce(p_required[3], '')
      and (select count(*) from unnest(p_terms) as term(pattern) where folded.text ~ term.pattern) >= p_min_hits
  )
  select jsonb_build_object(
    'columns', jsonb_build_array(
      'id', 'brand', 'model', 'referenceCode', 'referenceConfirmed',
      'reviewStatus', 'styles', 'caseShape', 'caseDiameterMm', 'movement',
      'waterResistanceM', 'designTraits'
    ),
    'rows', coalesce(jsonb_agg(jsonb_build_array(
      w.id, w.brand, w.model, w.reference_code, w.reference_confirmed,
      w.review_status, to_jsonb(w.styles), w.case_shape, w.case_diameter_mm,
      w.movement, w.water_resistance_m, w.design_traits
    ) order by w.brand, w.model, w.id), '[]'::jsonb)
  )
  from private.watch_catalogue w
  where w.id in (select id from candidate_ids);
$$;

revoke all on function public.watch_catalogue_name_candidates_v2(text, text[], integer, text[]) from public, anon, authenticated;
grant execute on function public.watch_catalogue_name_candidates_v2(text, text[], integer, text[]) to service_role;
