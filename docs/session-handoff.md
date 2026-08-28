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

- Active phase: **Phase 4 — deterministic recommendation MVP, in progress**.
- Phases 0–3 are complete and verified.
- `/quiz` now returns confirmed, verification-required, relaxation, why-not,
  score-trace, and source sections after the six core screens or optional
  refinement groups.
- Six additive migrations are applied to Supabase. The catalogue remains
  server-only; no subscriber, credential, DNS, or destructive database change
  was made.
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
- Migrations `0001` through `0006` are applied to Supabase project
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
- Security advisor findings are empty, and browser roles have no table grants.

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

## Verification evidence

On 2026-08-28:

- `npm run check` passes formatting, lint, strict type/route generation, all 32
  tests across seven files, and the production build.
- `npm run audit:coverage` validates all 28,800 cells without capped windows.
- The deferred Playwright suite was updated with the core diagnostic flow but
  was not executed, per the Phase 7 cadence.
- Supabase applied all six migrations. Live row counts, server-only privileges,
  and both advisors were checked after the final migration.

## Exact continuation

1. Configure usable pooled/direct Supabase connection values in Vercel without
   copying credentials into logs, then make the server read the canonical
   catalogue and retain the reviewed bundle only as an explicit fallback.
2. Move the exact active hard predicates into the PostgreSQL candidate query and
   prove parity with engine v2 golden profiles.
3. Finish the full Phase 4 gate and production smoke check.
4. Start Phase 5 with coverage-first variants for the empty and
   under-diversified cells; do not optimize for a vanity brand count.
5. Keep embeddings, chunking, Mastra, Ollama, and RunPod out of the production
   path until the optional held-out evaluation has a deterministic baseline to
   beat.

## Existing operational notes

- Local `.env` is ignored and real values must not be printed or committed.
- Vercel remains the active host. The historical domain discrepancy between
  repository intent (`thereserve.watch`) and older `thereverse.watch` aliases
  remains a later reversible routing task.
- Supabase project scope previously recorded is `osfqexnzgkksfvaocjvl`; never
  perform destructive removals, truncation, or resets.
