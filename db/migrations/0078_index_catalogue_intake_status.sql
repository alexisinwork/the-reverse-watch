-- Refresh statistics after bulk intake and keep administrative counts cheap.
create index watch_catalogue_intake_state_idx on private.watch_catalogue_intake(state);
create index watch_catalogue_import_source_idx on private.watch_catalogue(import_source);
alter function public.watch_catalogue_intake_status_v1() set jit = off;
analyze private.watch_catalogue;
analyze private.watch_catalogue_intake;
