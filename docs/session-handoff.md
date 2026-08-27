# Session handoff

Last updated: 2026-08-27

This is the restart point for the next working session. The controlling sequence
is [`implementation-roadmap.md`](implementation-roadmap.md), which implements
the owner's [`full original plan`](original_context.md). The original plan must
be read from first line to final line before each phase. Work remains gated by
phase: complete the Phase 1 preview, then stop for owner approval before Phase 2.

## Current checkpoint

- Active phase: **Phase 1 — application foundation and landing-page parity,
  local implementation complete; preview pending**.
- Phase 0 is complete and approved.
- Phase 2 has **not** started.
- Latest pushed commit: `cc87e2d Document Phase 1 session handoff` on `main`.
- The React Router migration is implemented locally. The original static
  `index.html` remains unchanged as the parity and rollback reference.
- No production deployment, domain, DNS, database, or subscriber state was
  changed.

## Completed work

### Repository and operating baseline

- Audited the static site, Beehiiv embed, eight-question prototype, and missing
  application/data layers.
- Added the phased roadmap, secret policy, environment template, account guide,
  project instructions, and non-secret environment checker.
- Approved decisions are eight questionnaire inputs and Vercel as the active
  production host.

### Accounts, credentials, and MCP

- Local `.env` exists and is ignored by Git.
- `OPENAI_API_KEY`, `PERPLEXITY_API_KEY`, `BEEHIIV_API_KEY`,
  `BEEHIIV_PUBLICATION_ID`, and `GITHUB_PAT_TOKEN` are detected without printing
  their values.
- Vercel MCP OAuth completed successfully.
- Supabase MCP OAuth completed successfully and is scoped to project
  `osfqexnzgkksfvaocjvl` with the requested feature groups.
- OpenAI Docs, Context7, Perplexity, GitHub, Vercel, and Supabase MCP servers are
  registered and enabled in the global Codex configuration.
- Supabase's `supabase` and `supabase-postgres-best-practices` agent skills are
  installed in `.agents/skills/`, pinned by `skills-lock.json`, reviewed, and
  committed.

### Pushed checkpoints

1. `1fde160` — Document phased implementation baseline.
2. `24073da` — Configure project accounts, secrets, and MCP.
3. `a916446` — Add Supabase agent skills.
4. `cc87e2d` — Document Phase 1 session handoff.

### Phase 1 application foundation

- Added React Router v7 Framework Mode, Vite, strict TypeScript, and the Vercel
  preset.
- Recreated the documentary landing page with reusable tokens and components,
  preserving the existing Beehiiv public form ID without exposing a credential.
- Added `/health`, a branded root error boundary, metadata and cache headers.
- Added Prettier, ESLint, strict type generation/checking, Vitest unit tests, a
  production build, and deferred Playwright specifications.
- Added deployment/rollback documentation and retained `index.html` as the
  migration reference.

### Original-plan preservation and testing cadence

- Added `docs/original-plan-requirements.md` as a traceability ledger for the
  full original plan.
- Repository instructions require reading all of `docs/original_context.md`,
  never just top/bottom or first/last excerpts, before every phase.
- The approved final eight questionnaire dimensions and the full approximately
  200-brand objective are explicitly carried into Phases 2 and 3.
- Every in-scope brand requires detailed sourced history, ownership, psychology,
  perception, design, mechanical/service reality, and references before Phase 3
  can exit.
- Playwright/E2E and long-running background validation remain deferred until
  Phase 5, after the core AI work through Phase 4. Earlier phases use
  `npm run check` and focused short smoke checks only.

## Verification evidence

On 2026-08-27, `npm run check` passed formatting, linting, strict route type
generation and TypeScript checking, 4 unit tests in 2 files, and the React Router
production build. The deferred E2E suite was not run.

Short read-only integration checks confirmed:

- GitHub identity and read access to `alexisinwork/the-reverse-watch`.
- Supabase project `osfqexnzgkksfvaocjvl`; its public schema is currently empty.
- Vercel team/project linkage to the GitHub repository and ready historical
  static deployments.

## Open items and exact continuation

1. Commit the reviewed Phase 1 work on a non-production branch and push that
   branch to create a Vercel preview. Do not push `main`: it is connected to
   production deployments and requires explicit owner confirmation.
2. Confirm the preview build reaches `READY`. Use only short read-only checks of
   `/`, `/health`, and the error boundary; do not run Playwright or submit the
   Beehiiv form.
3. Resolve the domain discrepancy before production routing: repository intent
   and `CNAME` say `thereserve.watch`, while Vercel currently lists
   `thereverse.watch` and `www.thereverse.watch`. Do not change either domain or
   DNS without explicit owner approval.
4. Treat `SESSION_SECRET` as a Phase 2 input, `DATABASE_URL` and
   `DIRECT_DATABASE_URL` as Phase 3 inputs, and `CRON_SECRET` as a Phase 5 input.
   Their absence does not block the Phase 1 preview.
5. After preview evidence is recorded, stop and request approval for the
   production deployment and then for Phase 2. These are separate approvals.

## Scope guard

Do not implement the questionnaire, watch catalogue, research pipeline,
embeddings, RAG, Mastra recommendation workflow, or production result email
until the Phase 1 preview is complete and the owner explicitly approves Phase 2.
