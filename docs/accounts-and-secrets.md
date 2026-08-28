# Accounts, API keys, and MCP configuration

This document separates three identities that are easy to confuse:

1. The ChatGPT account used to run Codex.
2. The GitHub/Vercel accounts used to own and deploy the repository.
3. Project API credentials used by the application at runtime.

Changing one does not change the others.

## Current local account evidence

Checked on 2026-08-27:

- Codex CLI authentication method: **ChatGPT login**. The CLI status command
  does not reveal the email; inspect the Codex/ChatGPT profile menu to see it.
- Git commit identity is configured locally but is intentionally not recorded in
  this public repository.
- GitHub CLI targets the repository owner's account, but its cached token is
  currently invalid.
- Vercel CLI account: `alexisinwork`; project ownership is the
  `alexisinworks-projects` team.

Do not infer repository ownership or API billing ownership from the git commit
email. They are separate credentials.

## Switching the Codex account

For the current desktop/web session, open the profile menu, log out, and sign in
with the desired ChatGPT account/workspace. A running agent cannot choose or
enter another person's interactive login on the owner's behalf.

For Codex CLI:

```bash
codex login status
codex logout
codex login
```

The final command opens the ChatGPT browser sign-in. On a headless system use
`codex login --device-auth`. Signing out of the CLI also affects the IDE
extension because they share cached credentials.

The application should not use this personal login. Create a dedicated OpenAI
API project and project service-account key for The Reserve.

## Keys to create

| Service | Credential | Required | Account recommendation |
| --- | --- | --- | --- |
| OpenAI Platform | `OPENAI_API_KEY` | Optional Phase 5/6 | Dedicated project service account named `the-reserve-app`; apply project budgets and limits. The SQL-first recommendation baseline does not require it. |
| OpenAI Platform | `OPENAI_PROJECT_ID`, `OPENAI_ORG_ID` | Optional | Record the dedicated project's IDs when the account belongs to multiple organizations/projects. |
| Perplexity | `PERPLEXITY_API_KEY` | Phase 5 and research MCP | Dedicated project/key for catalogue research so spend is isolated. |
| Beehiiv | `BEEHIIV_API_KEY`, `BEEHIIV_PUBLICATION_ID` | Phase 7 | Existing The Reserve publication; use only server-side. |
| Supabase API | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Phase 4 web runtime | Project `osfqexnzgkksfvaocjvl`; the public key can execute only the narrow read-only RPC boundary and has no table grants. |
| Supabase Postgres | `DIRECT_DATABASE_URL` | Migration/research maintenance only | Use a direct/session-pooler credential only for jobs that require SQL. It is not needed by the production recommendation route. `pgvector` is not enabled. |
| GitHub | `GITHUB_PAT_TOKEN` | MCP only | Fine-grained PAT restricted to `alexisinwork/the-reverse-watch`; add write permissions only when needed. |
| Vercel | OAuth for MCP | Phase 1 | Sign in to the account/team that will own `thereserve.watch`. |
| Vercel | `VERCEL_TOKEN` and IDs | Optional automation | Use only for non-interactive CI; OAuth is preferred for interactive MCP work. |
| RunPod | `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID` | Optional Phase 6 | Needed only if the later semantic experiment includes hosted Ollama. |
| Context7 | `CONTEXT7_API_KEY` | Optional | Higher documentation limits; unauthenticated MCP works for basic use. |
| Upstash | Redis REST URL/token | Phase 7 | Rate limiting and request deduplication. |
| Resend | API key and sender | Optional Phase 7 | Transactional dossier delivery; Beehiiv remains the newsletter opt-in system. |
| Sentry | DSN | Optional Phase 7 | Production error reporting. |

Real credentials go into the ignored `.env` file locally and encrypted Vercel
environment settings in production. Never add secrets to `.env.example`,
`.codex/config.toml`, issues, commits, or chat messages.

Official setup pages:

- [OpenAI API keys](https://platform.openai.com/api-keys) and
  [project service-account keys](https://developers.openai.com/api/reference/typescript/resources/admin/subresources/organization/subresources/projects/subresources/service_accounts/subresources/api_keys/methods/create)
- [Perplexity API quickstart](https://docs.perplexity.ai/docs/getting-started/quickstart)
- [GitHub fine-grained personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
- [Vercel MCP and OAuth setup](https://vercel.com/docs/agent-resources/vercel-mcp)

## Research and optional model routing

The Phase 3/4 catalogue and recommendation baseline uses PostgreSQL, SQL hard
filters, and explicit weighted scoring. It has no model or embedding runtime
dependency. The services below support catalogue research or a later evaluated
semantic experiment.

### Perplexity

Use the current Agent API presets rather than starting new work on the legacy
Sonar endpoint:

- `pro-search` — standard discovery, product-page research, and routine brand
  updates.
- `deep-research` — difficult ownership, lineage, litigation, sourcing, and
  contradictory-claim investigations.
- `advanced-deep-research` — exceptional audit cases only, after evaluation and
  cost review.

Dynamic presets intentionally allow Perplexity to improve their underlying
models. Raw request metadata and preset name must be retained for reproducibility.

### OpenAI

- `gpt-5.6-luna` — optional high-volume extraction and normalization.
- `gpt-5.6-terra` — optional free-text/semantic experiment.
- `gpt-5.6-sol` — selective quality audits and difficult edge cases, not every
  request.
- `text-embedding-3-large` — optional Phase 6 semantic experiment.

Any generation uses the Responses API with Zod-validated structured output.
Model choices remain configurable and must pass the project's deterministic
evaluation baseline. Arbitrary fixed-size dossier chunking is not planned.

## Project MCP servers

The committed `.codex/config.toml` configures:

| Server | Authentication | Default policy | Purpose |
| --- | --- | --- | --- |
| `openai_docs` | None | Read automatically | Current official OpenAI documentation. |
| `context7` | None initially | Read automatically | Current React Router, Zod, database, and package docs. |
| `perplexity` | `PERPLEXITY_API_KEY` | Read/research automatically | Search, reasoning, and deep research. |
| `vercel` | OAuth | Confirm writes | Projects, deployments, domains, and logs. |
| `github` | `GITHUB_PAT_TOKEN` | Confirm writes | Repository, issues, pull requests, and Actions. |
| `supabase` | OAuth, project-scoped | Confirm writes | Database schema, migrations, logs, and project documentation. |
| `playwright` | Local process | Prompt | Deferred Phase 7 browser verification; disabled during Phases 1–6. |

Project MCP configuration is loaded on a new Codex session from this trusted
repository. API-key-backed servers read variables from the process environment;
they do not automatically parse `.env`.

Load the local values before starting Codex:

```bash
set -a
source .env
set +a
codex
```

Then verify and authenticate:

```bash
codex mcp list
codex mcp login vercel
```

Do not authenticate Vercel until the browser shows the intended new account and
team. GitHub and Perplexity use the environment-variable tokens and do not need
an OAuth login in this configuration.

Supabase MCP is restricted to project `osfqexnzgkksfvaocjvl`. The application
does not need a Supabase management key or database password at web-request
time. Vercel calls the versioned accepted-facts and hard-filter RPCs with the
project URL and publishable key. A direct or session-pooler connection remains
appropriate for migrations or future bulk research workers. Do not enable
`pgvector` unless the optional Phase 6 experiment reaches its entry gate.

As of 2026-08-28, nine migrations and seed loading were completed through the
project-scoped Supabase MCP. Vercel Production and Preview have the two public
Supabase runtime values. The live catalogue and SQL hard-filter RPCs pass strict
shape, fact, and six-profile predicate parity against the bundled fallback.

## Local validation

Run the checker without exposing values:

```bash
node scripts/check-env.mjs
node scripts/check-env.mjs --phase research --strict
```

The first command reports readiness by group. `--strict` exits non-zero when a
required variable for the selected group is missing.
