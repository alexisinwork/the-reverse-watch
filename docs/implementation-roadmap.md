# The Reserve implementation roadmap

This is the controlling delivery sequence. It implements the owner's
[`full original plan`](original_context.md), the
[`requirements ledger`](original-plan-requirements.md), and the accepted
[`SQL-first architecture`](sql-first-recommendation-architecture.md). Before
planning or implementing any phase, read `original_context.md` from its first
line through its final line. Record evidence at phase boundaries and continue
automatically. Verified work is committed and pushed directly to `main`.

The original file preserves the evolution from seven to eight questions and a
vector-first technical sketch. The 2026-08-28 audit supersedes the fixed
eight-step funnel and removes embeddings/vector infrastructure from the launch
critical path without discarding history, psychology, perception, or dossier
requirements.

## System shape

```text
Browser
  -> React Router action/API boundary
      -> Zod validation and numeric normalization
      -> PostgreSQL hard filters over reference variants
      -> versioned explicit soft score
      -> deterministic brand/archetype diversity
      -> cited result plus rejection reasons
  -> three recommendations and two or three “why not” candidates

Research jobs
  -> source discovery
  -> structured TypeScript/Zod normalization
  -> field-level evidence and human review
  -> PostgreSQL brands + reference variants + snapshots
  -> coverage and staleness audits
```

The model is never the catalogue. No LLM, embedding model, vector extension,
vector database, Mastra workflow, Ollama endpoint, or RunPod deployment is
required for the baseline.

## Verification cadence

Development through Phase 4 uses the fast deterministic gate:

```bash
npm run check
```

That gate covers formatting, linting, strict types, unit tests, and the
production build. Playwright/E2E execution and browser installation remain
deferred until Phase 7, after the deterministic recommendation flow works.
Deferred specs must remain current.

## Phase 0 — Baseline and decisions

Status: **complete**

- Repository audit, roadmap, secret exclusions, and environment inventory.
- Owner selected React Router/TypeScript and Vercel.
- Historical choice of eight independent questions recorded.

The later questionnaire/catalogue audit is an additive decision, not a rewrite
of this historical checkpoint.

## Phase 1 — Application foundation and landing-page parity

Status: **complete**

- React Router v7 Framework Mode, Vite, and strict TypeScript.
- Landing-page parity, reusable design tokens, and preserved Beehiiv embed.
- Health route, error boundary, fast quality gate, deployment and rollback docs.

Restart details are recorded in [`session-handoff.md`](session-handoff.md).

## Phase 2 — Progressive diagnostic questionnaire

Status: **complete — verified 2026-08-28**

Original-plan traceability: [progressive questionnaire](original-plan-requirements.md#progressive-questionnaire).

Goal: collect the smallest trustworthy profile first, then offer optional
refinement without making semantic infrastructure a prerequisite.

Deliverables:

- One shared TypeScript constants module for price bands, wrist display bands,
  units, and answer enums. Exact budget and wrist values are canonical.
- Zod schemas and inferred types for the core profile and refinement fields.
- Six-screen accessible core flow: budget, wrist, deployment,
  movement/service+accuracy, weight, and complications/date.
- Early deterministic profile summary with an optional “refine” path.
- Refine contract for social signal, aesthetic, provenance, emotional objective,
  market stance, geometry/attachment, acquisition/premium, resale, lume/crown,
  geography, cosmetic tolerance, condition, and allergy.
- Recoverable browser state, Back/Next controls, keyboard behavior, and server
  rejection of forged or incomplete submissions.
- Privacy-preserving analytics contract; actual analytics provider integration
  may wait until Phase 7.

Verification:

- Boundary tests prove every price and wrist value derives exactly one band.
- Premium allowance is explicit, bounded to `0..100`, and applied by one shared
  function.
- Required complication combinations and no-date conflicts fail safely.
- Focused tests cover navigation, persistence, validation, and core completion.
- The result is a profile summary, not a fabricated watch recommendation.

Evidence: `/quiz` implements the six required screens and four optional refine
groups; server and browser use the same Zod/domain contract; session recovery,
boundary rules, premium/speculative rules, and the complete core flow are
covered by the fast gate (13 tests at the phase checkpoint).

## Phase 3 — Reference-variant schema and coverage feasibility

Status: **complete — verified 2026-08-28**

Goal: prove the data model and combinatorial coverage before collecting 200
brands.

Deliverables:

- Additive PostgreSQL migrations separating `brands`, `collections`,
  `reference_models`, and materially homogeneous `reference_variants`.
- Structured geometry, movement, operation, material, attachment, production,
  and commercial fields required by the questionnaire.
- Price and market snapshots instead of one stored price tier.
- Source registry and field-level evidence ledger with verification and
  staleness policy.
- Explicit definitions for hype, liquidity, momentum, and
  `speculative_bubble`.
- M0/M1/M2 completeness calculation against active filter requirements.
- Seed manifest selected across budget, movement, size, deployment, weight, and
  complication cells.
- Coverage-audit script that reports empty, single-result, and under-evidenced
  cells before bulk research.

Verification:

- A family with multiple sizes/materials cannot enter as one filterable row.
- Missing facts remain `null` and cannot satisfy an active hard requirement.
- Mutable facts have expiry policies; stable facts are not invalidated by a
  document-level date.
- Schema constraints reject invalid units, ratios, enum values, and evidence
  links.
- Coverage report runs over the complete defined axis set without capped
  first/last windows.

Evidence 2026-08-28: six additive migrations are applied to the selected
Supabase project. The server-only catalogue contains 11 brands and 12 sourced,
homogeneous variants, including separate steel and two-tone Rolex Explorer
rows. Field evidence, retail/availability/FX expiry, M0/M1/M2 evaluations, and
typed deployment/friction profiles are loaded. Browser roles have no grants and
the security advisor is clean. The regenerated full-matrix audit reports 180 of
28,800 cells covered (0.63%), all single-candidate and under-diversified, with
116 under-evidenced cells. That low number is the required feasibility result
and controls Phase 5 priorities.

## Phase 4 — Deterministic recommendation MVP

Status: **complete — live SQL path verified 2026-08-28**

Goal: produce reproducible and explainable recommendations without AI
infrastructure.

Deliverables:

- SQL hard filters for budget, fit, deployment, movement/accuracy,
  complications, weight, allergy, condition/channel, and active hard refinements.
- Versioned weighted scorer over reviewed reference and brand-context tags.
- Per-factor score trace and deterministic tie-breakers.
- `speculative_bubble` suppression rule and disclaimer path.
- Top-three diversity: at most one reference per brand and distinct primary
  archetypes.
- Two or three rejection explanations (“why not”).
- Explicit empty-result relaxation proposals in the accepted order; no silent
  hard-filter relaxation.
- Golden profiles, boundary fixtures, and deterministic fallback response.

Verification:

- No result violates an active hard constraint.
- Unknown hard-filter facts move a variant to “verification required.”
- Golden profiles have expected inclusions, exclusions, and relaxation prompts.
- Re-running the same catalogue/profile/scorer version yields the same order and
  explanation trace.
- The seed catalogue exercises non-empty, rare, and empty coverage cells.

Completion of Phase 4 proves the core product decision loop.

Completion evidence 2026-08-28: recommendation engine v2 implements fail-closed budget,
FX, fit, deployment, ownership friction, accuracy, weight, function, date,
geometry, attachment, acquisition, availability, condition, resale, lume,
crown, geography, allergy, and speculative gates over the reviewed server seed.
It logs score factors, enforces one brand and one archetype in the top three,
returns verification-required and why-not sections, proposes relaxations, and
discloses selected soft preferences that the seed cannot yet score. `/quiz`
renders this evidence and its sources.

Migrations `0007` and `0008` expose narrow, versioned read-only RPC contracts
for accepted catalogue facts and the complete hard-filter partition.
`anon`/`authenticated` still have no table grants; migration `0009` also removes
the unnecessary authenticated RPC grant. The server uses only the Supabase URL
and publishable key, strictly validates both responses, caches valid catalogue
facts for 60 seconds, and falls back as one visible unit to the reviewed bundle
and local deterministic predicates. It never mixes an unvalidated SQL partition
with live facts.

The parity audit compares every decision fact and every hard-reject/missing-fact
code across all 12 variants and six golden profiles. The live SQL partition,
the bundled TypeScript partition, and final result ordering match. Production
Vercel has the public Supabase runtime values and the source register states
whether each response used the live SQL path or the explicit fallback.

## Phase 5 — Research pipeline and catalogue expansion

Status: **in progress — coverage-first expansion started 2026-08-28**

Goal: expand from the validated seed to the planned approximately 200 brands
without sacrificing field evidence or coverage.

Deliverables:

- Complete brand manifest with tier, target variants, coverage purpose, and
  review state.
- TypeScript research worker with concurrency limits, retries, resumability,
  raw-response retention, and cost logging.
- Zod-validated structured output; Markdown dossiers are generated editorial
  artifacts, not parsing sources of truth.
- Primary-source validation and a human review queue.
- Field-specific refresh schedule for price, availability, market behavior,
  production state, ownership, dimensions, and stable mechanics.
- Detailed M2 brand context: history, ownership, psychology, buyer archetypes,
  perception, social signal, design DNA, service reality, risks, and sourced
  narrative.
- Repeated coverage audits during expansion.

Verification:

- Failed jobs resume without duplicating variants, facts, or evidence.
- Every accepted fact retains source and review metadata.
- Every manifest brand reaches an accepted dossier/reference state or an
  evidence-backed exclusion.
- M1 coverage, not raw brand count, controls recommendation eligibility.

Checkpoint 2026-08-29: the complete 200-dossier owner knowledge pack is
schema-validated and linked as research-only M0/M2 context. Together with one
existing roadmap brand, the strict manifest now contains 201 brands, links 13
reviewed seed variants, and retains 18 coverage targets. The coverage-ranked,
resumable Perplexity worker uses native JSON Schema plus Zod validation,
immutable artifacts, fingerprint reuse, globally increasing attempts, bounded
concurrency, rate-limit handling, and explicit review artifacts. Provider
extraction still cannot mark a fact accepted.

The first live P0 discovery batch reviewed exact Cartier WSTA0107, Casio
G-5600UE-1, and Swatch SO28N100 candidates. All three remain
`needs_more_evidence`: no row entered the recommendation catalogue because the
M1 source gate was not complete. The review caught a different-reference Swatch
lug-width citation, null/contradictory extraction fields, unsupported HKD price
normalization, and the need to represent rectangular case geometry without
calling one dimension a diameter. Details and the next queue are in
[`research-pipeline.md`](research-pipeline.md).

The second live batch produced valid provisional results for Christopher Ward
C63-39AGM4-S00W0-B0 and Citizen BM8180-03E; two Sinn attempts failed the strict
null/contradiction guards. Independent review completed every M1 field for the
Christopher Ward exact SKU and generated additive migration `0010`, increasing
the local projection from 180 to 212 covered cells. Citizen remains
`needs_more_evidence` for graded lume and attachment semantics despite official
resolution of E101 accuracy and a weight-source conflict. Migration `0010`
must be applied and live parity proved before this checkpoint is pushed because
the Supabase MCP OAuth refresh expired during verification.

## Phase 6 — Optional free-text and semantic evaluation

Status: **optional, pending deterministic baseline evidence**

Goal: determine whether AI improves free-text intake or aesthetic nuance enough
to justify operational complexity.

Experiments:

- Structured profile extraction from free text with Zod validation.
- Semantic comparison of curated reference/claim passages for aesthetic and
  psychological fit.
- Optional PostgreSQL `pgvector`; no separate vector database at current scale.
- Provider adapters may include OpenAI and Ollama/RunPod. Mastra is added only
  if orchestration complexity justifies it.

Entry gate:

- Phase 4 deterministic fixtures and quality/latency/cost baseline exist.

Exit decision:

- Adopt only functionality that measurably improves held-out fixtures without
  hard-filter violations or unsupported facts. Otherwise retain the SQL-first
  engine and close the experiment.

Arbitrary fixed-size dossier chunking is explicitly out of scope.

## Phase 7 — Product integration, email, deployment, and evaluation

Status: **pending**

Goal: turn the recommendation engine into a production funnel.

Deliverables:

- Results UI with comparison, score factors, trade-offs, citations, “why not,”
  verification gaps, and edit/restart controls.
- Explicit Beehiiv opt-in; results remain visible without subscribing.
- Rate limiting, abuse controls, caching, timeouts, and observability.
- Evaluation dashboard for hard-filter validity, ranking quality, latency, cost,
  completion, refinement use, and subscription conversion.
- Full deferred browser/integration suite and production deployment/rollback.

Verification:

- Full flow works from landing through core result, refinement, cited
  recommendations, and optional email.
- Consent, empty results, incomplete data, provider-free operation, and external
  failures are tested.
- Production smoke checks pass on the canonical domain.

## Environment-variable ownership

| Variable | Required in | Purpose |
| --- | --- | --- |
| `APP_URL` | Phase 1 | Canonical application origin. |
| `SESSION_SECRET` | Phase 2 if server sessions are used | Signed server-side state; not required for browser `sessionStorage`. |
| `SUPABASE_URL` | Phase 4 | Public project endpoint for the narrow accepted-facts RPCs. |
| `SUPABASE_PUBLISHABLE_KEY` | Phase 4 | Public API key; it has RPC execute only and no table grants. |
| `DATABASE_URL` | Optional Phase 5/7 | Direct SQL workers only if a later job needs them; not required by the web runtime. |
| `DIRECT_DATABASE_URL` | Phase 3/5 maintenance | Additive migrations and maintenance outside the web runtime. |
| `PERPLEXITY_API_KEY` | Phase 5 | Research source discovery. |
| `OPENAI_API_KEY` | Optional Phase 5/6 | Structured normalization audit or semantic experiment. |
| `AI_PROVIDER` | Optional Phase 6 | Experimental provider selection. |
| `OPENAI_INGESTION_MODEL` | Optional Phase 5 | Structured normalization model. |
| `OPENAI_RECOMMENDATION_MODEL` | Optional Phase 6 | Free-text/semantic experiment. |
| `OPENAI_AUDIT_MODEL` | Optional Phase 5/6 | Selective quality audit. |
| `OPENAI_EMBEDDING_MODEL` | Optional Phase 6 | Semantic experiment only. |
| `OLLAMA_BASE_URL`, `OLLAMA_CHAT_MODEL` | Optional Phase 6 | Ollama experiment. |
| `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID` | Optional Phase 6 | Hosted Ollama experiment. |
| `BEEHIIV_API_KEY`, `BEEHIIV_PUBLICATION_ID` | Phase 7 | Explicit subscription opt-in. |
| `SENTRY_DSN` | Optional Phase 7 | Production error reporting. |

Only `.env.example` is committed. Real values belong in ignored local files and
encrypted deployment settings.
