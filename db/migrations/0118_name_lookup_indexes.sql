-- Name lookups for the cheaper-alternative finder, without full scans.
--
-- Measured 2026-11-25 on production (database time, warm): every search ran
-- watch_catalogue_named_v1, 0.3–2.2 s by name (a scan of all 56,719 rows with
-- a subquery per row) and 0.66 s by reference (the reference is the second
-- column of watch_catalogue_exact_reference_idx, so the whole index was read).
-- Every new function instance also downloaded the 25,014-row name index
-- (4.75 MB) from watch_catalogue_name_index_v1. Both now use indexes and give
-- the same results:
--
-- 1. pg_trgm, for indexes that find substrings.
-- 2. watch_catalogue_named_v2: the same rows in the same order as
--    watch_catalogue_named_v1. A trigram index finds the rows holding the
--    longest typed word; every word is then checked as before.
-- 3. watch_catalogue_name_candidates_v1: the pool rows (the filter and order
--    of watch_catalogue_name_index_v1) that resolveNamedWatch could use for
--    one typed name: the same reference, or enough of the typed words. The
--    caller computes the words and the reference key in code
--    (nameCandidateQuery in app/domain/alternatives.server.ts); the exact
--    matching still runs in code on these rows.
--
-- Additive, service-role only, read-only. Proof that the results did not
-- change: scripts/check-name-lookup-equivalence.ts.

create extension if not exists pg_trgm with schema extensions;

-- The text resolveNamedWatch reads, decomposed (NFD) with A–Z lowercased.
-- The code lowercases first and decomposes second; for every Unicode code
-- point both orders leave the same runs of [a-z0-9] (checked in
-- app/domain/alternatives-name-candidates.test.ts and, for this database,
-- in scripts/test-name-lookups.ts), so a word the code finds is always a
-- substring here.
create function private.watch_name_fold(value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select translate(normalize(value, NFD), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz');
$$;

-- normalizeReference in code: lowercase, then keep only [a-z0-9]. Besides
-- A–Z, only U+212A (Kelvin sign) and U+0130 (capital I with dot) lowercase
-- to an ASCII letter in JavaScript.
create function private.watch_reference_key(value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select regexp_replace(
    translate(value, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' || chr(8490) || chr(304), 'abcdefghijklmnopqrstuvwxyzki'),
    '[^a-z0-9]', '', 'g'
  );
$$;

create index watch_catalogue_named_text_trgm_idx
  on private.watch_catalogue
  using gin (lower(brand || ' ' || model || ' ' || coalesce(reference_code, '')) extensions.gin_trgm_ops)
  where review_status <> 'rejected';

create index watch_catalogue_reference_alnum_idx
  on private.watch_catalogue (lower(regexp_replace(reference_code, '[^a-zA-Z0-9]', '', 'g')))
  where review_status <> 'rejected';

create index watch_catalogue_pool_name_fold_trgm_idx
  on private.watch_catalogue
  using gin (private.watch_name_fold(brand || ' ' || model || ' ' || coalesce(reference_code, '')) extensions.gin_trgm_ops)
  where review_status <> 'rejected'
    and (import_source is null or (price_amount is not null and price_status <> 'unconfirmed'));

create index watch_catalogue_pool_reference_key_idx
  on private.watch_catalogue (private.watch_reference_key(reference_code))
  where review_status <> 'rejected'
    and (import_source is null or (price_amount is not null and price_status <> 'unconfirmed'));

create function public.watch_catalogue_named_v2(p_query text, p_reference text default null)
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
  -- with %, _ and \ escaped tests exactly that; the longest word comes first
  -- so the trigram index can find the rows holding it.
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
        and lower(w.brand || ' ' || w.model || ' ' || coalesce(w.reference_code, '')) like v_patterns[1]
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
-- p_prefilter: a regular expression every such row contains, for the index.
create function public.watch_catalogue_name_candidates_v1(
  p_reference_key text,
  p_terms text[],
  p_min_hits integer,
  p_prefilter text
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
      and private.watch_name_fold(w.brand || ' ' || w.model || ' ' || coalesce(w.reference_code, '')) ~ p_prefilter
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

revoke all on function public.watch_catalogue_named_v2(text, text) from public, anon, authenticated;
grant execute on function public.watch_catalogue_named_v2(text, text) to service_role;
revoke all on function public.watch_catalogue_name_candidates_v1(text, text[], integer, text) from public, anon, authenticated;
grant execute on function public.watch_catalogue_name_candidates_v1(text, text[], integer, text) to service_role;
