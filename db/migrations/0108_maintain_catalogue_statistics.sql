-- Large intake updates previously left index-only reads visiting 35k heap rows
-- until the default 20% autovacuum threshold. Maintain the visibility map and
-- planner statistics more often; this changes no accepted catalogue facts.
alter table private.watch_catalogue set (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);
