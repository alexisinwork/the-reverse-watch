-- A sign-in for the quality evaluation in CI (owner, 2026-11-26: "да"), so
-- the free evaluation (scripts/run-evals.ts) can score the search code on
-- every change without the service key. The role reserve_eval_reader may
-- run only the read-only catalogue and cache functions the evaluation's
-- guard allows (READ_ONLY_RPC in scripts/eval-sets.ts; a test keeps this
-- list and that one equal). All sixteen are stable security-definer
-- functions that return jsonb.
--
-- Checked before writing it (2026-11-26): a new sign-in gets nothing else.
-- PUBLIC can use only the schemas public, pg_catalog and information_schema;
-- no function in public is executable by PUBLIC, and no table or view in a
-- usable schema grants anything to PUBLIC.
--
-- The role is created without a password, so nobody can sign in with it
-- until the owner sets one (scripts/set-eval-reader-password.ts). Its
-- sessions are read-only, short and few, so even a function that tried to
-- write would be refused.
-- Rollback: revoke the grants below and drop role reserve_eval_reader.
do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'reserve_eval_reader') then
    create role reserve_eval_reader with login nosuperuser nocreatedb nocreaterole
      noinherit noreplication nobypassrls connection limit 4;
  end if;
end
$$;

alter role reserve_eval_reader set default_transaction_read_only = on;
alter role reserve_eval_reader set statement_timeout = '30s';
alter role reserve_eval_reader set idle_in_transaction_session_timeout = '60s';

grant usage on schema public to reserve_eval_reader;

grant execute on function public.watch_catalogue_quiz_window_v1(jsonb, numeric, numeric, boolean) to reserve_eval_reader;
grant execute on function public.watch_catalogue_archetype_window_v1(jsonb, text[], text[], text[]) to reserve_eval_reader;
grant execute on function public.watch_catalogue_alternatives_window_v1(jsonb, text[], numeric, numeric, numeric, boolean) to reserve_eval_reader;
grant execute on function public.watch_catalogue_name_index_v1() to reserve_eval_reader;
grant execute on function public.watch_catalogue_rows_by_id_v1(uuid[]) to reserve_eval_reader;
grant execute on function public.watch_catalogue_pool_lookup_v1(text[], jsonb) to reserve_eval_reader;
grant execute on function public.watch_catalogue_pool_identity_keys_v1() to reserve_eval_reader;
grant execute on function public.watch_catalogue_unpriced_candidates_v1(text[], numeric, numeric, text[]) to reserve_eval_reader;
grant execute on function public.watch_catalogue_candidate_lookup_v1(jsonb) to reserve_eval_reader;
grant execute on function public.watch_catalogue_named_v1(text, text) to reserve_eval_reader;
grant execute on function public.watch_catalogue_named_v2(text, text) to reserve_eval_reader;
grant execute on function public.watch_catalogue_name_candidates_v2(text, text[], integer, text[]) to reserve_eval_reader;
grant execute on function public.watch_catalogue_lookup_v1(jsonb) to reserve_eval_reader;
grant execute on function public.ai_watch_search_get_v1(text) to reserve_eval_reader;
grant execute on function public.ai_watch_validated_cache_get_v2(text) to reserve_eval_reader;
grant execute on function public.discovery_published_stories_v1() to reserve_eval_reader;
