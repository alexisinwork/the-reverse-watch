# Production readiness and routine operations

Checkpoint: 2026-10-29. This follows the first-use validation phase in the
implementation roadmap; it does not certify every historical cache or catalogue
claim. Production evidence is recorded after deployment in `docs/reports/`.

Owner acceptance boundary, 2026-10-29: hosted Shopify testing is excluded and
automatic managed/off-site backups are explicitly deferred ("оставь на будущее").
The read-only Supabase check now succeeds but observes zero available backups,
no physical recovery window and PITR disabled. This is a known data-protection
gap retained for follow-up, not a claim of full disaster-recovery readiness.

Update 2026-11-27: the owner moved the project to Supabase **Pro** with
**Micro** compute (1 GB memory, 60 connections, pooler in transaction
mode). Read back through the Management API that day: daily backups, 9
kept (2026-11-20 to 2026-11-27 10:27 UTC), PITR off; disk 2 GB gp3, 41%
used, growing by itself at 90%; network open to all addresses; Enforce
SSL off at that moment (the owner switched it on later the same day; the
Management API reports `"database": true`). From the database: 463
MB, cache hit 99.9% for tables and indexes, a handful of idle connections.
Vercel's CDN served the public pages from its cache on the second request
(`/watches`, `/watches/find`, `/partners`, `/start`, `/privacy`,
`/embed.js`); the gated tools render per request in about 0.2 s.

## Launch check, 2026-11-27 (release readiness for 2026-12-06)

Evidence collected on the deployments of `10acd2e` and `2ef81a0`:

- **Production monitor:** the hourly GitHub workflow "Production readiness"
  had failed on every scheduled run since 2026-11-26 12:48 UTC:
  `/internal/operations/health` answered 503 because six paid-check
  reservations of $0.20 each (created 2026-11-26 11:18 and 16:35–16:42 UTC,
  most likely by interrupted local evaluation runs; none since) were still
  "reserved" after 15 minutes. They were settled exactly as
  `ai_watch_validation_reserve_v5` settles them on a retry: the whole
  reserve counts as spent ($1.20 moved from reserved to spent; the month's
  remaining allowance is unchanged at $74.87). The route answers 200
  "ready" again, and a manual run of the workflow passed (run
  `46063923821`).
- **Checks:** `scripts/verify-all.ts --production` 15 of 16 PASS; "Page
  speed (production)" failed only because Node on the agent's machine could
  not connect over IPv6 (curl could). Run again with
  `--dns-result-order=ipv4first` it passed: public pages 31–50 ms from the
  CDN in fra1 (`docs/reports/page-speed-verify-ipv4.json`). GitHub's
  Application checks, Security checks and Search quality evaluation are
  green on every push of the day.
- **Errors:** Sentry: no unresolved issue in 7 days; an alert rule for
  high-priority issues is on. Vercel: three error lines in 7 days, none
  repeating (a Beehiiv "validating" status, fixed in `99bfc9c` five minutes
  later; a statement timeout during the bulk catalogue writes of
  2026-11-27 09:56 UTC; one store read timeout on 2026-11-25).
- **Secrets and dependencies:** no key or database address in the client
  build, `.env` is not tracked, gitleaks green; `npm audit --omit=dev`: 0
  high or critical, 5 moderate in `glob`/`minimatch` (patterns are never
  taken from visitors).
- **Privacy and consent:** nothing from another site loads before consent;
  the only cookies are the owner's admin cookie and the diagnostic unlock
  cookie after a sign-up; Vercel Web Analytics sets none. The privacy
  policy (updated 27 November 2026) gives an email but not the name of who
  runs the site, which GDPR article 13(1)(a) asks for:
  `docs/OWNER_QUESTIONS.md` #15.
- **Search engines:** robots.txt, sitemap.xml (59 addresses) and a
  canonical link on every public page were added (`2ef81a0`); the copy at
  the-reverse-watch.vercel.app names thereserve.watch as canonical.
- **Fonts and images:** Inter and Fraunces are self-hosted (SIL Open Font
  License). Watch photographs are the makers' and shops' image addresses
  (never stored files), an accepted risk recorded in `AGENTS.md`.
- **Review queue:** 3 watches left for the owner (`docs/OWNER_QUESTIONS.md`
  #14). Prices to check by hand: https://claude.ai/artifact/JmMRd9Uj9JuB2rcLBYknCE.
- **Backups:** Supabase Pro keeps daily backups (9 on 2026-11-27, PITR
  off). A fresh local snapshot, `2026-11-27T22-54-06-348Z` (56 tables,
  227,676 rows, 53 foreign keys), was restored in the rehearsal: file and
  exact row hashes match, constraints and relationships hold, and the
  temporary restore was rolled back (`docs/reports/local-backup-rehearsal.json`).
  A restore of the whole Supabase project (auth, storage, roles) was not
  rehearsed.
- **Rollback:** Vercel keeps every production deployment; `vercel rollback`
  (or "Instant Rollback" on the deployment page) returns to the previous
  one. Every migration since 0100 is additive (no drop, truncate or delete),
  so the previous code runs on today's database.

Latest verified application source: `91e6c1d`, READY as
`dpl_8yGz4G2coeJM8hNv82UtnDJT4qXY`. Clean CI `40915966906` passes 716 tests
and the complete code gate. Twelve desktop/mobile checks, seven native/real
WordPress scenarios and the independent remote monitor `40916428562` pass.
Migration 0113's applied lost-ack test and live 204/204/one-row probe establish
idempotent delivery. A real production-frame browser check records all five
widget tools and advisor tab clicks in one anonymous journey, with zero paid
attempts and guarded cleanup of its ten events. Protected operations v4, admin
country/feedback views, full catalogue and complete saved-result public/partner
API smoke pass. Repeat cache/empty cron checks add no charge or attempt. The
surrounding production error-log inspection returned no runtime errors. Details
and the temporary local network diagnostic route: `analytics-delivery.md`.

Source `f477108` is deployed READY. Live checks prove authenticated readiness,
public/browser rejection, private aggregate analytics, country/yes-no feedback UI,
56,719 catalogue records, repeated actor/archetype results and registered partner
find/quiz/alternatives APIs. The origin rejection is 403, and the complete saved
result smoke added no paid attempts or cost. The first remote monitoring run
`40896399369` passed. Browser verification passed 12 desktop/mobile tests and
seven native/real local WordPress tests. The new clean-checkout CI exposed missing
route-type generation before lint; the lint command now generates its required
types. The corrected clean-checkout run `40897301790` passed all 681 tests,
types, lint, format and production build. Source `b0f9f0e` is READY as
`dpl_J15CD3z2weuBCgG39j4Y2HxrLUNN`; remote monitoring run `40897685444` and
the complete public/API smoke passed on that release. Applied database tests
also passed reservation ceilings, monthly exhaustion, retry cooldown, abandoned
recovery and analytics permissions. No runtime errors were returned by the
production error-log inspection covering the operational rollout.

The documentation checkpoint `2f6583d` also deployed READY
(`dpl_C3hemjx9fs84GcWterihE3DgWUeR`) and its clean CI run `40898519121` passed.
Additional read-only probes with the available local service credentials passed:
Redis PING, Beehiiv publication access and Resend sender-domain verification.
No subscription or email was created. These probes do not establish inbox
delivery or compare local credentials with every production environment value;
evidence is `reports/service-access-readonly.json`.

Latest application source `a57e2fe` is READY as
`dpl_Bj5Lr4DqgYjJ4xeGBUFXT6gQm3hq`. Migration 0112 and its transactional/applied
checks restore bounded daily price maintenance. Clean CI `40906976143` passed
all 701 tests/build; remote monitor `40907242447`, twelve browser checks,
catalogue/analytics admin and the complete public/partner API smoke passed.
Production cron auth, `no_due` and repeat checks added no charge; this does not
claim a new live price was found. Existing cached results also added no charge.
Evidence: `reports/price-refresh-production.json` and the updated operational,
catalogue and validated-cache reports.

The unrelated legacy GitHub Pages job tried to render the engineering context
as Liquid and failed. Its Pages build mode was switched from branch-triggered
`legacy` to `workflow`, retaining its existing custom-domain setting and history;
no Pages deployment workflow is installed. Vercel remains the active application
deployment. This removes future automatic Jekyll runs, not their historical
failure records. See the GitHub Pages REST API `build_type` contract:
https://docs.github.com/en/rest/pages/pages#update-information-about-a-github-pages-site.

## Checks and failure handling

- `/health` is public process liveness. It does not prove database/provider health.
- `/internal/operations/health` requires the separate 32+ character
  `OPERATIONS_TOKEN`, rejects browser-origin requests, and returns no secrets,
  visitor data or search text. It checks a narrow database contract, catalogue
  availability, RLS/direct grants, server-only analytics, budget safety and stuck
  reservations. Provider/newsletter/rate-limit configuration is checked for
  presence; this is not a paid provider probe or a newsletter delivery test.
- The hourly **Production readiness** GitHub workflow checks both routes without
  paid research. `RESERVE_OPERATIONS_TOKEN` is its only application secret. A
  failed check retries once and then fails the workflow, using GitHub's standard
  notification channel. Inbox delivery depends on the owner's GitHub notification
  preferences; no email destination or delivery is assumed.
- **Application checks** runs the fast development gate on main pushes and PRs.
  Both workflows use pinned official actions and read-only repository permissions.
- An interrupted validation reservation is recovered when the same query is
  retried after 15 minutes. Its unknown provider cost is charged at the entire
  reservation before a retry can reserve more. Known overruns remain halted;
  they cannot be cleared by expiry. Other abandoned keys are exposed by monitoring
  until revisited, rather than silently forgetting possible charges.
- Legacy bulk research, unknown-target alternatives and pre-owned refresh remain
  paused. The daily price route now uses the separate bounded maintenance flow
  in `metered-price-refresh.md`: up to eight already-priced stale references,
  one batch/day, sharing the visitor ledger. Changes await review and retain
  their approximate-price label. No unpriced import archive is researched by
  this job. Operations monitoring detects a missed daily run after 48 hours.

- Spend alerts (2026-11-26): the hourly cron `/internal/spend-alert`
  (`CRON_SECRET` bearer) reads the ledger and the per-provider counters
  (`provider-spend.server.ts`, Upstash Redis) and emails `SPEND_ALERT_EMAIL`
  through Resend once per mark: the month's ledger at $5, 10, 25, 50, 75, 90
  and 100, Perplexity alone at $5 and $10 (its balance is prepaid), and at
  once when the ledger halts. Checked in production: without the secret it
  answers 401; with it, `{"ok":true,"sent":false,"marks":[]}`. The counters
  are best-effort; the ledger stays the authority on what may be spent.

When a workflow fails, inspect its run first, then `/admin/catalogue` for the
budget and Vercel/Sentry for application errors. For database unavailability,
restore connectivity before retrying. For an overrun, reconcile provider billing
and the retained ledger before changing the safety hold; never reset production
data or discard reservations. An ordinary exhausted monthly allowance is a warning,
not a failed readiness check: existing validated results remain available.

## Local application-data backup

```powershell
node --env-file=.env --import tsx scripts/export-local-catalogue-snapshot.ts
node --env-file=.env --import tsx scripts/rehearse-local-snapshot.ts data/watch-archive/local-snapshots/<snapshot-id>
```

Format 2 snapshots include every non-extension application-owned table in public
and private schemas, including intake, validated snapshots, reservations/budgets,
partner configuration and analytics. One read-only repeatable-read transaction
provides a consistent point in time. Original PostgreSQL JSON text preserves
numeric precision; manifests retain hashes, row counts and migration names.
The ignored directory can contain partner credentials: keep it private and out
of Git, deploys and shared artifacts. Prior snapshots are retained.

The rehearsal restores into temporary copies inside a rolled-back transaction,
checks file hashes, exact row hashes, local constraints/indexes and relationships
between restored application tables. It never overwrites an application table.
The current proof is `reports/local-backup-rehearsal.json`: 56 tables, 227,676
rows and 53 foreign keys from `2026-11-27T22-54-06-348Z`, including the
catalogue, its fact log, the daily-run ledger and analytics delivery IDs (the
previous proof, 2026-10-29: 55 tables, 178,700 rows, 52 foreign keys). Its exact original
columns also restore against the additive 0113 schema. This is not a complete Supabase-project restore:
auth/storage/roles and managed backups/PITR are outside its scope. Scheduled
off-machine backups remain deferred; a local snapshot alone is not ongoing
disaster recovery protection.

### Managed backup inspection

```powershell
node --env-file=.env --import tsx scripts/check-managed-backups.ts
```

The scoped token works: backup-list HTTP 200, zero listed/completed backups,
empty physical recovery metadata, `pitr_enabled=false`, `walg_enabled=true`.
WAL-G being enabled does not prove an available restore point. The custom
schedule endpoint returns 402 and is Enterprise-only; this does not establish
the project's plan or disprove default daily backups. Configured retention is
unknown because the list response does not expose it. Evidence:
`reports/managed-backups-production.json` (2026-10-29 21:29 UTC).

The verifier uses GET only, validates the response and logs/writes selected
metadata without credentials or raw upstream bodies. Exit 2 means no restore
point was observed; exit 1 means metadata could not be verified. It does not
treat authentication success as backup readiness. API contract:
[backup list](https://supabase.com/docs/reference/api/v1-list-all-backups) and
[custom schedule](https://supabase.com/docs/reference/api/v1-get-backup-schedule),
retrieved 2026-10-29. No plan/PITR purchase, schedule change or production restore
was performed. The owner deferred automatic backup setup after seeing this result.

## Readiness boundaries

Owner scope update, 2026-10-29: ignore hosted Shopify verification for the current
completion goal. Existing Shopify files remain available; no hosted-store test
is claimed. Supabase metadata inspection is now complete; automatic managed or
independent off-site backup setup is also deferred by the owner's later decision.

For that read-only check, create a scoped personal access token for this project
only, start with No access and grant **Backups: Read**. Store it as
`SUPABASE_ACCESS_TOKEN` in the ignored local `.env`, never in chat or Git.
This scope permits reading the backup schedule/list without permitting restores
or schedule changes. Source: [Supabase token permissions](https://supabase.com/docs/guides/platform/personal-access-tokens)
and [backup API](https://supabase.com/docs/guides/platform/backups), retrieved
2026-10-29. An application service-role key does not establish Management API
access. Backup metadata verification does not itself prove a full project restore.

The release supports the demonstrated catalogue, five shared tools, admin,
native widgets, local real WordPress runtime and origin-checked partner API.
Historical unverified queries are validated on first use, not pre-certified by
a catalogue-wide paid run. Missing evidence returns an explicit unavailable or
insufficient-data result. Approximate prices remain labelled. A cached result
can still incur cold catalogue-read latency, previously about 20 seconds.

Before promising a particular hosted Shopify/builder installation, test that
actual platform/store and origin. No account/runtime was supplied for such a
test. Managed backup retention, alert inbox delivery, newsletter/dossier email
delivery and third-party catalogue redistribution rights must not be described
as proved by the code gate or local widget tests. These are distinct from the
verified first-use research and spend-control implementation.

## Security checks (2026-11-25)

The Security checks workflow (`.github/workflows/security.yml`) runs on every
push and weekly.

- PASS gitleaks over the full Git history: no committed secret found. This
  closes the whole-history secret scan listed as pending in the business plan.
- Semgrep: the widget messages its parent page only at the partner's
  registered websites instead of `*` (`embed-bridge.ts`).
- npm audit: high-severity advisories in `body-parser` and `compression`
  (server dependencies) were fixed within their version ranges.
- Closed 2026-11-26: Supabase signs its database certificate with its own
  certificate authority, which Node does not trust, so the database scripts
  used to encrypt without verifying the server. The owner downloaded the CA
  certificate (`certs/prod-ca-2021.crt`, "Supabase Root 2021 CA", valid until
  2031-04-26); all 61 scripts now connect through `scripts/database-tls.ts`,
  which trusts only that authority and checks the host name. Checked against
  the production pooler: verified with the certificate, refused without it
  ("self-signed certificate in certificate chain") and refused for a wrong
  host name. No Semgrep exception remains.
