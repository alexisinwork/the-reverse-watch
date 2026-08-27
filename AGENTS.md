# Repository agent instructions

## Delivery boundaries

- Work from `docs/implementation-roadmap.md` one phase at a time.
- Continue automatically from one completed phase into the next. Phase statuses
  are sequencing and evidence checkpoints, not owner-approval gates.
- Commit and push verified work directly to `main`; this repository and its
  connected deployment are an owner-designated test project.
- Keep the application and research pipeline in TypeScript/JavaScript.
- Never commit `.env`, credentials, raw authentication caches, or access tokens.
- Do not print secret values in commands, logs, tests, or responses.

## Documentation and research routing

- Before planning or implementing any phase, read
  `docs/original_context.md` from its first line through its final line. Never
  replace the complete read with `head`, `tail`, first/last-200-line excerpts,
  targeted searches, or the requirements ledger. The duplication is preserved
  product history and must not be used as a reason to skim.
- Use `docs/original-plan-requirements.md` as the traceability ledger and
  `docs/implementation-roadmap.md` as the controlling phase sequence. Reconcile
  superseded technical sketches explicitly; never silently discard original
  questionnaire, brand-history, psychology, perception, dossier, media, or
  funnel requirements.
- Use the `openai_docs` MCP server for OpenAI API, model, Codex, ChatGPT, or
  plugin questions before relying on memory.
- Use `context7` for current third-party package and framework documentation.
- Use `perplexity` for watch-market and horological research that needs current
  web sources. Retain citations and retrieval dates.
- Treat Perplexity results as research inputs. Validate them against schemas and
  primary sources before accepting them into the catalogue.

## External systems

- Use `github` and `vercel` MCP tools for inspection when connected.
- Roadmap-scoped external writes, additive database migrations, direct `main`
  pushes, deployments, and configuration changes are authorized without an
  additional approval prompt.
- Never perform risky Supabase removals or other critical destructive actions.
  Prohibited operations include dropping or truncating tables, bulk destructive
  deletes, resetting production data, deleting/resetting Supabase branches or
  projects, destructive migrations, and removing critical domains, credentials,
  repositories, or deployment history. Prefer additive, reversible changes.
- Use least-privilege tokens and project/service accounts rather than personal
  keys wherever the provider supports them.

## Quality invariants

- Exact watch constraints belong in PostgreSQL; subjective matching belongs in
  semantic retrieval.
- Missing facts remain `null`; never supply plausible-looking defaults.
- Every accepted mutable or factual claim retains source provenance.
- Until the core catalogue, retrieval, and recommendation work through Phase 4
  is complete, run only the fast development gate (`npm run check`). Do not run
  Playwright/E2E suites, install browser binaries, or start long-running
  background validation jobs unless the owner explicitly asks for them.
- Keep deferred browser and integration specs current as the application grows;
  execute the full suite in Phase 5 after the main AI work is complete.
- Run the phase's non-deferred documented checks before committing and pushing
  it.
