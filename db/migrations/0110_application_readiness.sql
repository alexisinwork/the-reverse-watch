-- Operations metadata only; no visitor, key or search text is exposed.
create function public.application_readiness_v1()
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'catalogueAvailable',exists(select 1 from private.watch_catalogue
      where review_status<>'rejected' and reference_confirmed and price_amount is not null and price_status<>'unconfirmed'),
    'validationContractReady',(
      select coalesce(bool_and(p.oid is not null
        and has_function_privilege('service_role',p.oid,'execute')
        and not has_function_privilege('anon',p.oid,'execute')
        and not has_function_privilege('authenticated',p.oid,'execute')),false)
      from (values
        ('public.ai_watch_validation_reserve_v5(text,integer)'),
        ('public.ai_watch_validated_cache_get_v2(text)'),
        ('public.ai_watch_validated_cache_publish_v7(uuid,text,jsonb,jsonb)')
      ) expected(signature) left join pg_catalog.pg_proc p on p.oid=pg_catalog.to_regprocedure(expected.signature)
    ),
    'tableAccessProtected',not exists(
      select 1 from information_schema.table_privileges
      where table_schema='private' and grantee in ('anon','authenticated')
    ) and not exists(
      select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
      where n.nspname='private' and c.relkind='r' and not c.relrowsecurity
    ),
    'staleReservations',(select count(*) from private.ai_watch_validation_attempts
      where state='reserved' and created_at<now()-interval '15 minutes'),
    'stalePricesPresent',exists(select 1 from private.watch_catalogue
      where price_checked_at<now()-interval '90 days' and price_amount is not null and review_status<>'rejected'),
    'budget',public.ai_watch_validation_admin_status_v1()
  );
$$;
revoke all on function public.application_readiness_v1() from public,anon,authenticated;
grant execute on function public.application_readiness_v1() to service_role;
