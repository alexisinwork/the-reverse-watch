-- Before the launch (2026-11-27): Supabase's security advisor lists nine
-- security-definer functions that anyone can run with the publishable key
-- through /rest/v1/rpc. Three are the site's own server reads and stay
-- open: catalogue_vocabulary_v1, discovery_published_stories_v1 and
-- discovery_story_context_v1 (catalogue-vocabulary.server.ts and
-- discovery-store.server.ts call them with the publishable key). The other
-- six belong to the version-4 recommender and the discovery search that
-- were archived with the legacy code (branch archive/legacy-code); nothing
-- on main, in the widgets or in the integrations calls them. One of them
-- returns the whole recommendation catalogue, so anyone could copy it or
-- load the database with it.
--
-- Only the permission changes: the functions and their data stay, and the
-- server role keeps them. Rollback: grant execute on each back to anon (and
-- authenticated where it had it).

revoke execute on function public.recommendation_catalogue_v3() from anon, authenticated;
revoke execute on function public.recommendation_catalogue_v4() from anon, authenticated;
revoke execute on function public.recommendation_hard_filter_v3(jsonb, timestamptz) from anon, authenticated;
revoke execute on function public.recommendation_hard_filter_v4(jsonb, timestamptz) from anon, authenticated;
revoke execute on function public.discovery_search_v1(text, text) from anon, authenticated;
revoke execute on function public.discovery_research_status_v1(text) from anon, authenticated;
