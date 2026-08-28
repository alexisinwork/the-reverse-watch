# Session handoff

Last updated: 2026-08-28

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
- Nine additive migrations are applied to Supabase. Tables remain server-only;
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
- The reviewed seed has 11 brands, 12 variants, 17 sources, 12 prices, 7
  availability snapshots, 236 evidence rows, 5 FX rows, 25 deployment profiles,
  and 12 ownership-friction profiles.
- The current audit reports 180 of 28,800 cells covered (0.63%), all
  single-candidate and under-diversified; 116 are under-evidenced.
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
- `npm run audit:catalogue-parity` proves fact and predicate parity for all 12
  variants across six golden profiles. PostgreSQL owns the live hard-filter
  partition; TypeScript owns scoring, explanations, diversity, and fallback.
- Vercel Production and Preview have the public Supabase URL and publishable
  key. Neither role has table access, and the web request path uses no database
  password.

## Verification evidence

On 2026-08-28:

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

1. Build the Phase 5 brand/reference manifest from the empty,
   single-candidate, under-diversified, and under-evidenced coverage cells; do
   not optimize for a vanity brand count.
2. Define the resumable TypeScript ingestion/review contract before doing bulk
   research, including raw-response retention and idempotent accepted facts.
3. Add variants in small source-backed batches and rerun coverage, strict
   catalogue validation, SQL parity, and the fast gate after every batch.
4. Keep embeddings, chunking, Mastra, Ollama, and RunPod out of the production
   path until the optional held-out evaluation has a deterministic baseline to
   beat.

## Existing operational notes

- Local `.env` is ignored and real values must not be printed or committed.
- Vercel remains the active host. The historical domain discrepancy between
  repository intent (`thereserve.watch`) and older `thereverse.watch` aliases
  remains a later reversible routing task.
- Supabase project scope previously recorded is `osfqexnzgkksfvaocjvl`; never
  perform destructive removals, truncation, or resets.
