-- Preserve the structured provider claim summary for the editorial promotion
-- note. Existing candidates remain valid with a null summary.

alter table private.discovery_research_candidates
  add column claim_summary text check (char_length(claim_summary) <= 1000);
