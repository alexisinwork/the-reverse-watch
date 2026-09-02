-- Private, resumable Sonar verification state for the owner-supplied intake.
-- Provisional results never publish discovery claims or catalogue variants.

alter table private.movie_watch_intake
  add column verification_status text not null default 'pending'
    check (verification_status in ('pending', 'researching', 'needs_review', 'verified', 'rejected')),
  add column verification_attempts integer not null default 0 check (verification_attempts >= 0),
  add column verification_payload jsonb,
  add column verification_error text,
  add column verified_at timestamptz;

create index movie_watch_intake_verification_queue_idx
  on private.movie_watch_intake (verification_status, id);

create or replace function public.claim_movie_watch_verification_v1(p_limit integer)
returns setof private.movie_watch_intake
language plpgsql
volatile
set search_path = ''
as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 50 then
    raise exception 'Movie verification claim limit must be between 1 and 50.';
  end if;
  return query
    with claimed as (
      select id from private.movie_watch_intake
      where verification_status = 'pending'
      order by id
      for update skip locked
      limit p_limit
    )
    update private.movie_watch_intake intake
      set verification_status = 'researching',
          verification_attempts = intake.verification_attempts + 1,
          updated_at = now()
    from claimed
    where intake.id = claimed.id
    returning intake.*;
end;
$$;

create or replace function public.complete_movie_watch_verification_v1(
  p_source_hash text,
  p_status text,
  p_payload jsonb,
  p_error text default null
)
returns boolean
language plpgsql
volatile
set search_path = ''
as $$
begin
  if p_status not in ('needs_review', 'verified', 'rejected') then
    raise exception 'Invalid movie verification status.';
  end if;
  update private.movie_watch_intake
    set verification_status = p_status,
        verification_payload = p_payload,
        verification_error = p_error,
        verified_at = now(),
        updated_at = now()
  where source_hash = p_source_hash;
  return found;
end;
$$;

revoke all on function public.claim_movie_watch_verification_v1(integer) from public, anon, authenticated;
revoke all on function public.complete_movie_watch_verification_v1(text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.claim_movie_watch_verification_v1(integer) to service_role;
grant execute on function public.complete_movie_watch_verification_v1(text, text, jsonb, text) to service_role;
