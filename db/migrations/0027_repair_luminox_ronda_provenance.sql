-- Preserve the independently retrieved Ronda 515 snapshot used during the
-- Luminox review and repoint only the affected Luminox evidence rows. The
-- earlier snapshot remains valid provenance for previously accepted watches.

insert into public.sources
  (url, canonical_url, title, publisher, source_type, retrieved_at)
values
  (
    'https://www.ronda.ch/en/watch-movement-finder/caliber/515',
    'https://www.ronda.ch/en/watch-movement-finder/caliber/515',
    'Ronda powertech calibre 515 specification',
    'Ronda AG',
    'manufacturer_data_sheet',
    '2026-08-31T05:40:25Z'::timestamptz
  )
on conflict (url, retrieved_at) do update set
  canonical_url = excluded.canonical_url,
  title = excluded.title,
  publisher = excluded.publisher,
  source_type = excluded.source_type;

update public.field_evidence fe
set
  source_id = (
    select s.id
    from public.sources s
    where s.url = 'https://www.ronda.ch/en/watch-movement-finder/caliber/515'
      and s.retrieved_at = '2026-08-31T05:40:25Z'::timestamptz
  ),
  retrieved_at = '2026-08-31T05:40:25Z'::timestamptz,
  verified_at = '2026-08-31T05:40:25Z'::timestamptz,
  reviewer = 'catalogue-expansion-v1',
  review_note = 'Exact Ronda calibre 515 technical record independently revalidated for Luminox XS.0307.WO.'
where fe.subject_type = 'reference_variant'
  and fe.subject_id = (
    select rv.id
    from public.reference_variants rv
    where rv.variant_key = 'luminox-leatherback-xs-0307-wo'
  )
  and fe.source_id = (
    select s.id
    from public.sources s
    where s.url = 'https://www.ronda.ch/en/watch-movement-finder/caliber/515'
      and s.retrieved_at = '2026-08-30T21:42:16Z'::timestamptz
  )
  and fe.field_name in ('movement', 'accuracy', 'dateStatus');
