-- Dated currency conversion is required because the questionnaire accepts
-- multiple currencies while source prices are market-local. Rates are facts,
-- not application constants, and therefore retain source and expiry metadata.

create table public.fx_rate_snapshots (
  id uuid primary key default gen_random_uuid(),
  base_currency char(3) not null,
  quote_currency char(3) not null,
  rate numeric(20, 10) not null check (rate > 0),
  observed_at timestamptz not null,
  stale_after timestamptz not null,
  source_id uuid not null references public.sources(id),
  review_status review_state not null default 'draft',
  created_at timestamptz not null default now(),
  unique (base_currency, quote_currency, observed_at),
  check (stale_after >= observed_at)
);

create index fx_rate_snapshots_current_lookup_idx
  on public.fx_rate_snapshots (base_currency, quote_currency, observed_at desc);

revoke all privileges on table public.fx_rate_snapshots from anon, authenticated;

comment on table public.fx_rate_snapshots is
  'Dated quote-currency units per base-currency unit; never an unsourced runtime constant.';
