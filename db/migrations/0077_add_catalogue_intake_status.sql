create function public.watch_catalogue_intake_status_v1()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'records',(select count(*) from private.watch_catalogue_intake),
    'importedIdentities',(select count(*) from private.watch_catalogue where import_source is not null),
    'states',(select coalesce(jsonb_object_agg(state,n),'{}'::jsonb) from (
      select state,count(*) as n from private.watch_catalogue_intake group by state
    ) s)
  );
$$;
revoke all on function public.watch_catalogue_intake_status_v1() from public, anon, authenticated;
grant execute on function public.watch_catalogue_intake_status_v1() to service_role;
