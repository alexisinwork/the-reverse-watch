# Local portfolio and Reserve integration

From the Reserve repository, run:

```sh
npm run dev:partners
```

This starts The Reserve at http://localhost:5173 and the sibling
`../personal-website` at http://localhost:8080. Open
http://localhost:8080/watch-advisor-demo and http://localhost:5173/admin/sites.
The admin password is the existing `ADMIN_PASSWORD` in the ignored Reserve
`.env`; it is never copied to the portfolio or printed. Stop both servers with
Ctrl+C. To use a different portfolio checkout, pass its path after `--`.

Prerequisites: install dependencies in both checkouts. The portfolio uses a Bun
lockfile; use `bun install` when available, or `npm install --package-lock=false`
for local testing without introducing a second lockfile. The Reserve requires its
existing ignored `.env` with database and provider settings.

The command finds or creates **Portfolio local integration** using the existing
partner RPCs. It permits exactly `http://localhost:8080` and
`http://127.0.0.1:8080`, starts with a 200-use monthly limit, and writes only
`VITE_RESERVE_ORIGIN` and the public partner key to the portfolio's ignored
`.env.local`. Other portfolio environment entries are retained. The local Reserve
process overrides `APP_URL`; the production environment file is unchanged.
Reserve secrets are removed from the portfolio child process environment.

Both applications run locally, but use the configured hosted database and live
providers. Searches may incur provider costs and increment this dedicated site's
counters. This setup does not create a local database or simulate search results.
Re-running the command preserves the admin's existing settings and key.

## Repeatable verification

With both servers running:

```sh
npm run test:partners
```

The opt-in Chromium suite checks all five actual frames, answers preserved across
tool switches, the six-screen diagnostic, archetype results, Heat film search,
Tudor Black Bay 58 alternatives, mobile overflow, admin configuration, loader
failure/retry, registered CSP framing, blocked unregistered framing, disabled keys,
quota enforcement and recorded usage. It creates isolated disabled/quota test
partners; quota partners are switched off in `finally`, never deleted. Static
stories intentionally remain available at quota, as specified by the existing
routes; searches and generated results enforce the monthly cap.

Additional checks: `npm run check` and the existing desktop/mobile browser suite
(`npm run test:e2e`). Browser checks are explicitly authorized by the owner for
this integration. Generated screenshots/traces remain in ignored `test-results/`.

## Publishing later

Use a separate production partner with the exact public portfolio origin. Set
the two public Vite variables in the portfolio deployment environment with
`https://thereserve.watch` as the service origin, then rebuild. Never deploy a
localhost service origin or a secret key. `/admin/sites` now provides copyable
Vite configuration alongside the script-tag snippet and native demo download.
Public-domain verification and paid-pilot evidence remain separate next actions.

## Verification record — 2026-10-25

Passed: Reserve `npm run check` (83 files / 500 tests plus formatting, lint,
types and build), existing browser suite (12 desktop/mobile checks), dedicated
partner suite (5 checks), portfolio TypeScript and production build, and targeted
lint for the new route and navigation. All five local feature counters were
observed in admin. Both development servers were left running.

The cloned portfolio's full lint baseline is not clean: existing CRLF/format
violations and four `no-useless-escape` errors in its unchanged interview preview
remain. Its bundled third-party `public/vendor` runtimes are now excluded from
ESLint, avoiding minutes spent parsing Babel. No broad reformat or unrelated
interview rewrite was performed. The demo integration's targeted checks pass.
