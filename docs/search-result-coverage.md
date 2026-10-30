# Search result coverage

Owner decision, 2026-10-30: all searches and recommendations, including partner
widgets and the API, require ten distinct display cards before a response is
complete. The later owner follow-up supersedes the earlier five-option minimum.
Uncertain associations, missing prices and missing photos may
appear with explicit labels. This supersedes the earlier rule that only the
two-source accepted subset could be visible; it does not certify those candidates.

`search-coverage.ts` composes the response after display deduplication. Checked
cards stay first, unchanged; supplementary candidates carry `verificationStatus:
unverified` and a reason. A `coverage` envelope reports minimum, target, actual
total, supplementary count and completion/partial status. The UI displays all
ten immediately and explains a real shortage. No made-up watches fill empty slots.

`coverage-search.server.ts` wraps the strict snapshot store. It binds film drafts
to the exact requested person/work, reads typed and legacy drafts, clears old
unverified prices/photos/specifications, and hydrates current exact-reference
catalogue facts. Migration 0114 supplies bounded service-only reads, including
rejection status. Rejected records are excluded. Deterministic selections also
exclude obsolete cached identities before choosing the ten visible options.

If a free checked-cache hit plus local saved candidates still has fewer than ten
options, metered supplementary discovery runs under a key containing the already
found identities. Those models are excluded from the next request. Saved partial
research is reused but cannot stop discovery below ten. A first paid attempt
never chains another reservation in the same issuance. Per-card $0.025, issuance $0.20 and
monthly $100 guards remain unchanged: up to eight independent checks, while one
primary discovery may return twenty candidates before display deduplication and
retain ten distinct cited draft candidates. Only accepted evidence
enters the certified snapshot/master transaction; draft candidates stay separate.

Exact quiz matches retain all active rules, including the precise edited case
range. The owner now permits broader labelled close fits: within the known budget
and requested movement, up to 3 mm beyond the case range, with every missing or
different function/specification stated. Nickel/allergy requirements never relax.
Price-unknown suggestions explicitly disclose unknown budget fit. Unknown source
facts remain null and are not counted as exact matches. Alternatives similarly
label unknown cheaper/budget status and technical similarity. Archetype supplements retain technical roles;
brand prestige is never invented to increase the count. Known out-of-budget
watches do not enter a quiz as price-unknown suggestions.

Model-only alternative searches choose a reference with documented comparison
facts before editorial status or photo traits. An imported identity with no
styles must not win over a usable reference in the same model family. Explicit
references retain their own facts; incomplete comparison specifications produce
a recoverable explanation before metering, rather than a false budget shortage.
Mechanical-only comparisons exclude candidates whose movement is unknown.

`complete-search-cache.server.ts` writes a separate completed-response key only
after final deduplication leaves ten options. A short result always has
`fromCache: false` and partial coverage. Existing small source-v1 snapshots and
candidate drafts are research evidence, not completed response caches. Completed
film responses rehydrate current catalogue facts and reuse their checked source
subset without repeating provider validation.

The alternatives page shows loading activity during route navigation, then
streams actual catalogue, discovery, independent provider and publication steps.
It has its own comparison messages instead of quiz-specific timed hints. Saved
results are described as previously researched, without an “Instant” promise.

Prices remain approximate and may change. Uncertain film cards say “Possible
sighting”; no missing fact receives a plausible default. In widgets provenance
stays text, and the existing Powered by credit owns the outbound link.

Verification commands:

```sh
npm run check
node --env-file=.env --import tsx scripts/test-candidate-coverage.ts
node --env-file=.env --import tsx scripts/smoke-film-search.ts "Daniel Craig" actor
```

The applied database check exercises grants, exact normalized-reference lookup,
rejection visibility, the 100-row limit and unpriced size/movement predicates
inside a rolled-back synthetic transaction. Local real-database Daniel Craig
lookup returns ten distinct cards, one certified and nine uncertain, with zero
provider calls. Deployment/browser evidence is recorded in the roadmap after
rollout; these counts do not assert that all ten associations are verified.

Earlier 5–10-policy completion evidence: 734 unit tests/full build, 12 desktop/mobile browser
scenarios and seven native/real WordPress scenarios pass. The explicit API smoke
returns find 10, archetype 10, quiz 10 and alternatives 8; desktop/mobile Daniel
Craig and the real widget script/frame show ten, with source text and only the
Powered by link in the widget. Budget remains $0.7163 spent/31 attempts, with
zero added charge or attempts. The intercepted blank local host requires the
browser's explicit local-network test permission; the real portfolio and
WordPress checks run normally. Report: `reports/result-coverage-local.json`.

Production source `dba0b83` is READY as `dpl_13q3RovMX92yuia53QBbk1tfRd5U`;
CI `41051160398` passes. The live API smoke returns find 10, archetype 10,
quiz 10 and alternatives 9, and the public desktop/mobile pages and production
widget frame pass the same display/link checks. Repeated saved requests add
zero charge and zero attempts. Evidence: `reports/result-coverage-production.json`.
This proves the tested requests and shared path; genuinely scarce future searches
still report partial coverage instead of fabricated watches.
