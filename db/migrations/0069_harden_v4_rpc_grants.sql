-- Supabase's default privileges on the public schema re-granted EXECUTE to
-- `authenticated` when the version-4 functions were created. Migration
-- 0009 established the policy for this contract: the deployed application
-- uses the publishable key's anonymous role, and a signed-in user needs no
-- second execution path.

revoke execute on function public.recommendation_catalogue_v4()
  from authenticated;
revoke execute on function public.recommendation_hard_filter_v4(jsonb, timestamptz)
  from authenticated;
revoke execute on function public.catalogue_vocabulary_v1()
  from authenticated;
