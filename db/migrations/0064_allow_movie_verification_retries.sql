-- Failed provider calls are retryable and must return to the queue.
create or replace function public.complete_movie_watch_verification_v1(
  p_source_hash text,
  p_status text,
  p_payload jsonb,
  p_error text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_status not in ('pending', 'needs_review', 'verified', 'rejected') then
    raise exception 'Invalid movie verification status.';
  end if;
  update private.movie_watch_intake
    set verification_status = p_status,
        verification_payload = p_payload,
        verification_error = p_error,
        verified_at = case when p_status = 'pending' then null else now() end,
        updated_at = now()
  where source_hash = p_source_hash;
  return found;
end;
$$;

revoke all on function public.complete_movie_watch_verification_v1(text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.complete_movie_watch_verification_v1(text, text, jsonb, text) to service_role;
