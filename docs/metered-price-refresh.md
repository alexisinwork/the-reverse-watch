# Bounded daily price refresh

Owner's approximate-price policy and the shared monthly allowance apply.
Migration 0112 and `catalogue-price-refresh.server.ts` replace the paused legacy
cron caller; the old unmetered worker remains disabled.

At 04:30 UTC, `/internal/catalogue/recheck-prices` authenticates `CRON_SECRET`
before accessing the database. One atomic admission per UTC day selects up to
eight non-rejected, referenced watches that already have a usable price checked
over 90 days ago. Unpriced imports and pending price-review proposals are excluded.
An attempted reference waits seven days before another scheduled attempt, so
unavailable references cannot occupy every daily batch indefinitely.

Admission uses the existing durable validation ledger: at most $0.025 per card,
$0.20 per daily batch, within the same $100 monthly allowance as visitor checks.
A small remaining allowance reduces the batch size. Repeat cron requests and
exhausted-budget requests make no extra provider calls. Each card makes one
Perplexity and one independent Muse call using the shared checked-source code.
No visitor information is sent. Unknown costs consume their full reservation;
known overruns keep the safety hold. An abandoned daily run is conservatively
settled when a later cron invocation sees it after 15 minutes.

Both source pages must support the exact reference and price, in one currency,
within 5%. This lightweight flow retains an **approximate** price label, including
quotes that look like MSRP; it does not infer retail authorization from a hostname.
Missing/conflicting observations leave the existing amount and check date intact.
An essentially unchanged existing estimate gets fresh evidence/check time. A
different amount, currency or status is parked for admin review. The amount and
status remain unchanged until accepted. A concurrently edited catalogue row is
skipped rather than overwritten.

Price proposals and every card's cost are committed in one transaction. Admin
acceptance retains the estimate label and invalidates only active snapshots
containing that exact identity. The next requested result goes through normal
first-use validation. Older snapshot generations and raw cached results remain
as evidence. Daily price runs are counted separately from failed visitor checks.

Protected operations readiness checks the new RPC permissions and detects a
missing successful/empty daily run after 48 hours. Ordinary monthly exhaustion
does not take the free service down; readiness shows a budget warning instead.

Verification:

- Fast gate: 700 tests, lint, types, formatting and production build passed.
- `scripts/test-metered-price-refresh.ts` passed both transactional and applied
  checks, always rolling back synthetic rows and reservations: daily admission,
  unpriced exclusion, same-day duplicates, partial/exhausted month, source conflicts,
  concurrent edits, settlement rollback, abandoned/overrun handling, approximate
  acceptance, targeted snapshot invalidation and server-only privileges.
- Local routing against the configured production database returned `no_due`
  twice, with zero added attempts/charges and healthy operations metadata.
- Production evidence is added after deployment. An empty batch proves admission
  and repeat behaviour, not a fresh live two-provider price estimate.

Repeatable production probe (can spend at most one admitted daily batch):

```powershell
node --env-file=.env --import tsx scripts/verify-price-refresh-production.ts
```
