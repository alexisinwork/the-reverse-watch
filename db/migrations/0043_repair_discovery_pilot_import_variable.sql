-- Repair the initial D2 importer implementation without changing data.
-- A fresh database receives the corrected 0042 definition; this migration also
-- updates projects that received the original function body.

do $$
declare
  function_sql text;
begin
  select pg_get_functiondef(
    'public.import_discovery_pilot_v1(jsonb)'::regprocedure
  ) into function_sql;

  function_sql := replace(
    function_sql,
    '  attribution_id bigint;',
    '  imported_attribution_id bigint;'
  );
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
    'returning id into attribution_id;',
    'returning id into imported_attribution_id;'
  );
  function_sql := replace(
    function_sql,
    E'        attribution_id,\n        source_id,',
    E'        imported_attribution_id,\n        source_id,'
  );
  function_sql := replace(
    function_sql,
    'where id = attribution_id;',
    'where id = imported_attribution_id;'
  );

  execute function_sql;
end;
$$;

revoke all on function public.import_discovery_pilot_v1(jsonb)
  from public, anon, authenticated;
grant execute on function public.import_discovery_pilot_v1(jsonb) to service_role;
