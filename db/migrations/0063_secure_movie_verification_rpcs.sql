-- These wrappers touch the private queue and are callable only by service_role.
-- SECURITY DEFINER is intentionally constrained by an empty search_path and
-- revoked public grants; no browser role can invoke them.

alter function public.claim_movie_watch_verification_v1(integer) security definer;
alter function public.complete_movie_watch_verification_v1(text, text, jsonb, text) security definer;

revoke all on function public.claim_movie_watch_verification_v1(integer) from public, anon, authenticated;
revoke all on function public.complete_movie_watch_verification_v1(text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.claim_movie_watch_verification_v1(integer) to service_role;
grant execute on function public.complete_movie_watch_verification_v1(text, text, jsonb, text) to service_role;
