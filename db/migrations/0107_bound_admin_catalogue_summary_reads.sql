-- Count narrow indexed identities instead of scanning wide provenance records.
create index if not exists watch_catalogue_price_change_ids_idx
  on private.watch_catalogue(id) where price_change is not null;
create index if not exists watch_catalogue_awaiting_price_ids_idx
  on private.watch_catalogue(id)
  where import_source is not null and (price_amount is null or price_status='unconfirmed');

create or replace function public.watch_catalogue_admin_page_v1(
  p_filter text default 'all', p_query text default '', p_page integer default 1
) returns jsonb language plpgsql stable security definer set search_path='' set jit=off as $$
declare
  v_counts jsonb;
  v_query text:=lower(left(trim(coalesce(p_query,'')),80));
  v_filter text:=case when p_filter in ('all','pending','approved','rejected','price') then p_filter else 'all' end;
  v_total integer; v_pages integer; v_page integer; v_rows jsonb;
begin
  select jsonb_build_object(
    'all',(select count(*) from private.watch_catalogue),
    'pending',(select count(*) from private.watch_catalogue where review_status='pending'),
    'approved',(select count(*) from private.watch_catalogue where review_status='approved'),
    'rejected',(select count(*) from private.watch_catalogue where review_status='rejected'),
    'price',(select count(*) from private.watch_catalogue where price_change is not null),
    'recommendationPool',(select count(*) from private.watch_catalogue where import_source is null or (price_amount is not null and price_status<>'unconfirmed')),
    'awaitingPrice',(select count(*) from private.watch_catalogue where import_source is not null and (price_amount is null or price_status='unconfirmed'))
  ) into v_counts;
  if v_query='' then
    v_total:=(v_counts->>v_filter)::integer;
  else
    select count(*) into v_total from private.watch_catalogue w
      where (v_filter='all' or w.review_status=v_filter or (v_filter='price' and w.price_change is not null))
        and position(v_query in lower(w.brand||' '||w.model||' '||coalesce(w.reference_code,'')))>0;
  end if;
  v_pages:=greatest(1,ceil(v_total/60.0)::integer);
  v_page:=least(v_pages,greatest(1,coalesce(p_page,1)));
  if v_total=0 then v_rows:='[]'::jsonb;
  else
    select coalesce(jsonb_agg(private.watch_catalogue_json(w) order by w.brand,w.model,w.id),'[]'::jsonb) into v_rows
      from (select * from private.watch_catalogue w
        where (v_filter='all' or w.review_status=v_filter or (v_filter='price' and w.price_change is not null))
          and (v_query='' or position(v_query in lower(w.brand||' '||w.model||' '||coalesce(w.reference_code,'')))>0)
        order by w.brand,w.model,w.id limit 60 offset (v_page-1)*60) w;
  end if;
  return jsonb_build_object('counts',v_counts,'rows',v_rows,'page',v_page,'pages',v_pages,'filteredTotal',v_total);
end;
$$;
revoke all on function public.watch_catalogue_admin_page_v1(text,text,integer) from public,anon,authenticated;
grant execute on function public.watch_catalogue_admin_page_v1(text,text,integer) to service_role;
