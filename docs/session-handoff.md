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

- Active phase: **Phase 3 — reference-variant schema and coverage feasibility,
  in progress**.
- Phase 0 and Phase 1 remain complete.
- Phase 2 is complete and verified locally.
- The application now exposes `/quiz` with six required screens, an early
  validated profile summary, and four optional refinement groups.
- No database migration has been applied to Supabase yet. No catalogue,
  subscriber, credential, DNS, or production data was changed.
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
- Core and refine submissions are validated on the server. The result remains a
  constraint profile and does not fabricate a watch recommendation.
- Draft state recovers from browser `sessionStorage`; access does not require
  email.
- The obsolete root `questionnaire.js` prototype was removed. Its history and
  code sketch remain in git and `original_context.md`.
- The landing page links to the diagnostic without changing the Beehiiv embed.

## Phase 3 checkpoint delivered

- `db/migrations/0001_reference_variant_catalogue.sql` defines additive
  PostgreSQL types and tables for brands, ownership periods, service regions,
  collections, models, variants, complications, price/market snapshots, traits,
  editorial claims, sources, per-field evidence, completeness, and review.
- The migration deliberately does not enable `pgvector`.
- `docs/catalogue-schema.md` maps questionnaire requirements to fields and
  records refresh/null/completeness policy.
- `app/domain/coverage.ts` and `scripts/audit-coverage.ts` enumerate the defined
  pre-collection core matrix and report empty, single-candidate,
  under-diversified, and under-evidenced cells.
- The input projection is intentionally empty. The current audit reports 0 of
  28,800 cells covered; this prevents a seed or prestigious-brand list from being
  mistaken for market coverage.

## Verification evidence

On 2026-08-28:

- `npm run check` passed formatting, linting, strict route/type generation, 17
  tests across five files, and the React Router production build.
- After the coverage checkpoint was added, focused type checking passed and
  `npm run audit:coverage` validated the empty projection and reported 28,800
  empty cells after treating ownership/service tolerance as its own axis.
- The deferred Playwright suite was updated with the core diagnostic flow but
  was not executed, per the Phase 7 cadence.
- PostgreSQL syntax and application against Supabase are not claimed because no
  local PostgreSQL client is installed and no external migration was applied.

## Exact continuation

1. Validate the additive migration against the selected PostgreSQL/Supabase
   project, preserving a reversible migration path and without destructive
   operations.
2. Define the coverage-selected seed manifest and a database-to-coverage
   projection. Do not start bulk 200-brand research yet.
3. Add completeness evaluation for active hard-filter fields and fixtures that
   prove family/material/size rows cannot be collapsed.
4. Populate a small sourced seed across deliberately different coverage cells,
   then rerun the audit and distinguish market rarity from data gaps.
5. Keep Phase 3 open until the schema and seed projection work end to end. Do
   not add embeddings or model providers to solve missing structured data.

## Existing operational notes

- Local `.env` is ignored and real values must not be printed or committed.
- Vercel remains the active host. The historical domain discrepancy between
  repository intent (`thereserve.watch`) and older `thereverse.watch` aliases
  remains a later reversible routing task.
- Supabase project scope previously recorded is `osfqexnzgkksfvaocjvl`; never
  perform destructive removals, truncation, or resets.
