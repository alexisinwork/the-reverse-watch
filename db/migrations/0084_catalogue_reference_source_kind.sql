-- Preserve the distinction between maker/retailer confirmation and a
-- reference verified against a cited third-party watch catalogue.
alter table private.watch_catalogue drop constraint watch_catalogue_source_kind_check;
alter table private.watch_catalogue add constraint watch_catalogue_source_kind_check
  check (source_kind is null or source_kind in ('manufacturer','retailer','catalogue'));
