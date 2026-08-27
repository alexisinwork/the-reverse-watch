# The Reserve

The Reserve is a watch-selection diagnostic built around mechanical constraints,
corporate provenance, design language, and the signal a buyer actually wants to
send. The public site currently contains the launch landing page and Beehiiv
subscription form.

## Current status

**Phase 0 — repository baseline is complete and awaiting approval.**

The repository is intentionally still a static site at this checkpoint. No
framework migration or production behavior was changed during the audit.

Current files:

- `index.html` — deployed landing page and embedded Beehiiv form.
- `questionnaire.js` — an unconnected React/TypeScript questionnaire prototype.
- `architecture-todo.md` — an early architecture proposal; retained as historical
  context, not as an implementation specification.
- `docs/implementation-roadmap.md` — phased delivery plan and approval gates.
- `docs/phase-0-audit.md` — evidence-based audit of the starting repository.
- `.env.example` — credential inventory with safe placeholders only.

## Working rules

1. Work proceeds one phase at a time.
2. Each phase is implemented and verified in this repository.
3. The phase is committed and pushed before review.
4. The next phase starts only after explicit approval.
5. Credentials stay in local `.env` files or the hosting provider's encrypted
   environment settings; they are never committed.

## Proposed target

- TypeScript throughout the application and data pipeline.
- React Router v7 framework mode (the current continuation of Remix) with Vite.
- Mastra for workflow orchestration where it adds measurable value.
- Zod schemas at every external-data and API boundary.
- PostgreSQL for canonical watch facts and `pgvector` for semantic fields.
- Perplexity for cited research acquisition.
- A provider adapter supporting OpenAI by default and Ollama locally or on
  RunPod when selected.
- Vercel deployment, retaining the existing visual identity and Beehiiv funnel.

The target is provisional until Phase 1 is approved. See the roadmap for the
exact deliverables and verification gates.

## Secrets

Copy `.env.example` to `.env` when a development phase needs credentials. The
example documents every planned integration, but most variables are optional
until their corresponding phase begins.
