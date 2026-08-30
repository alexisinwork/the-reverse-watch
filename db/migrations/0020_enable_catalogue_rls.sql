-- Public is an exposed Supabase schema even though browser roles have no table
-- grants. Enable RLS as defense in depth and keep the versioned, read-only RPCs
-- as the only browser access path. No direct-table policies are intentional.

alter table public.sources enable row level security;
alter table public.brands enable row level security;
alter table public.brand_ownership_periods enable row level security;
alter table public.brand_service_regions enable row level security;
alter table public.collections enable row level security;
alter table public.reference_models enable row level security;
alter table public.reference_variants enable row level security;
alter table public.reference_complications enable row level security;
alter table public.price_snapshots enable row level security;
alter table public.market_snapshots enable row level security;
alter table public.reference_traits enable row level security;
alter table public.brand_traits enable row level security;
alter table public.editorial_claims enable row level security;
alter table public.claim_sources enable row level security;
alter table public.field_evidence enable row level security;
alter table public.completeness_evaluations enable row level security;
alter table public.review_queue enable row level security;
alter table public.fx_rate_snapshots enable row level security;
alter table public.reference_deployment_profiles enable row level security;
alter table public.reference_ownership_friction_profiles enable row level security;
