-- Use PostgreSQL's built-in UUID entropy rather than an unavailable extension.

do $$
declare
  function_sql text;
begin
  select pg_get_functiondef(
    'public.enqueue_discovery_research_v1(text,text,integer)'::regprocedure
  ) into function_sql;
  function_sql := replace(
    function_sql,
    $token$encode(gen_random_bytes(24), 'hex')$token$,
    $token$replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)$token$
  );
  execute function_sql;
end;
$$;

revoke all on function public.enqueue_discovery_research_v1(text, text, integer)
  from public;
grant execute on function public.enqueue_discovery_research_v1(text, text, integer)
  to anon, authenticated, service_role;
