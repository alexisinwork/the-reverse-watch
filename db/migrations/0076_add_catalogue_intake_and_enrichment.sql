-- Additive source archive and resumable reference-level enrichment. Source
-- claims never become confirmed recommendation facts just by being imported.
alter table private.watch_catalogue add column import_source text;

create table private.watch_catalogue_intake (
  source text not null,
  snapshot text not null,
  source_record_id text not null,
  watch_id uuid references private.watch_catalogue(id),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  state text not null default 'pending'
    check (state in ('pending','running','enriched','needs_evidence','retry','blocked_identity')),
  priority integer not null default 0,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  enrichment jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (source, snapshot, source_record_id)
);
create index watch_catalogue_intake_watch_idx on private.watch_catalogue_intake(watch_id);
create index watch_catalogue_intake_due_idx
  on private.watch_catalogue_intake(priority desc, next_attempt_at, source_record_id)
  where state in ('pending','retry','running');
alter table private.watch_catalogue_intake enable row level security;
revoke all on private.watch_catalogue_intake from public, anon, authenticated;

create index watch_catalogue_exact_reference_idx on private.watch_catalogue
  (lower(regexp_replace(brand, '[^a-zA-Z0-9]', '', 'g')),
   lower(regexp_replace(reference_code, '[^a-zA-Z0-9]', '', 'g')));

-- Keep the hot recommendation payload bounded: unpriced imported identities
-- are discoverable by lookup, but cannot satisfy any active price constraint.
create or replace function public.watch_catalogue_list_v1(p_include_rejected boolean default false)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(private.watch_catalogue_json(w) order by w.brand,w.model), '[]'::jsonb)
  from private.watch_catalogue w
  where (p_include_rejected or w.review_status <> 'rejected')
    and (w.import_source is null or (w.price_amount is not null and w.price_status <> 'unconfirmed'));
$$;

-- Exact brand/reference pairs only. Never substitute another variant's facts.
create function public.watch_catalogue_lookup_v1(p_keys jsonb)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(private.watch_catalogue_json(w)), '[]'::jsonb)
  from private.watch_catalogue w
  where w.review_status <> 'rejected' and exists (
    select 1 from jsonb_array_elements(p_keys) with ordinality as k(value,n)
    where n <= 100
      and lower(regexp_replace(w.brand,'[^a-zA-Z0-9]','','g')) = lower(regexp_replace(k.value->>'brand','[^a-zA-Z0-9]','','g'))
      and lower(regexp_replace(w.reference_code,'[^a-zA-Z0-9]','','g')) = lower(regexp_replace(k.value->>'referenceCode','[^a-zA-Z0-9]','','g'))
  );
$$;

create function public.watch_catalogue_named_v1(p_query text, p_reference text default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(private.watch_catalogue_json(w)), '[]'::jsonb) from (
    select w.* from private.watch_catalogue w where w.review_status <> 'rejected'
    and (
      (nullif(p_reference,'') is not null and lower(regexp_replace(w.reference_code,'[^a-zA-Z0-9]','','g')) = lower(regexp_replace(p_reference,'[^a-zA-Z0-9]','','g')))
      or (nullif(p_reference,'') is null and length(p_query) between 3 and 180 and not exists (
        select 1 from regexp_split_to_table(lower(p_query), '\s+') as term
        where position(term in lower(w.brand||' '||w.model||' '||coalesce(w.reference_code,''))) = 0
      ))
    ) order by w.reference_confirmed desc, w.updated_at desc, w.id limit 30
  ) w;
$$;

revoke all on function public.watch_catalogue_lookup_v1(jsonb) from public, anon, authenticated;
revoke all on function public.watch_catalogue_named_v1(text,text) from public, anon, authenticated;
grant execute on function public.watch_catalogue_lookup_v1(jsonb) to service_role;
grant execute on function public.watch_catalogue_named_v1(text,text) to service_role;
