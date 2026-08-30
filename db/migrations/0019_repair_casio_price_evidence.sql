-- Repair the verified price evidence omitted by the historical expansion
-- renderer when the first secondary-market snapshot was introduced. The
-- canonical snapshot itself is unchanged; this only links its reviewed source.

insert into public.field_evidence (
  subject_type, subject_id, field_name, value_hash, source_id,
  observed_at, retrieved_at, verified_at, stale_after, tier, reviewer
)
select
  'price_snapshot',
  ps.id,
  'amount_low_minor',
  'ff21b44ef5765a55472fb0ac130dda19f80cd1652fe38970ac60d76f61937932',
  s.id,
  ps.observed_at,
  s.retrieved_at,
  s.retrieved_at,
  ps.stale_after,
  'verified',
  'catalogue-expansion-v1'
from public.reference_variants rv
join public.price_snapshots ps
  on ps.reference_variant_id = rv.id
join public.sources s
  on s.url = 'https://stockx.com/casio-g-shock-g-5600ue-1-digital'
  and s.retrieved_at = '2026-08-29T08:21:08Z'::timestamptz
where rv.variant_key = 'casio-g5600ue-1'
  and ps.kind = 'secondary_ask'
  and ps.condition = 'new'
  and ps.currency = 'USD'
  and ps.observed_at = '2026-08-29T08:21:08Z'::timestamptz
on conflict (subject_type, subject_id, field_name, value_hash, source_id)
do update set
  observed_at = excluded.observed_at,
  retrieved_at = excluded.retrieved_at,
  verified_at = excluded.verified_at,
  stale_after = excluded.stale_after,
  tier = 'verified',
  reviewer = excluded.reviewer;
