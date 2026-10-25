-- The full JSON aggregate exceeded the statement timeout after intake grew the
-- private master. Keep the same recommendation filter and fetch bounded pages.
create function public.watch_catalogue_recommendation_page_v1(
  p_include_rejected boolean default false,
  p_page integer default 1
)
returns jsonb
language sql
stable
security definer
set search_path = ''
set jit = off
as $$
  select coalesce(jsonb_agg(private.watch_catalogue_json(w) order by w.brand,w.model,w.id), '[]'::jsonb)
  from (
    select * from private.watch_catalogue
    where (p_include_rejected or review_status <> 'rejected')
      and (import_source is null or (price_amount is not null and price_status <> 'unconfirmed'))
    order by brand,model,id
    limit 500 offset (greatest(1,least(coalesce(p_page,1),1000))-1)*500
  ) w;
$$;
revoke all on function public.watch_catalogue_recommendation_page_v1(boolean,integer) from public,anon,authenticated;
grant execute on function public.watch_catalogue_recommendation_page_v1(boolean,integer) to service_role;
