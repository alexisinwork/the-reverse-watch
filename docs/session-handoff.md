# Session handoff

Last updated: 2026-08-27

This is the restart point for the next working session. The controlling sequence
is [`implementation-roadmap.md`](implementation-roadmap.md), which implements
the owner's [`full original plan`](original_context.md). The original plan must
be read from first line to final line before each phase. Phase 1 is complete on
`main`; the next session continues directly into Phase 2 without an approval
stop.

## Current checkpoint

- Active phase: **Phase 2 — diagnostic questionnaire, not yet implemented**.
- Phase 0 is complete and approved.
- Phase 1 is complete, merged, pushed, and deployed from `main`.
- Latest delivered application commit: `a86e148 Enable continuous autonomous
  delivery` on `main`.
- The React Router migration is deployed. The original static
  `index.html` remains unchanged as the parity and rollback reference.
- Vercel production deployment: `dpl_HWjYWXTCUX9PuphVsYPFKRD782p9`, state
  `READY`, commit `a86e148`.
- Existing Vercel aliases still use `thereverse.watch`; the repository's
  canonical intent remains `thereserve.watch`.
- No database, DNS, Supabase, credential, or subscriber state was changed.

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
5. `b882439` — Build Phase 1 application foundation.
6. `83a9f0e` — Record Phase 1 preview checkpoint.
7. `a86e148` — Enable continuous autonomous delivery.

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
- Production deployment `dpl_HWjYWXTCUX9PuphVsYPFKRD782p9` reached `READY` for
  `main` commit `a86e148`. Follow-up route fetches through the Vercel MCP failed,
  so no page-level remote smoke result is claimed.

## Open items and exact continuation

1. Begin Phase 2 by implementing the canonical eight-question schema, route UI,
   server validation, recoverable state, accessibility behavior, and temporary
   deterministic profile summary. Read all of `original_context.md` first.
2. Preserve the deferred testing cadence: run fast focused checks, but do not
   run Playwright/E2E or long background suites before Phase 5.
3. Resolve the domain discrepancy during later production routing: repository
   intent and `CNAME` say `thereserve.watch`, while Vercel currently lists
   `thereverse.watch` and `www.thereverse.watch`. Prefer reversible, recorded
   changes toward the canonical repository domain.
4. Treat `SESSION_SECRET` as a Phase 2 input, `DATABASE_URL` and
   `DIRECT_DATABASE_URL` as Phase 3 inputs, and `CRON_SECRET` as a Phase 5 input.
5. Commit verified Phase 2 work directly to `main`, confirm deployment state,
   record the phase evidence, and continue automatically into Phase 3.

## Scope guard

Implement the roadmap sequentially and continue automatically across phase
boundaries. Do not skip ahead of the active phase. Never perform risky Supabase
removals or other critical destructive actions.
