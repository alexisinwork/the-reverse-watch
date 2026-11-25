-- A cheaper name fold (follows 0119; the app starts using these lookups in
-- the release that ships with this migration).
--
-- Measured 2026-11-26 (database time per call, 20,000 calls): the 0119 fold
-- took 12.6 µs (translate() about 7 µs, the function's SET search_path
-- about 6 µs, which also stops PostgreSQL from inlining it); lower() takes
-- 1.3 µs. A one-word search such as "Omega" checks about 2,000 rows four
-- times each, so it took about 0.5 s.
--
-- The new body gives the same output for every input: after NFD, A–Z are the
-- only characters lower() turns into ASCII letters (U+212A and U+0130 are
-- already decomposed to K and I), and this database's ctype is en_US.UTF-8,
-- where lower() maps I to i. scripts/test-name-lookups.ts checks every code
-- point and all of ASCII against the code; rerun it after any change of
-- database locale.
--
-- No SET search_path, so PostgreSQL can inline it: every name is qualified
-- with pg_catalog, which PostgreSQL searches first anyway. (The Supabase
-- advisor may list it as "function_search_path_mutable"; that is expected.)

create or replace function private.watch_name_fold(value text)
returns text
language sql
immutable
parallel safe
as $$
  select pg_catalog.lower(
    case
      when pg_catalog.octet_length(value) operator(pg_catalog.=) pg_catalog.length(value) then value
      else pg_catalog.normalize(value, 'NFD')
    end
  );
$$;

reindex index private.watch_catalogue_pool_name_fold_trgm_idx;
