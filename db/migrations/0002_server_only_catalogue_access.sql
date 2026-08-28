-- The catalogue is server-only until explicit public read policies are designed.
-- This removes PostgREST roles' table access without guessing future RLS rules.

revoke all privileges on table
  public.sources,
  public.brands,
  public.brand_ownership_periods,
  public.brand_service_regions,
  public.collections,
  public.reference_models,
  public.reference_variants,
  public.reference_complications,
  public.price_snapshots,
  public.market_snapshots,
  public.reference_traits,
  public.brand_traits,
  public.editorial_claims,
  public.claim_sources,
  public.field_evidence,
  public.completeness_evaluations,
  public.review_queue
from anon, authenticated;

alter default privileges in schema public
  revoke all privileges on tables from anon, authenticated;

alter default privileges in schema public
  revoke all privileges on sequences from anon, authenticated;

create index claim_sources_source_id_idx
  on public.claim_sources (source_id);

create index field_evidence_source_id_idx
  on public.field_evidence (source_id);

comment on schema public is
  'The Reserve catalogue is accessed by the server database role. Browser roles have no table grants.';
