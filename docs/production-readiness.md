# Production readiness and routine operations

Checkpoint: 2026-10-29. This follows the first-use validation phase in the
implementation roadmap; it does not certify every historical cache or catalogue
claim. Production evidence is recorded after deployment in `docs/reports/`.

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
The current proof is `reports/local-backup-rehearsal.json`: 55 tables, 178,586
rows and 52 foreign keys, including the new daily-run ledger. Its exact original
columns also restore against the additive 0113 schema. This is not a complete Supabase-project restore:
auth/storage/roles and managed backups/PITR are outside its scope. Scheduled
off-machine backups and managed retention have not been verified with the
available project credentials; a local snapshot alone is not ongoing disaster
recovery protection.

## Readiness boundaries

Owner scope update, 2026-10-29: ignore hosted Shopify verification for the current
completion goal. Existing Shopify files remain available; no hosted-store test
is claimed. The remaining requested operational check is managed Supabase
backup availability, freshness and retention.

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
