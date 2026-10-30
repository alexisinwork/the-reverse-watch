-- Bounded server-only reads for labelled, incomplete candidate coverage.
-- No catalogue fact, editorial status, price or checked snapshot is changed.
create function public.watch_catalogue_candidate_lookup_v1(p_keys jsonb)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(private.watch_catalogue_json(w)), '[]'::jsonb)
  from private.watch_catalogue w where exists (
    select 1 from jsonb_array_elements(p_keys) with ordinality as k(value,n)
    where n<=100
      and lower(regexp_replace(w.brand,'[^a-zA-Z0-9]','','g'))=lower(regexp_replace(k.value->>'brand','[^a-zA-Z0-9]','','g'))
      and lower(regexp_replace(w.reference_code,'[^a-zA-Z0-9]','','g'))=lower(regexp_replace(k.value->>'referenceCode','[^a-zA-Z0-9]','','g'))
  );
$$;
revoke all on function public.watch_catalogue_candidate_lookup_v1(jsonb) from public,anon,authenticated;
grant execute on function public.watch_catalogue_candidate_lookup_v1(jsonb) to service_role;

create function public.watch_catalogue_unpriced_candidates_v1(
  p_styles text[],p_min_diameter numeric default null,p_max_diameter numeric default null,
  p_movements text[] default '{}'
) returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(private.watch_catalogue_json(w)), '[]'::jsonb) from (
    select w.* from private.watch_catalogue w
    where w.review_status<>'rejected' and w.source_url is not null
      and w.reference_confirmed and w.reference_code is not null
      and (w.price_amount is null or w.price_status='unconfirmed')
      and w.styles && p_styles
      and (p_min_diameter is null or w.case_diameter_mm>=p_min_diameter)
      and (p_max_diameter is null or w.case_diameter_mm<=p_max_diameter)
      and (coalesce(cardinality(p_movements),0)=0 or w.movement=any(p_movements))
    order by (w.review_status='approved') desc,w.updated_at desc,w.id limit 100
  ) w;
$$;
revoke all on function public.watch_catalogue_unpriced_candidates_v1(text[],numeric,numeric,text[]) from public,anon,authenticated;
grant execute on function public.watch_catalogue_unpriced_candidates_v1(text[],numeric,numeric,text[]) to service_role;
