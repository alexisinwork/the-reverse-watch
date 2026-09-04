# The Reserve

The Reserve is a server-rendered Remix-style application built with React
Router v7 Framework Mode, Vite, and strict TypeScript. The application preserves
the documentary landing page and Beehiiv signup and now includes the six-screen
reference diagnostic at `/quiz`: budget, use, case, movement, details, and
requirements. Every question maps onto a column of the owner's model intake
sheet, which is the canonical catalogue intake format. The diagnostic returns
deterministic, source-cited candidates, verification gaps, and rejection reasons
from a reviewed PostgreSQL reference-variant catalogue. The server validates the
accepted-facts RPC response and visibly falls back to the reviewed bundled
snapshot if the live catalogue or SQL filter contract fails.

Wearing scenarios, complications, and positioning groups are PostgreSQL
vocabularies read at runtime, so the owner extends them without a code change;
the bundled list in `app/domain/catalogue-vocabulary.ts` is the all-or-nothing
fallback. The result screen offers a positioning facet that narrows what is
displayed without re-ranking anything.

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

Run the fast development gate for every change:

```bash
npm run check
```

This checks formatting, lint rules, strict types, unit tests, and the production
build. The Phase 7 integration suite covers both desktop and mobile Chromium;
install its browser once, then run it with the local server:

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

## Catalogue intake

The owner's tab-separated model sheet is imported with:

```bash
npm run import:model-sheet -- data/research/model-sheet-sample.tsv
```

The importer drops workbook artifact rows, collapses exact duplicate
references, and exits non-zero listing conflicting duplicates and unparseable
rows for owner resolution; it never picks a winner between conflicting rows. It
also reports which accepted rows would supersede an already-reviewed variant,
without merging them.

`npm run migrate:seed-catalogue-v3` is the one-shot forward migration that gave
the reviewed variants their wearing-scenario and complication slugs. Run
Prettier over `data/catalogue/seed-catalogue.json` afterwards.
`npm run build:watches-workbook` exports the reviewed facts back into the
owner's workbook layout.

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

Phase 5's TypeScript research/review engineering is complete. Further
brand/model research and catalogue population are owner-managed; every supplied
record still passes the same provenance, M1, additive-migration, coverage, and
parity gates before recommendation eligibility.

The canonical catalogue is PostgreSQL/Supabase. Chunking, embeddings, a vector
database, Mastra, Ollama, and RunPod are not required by the baseline; optional
semantic work must first beat the deterministic engine on held-out fixtures.
