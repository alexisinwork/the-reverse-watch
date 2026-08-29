-- Preserve honest dimensions for rectangular and other non-round cases.
-- Existing round-watch rows and both read RPCs remain backward compatible;
-- the first accepted non-round expansion must expose these columns in the
-- catalogue and SQL hard-filter RPCs in the same additive migration.

alter table public.reference_variants
  add column if not exists case_width_mm numeric(6, 2)
    check (case_width_mm > 0),
  add column if not exists case_length_mm numeric(6, 2)
    check (case_length_mm > 0);

comment on column public.reference_variants.case_width_mm is
  'Case width excluding the crown for non-round geometry; not a synthetic diameter.';

comment on column public.reference_variants.case_length_mm is
  'Overall top-to-bottom case length; may serve as wearing span only with verified field evidence when lug-to-lug is unavailable.';
