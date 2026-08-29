# Session handoff

Last updated: 2026-08-29

This is the restart point for the next working session. The controlling
sequence is [`implementation-roadmap.md`](implementation-roadmap.md), which
implements the owner's [`full original plan`](original_context.md) and the
accepted
[`SQL-first architecture`](sql-first-recommendation-architecture.md). Read the
original context from first line to final line before continuing the active
phase.

## Current checkpoint

- Active phase: **Phase 5 — coverage-first catalogue expansion, in progress**.
- Phases 0–4 are complete and verified.
- `/quiz` now returns confirmed, verification-required, relaxation, why-not,
  score-trace, and source sections after the six core screens or optional
  refinement groups.
- Nine additive migrations are applied to Supabase; additive migration `0010`
  is prepared and locally verified but not yet applied because the Supabase MCP
  OAuth refresh expired. Tables remain server-only;
  the application uses two narrow read-only RPCs for accepted facts and SQL
  hard-filter codes. No subscriber, DNS, or destructive database change was
  made.
- Chunking, embeddings, `pgvector`, a separate vector database, Mastra, Ollama,
  and RunPod are outside the launch critical path.

## Accepted 2026-08-28 audit decisions

- Brand is sourced context; a homogeneous reference variant is the filtering
  and ranking unit.
- Price and wrist circumference are canonical numeric values. Display bands are
  derived from one shared TypeScript module.
- Material, size, movement, attachment, or materially different commercial
  behavior splits a variant row.
- Missing facts never satisfy an active hard filter.
- Evidence, verification tier, and staleness attach to each field value.
- The baseline engine is PostgreSQL hard filtering plus explicit versioned
  scoring, diversity quotas, rejection reasons, and visible relaxation prompts.
- Semantic retrieval is an optional later experiment for free text or
  demonstrably nuanced aesthetics only.

## Phase 2 delivered

- `app/domain/questionnaire.ts` contains the shared price/wrist bands, all core
  and refinement enums, Zod schemas, premium calculation, normalization, and
  speculative-candidate gate.
- `/quiz` collects exact budget and wrist values, deployment,
  service/accuracy, weight, complications/date, then optional identity, fit,
  market, operation, geography, condition, cosmetic, and allergy preferences.
- Core and refine submissions are validated on the server. The result is built
  by deterministic recommendation engine v2 from accepted seed facts; missing
  or expired hard facts cannot become confirmed recommendations.
- Draft state recovers from browser `sessionStorage`; access does not require
  email.
- The obsolete root `questionnaire.js` prototype was removed. Its history and
  code sketch remain in git and `original_context.md`.
- The landing page links to the diagnostic without changing the Beehiiv embed.

## Phase 3 delivered

- `db/migrations/0001_reference_variant_catalogue.sql` defines additive
  PostgreSQL types and tables for brands, ownership periods, service regions,
  collections, models, variants, complications, price/market snapshots, traits,
  editorial claims, sources, per-field evidence, completeness, and review.
- Migrations `0001` through `0009` are applied to Supabase project
  `osfqexnzgkksfvaocjvl`; none enables `pgvector`.
- `docs/catalogue-schema.md` maps questionnaire requirements to fields and
  records refresh/null/completeness policy.
- `app/domain/coverage.ts` and `scripts/audit-coverage.ts` enumerate the defined
  pre-collection core matrix and report empty, single-candidate,
  under-diversified, and under-evidenced cells.
- The applied baseline has 11 brands and 12 variants. The reviewed local seed
  now has 12 brands and 13 variants after adding Christopher Ward
  C63-39AGM4-S00W0-B0; migration `0010` carries only that additive row and its
  source, price, availability, evidence, deployment, friction, trait, and
  product-URL records.
- The current local audit reports 212 of 28,800 cells covered (0.74%), all
  single-candidate and under-diversified; 116 are under-evidenced. The applied
  live baseline remains 180 cells until migration `0010` is applied.
- Browser roles have no table grants. The security advisor's only current
  findings are the two intentional anonymous `SECURITY DEFINER` RPC warnings;
  both functions have an empty `search_path`, fixed read-only SQL, and no
  dynamic statements. Performance findings remain unused-index information.

## Phase 4 checkpoint delivered

- `app/domain/recommendation.ts` contains the versioned explicit hard-filter,
  score, tie-break, diversity, verification, why-not, and relaxation policy.
- Candidate-specific premium handling prevents a grey/secondary allowance from
  expanding an authorized-dealer price.
- Price, availability, and cross-currency FX snapshots fail closed after their
  own expiry. Purchase/service geography is not inferred from an unrelated
  market.
- `data/catalogue/seed-catalogue.json` is a strict source-backed runtime
  snapshot. `scripts/render-seed-migration.ts` and
  `scripts/project-seed-coverage.ts` regenerate its database and coverage
  artifacts.
- Provenance and cosmetic preferences are visibly disclosed as unscored until
  reviewed brand/surface data exists.
- `recommendation_catalogue_v1()` returns the accepted relational catalogue in
  the strict Zod runtime shape. `recommendation_hard_filter_v1(profile, as_of)`
  returns the authoritative hard-reject and missing-fact partition.
- The server validates both RPC responses, requires exact variant coverage,
  caches valid catalogue facts for 60 seconds, and visibly falls back as one
  unit to the reviewed bundle plus local predicates.
- `npm run audit:catalogue-parity` proved fact and predicate parity for all 12
  applied baseline variants across six golden profiles. It must be rerun for
  all 13 variants immediately after migration `0010` is applied. PostgreSQL
  owns the live hard-filter partition; TypeScript owns scoring, explanations,
  diversity, and fallback.
- Vercel Production and Preview have the public Supabase URL and publishable
  key. Neither role has table access, and the web request path uses no database
  password.

## Verification evidence

On 2026-08-29 for the Phase 5 continuation:

- `npm run check` passes formatting, lint, strict type/route generation, all 55
  tests across 13 files, and the production build.
- `npm run audit:knowledge` validates 200 dossiers and 951 family rows against
  their source files; `npm run audit:research -- --strict` validates all 201
  manifest brands, 200 knowledge links, 12 accepted seed links, and three review
  artifacts.
- `npm run audit:coverage` still validates all 28,800 cells and the unchanged 12
  accepted variants. No provisional Phase 5 fact entered the catalogue, so the
  last verified live SQL parity remains authoritative for that unchanged set.
- Eight local worker attempts were retained: three succeeded, five failed with
  raw artifact pointers, and the successful provider cost recorded by the job
  ledger totals USD 0.04055. Raw, normalized, and job files remain ignored.
- Commit-candidate data contains only Markdown, CSV, and reviewed JSON/contract
  artifacts; a secret-pattern scan found no credential-like strings.

For the second Phase 5 research batch on the same date:

- Christopher Ward C63-39AGM4-S00W0-B0 passed independent primary-source review
  with complete M1 decision facts and is present in the 13-row local seed.
- Citizen BM8180-03E remains `needs_more_evidence` for graded lume and the
  strap-to-case attachment interface. Official sources resolved E101 accuracy,
  power duration, and a 54 g versus 48 g conflict in favor of the manufacturer.
- Two Sinn attempts failed strict extraction validation and did not advance the
  target. Across the batch, two jobs succeeded and one target exhausted two
  retained failures.
- `npm run audit:research -- --strict` passes with 201 brands, 13 accepted
  links, 18 active targets, and five committed reviews. `npm run audit:coverage`
  reports 212 covered cells (0.74%). The fast gate is locally passing after the
  count fixtures were updated.
- `db/migrations/0010_expand_catalogue_christopher_ward.sql` is a generated,
  replay-safe one-row expansion. A local commit is safe, but do not push it
  until Supabase is reconnected, `0010` is applied, and catalogue/SQL parity
  passes.

On 2026-08-28 for Phases 1–4:

- `npm run check` passes formatting, lint, strict type/route generation, all 41
  tests across nine files, and the production build.
- `npm run audit:coverage` validates all 28,800 cells without capped windows.
- The deferred Playwright suite was updated with the core diagnostic flow but
  was not executed, per the Phase 7 cadence.
- Supabase applied all nine migrations. Live RPC parity, row counts, zero table
  grants for browser roles, and both advisors were checked after the final
  migration.
- Vercel deployment `dpl_FvEFUWbHRQrkGmDFAziEP6F5xP1o` reached `READY`; `/`,
  `/quiz`, `/health`, and a core recommendation POST returned 200. The response
  identified the Supabase facts/SQL-filter path and returned Grand Seiko; no
  recent runtime errors were present.

## Exact continuation

1. Reconnect the Supabase MCP for project `osfqexnzgkksfvaocjvl`, apply
   `0010_expand_catalogue_christopher_ward.sql`, then run live catalogue and
   six-profile SQL parity. Only push after that succeeds so production never
   sees divergent bundled and relational catalogues.
2. Resolve or explicitly retain the first review gaps. Casio G-5600UE-1 needs a
   supported price/FX path, band-interface width, attachment classification,
   and illumination mapping; Cartier WSTA0107 needs rectangular geometry
   support plus M1 sources; Swatch SO28N100 needs exact-reference primary M1
   sources. Do not accept a row merely to make the batch non-empty.
3. Retain Citizen BM8180-03E as research-only until a supported graded lume
   classification and strap attachment are available. Retry Sinn only through
   the strict worker; do not salvage its contradictory raw payloads manually.
4. Convert only M1-complete reviewed candidates into small additive catalogue
   migrations. Keep every knowledge-pack family research-only until it is split
   into homogeneous variants and independently sourced.
5. Rerun coverage, strict catalogue validation, SQL parity, and the fast gate
   after every accepted batch.
6. Continue prioritizing coverage and original-plan purpose over raw brand
   count even though the 200-dossier pack is now fully represented.
7. Keep embeddings, chunking, Mastra, Ollama, and RunPod out of the production
   path until the optional held-out evaluation has a deterministic baseline to
   beat.

## Phase 5 continuation delivered 2026-08-29

- The complete 200-dossier knowledge pack is parsed into a strict research-only
  intake: 200 dossiers, 951 family rows, 248 required variant splits, 169
  dossiers mapped through Q1-Q16, and 1,748 unique cited URLs.
- The manifest now contains 201 brands (the pack plus one existing roadmap
  brand), all 13 reviewed seed links, and 18 active coverage-led targets.
  Knowledge hash/count drift and missing review artifacts fail the strict audit.
- The default worker queue is the same coverage-ranked queue shown by
  `npm run plan:research`; successful fingerprints are reusable, attempts remain
  monotonic across runs, raw failures retain pointers, and rate limiting is
  handled at safe default concurrency one.
- Perplexity Agent requests use the current `POST /v1/agent` preset contract and
  native JSON Schema, followed by strict Zod validation. Extraction remains
  provisional and a successful job moves only to `needs_review`.
- The first live Cartier/Casio/Swatch batch produced three committed review
  decisions, all `needs_more_evidence`. No incomplete variant entered the
  catalogue or PostgreSQL.
- The second batch accepted Christopher Ward C63-39AGM4-S00W0-B0 into the local
  reviewed seed, kept Citizen BM8180-03E research-only, and rejected both Sinn
  responses at the strict extraction boundary. The additive database migration
  is prepared but deliberately unpushed until live parity can be verified.

## Earlier Phase 5 start

- `app/domain/research.ts` defines strict manifest, coverage-intent, job,
  provisional-fact, knowledge-link, and review contracts. Accepted facts cannot
  be emitted by extraction.
- `npm run audit:research` checks manifest, knowledge-intake, accepted-catalogue,
  and review integrity. `npm run plan:research` ranks target hypotheses against
  all core coverage cells.
- `docs/research-pipeline.md` records idempotency, raw artifact retention,
  provisional review, source hierarchy, acceptance gates, and the small-batch
  policy. No semantic infrastructure was added.

## Existing operational notes

- Local `.env` is ignored and real values must not be printed or committed.
- Vercel remains the active host. The historical domain discrepancy between
  repository intent (`thereserve.watch`) and older `thereverse.watch` aliases
  remains a later reversible routing task.
- Supabase project scope previously recorded is `osfqexnzgkksfvaocjvl`; never
  perform destructive removals, truncation, or resets.
