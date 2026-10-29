# Production readiness and routine operations

Checkpoint: 2026-10-29. This follows the first-use validation phase in the
implementation roadmap; it does not certify every historical cache or catalogue
claim. Production evidence is recorded after deployment in `docs/reports/`.

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
  paused. The daily legacy price cron returns an explicit successful **skipped**
  response and makes no paid calls; stale prices remain visible in readiness
  warnings. This does not claim a functioning daily price refresh.

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
The current proof is `reports/local-backup-rehearsal.json`: 54 tables, 178,540
rows and 51 foreign keys. This is not a complete Supabase-project restore:
auth/storage/roles and managed backups/PITR are outside its scope. Scheduled
off-machine backups and managed retention have not been verified with the
available project credentials; a local snapshot alone is not ongoing disaster
recovery protection.

## Readiness boundaries

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
