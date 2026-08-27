# Session handoff

Last updated: 2026-08-27

This is the restart point for the next working session. The controlling plan is
[`implementation-roadmap.md`](implementation-roadmap.md). Work remains gated by
phase: finish, verify, commit, and push Phase 1, then stop for owner approval
before beginning Phase 2.

## Current checkpoint

- Active phase: **Phase 1 — application foundation and landing-page parity**.
- Phase 0 is complete and approved.
- Phase 2 has **not** started.
- Latest pushed commit: `a916446 Add Supabase agent skills` on `main`.
- Repository was clean and synchronized with `origin/main` when this handoff was
  written.
- The production landing page remains the original static `index.html`; the
  React Router migration has not started, so no live funnel behavior has been
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

## Known incomplete configuration

The environment checker currently reports:

- `SESSION_SECRET` missing or still set to a placeholder.
- `DATABASE_URL` missing.
- `CRON_SECRET` missing or still set to a placeholder.
- `DIRECT_DATABASE_URL` is not configured.

These values must be placed in local `.env` and, with independent production
secret values, in Vercel's encrypted environment settings. Supabase OAuth does
not replace the application's Postgres connection strings.

Credential presence is not the same as successful authentication. Live,
read-only validation of the OpenAI, Perplexity, Beehiiv, and GitHub credentials
was started but interrupted before completion. Do not claim these APIs work
until the checks below pass.

Additional configuration debt:

- The committed `.codex/config.toml` does not yet contain the new project-scoped
  Supabase MCP entry; only the global Codex configuration does.
- `.env.example` and the account documentation still describe Neon as the
  suggested provider. Update them to record the owner's Supabase selection.
- GitHub CLI previously reported an invalid cached token for `alexisinwork`.
  `GITHUB_PAT_TOKEN` is present for MCP, but normal `gh` CLI authentication must
  be verified separately.
- The Vercel OAuth login succeeded, but the repository's Vercel project link,
  environment-variable parity, and preview deployment have not been verified.

## Exact next-session sequence

### 1. Re-establish configuration safely

Run from the repository root:

```bash
node scripts/check-env.mjs
codex mcp list
git status --short --branch
```

Resolve the missing `SESSION_SECRET`, `DATABASE_URL`, `DIRECT_DATABASE_URL`, and
`CRON_SECRET` values without printing them. Use Supabase's transaction-pooler
connection string for Vercel application traffic and a direct or session-pooler
connection for migrations.

### 2. Validate integrations with minimal read-only requests

Verify and report only status, identity/project names, and HTTP/error codes—never
secret values:

1. OpenAI: retrieve one configured model or list accessible models.
2. Perplexity: run one minimal `pro-search` request and record cost metadata.
3. Beehiiv: retrieve the configured publication; do not create a subscriber.
4. GitHub: verify identity and read access to
   `alexisinwork/the-reverse-watch`; do not write through MCP.
5. Supabase: confirm project `osfqexnzgkksfvaocjvl` and inspect schema metadata
   only; do not change the database.
6. Vercel: confirm the intended account/team/project and domain without changing
   deployment or DNS state.

### 3. Reconcile the committed configuration

- Add the project-scoped Supabase MCP URL to `.codex/config.toml` with write
  actions requiring confirmation.
- Replace Neon-specific guidance with Supabase Postgres/Supavisor guidance while
  retaining provider-neutral `DATABASE_URL` and `DIRECT_DATABASE_URL` names.
- Extend the non-secret checker if Supabase-specific public configuration is
  adopted later. Do not add `SUPABASE_SECRET_KEY` unless a concrete server-side
  API requirement exists.

### 4. Complete Phase 1 application work

1. Scaffold React Router v7 framework mode with Vite and strict TypeScript in
   this repository.
2. Preserve the current static landing page as the visual/behavioral reference.
3. Rebuild it with reusable design tokens and components while keeping the
   existing Beehiiv embed working.
4. Add a health route and root error boundary.
5. Configure formatting, linting, type checking, unit tests, and production
   build commands.
6. Verify desktop/mobile layout and the Beehiiv form without submitting a real
   test subscriber unless the owner explicitly authorizes it.
7. Link and deploy a Vercel preview; document migration and rollback. Do not
   change production DNS/domain routing without explicit approval.
8. Run every Phase 1 check, commit and push the completed phase, summarize the
   evidence, and stop for approval before Phase 2.

## Scope guard

Do not implement the questionnaire, watch catalogue, research pipeline,
embeddings, RAG, Mastra recommendation workflow, or production result email in
the next session unless Phase 1 has first been completed and the owner has
explicitly approved Phase 2.
