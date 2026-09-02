-- Canonical support for accepted discovery search and ranking.
-- This is deliberately additive: it neither changes recommendation catalogue
-- facts nor grants browser roles raw access to editorial discovery records.

create table public.discovery_entity_aliases (
  id bigint generated always as identity primary key,
  entity_id bigint not null references public.discovery_entities(id),
  display_alias text not null check (length(btrim(display_alias)) > 0),
  normalized_alias text not null check (
    normalized_alias = lower(btrim(normalized_alias))
    and length(normalized_alias) > 0
  ),
  locale text not null default 'und' check (
    locale ~ '^[a-z]{2,3}(?:-[A-Z]{2})?$'
  ),
  review_status text not null default 'draft' check (
    review_status in ('draft', 'in_review', 'accepted', 'rejected')
  ),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_id, normalized_alias, locale),
  check (
    (review_status in ('accepted', 'rejected')) = (reviewed_at is not null)
  )
);

create index discovery_entity_aliases_entity_id_idx
  on public.discovery_entity_aliases (entity_id, review_status);
create index discovery_entity_aliases_accepted_search_idx
  on public.discovery_entity_aliases (normalized_alias)
  where review_status = 'accepted';

create table public.discovery_work_aliases (
  id bigint generated always as identity primary key,
  work_id bigint not null references public.discovery_works(id),
  display_alias text not null check (length(btrim(display_alias)) > 0),
  normalized_alias text not null check (
    normalized_alias = lower(btrim(normalized_alias))
    and length(normalized_alias) > 0
  ),
  locale text not null default 'und' check (
    locale ~ '^[a-z]{2,3}(?:-[A-Z]{2})?$'
  ),
  review_status text not null default 'draft' check (
    review_status in ('draft', 'in_review', 'accepted', 'rejected')
  ),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (work_id, normalized_alias, locale),
  check (
    (review_status in ('accepted', 'rejected')) = (reviewed_at is not null)
  )
);

create index discovery_work_aliases_work_id_idx
  on public.discovery_work_aliases (work_id, review_status);
create index discovery_work_aliases_accepted_search_idx
  on public.discovery_work_aliases (normalized_alias)
  where review_status = 'accepted';

create table public.discovery_cast_credits (
  id bigint generated always as identity primary key,
  public_figure_entity_id bigint not null references public.discovery_entities(id),
  fictional_character_entity_id bigint not null references public.discovery_entities(id),
  work_id bigint not null references public.discovery_works(id),
  review_status text not null default 'draft' check (
    review_status in ('draft', 'in_review', 'accepted', 'rejected')
  ),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (public_figure_entity_id, fictional_character_entity_id, work_id),
  check (public_figure_entity_id <> fictional_character_entity_id),
  check (
    (review_status in ('accepted', 'rejected')) = (reviewed_at is not null)
  )
);

create index discovery_cast_credits_public_figure_idx
  on public.discovery_cast_credits (public_figure_entity_id, review_status);
create index discovery_cast_credits_fictional_character_idx
  on public.discovery_cast_credits (fictional_character_entity_id, review_status);
create index discovery_cast_credits_work_id_idx
  on public.discovery_cast_credits (work_id, review_status);

create or replace function public.enforce_discovery_cast_credit_entity_kinds()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.discovery_entities entity
    where entity.id = new.public_figure_entity_id
      and entity.entity_kind = 'public_figure'
  ) then
    raise exception 'Cast credits require a public-figure entity.';
  end if;

  if not exists (
    select 1
    from public.discovery_entities entity
    where entity.id = new.fictional_character_entity_id
      and entity.entity_kind = 'fictional_character'
  ) then
    raise exception 'Cast credits require a fictional-character entity.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_discovery_cast_credit_entity_kinds()
  from public, anon, authenticated;

create trigger enforce_discovery_cast_credit_entity_kinds_trigger
before insert or update of public_figure_entity_id, fictional_character_entity_id
on public.discovery_cast_credits
for each row execute function public.enforce_discovery_cast_credit_entity_kinds();

create table public.discovery_attribution_traits (
  id bigint generated always as identity primary key,
  attribution_id bigint not null unique references public.discovery_attributions(id),
  social_signal text check (
    social_signal in (
      'discreet_competence',
      'quiet_continuity',
      'unapologetic_benchmark',
      'anti_luxury'
    )
  ),
  aesthetic_dna text check (
    aesthetic_dna in (
      'structural_tool',
      'mid_century_industrial',
      'integrated_geometry',
      'extravagant_creative',
      'high_art'
    )
  ),
  deployment_environment text check (
    deployment_environment in (
      'field_water_abuse',
      'studio_desk_daily',
      'formal_architectural'
    )
  ),
  price_comfort text check (
    price_comfort in (
      'considered_entry',
      'established_collection',
      'exceptional_object'
    )
  ),
  evidence_source_id uuid not null references public.sources(id),
  editorial_note text,
  review_status text not null default 'draft' check (
    review_status in ('draft', 'in_review', 'accepted', 'rejected')
  ),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    social_signal is not null
    or aesthetic_dna is not null
    or deployment_environment is not null
    or price_comfort is not null
  ),
  check (
    (review_status in ('accepted', 'rejected')) = (reviewed_at is not null)
  )
);

create index discovery_attribution_traits_attribution_id_idx
  on public.discovery_attribution_traits (attribution_id);
create index discovery_attribution_traits_evidence_source_id_idx
  on public.discovery_attribution_traits (evidence_source_id);
create index discovery_attribution_traits_accepted_idx
  on public.discovery_attribution_traits (review_status)
  where review_status = 'accepted';

alter table public.discovery_entity_aliases enable row level security;
alter table public.discovery_work_aliases enable row level security;
alter table public.discovery_cast_credits enable row level security;
alter table public.discovery_attribution_traits enable row level security;

revoke all privileges on table
  public.discovery_entity_aliases,
  public.discovery_work_aliases,
  public.discovery_cast_credits,
  public.discovery_attribution_traits
from public, anon, authenticated;

revoke all privileges on sequence
  public.discovery_entity_aliases_id_seq,
  public.discovery_work_aliases_id_seq,
  public.discovery_cast_credits_id_seq,
  public.discovery_attribution_traits_id_seq
from public, anon, authenticated;

comment on table public.discovery_entity_aliases is
  'Reviewed alternate public-figure or fictional-character names for accepted local discovery search.';
comment on table public.discovery_work_aliases is
  'Reviewed alternate or localized work titles for accepted local discovery search.';
comment on table public.discovery_cast_credits is
  'Reviewed public figure, fictional character, and work relations. It never implies watch ownership or screen use.';
comment on table public.discovery_attribution_traits is
  'Reviewed editorial ranking traits for a bounded attribution; never catalogue facts or hard recommendation constraints.';
