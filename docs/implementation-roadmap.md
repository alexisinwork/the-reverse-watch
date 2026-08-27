# The Reserve implementation roadmap

This is the controlling delivery sequence. It implements the owner's
[`full original plan`](original_context.md), with requirement traceability in
[`original-plan-requirements.md`](original-plan-requirements.md). Before
planning or implementing any phase, read `original_context.md` from its first
line through its final line; never use only the top, bottom, first 200, last 200,
search matches, or this roadmap as a substitute. Work stops after each phase so
the owner can inspect the repository and approve the next phase.

The original file deliberately preserves duplicates, the evolution from seven
to eight questions, and superseded architecture sketches. The final eight
questions and the pure TypeScript/JavaScript direction are binding. This
roadmap may refine implementation details, but it must retain the original
product intent for complete brand coverage, detailed history, psychology,
perception, factual mechanics, the dossier, and the audience funnel.

## System shape

```text
Browser
  -> React Router action/API boundary
      -> questionnaire validation
      -> deterministic SQL constraints
      -> pgvector semantic candidate retrieval
      -> deterministic weighted score
      -> model reranking and grounded explanation
  -> 3–5 cited recommendations

Research jobs
  -> Perplexity source discovery
  -> Zod validation and normalization
  -> human review queue
  -> PostgreSQL canonical records
  -> reference-level embeddings
```

The model is never the catalogue and the vector index is never the source of
truth. Exact filters run before semantic retrieval.

## Verification cadence

Development through Phase 4 uses the fast deterministic gate:

```bash
npm run check
```

That gate covers formatting, linting, strict types, unit tests, and the
production build. Playwright/E2E execution, browser-binary installation, and
long-running background validation suites are deferred until Phase 5, after the
core catalogue, retrieval, and recommendation engine is complete. Deferred
specs should still be written and kept current during earlier phases. Focused
unit tests and short, read-only smoke checks remain appropriate when needed to
develop the active phase.

## Phase 0 — Baseline and decisions

Status: **complete and approved**

Deliverables:

- Repository audit.
- Controlling roadmap.
- Environment-variable inventory.
- Secret exclusions.
- Explicit decision list for Phase 1.

Exit gate:

- [x] Owner approved the framework migration.
- [x] Owner selected eight questions.
- [x] Owner confirmed Vercel as the live hosting provider.

## Phase 1 — Application foundation and landing-page parity

Status: **in progress — tooling checkpoint complete; application scaffold next**

Restart details and unresolved configuration are recorded in
[`session-handoff.md`](session-handoff.md).

Original-plan traceability: [landing identity, design, Vercel, and Beehiiv](original-plan-requirements.md#phase-mapping).

Goal: establish a maintainable TypeScript application without breaking the live
subscription funnel.

Deliverables:

- Scaffold React Router v7 framework mode with Vite and strict TypeScript.
- Recreate the current landing page using reusable design tokens and components.
- Preserve the Beehiiv embedded form first; add server-side API subscription only
  when the result-email flow needs it.
- Establish project-scoped MCP configuration, credential ownership, and a
  secret-safe local environment before installing runtime dependencies.
- Add formatting, linting, type checking, unit tests, and a production build.
- Configure Vercel and document domain migration/rollback.
- Add a health route and basic error boundary.

Verification:

- Landing page matches the current desktop and mobile presentation.
- Beehiiv form renders and can be exercised without exposing credentials.
- The fast development gate passes.
- Preview deployment builds successfully before production routing changes.
- Phase 1 browser/E2E specs are retained but their execution is deferred under
  the verification cadence above.

No watch AI or catalogue work belongs in this phase.

## Phase 2 — Diagnostic questionnaire

Original-plan traceability: [canonical eight-question diagnostic](original-plan-requirements.md#canonical-eight-question-diagnostic).

Goal: collect a complete, validated buyer profile with an accessible user
experience.

Deliverables:

- Canonical Zod schema and inferred TypeScript types.
- Route-based questionnaire UI with progress, Back/Next controls, keyboard
  support, validation, and completion summary.
- URL/session-safe state recovery so refresh does not silently lose answers.
- Privacy-preserving analytics events for start, step completion, abandonment,
  and completion.
- A temporary deterministic profile result; no fabricated watch recommendation.

Verification:

- All answer combinations validate against the server schema.
- Directly forged or incomplete submissions fail safely.
- Focused unit tests cover navigation, validation, and submission behavior.
- Mobile, keyboard, screen-reader, and browser-level E2E specs are prepared for
  the deferred Phase 5 integration run.

## Phase 3 — Canonical catalogue and research pipeline

Original-plan traceability: [complete brand and reference knowledge](original-plan-requirements.md#complete-brand-and-reference-knowledge).

Goal: create trustworthy structured watch data before adding RAG.

Deliverables:

- PostgreSQL schema for brands, collections, references, prices, measurements,
  movements, traits, sources, claims, and review status.
- Brand manifest with tier and target reference counts.
- TypeScript Perplexity research worker with concurrency limits, retries,
  resumability, raw-response retention, and cost logging.
- Structured JSON output validated with Zod; Markdown dossiers become generated
  editorial artifacts, not the parsing source of truth.
- Source-quality rules and a human review queue.
- Seed set of approximately 10 brands across budgets for end-to-end validation.
- A complete manifest for the planned approximately 200-brand universe, with
  every brand assigned coverage and review status.
- Detailed dossier fields for each brand's verified history and ownership,
  psychology and buyer archetypes, public/collector perception, social signal,
  design DNA, mechanical/service reality, and representative references.

Verification:

- A failed or partial job can resume without duplicating records.
- Invalid enums, units, and unsupported claims are quarantined.
- Every accepted fact links to at least one source and retrieval date.
- Missing values remain `null` and never receive silent defaults.
- Every in-scope manifest brand reaches an accepted detailed dossier or an
  explicit owner-approved exclusion; the phase cannot exit after only the seed
  set.
- Coverage audits scan the complete manifest and complete dossier contents, not
  arbitrary first/last excerpts or capped record windows.

Expansion from the 10-brand calibration set to every entry in the planned
approximately 200-brand manifest happens only after the seed-set accuracy
review, but remains required catalogue work. The seed examples never redefine
or truncate the full brand scope.

## Phase 4 — Retrieval, scoring, and recommendation engine

Original-plan traceability: [AI decisions and recommendation dossier contract](original-plan-requirements.md#recommendation-dossier-contract).

Goal: return relevant recommendations reproducibly and explainably.

Deliverables:

- Reference-level embeddings for subjective/editorial fields.
- SQL hard filters for budget, wrist geometry, environment, movement, maintenance,
  and availability.
- Semantic retrieval for aesthetic, psychological, provenance, and social traits.
- Versioned weighted scoring with diversity rules and rejection reasons.
- Mastra workflow for retrieval, reranking, and structured dossier generation.
- Provider adapter for OpenAI and optional Ollama/RunPod inference.
- Recommendation response with 3–5 candidates, confidence, trade-offs, and source
  citations.

Verification:

- Golden questionnaire profiles have expected inclusions and exclusions.
- No result violates a hard budget or geometry constraint.
- Explanations contain no unsupported specifications.
- Provider failures produce a safe fallback based on deterministic ranking.
- OpenAI and Ollama are evaluated against the same fixtures before switching the
  production provider.

Completion of these focused AI evaluations ends the deferral period. The full
browser and long-running integration suite begins in Phase 5.

OpenAI implementation will use the Responses API and structured output rather
than copying the provisional chat-completions snippets in the legacy notes.

## Phase 5 — Product integration, email, deployment, and evaluation

Original-plan traceability: [dossier, email, media, and funnel requirements](original-plan-requirements.md#media-funnel-and-release-workstream).

Goal: turn the engine into a production funnel with measurable quality.

Deliverables:

- Results experience with comparison, trade-offs, citations, and restart/edit
  controls.
- Explicit Beehiiv opt-in for emailing the dossier; results remain visible without
  subscribing.
- Rate limiting, abuse controls, caching, timeouts, and observability.
- Evaluation dashboard for recommendation validity, retrieval quality, latency,
  cost, completion rate, and subscription conversion.
- Data-refresh schedule for prices, availability, and ownership facts.
- Production deployment and documented rollback.

Verification:

- Full browser flow works from landing page through results and optional email.
- Consent and error states are tested.
- Monitoring detects provider, database, and subscription failures.
- Production smoke checks pass on `thereserve.watch`.

## Environment-variable ownership

| Variable | Required in | Purpose |
| --- | --- | --- |
| `APP_URL` | Phase 1 | Canonical application origin. |
| `SESSION_SECRET` | Phase 2 | Signed server-side questionnaire/session state. |
| `BEEHIIV_API_KEY` | Phase 5 | Server-side subscription request. |
| `BEEHIIV_PUBLICATION_ID` | Phase 5 | Beehiiv publication destination. |
| `PERPLEXITY_API_KEY` | Phase 3 | Research acquisition jobs. |
| `PERPLEXITY_STANDARD_PRESET` | Phase 3 | Normal Perplexity Agent API research preset. |
| `PERPLEXITY_DEEP_RESEARCH_PRESET` | Phase 3 | Selective deep-research preset. |
| `DATABASE_URL` | Phase 3 | Pooled application database connection. |
| `DIRECT_DATABASE_URL` | Phase 3 | Migrations and maintenance connection. |
| `AI_PROVIDER` | Phase 4 | Selects the model adapter. |
| `OPENAI_API_KEY` | Phase 3/4 | Normalization, embeddings, and/or synthesis. |
| `OPENAI_INGESTION_MODEL` | Phase 3 | High-volume normalization model. |
| `OPENAI_RECOMMENDATION_MODEL` | Phase 4 | Reranking and grounded dossier model. |
| `OPENAI_AUDIT_MODEL` | Phase 4 | Selective quality-audit model. |
| `OPENAI_EMBEDDING_MODEL` | Phase 4 | Reference embedding model. |
| `OLLAMA_BASE_URL` | Phase 4 | Local or RunPod Ollama endpoint. |
| `OLLAMA_CHAT_MODEL` | Phase 4 | Ollama generation model installed at the endpoint. |
| `OLLAMA_EMBEDDING_MODEL` | Phase 4 | Optional Ollama embedding model. |
| `SENTRY_DSN` | Phase 5 | Optional production error reporting. |

Only `.env.example` is committed. Real values belong in `.env` locally and in
encrypted Vercel environment settings for deployments.
