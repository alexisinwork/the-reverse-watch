-- Mirror the budgeted attempt and atomic snapshot into the legacy cache's
-- lifecycle fields. The snapshot remains the only source of valid results.
create function private.ai_watch_validation_attempt_status_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update private.ai_watch_searches set validation_status='validating',
      validation_started_at=now(), validated_at=null, validation_error=null,
      validation_cost_usd=0 where cache_key=new.cache_key;
  elsif old.state='reserved' and new.state='settled' then
    update private.ai_watch_searches set validation_status='failed',
      validated_at=null, validation_error='No validated snapshot was published',
      validation_cost_usd=new.charged_usd where cache_key=new.cache_key;
  end if;
  return new;
end;
$$;

create trigger ai_watch_validation_attempt_status_sync
after insert or update of state on private.ai_watch_validation_attempts
for each row execute function private.ai_watch_validation_attempt_status_sync();

create function private.ai_watch_validation_snapshot_status_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update private.ai_watch_searches set validation_status='valid',
    validated_at=new.validated_at, validation_error=null
    where cache_key=new.cache_key;
  return new;
end;
$$;

create trigger ai_watch_validation_snapshot_status_sync
after insert on private.ai_watch_validated_cache_snapshots
for each row execute function private.ai_watch_validation_snapshot_status_sync();

create function private.ai_watch_validation_overrun_status_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update private.ai_watch_searches s set validation_status='failed',
    validated_at=null, validation_error='Provider cost exceeded reservation'
    from private.ai_watch_validation_attempts a
    where a.id=new.attempt_id and s.cache_key=a.cache_key;
  return new;
end;
$$;

create trigger ai_watch_validation_overrun_status_sync
after insert on private.ai_watch_validation_overruns
for each row execute function private.ai_watch_validation_overrun_status_sync();

revoke all on function private.ai_watch_validation_attempt_status_sync() from public,anon,authenticated;
revoke all on function private.ai_watch_validation_snapshot_status_sync() from public,anon,authenticated;
revoke all on function private.ai_watch_validation_overrun_status_sync() from public,anon,authenticated;
