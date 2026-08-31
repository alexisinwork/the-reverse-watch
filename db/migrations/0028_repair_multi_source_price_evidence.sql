-- Preserve every reviewed source attached to a price fact. Earlier expansion
-- renders emitted only the first source that carried `price`, so the public
-- evidence grouping omitted the corroborating exact-offer records below.

insert into public.field_evidence (
  subject_type, subject_id, field_name, value_hash, source_id,
  observed_at, retrieved_at, verified_at, stale_after, tier, reviewer
)
select
  'price_snapshot',
  ps.id,
  'amount_low_minor',
  'bc8d4a4d1e75fc17e84c2ad57c2b12850be6a4541337c1386b59ed9124d11aa1',
  (
    select s.id
    from public.sources s
    where s.url = 'https://www.brew-watches.com/products/metric-titanium.js'
      and s.retrieved_at = '2026-08-30T21:19:27Z'::timestamptz
  ),
  ps.observed_at,
  '2026-08-30T21:19:27Z'::timestamptz,
  '2026-08-30T21:19:27Z'::timestamptz,
  ps.stale_after,
  'verified',
  'catalogue-provenance-repair-v1'
from public.price_snapshots ps
join public.reference_variants rv on rv.id = ps.reference_variant_id
where rv.variant_key = 'brew-metric-titanium-mtrc-titan'
  and ps.kind = 'retail'
  and ps.condition = 'new'
  and ps.currency = 'USD'
  and ps.observed_at = '2026-08-30T21:18:14Z'::timestamptz
on conflict (subject_type, subject_id, field_name, value_hash, source_id)
do update set
  verified_at = excluded.verified_at,
  stale_after = excluded.stale_after,
  tier = 'verified',
  reviewer = excluded.reviewer;

insert into public.field_evidence (
  subject_type, subject_id, field_name, value_hash, source_id,
  observed_at, retrieved_at, verified_at, stale_after, tier, reviewer
)
select
  'price_snapshot',
  ps.id,
  'amount_low_minor',
  '0b31c0155c83c5fdbff532bfe3e43dfe547938df26dd9092df0eb46bd7900b0c',
  (
    select s.id
    from public.sources s
    where s.url = 'https://www.outlandusa.com/p/bertucci-mens-a-2t-original-classics-black-black-nylon'
      and s.retrieved_at = '2026-08-30T22:04:38Z'::timestamptz
  ),
  ps.observed_at,
  '2026-08-30T22:04:38Z'::timestamptz,
  '2026-08-30T22:04:38Z'::timestamptz,
  ps.stale_after,
  'verified',
  'catalogue-provenance-repair-v1'
from public.price_snapshots ps
join public.reference_variants rv on rv.id = ps.reference_variant_id
where rv.variant_key = 'bertucci-a2t-original-classic-12022'
  and ps.kind = 'grey_market_ask'
  and ps.condition = 'new'
  and ps.currency = 'USD'
  and ps.observed_at = '2026-08-30T22:02:41Z'::timestamptz
on conflict (subject_type, subject_id, field_name, value_hash, source_id)
do update set
  verified_at = excluded.verified_at,
  stale_after = excluded.stale_after,
  tier = 'verified',
  reviewer = excluded.reviewer;
