-- Phase 8 discovery evidence foundation.
-- Contextual public-figure and screen claims never promote catalogue facts.

create table public.discovery_entities (
  id bigint generated always as identity primary key,
  entity_kind text not null check (
    entity_kind in ('public_figure', 'fictional_character')
  ),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  display_name text not null check (length(btrim(display_name)) > 0),
  disambiguation text,
  review_status text not null default 'draft' check (
    review_status in ('draft', 'in_review', 'accepted', 'rejected')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.discovery_works (
  id bigint generated always as identity primary key,
  parent_work_id bigint references public.discovery_works(id),
  work_kind text not null check (
    work_kind in (
      'film',
      'television_series',
      'television_episode',
      'documentary',
      'music_video',
      'other'
    )
  ),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (length(btrim(title)) > 0),
  release_date date,
  season_number integer check (season_number > 0),
  episode_number integer check (episode_number > 0),
  review_status text not null default 'draft' check (
    review_status in ('draft', 'in_review', 'accepted', 'rejected')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_work_id is null or parent_work_id <> id),
  check (
    work_kind = 'television_episode'
    or (season_number is null and episode_number is null)
  )
);

create index discovery_works_parent_work_id_idx
  on public.discovery_works (parent_work_id);

create table public.discovery_events (
  id bigint generated always as identity primary key,
  event_kind text not null check (
    event_kind in (
      'premiere',
      'award_ceremony',
      'interview',
      'sporting_event',
      'public_appearance',
      'other'
    )
  ),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (length(btrim(title)) > 0),
  occurred_on date,
  ended_on date,
  location text,
  review_status text not null default 'draft' check (
    review_status in ('draft', 'in_review', 'accepted', 'rejected')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_on is null or occurred_on is null or ended_on >= occurred_on)
);

create table public.discovery_attributions (
  id bigint generated always as identity primary key,
  entity_id bigint not null references public.discovery_entities(id),
  work_id bigint references public.discovery_works(id),
  event_id bigint references public.discovery_events(id),
  reference_variant_id uuid references public.reference_variants(id),
  claim_type text not null check (
    claim_type in (
      'owned',
      'worn_publicly',
      'screen_worn',
      'reported',
      'unconfirmed'
    )
  ),
  identification_precision text not null check (
    identification_precision in (
      'exact_reference',
      'model_family',
      'brand_only',
      'unidentified'
    )
  ),
  identified_brand text,
  identified_model_family text,
  identified_reference_code text,
  confidence_code text not null check (
    confidence_code in ('confirmed', 'disputed', 'family_only', 'unconfirmed')
  ),
  dispute_state text not null default 'clear' check (
    dispute_state in ('clear', 'disputed', 'corrected', 'withdrawn')
  ),
  observed_on date,
  scene_locator text,
  editorial_note text,
  review_status text not null default 'draft' check (
    review_status in ('draft', 'in_review', 'accepted', 'rejected', 'withdrawn')
  ),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (work_id is null or event_id is null),
  check (claim_type <> 'screen_worn' or (work_id is not null and event_id is null)),
  check (reference_variant_id is null or identification_precision = 'exact_reference'),
  check (
    identification_precision <> 'exact_reference'
    or reference_variant_id is not null
    or identified_reference_code is not null
  ),
  check (
    identification_precision <> 'model_family'
    or (identified_brand is not null and identified_model_family is not null)
  ),
  check (
    identification_precision <> 'brand_only'
    or (
      identified_brand is not null
      and identified_model_family is null
      and identified_reference_code is null
    )
  ),
  check (
    identification_precision <> 'unidentified'
    or (
      reference_variant_id is null
      and identified_brand is null
      and identified_model_family is null
      and identified_reference_code is null
    )
  ),
  check (
    confidence_code <> 'confirmed'
    or (identification_precision = 'exact_reference' and claim_type <> 'unconfirmed')
  ),
  check (
    confidence_code <> 'family_only'
    or identification_precision in ('model_family', 'brand_only')
  ),
  check (claim_type <> 'unconfirmed' or confidence_code = 'unconfirmed'),
  check (confidence_code <> 'disputed' or dispute_state = 'disputed'),
  check (published_at is null or review_status = 'accepted')
);

create index discovery_attributions_entity_id_idx
  on public.discovery_attributions (entity_id);
create index discovery_attributions_work_id_idx
  on public.discovery_attributions (work_id)
  where work_id is not null;
create index discovery_attributions_event_id_idx
  on public.discovery_attributions (event_id)
  where event_id is not null;
create index discovery_attributions_reference_variant_id_idx
  on public.discovery_attributions (reference_variant_id)
  where reference_variant_id is not null;
create index discovery_attributions_published_idx
  on public.discovery_attributions (confidence_code, published_at desc)
  where review_status = 'accepted' and published_at is not null;

create table public.discovery_attribution_evidence (
  id bigint generated always as identity primary key,
  attribution_id bigint not null references public.discovery_attributions(id),
  source_id uuid not null references public.sources(id),
  stance text not null check (stance in ('supports', 'contradicts', 'context')),
  source_role text not null check (
    source_role in (
      'official_production_record',
      'direct_interview',
      'primary_visual',
      'contemporaneous_reporting',
      'specialist_corroboration',
      'other'
    )
  ),
  source_locator text,
  excerpt text,
  editorial_note text,
  observed_at timestamptz,
  review_status text not null default 'pending' check (
    review_status in ('pending', 'accepted', 'rejected')
  ),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (review_status = 'pending' or reviewed_at is not null)
);

create index discovery_attribution_evidence_attribution_id_idx
  on public.discovery_attribution_evidence (attribution_id, review_status, stance);
create index discovery_attribution_evidence_source_id_idx
  on public.discovery_attribution_evidence (source_id);

create table public.discovery_image_rights (
  id bigint generated always as identity primary key,
  attribution_id bigint not null unique references public.discovery_attributions(id),
  image_state text not null check (
    image_state in (
      'no_image_stored',
      'licensed_asset',
      'owned_asset',
      'public_domain_asset',
      'external_embed_cleared'
    )
  ),
  asset_url text,
  rights_basis text,
  rights_holder text,
  licence_name text,
  licence_url text,
  credit_line text,
  expires_at timestamptz,
  reviewed_at timestamptz not null,
  editorial_note text,
  created_at timestamptz not null default now(),
  check (
    (image_state = 'no_image_stored' and asset_url is null)
    or (
      image_state <> 'no_image_stored'
      and asset_url is not null
      and rights_basis is not null
    )
  )
);

create table public.discovery_corrections (
  id bigint generated always as identity primary key,
  attribution_id bigint not null references public.discovery_attributions(id),
  source_id uuid references public.sources(id),
  correction_status text not null default 'open' check (
    correction_status in ('open', 'resolved', 'dismissed')
  ),
  summary text not null check (length(btrim(summary)) > 0),
  public_note text,
  resolution_note text,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (correction_status = 'open' and resolved_at is null)
    or (correction_status <> 'open' and resolved_at is not null)
  )
);

create index discovery_corrections_attribution_status_idx
  on public.discovery_corrections (attribution_id, correction_status, opened_at desc);
create index discovery_corrections_source_id_idx
  on public.discovery_corrections (source_id)
  where source_id is not null;

create or replace function public.enforce_discovery_attribution_publication()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.published_at is null then
    return new;
  end if;

  if new.review_status <> 'accepted' then
    raise exception 'Published discovery attributions must be accepted.';
  end if;

  if not exists (
    select 1
    from public.discovery_attribution_evidence evidence
    where evidence.attribution_id = new.id
      and evidence.review_status = 'accepted'
      and evidence.stance = 'supports'
  ) then
    raise exception 'Published discovery attributions require accepted supporting evidence.';
  end if;

  if not exists (
    select 1
    from public.discovery_image_rights rights
    where rights.attribution_id = new.id
  ) then
    raise exception 'Published discovery attributions require an image-rights decision.';
  end if;

  if new.confidence_code = 'confirmed' and (
    new.identification_precision <> 'exact_reference'
    or (new.reference_variant_id is null and new.identified_reference_code is null)
  ) then
    raise exception 'Confirmed discovery attributions require an exact reference.';
  end if;

  if new.confidence_code = 'disputed' and not exists (
    select 1
    from public.discovery_corrections correction
    where correction.attribution_id = new.id
      and correction.correction_status = 'open'
  ) then
    raise exception 'Disputed discovery attributions require an open correction record.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_discovery_attribution_publication() from public;

create trigger enforce_discovery_attribution_publication_trigger
before insert or update of review_status, published_at, confidence_code,
  identification_precision, reference_variant_id, identified_reference_code
on public.discovery_attributions
for each row execute function public.enforce_discovery_attribution_publication();

alter table public.discovery_entities enable row level security;
alter table public.discovery_works enable row level security;
alter table public.discovery_events enable row level security;
alter table public.discovery_attributions enable row level security;
alter table public.discovery_attribution_evidence enable row level security;
alter table public.discovery_image_rights enable row level security;
alter table public.discovery_corrections enable row level security;

revoke all privileges on table
  public.discovery_entities,
  public.discovery_works,
  public.discovery_events,
  public.discovery_attributions,
  public.discovery_attribution_evidence,
  public.discovery_image_rights,
  public.discovery_corrections
from public, anon, authenticated;

revoke all privileges on sequence
  public.discovery_entities_id_seq,
  public.discovery_works_id_seq,
  public.discovery_events_id_seq,
  public.discovery_attributions_id_seq,
  public.discovery_attribution_evidence_id_seq,
  public.discovery_image_rights_id_seq,
  public.discovery_corrections_id_seq
from public, anon, authenticated;

comment on table public.discovery_attributions is
  'Contextual public-figure and screen claims. Never promotes catalogue facts or recommendation eligibility.';
comment on column public.discovery_attributions.reference_variant_id is
  'Optional link to an already reviewed exact catalogue variant; never a path for accepting a new variant.';
comment on table public.discovery_attribution_evidence is
  'Claim-level provenance linked to the canonical source registry.';
comment on table public.discovery_image_rights is
  'Required publication decision recording cleared image use or that no image is stored.';
