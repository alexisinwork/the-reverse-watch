-- Sheet-native catalogue vocabulary and reference-variant columns.
-- Additive only: no table is dropped, truncated, or reset, and the v3
-- recommendation RPCs continue to work unchanged.

create table if not exists public.catalogue_vocabulary (
  id bigint generated always as identity primary key,
  kind text not null check (kind in
    ('wearing_scenario', 'complication', 'positioning_group')),
  slug text not null check (slug ~ '^[a-z0-9]+(_[a-z0-9]+)*$'),
  label_en text not null check (char_length(label_en) between 1 and 80),
  source_alias text[] not null default '{}',
  sort_order integer not null default 100 check (sort_order >= 0),
  active boolean not null default true,
  unique (kind, slug)
);

alter table public.catalogue_vocabulary enable row level security;

create index if not exists catalogue_vocabulary_kind_sort_idx
  on public.catalogue_vocabulary (kind, sort_order, slug);

alter table public.reference_variants
  add column if not exists case_shape text
    check (case_shape is null or case_shape in
      ('round', 'tonneau', 'rectangular', 'cushion', 'square', 'oval', 'other')),
  add column if not exists display_caseback boolean,
  add column if not exists movement_construction text
    check (movement_construction is null or movement_construction in
      ('mass_produced', 'manufacture')),
  add column if not exists micro_adjustment_present boolean,
  add column if not exists micro_adjustment_system text,
  add column if not exists micro_adjustment_range_mm numeric
    check (micro_adjustment_range_mm is null or micro_adjustment_range_mm > 0),
  add column if not exists positioning_line text,
  add column if not exists positioning_group text;

create table if not exists public.reference_variant_scenario (
  variant_id uuid not null
    references public.reference_variants (id) on delete cascade,
  vocabulary_id bigint not null
    references public.catalogue_vocabulary (id) on delete restrict,
  primary key (variant_id, vocabulary_id)
);

create table if not exists public.reference_variant_complication (
  variant_id uuid not null
    references public.reference_variants (id) on delete cascade,
  vocabulary_id bigint not null
    references public.catalogue_vocabulary (id) on delete restrict,
  primary key (variant_id, vocabulary_id)
);

alter table public.reference_variant_scenario enable row level security;
alter table public.reference_variant_complication enable row level security;

create index if not exists reference_variant_scenario_vocabulary_idx
  on public.reference_variant_scenario (vocabulary_id);
create index if not exists reference_variant_complication_vocabulary_idx
  on public.reference_variant_complication (vocabulary_id);

create or replace function public.catalogue_vocabulary_v1()
returns table (
  kind text,
  slug text,
  label_en text,
  source_alias text[],
  sort_order integer,
  active boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select kind, slug, label_en, source_alias, sort_order, active
  from public.catalogue_vocabulary
  where active
  order by kind, sort_order, slug;
$$;

revoke all on function public.catalogue_vocabulary_v1() from public;
grant execute on function public.catalogue_vocabulary_v1() to anon, authenticated;

-- Seed rows generated from BUNDLED_VOCABULARY in
-- app/domain/catalogue-vocabulary.ts so the database and the bundled
-- fallback cannot drift.
insert into public.catalogue_vocabulary (kind, slug, label_en, source_alias, sort_order, active)
values
  ('wearing_scenario', 'everyday', 'Everyday', array['повседневно','везде','casual']::text[], 10, true),
  ('wearing_scenario', 'office', 'Office', array['офис']::text[], 20, true),
  ('wearing_scenario', 'business', 'Business', array['бизнес','международный бизнес']::text[], 30, true),
  ('wearing_scenario', 'boardroom', 'Boardroom', array['совет директоров']::text[], 40, true),
  ('wearing_scenario', 'negotiation', 'Negotiation', array['переговоры','переговорные']::text[], 50, true),
  ('wearing_scenario', 'executive', 'Executive', array['представительский']::text[], 60, true),
  ('wearing_scenario', 'smart_casual', 'Smart casual', array['smart casual']::text[], 70, true),
  ('wearing_scenario', 'sport_chic', 'Sport chic', array['спорт-шик']::text[], 80, true),
  ('wearing_scenario', 'suit', 'Suit', array['костюм','строгий костюм']::text[], 90, true),
  ('wearing_scenario', 'black_tie', 'Black tie', array['дресс-код','смокинг']::text[], 100, true),
  ('wearing_scenario', 'evening', 'Evening', array['вечер','вечерний прием','вечерний выход','вечерний раут']::text[], 110, true),
  ('wearing_scenario', 'gala', 'Gala', array['гала']::text[], 120, true),
  ('wearing_scenario', 'reception', 'Reception', array['раут','приемы','официальные приемы','официальные встречи']::text[], 130, true),
  ('wearing_scenario', 'high_society', 'High society', array['высший свет']::text[], 140, true),
  ('wearing_scenario', 'club', 'Club', array['клуб']::text[], 150, true),
  ('wearing_scenario', 'private_club', 'Private club', array['закрытый клуб']::text[], 160, true),
  ('wearing_scenario', 'cocktail', 'Cocktail', array['коктейль']::text[], 170, true),
  ('wearing_scenario', 'theatre', 'Theatre', array['театр']::text[], 180, true),
  ('wearing_scenario', 'status', 'Status', array['статус','топ-статус']::text[], 190, true),
  ('wearing_scenario', 'collection', 'Collection', array['коллекция','музейная коллекция']::text[], 200, true),
  ('wearing_scenario', 'auction', 'Auction', array['аукцион','аукционы']::text[], 210, true),
  ('wearing_scenario', 'art', 'Art', array['арт']::text[], 220, true),
  ('wearing_scenario', 'weekend', 'Weekend', array['уикенд']::text[], 230, true),
  ('wearing_scenario', 'leisure', 'Leisure', array['отдых']::text[], 240, true),
  ('wearing_scenario', 'sport', 'Sport', array['спорт','повседневный спорт']::text[], 250, true),
  ('wearing_scenario', 'motorsport', 'Motorsport', array['автоспорт','гоночный']::text[], 260, true),
  ('wearing_scenario', 'field', 'Field', array['полевые']::text[], 270, true),
  ('wearing_scenario', 'expedition', 'Expedition', array['экспедиции']::text[], 280, true),
  ('wearing_scenario', 'caving', 'Caving', array['спелеология']::text[], 290, true),
  ('wearing_scenario', 'extreme', 'Extreme', array['экстрим']::text[], 300, true),
  ('wearing_scenario', 'diving', 'Diving', array['дайвинг']::text[], 310, true),
  ('wearing_scenario', 'professional_diving', 'Professional diving', array['профессиональный дайвинг']::text[], 320, true),
  ('wearing_scenario', 'deep_sea_diving', 'Deep-sea diving', array['глубоководный дайвинг','экстремальный дайвинг']::text[], 330, true),
  ('wearing_scenario', 'marine_sport', 'Marine sport', array['морской спорт']::text[], 340, true),
  ('wearing_scenario', 'sailing', 'Sailing', array['парусный спорт','парусные гонки']::text[], 350, true),
  ('wearing_scenario', 'regatta', 'Regatta', array['регата']::text[], 360, true),
  ('wearing_scenario', 'yachting', 'Yachting', array['яхтинг','яхта']::text[], 370, true),
  ('wearing_scenario', 'beach', 'Beach', array['пляж']::text[], 380, true),
  ('wearing_scenario', 'resort', 'Resort', array['курорт']::text[], 390, true),
  ('wearing_scenario', 'travel', 'Travel', array['путешествия']::text[], 400, true),
  ('wearing_scenario', 'business_travel', 'Business travel', array['бизнес-тревел','бизнес-авиация']::text[], 410, true),
  ('wearing_scenario', 'flights', 'Flights', array['перелеты']::text[], 420, true),
  ('wearing_scenario', 'aviation', 'Aviation', array['авиация']::text[], 430, true),
  ('wearing_scenario', 'laboratory', 'Laboratory', array['наука','лаборатории']::text[], 440, true),
  ('complication', 'time_only', 'Time only', array['нет (time-only)']::text[], 10, true),
  ('complication', 'date', 'Date', array['дата','мгновенная дата']::text[], 20, true),
  ('complication', 'pointer_date', 'Pointer date', array['стрелочная дата','стрелочный указатель даты','стрелочный календарь']::text[], 30, true),
  ('complication', 'day_of_week', 'Day of week', array['день недели']::text[], 40, true),
  ('complication', 'annual_calendar', 'Annual calendar', array['годовой календарь']::text[], 50, true),
  ('complication', 'moonphase', 'Moon phase', array['фазы луны']::text[], 60, true),
  ('complication', 'small_seconds', 'Small seconds', array['малая секундная стрелка']::text[], 70, true),
  ('complication', 'gmt', 'GMT / second time zone', array['второй пояс gmt','второй пояс','dual time 24h']::text[], 80, true),
  ('complication', 'day_night_indicator', 'Day/night indicator', array['день/ночь']::text[], 90, true),
  ('complication', 'bezel_24h', '24-hour bezel', array['безель 24ч']::text[], 100, true),
  ('complication', 'dive_bezel', 'Dive bezel', array['дайверский безель','дайверский безель 60 мин']::text[], 110, true),
  ('complication', 'sixty_minute_bezel', '60-minute bezel', array['безель 60 мин']::text[], 120, true),
  ('complication', 'chronograph', 'Chronograph', array['хронограф']::text[], 130, true),
  ('complication', 'tachymeter', 'Tachymeter', array['тахиметр']::text[], 140, true),
  ('complication', 'flyback', 'Flyback', array['flyback']::text[], 150, true),
  ('complication', 'regatta_timer', 'Regatta timer', array['программируемый таймер регаты']::text[], 160, true),
  ('complication', 'helium_valve', 'Helium escape valve', array['гелиевый клапан']::text[], 170, true),
  ('complication', 'antimagnetic_shield', 'Antimagnetic shield', array['антимагнитный экран 1000g']::text[], 180, true),
  ('complication', 'ring_command', 'Ring Command bezel', array['ring command']::text[], 190, true),
  ('complication', 'ringlock', 'Ringlock case system', array['ringlock']::text[], 200, true),
  ('complication', 'power_reserve', 'Power reserve', array['запас хода']::text[], 210, true),
  ('complication', 'alarm', 'Alarm', array['будильник']::text[], 220, true),
  ('complication', 'world_time', 'World time', array['мировое время']::text[], 230, true),
  ('complication', 'perpetual_calendar', 'Perpetual calendar', array['вечный календарь']::text[], 240, true),
  ('positioning_group', 'instrument', 'Instrument', array[]::text[], 10, true),
  ('positioning_group', 'quiet_classic', 'Quiet classic', array[]::text[], 20, true),
  ('positioning_group', 'recognised_benchmark', 'Recognised benchmark', array[]::text[], 30, true),
  ('positioning_group', 'bicolour', 'Two-tone', array[]::text[], 40, true),
  ('positioning_group', 'precious_metal', 'Solid precious metal', array[]::text[], 50, true),
  ('positioning_group', 'platinum_ice', 'Platinum / Ice Blue', array[]::text[], 60, true),
  ('positioning_group', 'high_jewellery', 'High jewellery', array[]::text[], 70, true),
  ('positioning_group', 'avant_garde', 'Avant-garde', array[]::text[], 80, true),
  ('positioning_group', 'sport_luxe', 'Sport-luxe', array[]::text[], 90, true),
  ('positioning_group', 'expressive_dial', 'Expressive dial', array[]::text[], 100, true),
  ('positioning_group', 'mechanical_showcase', 'Mechanical showcase', array[]::text[], 110, true)
on conflict (kind, slug) do update set
  label_en = excluded.label_en,
  source_alias = excluded.source_alias,
  sort_order = excluded.sort_order,
  active = excluded.active;
