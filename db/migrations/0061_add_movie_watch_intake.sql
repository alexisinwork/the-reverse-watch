-- Raw owner-supplied movie/watch intake. These claims are intentionally private
-- and unreviewed; this table cannot publish discovery attributions or catalogue
-- variants without the existing independent-source review gates.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.movie_watch_intake (
  id bigint generated always as identity primary key,
  source_row integer not null check (source_row > 0),
  source_line integer not null check (source_line > 0),
  source_hash text not null unique check (source_hash ~ '^[a-f0-9]{64}$'),
  title_display text not null check (char_length(title_display) between 1 and 300),
  title_original text check (title_original is null or char_length(title_original) between 1 and 300),
  year_start integer check (year_start is null or year_start between 1888 and 2100),
  year_end integer check (year_end is null or year_end between 1888 and 2100),
  subject_raw text not null check (char_length(subject_raw) between 1 and 2000),
  watch_raw text not null check (char_length(watch_raw) between 1 and 2000),
  watch_candidates jsonb not null check (jsonb_typeof(watch_candidates) = 'array'),
  context_raw text not null check (char_length(context_raw) between 1 and 2000),
  affordable_alternative_raw text not null check (char_length(affordable_alternative_raw) between 1 and 2000),
  review_status text not null default 'unreviewed' check (review_status = 'unreviewed'),
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table private.movie_watch_intake enable row level security;

create index movie_watch_intake_title_idx
  on private.movie_watch_intake (title_display, year_start);

create or replace function public.import_movie_watch_intake_v1(p_rows jsonb)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  inserted_count integer := 0;
  item jsonb;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 250 then
    raise exception 'Movie/watch intake batch must contain 1 to 250 rows.';
  end if;
  for item in select value from jsonb_array_elements(p_rows) loop
    insert into private.movie_watch_intake (
      source_row, source_line, source_hash, title_display, title_original,
      year_start, year_end, subject_raw, watch_raw, watch_candidates,
      context_raw, affordable_alternative_raw, review_status
    ) values (
      (item->>'sourceRow')::integer, (item->>'sourceLine')::integer,
      item->>'sourceHash', item->>'titleDisplay', item->>'titleOriginal',
      (item->>'yearStart')::integer, (item->>'yearEnd')::integer,
      item->>'subjectRaw', item->>'watchRaw', item->'watchCandidates',
      item->>'contextRaw', item->>'affordableAlternativeRaw', 'unreviewed'
    ) on conflict (source_hash) do update set
      source_row = excluded.source_row,
      source_line = excluded.source_line,
      title_display = excluded.title_display,
      title_original = excluded.title_original,
      year_start = excluded.year_start,
      year_end = excluded.year_end,
      subject_raw = excluded.subject_raw,
      watch_raw = excluded.watch_raw,
      watch_candidates = excluded.watch_candidates,
      context_raw = excluded.context_raw,
      affordable_alternative_raw = excluded.affordable_alternative_raw,
      updated_at = now();
    inserted_count := inserted_count + 1;
  end loop;
  return inserted_count;
end;
$$;

revoke all on function public.import_movie_watch_intake_v1(jsonb) from public, anon, authenticated;
grant execute on function public.import_movie_watch_intake_v1(jsonb) to service_role;
