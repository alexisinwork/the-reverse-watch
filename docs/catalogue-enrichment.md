# Full source import, enrichment and feature propagation

Owner authorization, 2026-10-25: add all imported watches, find missing technical
facts and image URLs, recheck affected catalogues/features. This supersedes the
earlier image/research deferral. First-pass allowance: **USD 100**, chosen by the
owner, explicitly **Perplexity only** (owner correction below). It does not authorize unlimited spending or imply all 42k records can be
fully verified for that amount.

## Delivered integration

Owner follow-up, 2026-10-25: approved all currently pending editorial records
in a backed-up transaction: 41,899 approvals, leaving 44,877 approved, three
rejected and zero pending at that checkpoint. Approval does not confirm prices,
references or missing facts. Full admin pagination now covers all 44,880 rows;
the former 3,118 count was the smaller recommendation read model. Separate totals
show the recommendation pool and 41,762 imported records awaiting a verified price.
This is one-time approval, not automatic approval of future finds. The owner also
explicitly requests Perplexity API research for unverified claims/references and
image URLs; the worker now pins its research provider accordingly, retaining the
independent Muse price cross-check. The $100 allowance applies to Perplexity only.
Delivery: `74b3d33`, production deployment
`dpl_8Jq9e6g8uMM4A6fWrWJ21RsZt29Q`. Authenticated production GET returned HTTP
200 and showed the entire 44,880-row catalogue plus separate recommendation and
unpriced-import totals. Evidence: `docs/reports/admin-catalogue-production.json`.
The fast gate passed 529 tests; the worker remained active under its existing
allowance. Editorial approval does not reset research progress or spending.

- All 42,590 source records are archived in `private.watch_catalogue_intake`,
  with source commit, original source pointers and assertions. Original local
  snapshots and normalized files remain in ignored `data/watch-archive/`.
- 41,771 new identities inserted into `private.watch_catalogue`, taking it from
  3,109 to 44,880. Existing IDs, approved/rejected records and facts are preserved.
  212 missing/duplicate/ambiguous source identities are held outside auto-promotion.
  The live write uses the application's existing `catalogueIdentityKey`, which
  differs from the deliberately stricter diagnostic key in the first audit;
  these figures are not counts of independently verified watch variants.
- Bare imported identities contain no invented prices, technical facts, image
  URLs or style tags. Source-declared assertions remain in the archive until
  independently grounded. Dataset URLs are provenance, not primary confirmation.
- Recommendation reads include priced imported rows as they become eligible.
  Unpriced identities can still resolve named alternative targets and be found
  in admin search without transferring the entire 170MB archive on every request.
  Required unknown facts still fail their filters.
- The admin catalogue shows source/queue counts and searches imported identities.
  After the owner count correction, its paginated lists cover the entire master;
  separate totals identify the smaller recommendation pool and unpriced imports.

## Automatic research worker

```powershell
# Idempotent archive/import; never overwrites existing accepted facts:
node --env-file=.env --import tsx scripts/import-local-catalogue.ts --write

# Persistent allowance shared across restarts, not $100 every invocation:
node --dns-result-order=ipv4first --env-file=.env --import tsx scripts/enrich-local-catalogue.ts --budget 100

# Live counts, permissions and exact-reference propagation checks:
node --env-file=.env --import tsx scripts/catalogue-enrichment-report.ts

# Recheck only imported primary-reference confirmations:
node --env-file=.env --import tsx scripts/recheck-imported-references.ts
```

The worker uses the existing Muse/Perplexity abstraction. It sends watch identity
and search constraints only, never visitor/session/email data. Claimed facts need
a verbatim quote on an independently fetched manufacturer or authorized-retailer
page which confirms the reference. Field labels, values and units must agree;
nominal water-resistance ratings in bar/ATM normalize at 10 m per unit. Rectangular
length/width pairs cannot become a diameter. Invalid/unreachable facts remain
unknown. Fetched evidence, rejected/missing fields, source pages and the sanitized
research result are retained. Two independent current-price checks still apply.
Images are URL-only, validated by the existing source/photo pipeline; no image
files are downloaded or stored.

Reference checking now preserves boundaries: a page naming SPB153J1 cannot confirm
SPB153 merely because its text contains that prefix. An imported confirmation
which fails a strict recheck loses confirmed-reference/price eligibility; the
observed values and original evidence remain available. Existing accepted
conflicting facts are not silently overwritten by the worker; newly found
assertions are preserved in its evidence for reconciliation.

Jobs use row leases, retries and a single-worker advisory lock. Upstream failures
are saved and five consecutive errors stop the run rather than burning through
the allowance. Perplexity reservations happen before requests, including retries:
$0.10 per chat request, settled to `usage.cost.total_cost` when returned; successful
Search requests cost $0.005. Successful chat responses without reported cost retain
their estimate; uncertain transport failures retain the reservation. Muse calls
are counted separately and do not consume this Perplexity allowance. Account billing
remains the final source of charges; this is not an account billing integration.

The previous $93.20 value combined conservative estimates across providers and
was **not actual Perplexity spend**. It remains as a historical counter. The owner
reports approximately $5 actual Perplexity spend at this correction; the new ledger
uses that explicitly owner-reported baseline plus subsequent response-reported
costs, estimates and pending requests. It does not claim the $5 was independently
retrieved or verified. Sequence numbers preserve settlements across restart even
when Windows/OneDrive refuses the display snapshot rename.

Local continuity files (ignored):

- `enrichment-progress.json`: historical reserve, separate Perplexity billing and results.
- `enrichment-allowance.jsonl`: authoritative append-only reservation journal;
  recovers the latest sequence (legacy highest reservation) if Windows/OneDrive locks a snapshot.
- `enrichment-results.jsonl`: locally mirrored fact/source results.
- `enrichment-worker.log`, `enrichment-worker-error.log`, `enrichment-worker.pid`:
  background worker evidence. No secrets are included in CLI arguments.

Do not reset the progress file to bypass the owner's allowance. A machine restart
requires restarting the worker command; leases expire safely. This is a local
worker, not a Vercel-hosted permanent cron. The admin counts are live; committed
reports are dated snapshots and do not assert completion of the remaining queue.

## How updates reach features

| Feature | Read path |
| --- | --- |
| Quiz, app/widget/API | Catalogue filtering sees newly eligible priced entries; stored live results get exact-reference hydration. |
| Alternatives, app/widget/API | Named lookup covers imported identities; live identification can fill an incomplete target; candidate ranking uses the current priced catalogue. |
| Archetype, app/widget/API | Existing editorial picks receive current facts/photos. Version-1 technical-role scoring supplements up to five slots with newly enriched, priced, photographed fits. Recognition/prestige is never inferred from specs. |
| Film/people, app/widget/API | Saved and fresh results receive current exact-reference facts/photos, preserving all sighting/person/work evidence. Owning a product record never creates a celebrity association. |
| Story detail, app/widget/API | Exact identified references can show a product photo, explicitly separate from attribution evidence; family-only identifications remain unfilled. |

`catalogue-result-enrichment.server.ts` is the common hydration layer; it preserves
reference suffixes, requires a unique brand/reference match, keeps attribution
sources intact and never replaces pre-owned prices with retail prices. Cached
results do not require a destructive cache rewrite. Ordinary catalogue ranking
reads have a five-minute process cache; fresh detail hydration reads current rows.
An already open result page needs reloading to receive changes.

Archetype role supplements keep at least five editorial picks where available;
they are not a new brand-history or psychology classifier. Family/title similarity
never joins different reference configurations. The shared legacy photo fallback
also no longer falls back to a related model when an explicit reference differs.

## Evidence and current limits

Migrations 0076â€“0079 are additive and applied. Private intake has RLS; new lookup,
named-search and status RPCs execute for service_role only. After bulk import,
covering state/source indexes, statistics and disabling JIT on the count RPC
removed a reproduced administrative count timeout.

See `docs/reports/catalogue-import.json` and
`docs/reports/catalogue-enrichment-status.json`. The latter checks actual DB
counts, payload objects, access grants and propagation from the new lookup into
the shared result helper. Initial real research found photos and confirmed
prices; missing dimensions/water resistance on some references remain null.
`enriched` means an enrichment attempt established the primary identity and
some results, **not** that every field is known or every feature ranks that watch.

The technical gate passes unit tests, strict types, lint, format and production
build: 529 tests in 87 files passed. Live DB verification also demonstrated new
Seiko SPB153/SPB183/SPB301 eligibility for a suitable quiz profile and membership
in the current field-rationalist archetype result. A priced SPB257 with missing
diameter/movement still fails those active constraints. Archetype route tests now
mock FX instead of depending on the live ECB
feed that caused the previous five timeouts. Browser/store installations are
not claimed retested merely because these shared routes pass their unit checks.
The first paid pass continues in the local worker until its saved allowance or
error stop is reached; the remaining queue is explicitly unfinished.

Production checkpoint: code commit `31f3e04` deployed as
`dpl_6MQnwKQTfSL7pQ9UkENDpYr8zqus`, READY and aliased to
`https://thereserve.watch`. The CLI needed explicit scope
`alexisinworks-projects`; default-scope deploy initially returned Not authorized.
Initial default-network checks timed out, including a Vercel API fetch. A
subsequent IPv4 smoke check succeeded: `/health` and the complete field-rationalist
archetype page both returned HTTP 200; the public HTML contained SPB153, SPB183,
SPB301 and the new role-supplement rationale. Live DB/helper checks and the
529-test gate passed. The local worker was resumed with IPv4-first DNS and its
durable allowance journal; deployment/auth scope does not control that process.

## Space City supplement and Dials cache checks (2026-10-25)

The owner's additional source is https://spacecitytimepiece.com/watches. Its public
index https://spacecitytimepiece.com/api/v1/watches.json declares CC BY 4.0 and
upstream Chrono24 secondary-market observations from 2017–2023. Downloaded all 26
brand files: 25,385 observations, 21,540 identity keys. Added 10,149 unambiguous
missing identities, bringing the master to 55,029. Existing identities retain
accepted facts; all observations and attribution are in private intake and ignored
local snapshots. Ambiguous duplicates remain blocked. It includes Seiko and other
non-luxury brands too, and is not complete luxury coverage. Conflicting size arrays
and historical listing prices cannot establish specifications or current MSRP.

```powershell
node --dns-result-order=ipv4first --env-file=.env --import tsx scripts/import-spacecity-catalogue.ts --write
node --dns-result-order=ipv4first --env-file=.env --import tsx scripts/recheck-cached-watches.ts --limit 500
```

Dials API checks match the complete brand/reference, including suffixes, then
compare available diameter, thickness, water resistance and movement. They are
secondary corroboration, not primary confirmation. Missing values never agree.
No images are downloaded or hotlinked. Individual comparison records are retained
under ignored `data/watch-archive/cache-corroboration/`; subsequent runs skip
already checked IDs. Cached answers, membership, ranking and attribution are not
rewritten. Conflicts remain unresolved evidence for primary research, never an
automatic good-to-go stamp. Dated totals are in `docs/reports/cache-corroboration.json`.

Budget sources: [Perplexity pricing](https://docs.perplexity.ai/docs/getting-started/pricing)
($5/1,000 successful Search requests), and the official
[cost response announcement](https://community.perplexity.ai/t/cost-information-now-included-in-api-response-json/833).
Dials: [reference](https://docs.dials.co/api/reference),
[terms](https://docs.dials.co/api/terms). Retrieved 2026-10-25.

### Space City facts and local Dials mirror (2026-10-25)

Matched all 18,124 Space City source claims with exact local identities. Unique
specifications were written only into null fields; source-specific CC BY evidence
is retained. All 11,857 identities in the ten requested luxury brands were
already represented locally. Catalogued references are labeled separately from
manufacturer-confirmed references. Updated 132 of 1,219 cached entries from exact
local matches without changing membership, ranking, existing facts or prices.

The free Dials mirror is resumable and currently downloading its 41,996 model
records at the published request limit. Raw JSONL stays in ignored local archive.
No photos or seller prices are imported. Dials requires a linked model-page
attribution; widget exposure awaits the owner's choice about that requirement
versus the existing link-free widget screen. Paid Perplexity research remains
bounded by its separate $100 cumulative allowance.
