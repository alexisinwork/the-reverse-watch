-- Apply the second harmless variable-name repair to already migrated projects.

do $$
declare
  function_sql text;
begin
  select pg_get_functiondef(
    'public.import_discovery_pilot_v1(jsonb)'::regprocedure
  ) into function_sql;

  function_sql := replace(
    function_sql,
    '  source_id uuid;',
    '  imported_source_id uuid;'
  );
  function_sql := replace(
    function_sql,
    'returning id into source_id;',
    'returning id into imported_source_id;'
  );
  function_sql := replace(
    function_sql,
    E'        imported_attribution_id,\n        source_id,',
    E'        imported_attribution_id,\n        imported_source_id,'
  );
  function_sql := replace(
    function_sql,
    E'    ) values (\n      attribution_id,\n      story #>> ''{publication,imageRights,imageState}'',',
    E'    ) values (\n      imported_attribution_id,\n      story #>> ''{publication,imageRights,imageState}'','
  );

  execute function_sql;
end;
$$;

revoke all on function public.import_discovery_pilot_v1(jsonb)
  from public, anon, authenticated;
grant execute on function public.import_discovery_pilot_v1(jsonb) to service_role;
