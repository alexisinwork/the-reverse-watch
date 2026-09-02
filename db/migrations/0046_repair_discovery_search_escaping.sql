-- Repair D3 pattern escaping on projects that received the original function.

do $$
declare
  function_sql text;
begin
  select pg_get_functiondef(
    'public.discovery_search_v1(text,text)'::regprocedure
  ) into function_sql;

  function_sql := replace(
    function_sql,
    $search$replace(replace(replace(normalized_query, '\\', '\\\\'), '%', '\\%'), '_', '\\_')$search$,
    $search$replace(replace(replace(normalized_query, chr(92), chr(92) || chr(92)), '%', chr(92) || '%'), '_', chr(92) || '_')$search$
  );
  function_sql := replace(
    function_sql,
    $search$escape '\\'$search$,
    $search$escape chr(92)$search$
  );

  execute function_sql;
end;
$$;

revoke all on function public.discovery_search_v1(text, text) from public;
grant execute on function public.discovery_search_v1(text, text)
  to anon, authenticated, service_role;
