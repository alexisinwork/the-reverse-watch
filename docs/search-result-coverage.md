# Search result coverage

Owner decision, 2026-10-30: all searches and recommendations, including partner
widgets and the API, aim for ten distinct watches and at least five where sourced
candidates exist. Uncertain associations, missing prices and missing photos may
appear with explicit labels. This supersedes the earlier rule that only the
two-source accepted subset could be visible; it does not certify those candidates.

`search-coverage.ts` composes the response after display deduplication. Checked
cards stay first, unchanged; supplementary candidates carry `verificationStatus:
unverified` and a reason. A `coverage` envelope reports minimum, target, actual
total, supplementary count and target/minimum/partial status. The UI displays all
ten immediately and explains a real shortage. No made-up watches fill empty slots.

`coverage-search.server.ts` wraps the strict snapshot store. It binds film drafts
to the exact requested person/work, reads typed and legacy drafts, clears old
unverified prices/photos/specifications, and hydrates current exact-reference
catalogue facts. Migration 0114 supplies bounded service-only reads, including
rejection status. Rejected records are excluded. Deterministic selections also
exclude obsolete cached identities before choosing the ten visible options.

If a free checked-cache hit plus local saved candidates still has fewer than five
options, one metered supplementary discovery may run under a separate coverage
key. Its saved candidates/snapshot are reused. A first paid attempt never chains
another reservation in the same issuance. Per-card $0.025, issuance $0.20 and
monthly $100 guards remain unchanged: up to eight independent checks, while one
primary discovery may retain ten cited draft candidates. Only accepted evidence
enters the certified snapshot/master transaction; draft candidates stay separate.

Quiz budget-qualified matches retain all active hard rules. Labelled price-unknown
suggestions must pass every other active constraint, including known case size,
required functions and allergy requirements. They explicitly say budget fit is
unknown. Alternatives similarly label unknown cheaper/budget status and retain
their technical matching rules. Archetype supplements retain technical roles;
brand prestige is never invented to increase the count. Known out-of-budget
watches do not enter a quiz as price-unknown suggestions.

Model-only alternative searches choose a reference with documented comparison
facts before editorial status or photo traits. An imported identity with no
styles must not win over a usable reference in the same model family. Explicit
references retain their own facts; incomplete comparison specifications produce
a recoverable explanation before metering, rather than a false budget shortage.
Mechanical-only comparisons exclude candidates whose movement is unknown.

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

Local completion evidence: 734 unit tests/full build, 12 desktop/mobile browser
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
