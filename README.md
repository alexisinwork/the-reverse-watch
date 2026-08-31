# The Reserve

The Reserve is a server-rendered Remix-style application built with React
Router v7 Framework Mode, Vite, and strict TypeScript. The application preserves
the documentary landing page and Beehiiv signup and now includes the progressive
reference diagnostic at `/quiz`. The diagnostic returns deterministic,
source-cited candidates, verification gaps, and rejection reasons from a
reviewed PostgreSQL reference-variant catalogue. The server validates the
accepted-facts RPC response and visibly falls back to the reviewed bundled
snapshot if the live catalogue or SQL filter contract fails.

Results remain available without an email address. The result screen offers a
separate, explicit opt-in; a valid request records a Beehiiv subscription when
the server credentials are configured and can send a deterministic,
source-backed dossier through Resend when its sender credentials are configured.
Malformed consent or channel failures remain visible without replacing the
recommendation.
The server also emits aggregate `quiz_funnel` events for result and subscription
measurement without logging profile answers or email addresses.

## Local development

Requirements: Node.js 22.22 or newer and npm 12 or newer.

```bash
npm install
npm run dev
```

The application runs at `http://localhost:5173`. The diagnostic is available at
`/quiz`, and the read-only health endpoint is available at `/health`. After
`npm run build`, `npm start` serves the local production bundle.

## Verification

Run the fast development gate while the deterministic core is in progress:

```bash
npm run check
```

This checks formatting, lint rules, strict types, unit tests, and the production
build. Browser installation, Playwright/E2E execution, and long-running
background verification are intentionally deferred until Phase 7, after the
core catalogue and deterministic recommendation engine are complete. The
deferred suite is kept in the repository for that integration phase:

```bash
npx playwright install chromium
npm run test:e2e
```

With the two public Supabase runtime variables loaded, verify that the bundled
facts, live facts, TypeScript predicates, and PostgreSQL hard-filter partition
remain identical:

```bash
npm run audit:catalogue-parity
```

The deterministic Phase 6 entry-gate measurements can be reproduced with:

```bash
npm run evaluate:baseline
```

Real credentials belong in the ignored `.env` file. See
`docs/accounts-and-secrets.md` and `scripts/check-env.mjs`; never commit `.env`
or expose credential values in output.

## Delivery phases

Work is governed by `docs/implementation-roadmap.md` and the accepted SQL-first
decision in `docs/sql-first-recommendation-architecture.md`. Complete and record
evidence for each phase, then continue automatically into the next one.
Verified work is pushed directly to `main`. Production routing and rollback are
documented in `docs/deployment-and-rollback.md`. The owner's full original plan
is preserved in `docs/original_context.md`; it must be read in full before every
phase, with decisions tracked in `docs/original-plan-requirements.md`.

The canonical catalogue is PostgreSQL/Supabase. Chunking, embeddings, a vector
database, Mastra, Ollama, and RunPod are not required by the baseline; optional
semantic work must first beat the deterministic engine on held-out fixtures.
