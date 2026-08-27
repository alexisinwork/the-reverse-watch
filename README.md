# The Reserve

The Reserve is a server-rendered Remix-style application built with React
Router v7 Framework Mode, Vite, and strict TypeScript. The current Phase 1
surface preserves the existing documentary landing page and its Beehiiv signup
while establishing the application foundation for later diagnostic routes.

## Local development

Requirements: Node.js 22.22 or newer and npm 12 or newer.

```bash
npm install
npm run dev
```

The application runs at `http://localhost:5173`. The read-only health endpoint
is available at `/health`. After `npm run build`, `npm start` serves the local
production bundle.

## Verification

Run the fast development gate while Phases 1–4 are in progress:

```bash
npm run check
```

This checks formatting, lint rules, strict types, unit tests, and the production
build. Browser installation, Playwright/E2E execution, and long-running
background verification are intentionally deferred until Phase 5, after the
core catalogue and AI recommendation engine is complete. The deferred suite is
kept in the repository for that integration phase:

```bash
npx playwright install chromium
npm run test:e2e
```

Real credentials belong in the ignored `.env` file. See
`docs/accounts-and-secrets.md` and `scripts/check-env.mjs`; never commit `.env`
or expose credential values in output.

## Delivery phases

Work is governed by `docs/implementation-roadmap.md`. Complete and record
evidence for each phase, then continue automatically into the next one.
Verified work is pushed directly to `main`. Production routing and rollback are
documented in `docs/deployment-and-rollback.md`. The owner's full original plan
is preserved in `docs/original_context.md`; it must be read in full before every
phase, with decisions tracked in `docs/original-plan-requirements.md`.
