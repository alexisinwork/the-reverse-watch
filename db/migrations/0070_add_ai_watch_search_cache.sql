-- Watches found by the Muse Spark -> Perplexity search, stored permanently
-- and reused whenever the same search brief (same answers, same price band)
-- comes in again. No visitor data is stored: the cache key and brief hold
-- only search constraints. Images are never stored, only their URLs.
--
-- Everything is written and read by the server with the service-role key.
-- anon and authenticated get no access: a writable cache would let anyone
-- holding the public key poison what every later visitor is shown.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.ai_watches (
  id uuid primary key default gen_random_uuid(),
  brand text not null check (length(brand) between 1 and 160),
  model text not null check (length(model) between 1 and 200),
  reference_code text
    check (reference_code is null or length(reference_code) between 1 and 120),
  identity_key text generated always as (
    lower(brand) || '|' || lower(model) || '|' || coalesce(lower(reference_code), '')
  ) stored unique,
  source_url text not null check (source_url ~ '^https?://'),
  image_url text check (image_url is null or image_url ~ '^https?://'),
  first_found_at timestamptz not null default now()
);

create table private.ai_watch_searches (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('quiz', 'film', 'find')),
  cache_key text not null unique check (cache_key ~ '^[0-9a-f]{64}$'),
  brief jsonb not null,
  summary text not null,
  created_at timestamptz not null default now()
);

create table private.ai_watch_search_results (
  search_id uuid not null references private.ai_watch_searches (id) on delete cascade,
  rank smallint not null check (rank between 1 and 10),
  watch_id uuid not null references private.ai_watches (id),
  rationale text not null,
  price_note text,
  -- Per-search facts the guardrails checked (price, water resistance,
  -- materials, source type) or, for films, where the watch was worn.
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  primary key (search_id, rank)
);

alter table private.ai_watches enable row level security;
alter table private.ai_watch_searches enable row level security;
alter table private.ai_watch_search_results enable row level security;

create function public.ai_watch_search_get_v1(p_cache_key text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'summary', s.summary,
    'watches', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'brand', w.brand,
          'model', w.model,
          'referenceCode', w.reference_code,
          'sourceUrl', w.source_url,
          'imageUrl', w.image_url,
          'priceNote', r.price_note,
          'rationale', r.rationale,
          'details', r.details
        )
        order by r.rank
      )
      from private.ai_watch_search_results r
      join private.ai_watches w on w.id = r.watch_id
      where r.search_id = s.id
    ), '[]'::jsonb)
  )
  from private.ai_watch_searches s
  where s.cache_key = p_cache_key;
$$;

-- Returns false when an identical search was already stored (two visitors
-- with the same answers searching at once); the first result wins.
create function public.ai_watch_search_store_v1(
  p_kind text,
  p_cache_key text,
  p_brief jsonb,
  p_summary text,
  p_watches jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_search_id uuid;
  v_watch jsonb;
  v_watch_id uuid;
  v_rank smallint := 0;
begin
  if jsonb_typeof(p_watches) <> 'array'
    or jsonb_array_length(p_watches) not between 1 and 10 then
    raise exception 'p_watches must be an array of 1 to 10 watches';
  end if;

  insert into private.ai_watch_searches (kind, cache_key, brief, summary)
  values (p_kind, p_cache_key, p_brief, p_summary)
  on conflict (cache_key) do nothing
  returning id into v_search_id;

  if v_search_id is null then
    return false;
  end if;

  for v_watch in select value from jsonb_array_elements(p_watches) loop
    v_rank := v_rank + 1;

    insert into private.ai_watches (brand, model, reference_code, source_url, image_url)
    values (
      v_watch ->> 'brand',
      v_watch ->> 'model',
      nullif(v_watch ->> 'referenceCode', ''),
      v_watch ->> 'sourceUrl',
      nullif(v_watch ->> 'imageUrl', '')
    )
    on conflict (identity_key) do update
      set image_url = coalesce(private.ai_watches.image_url, excluded.image_url)
    returning id into v_watch_id;

    insert into private.ai_watch_search_results
      (search_id, rank, watch_id, rationale, price_note, details)
    values (
      v_search_id,
      v_rank,
      v_watch_id,
      v_watch ->> 'rationale',
      nullif(v_watch ->> 'priceNote', ''),
      case
        when jsonb_typeof(v_watch -> 'details') = 'object' then v_watch -> 'details'
        else '{}'::jsonb
      end
    );
  end loop;

  return true;
end;
$$;

-- Quiz results now come from the AI search: 'supabase' marks a result
-- served from a stored search, 'ai_search' a fresh live search.
alter table public.quiz_funnel_events
  drop constraint quiz_funnel_events_catalogue_origin_check;
alter table public.quiz_funnel_events
  add constraint quiz_funnel_events_catalogue_origin_check
  check (catalogue_origin in ('supabase', 'bundled_seed', 'ai_search'));

revoke all on function public.ai_watch_search_get_v1(text)
  from public, anon, authenticated;
revoke all on function public.ai_watch_search_store_v1(text, text, jsonb, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.ai_watch_search_get_v1(text) to service_role;
grant execute on function public.ai_watch_search_store_v1(text, text, jsonb, text, jsonb)
  to service_role;
