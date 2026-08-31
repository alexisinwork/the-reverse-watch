-- Trigger functions are not application RPCs. Remove inherited execution even
-- though PostgreSQL permits them to run only through their attached trigger.

revoke all on function public.enforce_discovery_attribution_publication()
from public, anon, authenticated;
