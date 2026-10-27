# The Reserve — business plan and continuing strategy

Updated: 2026-10-25. Owner: Alex. Evidence baseline: commit `da6108a`.
This is the persistent repository record of the supplied audit/business-plan
conversation. Earlier Word documents and ZIP attachments were mentioned in that
conversation but are not available here; their contents have not been independently
reviewed. Read this plan before proposing commercial work. The
[implementation roadmap](implementation-roadmap.md) controls implementation order.

## Objective and operating limits

Owner targets: $5,000 monthly personal income after tax, then $10,000, within
6–8 hours per week. These are ambitions, not forecasts or demonstrated economics.
Use one product foundation: The Reserve media and website build trust; partner
widgets and API test recurring revenue; another vertical is a later experiment.
All five features are included for every partner. Price can vary by agreed usage
and service requirements, never by excluding features.

## What the source actually establishes

This is a focused source assessment, not a completed security, licence, production
or whole-history audit. File presence proves implementation, not live configuration,
successful installation, commercial demand or paid revenue.

| Capability | Source evidence | Conclusion / remaining evidence |
| --- | --- | --- |
| Framework-independent embedding | `public/embed.js` | Real iframe loader, five features, resizing and origin/source-checked messages |
| Partner surface | `app/routes/embed-layout.tsx`, `app/components/surface.tsx` | Reuses route modules, framing policy context and partner presentation; verify on independent host |
| Partner administration | `app/routes/admin-sites.tsx`, `app/domain/partner-sites.server.ts` | Site activation, keys, origins, quotas and counters; production settings not inspected |
| Public/server API | `app/domain/partner-api.server.ts`, `app/routes/api-v1-*.ts` | Origin-checked public keys, hashed secret lookup, SSE and rate limiting; no browser-held secret |
| Metering failure | `recordPartnerUse` in `partner-sites.server.ts` | Intentionally permits requests on counter failure; monthly cap is not a guaranteed AI spend ceiling |
| Watch matching | `app/domain/watch-catalogue.ts`, `quiz-search.server.ts`, `quiz-live-search.server.ts` | Current path filters catalogue in code and can run live research; README's historical SQL-first description is incomplete |
| Price/source checks | `app/domain/price-check.server.ts`, `ai-watch-guardrails.ts` | Verification code exists; source accuracy and live provider behaviour need operational evidence |
| Distribution | `integrations/wordpress/`, `integrations/shopify/`, `packages/client`, `packages/react` | Sources exist; directory/app/npm publication is not established |
| Retailer inventory | Current shared-catalogue partner design | No demonstrated merchant-only recommendations, stock sync or order attribution |
| Billing | Partner counters and onboarding instructions | Manual invoicing is documented; recurring payment/subscription automation not established |
| Portable demo | `public/watch-advisor-demo/` | Copyable HTML/CSS/JS with public-key placeholder; external installation still pending |

Reconciliation: owner decisions of 2026-09-30 supersede conflicting SQL-first
quiz assumptions; PostgreSQL remains catalogue storage, with code filtering and
conditional live search. The 2026-10-04 decision already authorized partner widgets
and API, superseding Phase 13's pre-development buyer gate for that scope.
Retailer feeds and a general multi-industry product remain future scope.
Keep historical questionnaire, psychology, brand-history, dossier and media intent
in `original_context.md` and `original-plan-requirements.md`; this commercial plan
does not erase or reimplement them.

## What to sell first

Offer: hosted watch discovery tools for English-speaking watch publishers,
communities and specialist retailers willing to use a shared catalogue. The
personal site is an integration demonstration, not an independent customer or
evidence of demand. Explain to retailers that results are not restricted to their
stock. Test whether that offer has value before promising a stock-aware adviser.

Start with a bounded, manually invoiced paid pilot: exact origins, all five tools,
agreed monthly usage, support window, duration and renewal decision. Use existing
onboarding and avoid bespoke features for individual prospects until their need
is repeatable. No automatic customer outreach is authorized by this document.

Media remains the audience/trust channel: release existing documentary work,
maintain the production buffer, and measure the late-video website CTA and
consented newsletter funnel. Preserve the owner/media tasks in the original plan;
they are not completed by shipping widget code. Avoid simultaneous development
of affiliate, concierge, paid report and sponsorship businesses.

## Economics: explicit assumptions, not market prices

The following USD figures are arithmetic examples only, not researched prices,
customer commitments, provider quotes or tax advice. Revenue excludes any taxes
collected on behalf of authorities. No current revenue is established in this review.

| Example | Partners | Monthly fee | Monthly revenue |
| --- | ---: | ---: | ---: |
| Learning pilot | 3 | $99 | $297 |
| Small recurring base | 10 | $199 | $1,990 |
| Larger base | 25 | $299 | $7,475 |
| Higher service/value case | 40 | $399 | $15,960 |

Track hosting/database/monitoring fixed costs F, per-partner variable costs V
(AI, research, payment fees, refunds and support), fee P and number of partners N.
Monthly operating surplus before owner tax = N × (P − V) − F. Record provider
invoices and aggregate request counts; do not derive cost from metering alone when
metering can fail. Treat support hours as a real cost and a capacity constraint.

Illustration only: P=$299, V=$40, F=$300, hypothetical effective owner tax t=25%.
For target take-home T, N = ceil((T / (1 − t) + F) / (P − V)). That gives 27
partners for $5,000 and 53 for $10,000. The assumed tax rate has no jurisdictional
claim; actual tax, contributions and entity structure need separate advice.
At 30 minutes support per partner monthly, those bases consume 13.5 or 26.5
hours monthly before sales, media and engineering. The larger base strains the
6–8 hour weekly limit. Validate higher value, lower support or a smaller scope
before treating either income target as achievable.

Measure cache/live-search mix, cost per completed result, p95 latency, unavailable
rate, installation time, monthly support minutes, renewal and cancellations.
Do not sell unlimited AI usage before outage/spend controls have evidence.

## Twelve-week validation sequence

Time boxes are planning assumptions; advance implementation using the roadmap.
Maintain a 6–8 hour weekly budget: roughly 2 hours media, 2 hours buyer discovery,
2 hours product/operations and up to 2 hours support/buffer. Log actual time.

| Window | Deliverable | Evidence to retain / decision |
| --- | --- | --- |
| Weeks 1–2 | Publish native demo on personal site with dedicated partner | Exact origins, deployment revision, install time, five-feature results, mobile/keyboard, counters, blocked origin, disabled key and quota checks |
| Weeks 3–4 | Owner conducts 8–10 buyer conversations | Anonymized problem, shared vs own-catalogue need, budget hypothesis and explicit pilot interest; no invented interviews |
| Weeks 5–8 | Aim for 2–3 bounded paid pilots | Actual invoice/payment, installation effort, aggregate usage, measured cost and support; a free demo does not count as paid demand |
| Weeks 9–12 | Review renewals and scope | Continue if at least two paying pilots want renewal and margin/time fit; otherwise revise buyer/offer before building integrations |

These numeric thresholds are proposed working criteria, not observed results.
If most qualified buyers require own-stock results, define one narrow catalogue
pilot only after a buyer supplies authorized data and commits to testing it.
Do not promise a delivery estimate until ingestion and data rights are assessed.

## Vertical AI Recommendation Engine: feasible direction, separate evidence

Hypothesis: the reusable pattern is structured problem intake → normalized
constraints → verified domain data → hard eligibility checks → transparent ranking
→ cited trade-offs or explicit insufficient-data outcome. AI may interpret a
request or retrieve candidate evidence; it must not override enforced constraints
or invent compatibility, price, availability or performance.

Reusable concepts: widget/API delivery, partner keys, provenance, provider adapters,
validation, caching and evaluation. Watch prompts, vocabulary, schemas, scoring,
source trust rules and reference identity are domain-specific. A generic engine
does not already exist merely because these modules do.

| Candidate niche | Decision problem | Missing proof / main burden |
| --- | --- | --- |
| Watches | Model fitting budget, case and use | Existing foundation; retailer feed/stock and buyer demand remain unproved |
| Specialist e-commerce | Product for a concrete task | Merchant permission, SKU identity, variants, stock freshness and measurable outcome |
| B2B software | Product fitting workflow/integration constraints | Versioned feature/pricing evidence, vendor bias and expensive maintenance |
| Industrial equipment | Technically compatible component | Authoritative compatibility rules, missing specification handling and specialist review |

No market-size, competitive ranking or comparative margin claim is made here.
Research any selected niche using current primary sources before investing.
Choose one with an accessible paying buyer, authorized structured data, objective
eligibility tests, observable outcomes and support that fits the weekly budget.
Before generalizing, require repeatable demand and acceptable unit economics in
watches, then one separate domain pilot. Evaluate expert-labelled problems,
zero tolerated hard-constraint violations, missing-data cases and useful explanations.
For retailer feeds, design tenant isolation and freshness before implementation.

## Risk and evidence backlog

1. **External integration:** independent-domain verification pending; source tests
   cannot establish deployed CSP, partner configuration or mobile behaviour.
2. **Spend during failures:** fail-open metering is an explicit current policy.
   Review provider/global spend ceilings and alerting before high-volume pilots;
   do not silently change paying-partner availability semantics.
3. **Isolation/abuse:** inspect existing tests and verify wrong origin, disabled
   site, key replacement, quota concurrency and any shared rate-limit behaviour.
   Public keys and browser origins are not server-to-server authentication.
4. **Data/material rights:** record permissions for facts, source access and
   remote image display. URL-only storage does not establish usage rights.
5. **Secrets/licensing:** whole Git history secret scanning and dependency/data
   licence inventory remain pending. Never print detected secret values.
6. **Commercial proof:** no validated demand, recurring revenue, sales uplift or
   automatic attribution is established. Existing usage counters measure use.

## Current next action and durable handoff

Deferred tooling idea, owner decision 2026-10-25: remember Replica Skill as a
possible future workflow reference, but do not install, adapt or implement it
yet. The owner supplied `https://github.com/nelakay/ai-website-cloner-claudeskill`
as a candidate; its contents and capabilities have not been evaluated here.
This is a parked idea, not part of the active implementation scope, and does
not change the current product/data work or next action below.

Local delivery evidence, 2026-10-24: `npm run check` passed formatting, lint,
typecheck, 83 test files / 500 tests and the production build. An offline jsdom
smoke check using the real widget loader passed placeholder handling, five-tool
mounting, preserved frames and ready-state handling. Browser/E2E and independent
host checks were not run. These results do not close the evidence backlog above.

Local integration evidence, 2026-10-25: the sibling `personal-website` now has a
native React `/watch-advisor-demo` route, navigation and project links. Both
applications run together through `npm run dev:partners`; a dedicated
**Portfolio local integration** partner permits localhost/loopback port 8080,
with a 200-use monthly limit and public-only portfolio configuration. The
existing hosted database/providers are used, not a local database. Admin now
offers copyable public Vite configuration and the native download. No visitor
or provider secret is copied into the portfolio.

The five opt-in integration tests passed: all five frames, preserved answers,
real six-screen diagnostic, archetype results, cached Heat sightings, Tudor
Black Bay 58 alternatives, mobile overflow, admin sign-in/configuration,
script failure/retry, actual CSP rejection on an unregistered local server,
disabled keys, exhausted quota and usage records. The existing desktop/mobile
browser suite passed all 12 tests. These establish local cross-origin
integration, not public-domain operation, fresh provider discovery, paid demand
or deployment rights for source images. See
[`local testing`](local-partner-testing.md) for repeatable commands and limits.
Portfolio types/build and targeted route/navigation lint passed; full portfolio
lint retains pre-existing formatting and interview-preview errors. This does
not imply a clean whole-portfolio audit.

**Next action:** configure a separate production partner for the exact portfolio
origin, set its public Vite configuration in the portfolio deployment and verify
`https://oleksandr-kukhtin.dev/watch-advisor-demo` after publication. Local-only
settings remain ignored; no public deployment is claimed here.
WordPress/Shopify publication remains deferred until the public native install works.

Partner UI/distribution follow-up, 2026-10-25: fixed the partner page's accidental
catalogue thumbnail column, styled responsive forms/cards, and added role-based
onboarding plus personalized native/WordPress/builder snippets in admin. The ten
audited inactive test fixtures were removed under the owner's explicit cleanup
request; an ignored local backup exists. Only the two active owner/local sites
remain. Future integration runs remove their own guarded fixture IDs; real
partners/history retain the no-deletion policy.

The shared loader now supports `data-reserve="all"` with five on-demand tabs and
preserved frames. WordPress 1.1.0 and Shopify's standalone theme section use it;
Wix, Squarespace, Webflow, Framer, Ghost and Carrd use the same HTML snippet with
platform instructions. Widget results keep review/source labels as text and no
cross-tool/outbound links; the Powered by credit is the only link on diagnostic
and archetype results. Navigation between tools belongs to the parent tabs.

Evidence: fast gate passed 501 tests and build; six browser integration tests
passed including a real local WordPress/PHP shortcode installation, plus all
12 existing desktop/mobile E2E checks. Shopify Liquid JSON/schema/options and
download parity were checked, but no hosted Shopify/builder installation or
marketplace publication is claimed. Owner, agent and partner checklists are in
`docs/partner-onboarding.md`, `AGENTS.md`, `/admin/sites` and `/partners`.

Result UI follow-up, 2026-10-25: shared display-time deduplication now removes
repeated normalized brand/title or brand/reference cards across all tools,
widgets, result sections and live previews. Different reference facts are not
merged. The owner's correction explicitly excludes cache-wide cleanup; stored
results/catalogue records were not rewritten. Daniel Craig's cached actor
result displays five unique cards, with Planet Ocean and Aqua Terra once each.
The alternatives budget input now shows/submits Price or Range exclusively,
preserving each value while switching. Fast gate: 508 tests/types/build passed;
seven partner/WordPress and twelve desktop/mobile browser checks passed. Main
app budget toggling and the Daniel Craig result were also checked in-browser.

Download: `/downloads/the-reserve-native-demo.zip`. Source:
`public/watch-advisor-demo/`. Regenerate after edits with PowerShell:

```powershell
Compress-Archive -Path public/watch-advisor-demo/* -DestinationPath public/downloads/the-reserve-native-demo.zip -Force
```

Local-data follow-up, 2026-10-25: source access/licensing audit and an ignored,
pinned Timepiecepedia snapshot are complete; source counts disagree across export
formats. No commercial dataset was purchased, no production import was made, and
no image work was performed. Strategy and evidence:
`docs/local-watch-database-strategy.md`. HoroDB bulk access and permanent
commercial/partner redistribution terms for API providers remain dependencies,
not assumed permissions. A local master does not by itself remove the hosted
runtime's Supabase/provider dependencies. This research does not change the
commercial next action above (public portfolio partner verification).

Catalogue integration follow-up, 2026-10-25: owner authorizes source import,
primary-source enrichment/images and a $100 first-pass allowance. All source
records are archived; 41,771 new bare identities are in the database, becoming
recommendation-eligible only as price/required facts are established. Shared app,
widget and API routes now hydrate exact references from the same catalogue.
No new partner-facing completeness or celebrity-attribution claim is justified
by import counts. Local paid worker progress is resumable; full enrichment is
still running, and conservative request allowance is not an actual billing quote.
Workflow: `docs/catalogue-enrichment.md`. Commercial next action remains the
public portfolio partner verification above.

Owner follow-up, 2026-10-25: source import used the free Space City exports,
not a new commercial feed purchase. All 18,124 exact source/reference claims
for the 26-export set are retained with CC BY attribution; the ten owner-named
luxury brands have 11,857 distinct identities in the master and no missing
source identities. Catalogue-level reference presence is labeled separately
from manufacturer confirmation. Only unique non-price facts fill null fields;
no existing accepted values are overwritten. The new app/widget analytics asks
whether results were liked and aggregates feature, click, source and exit funnel
by partner site. It uses random per-tab session IDs in memory, retains no quiz
answers or direct personal identifiers, and is visible in `/admin/analytics`.
The owner also requested country-level reporting; the system stores only the
two-letter hosting-country code, not an IP address or precise location. The
admin page now shows an explicit yes/no feedback table by service.
Current evidence and limits are in the roadmap and dated reports. The complete
41,996-record Dials mirror is local; 41,911 unique exact references now carry
Dials provenance, and 419 cached result rows were refreshed from exact local
matches. The final fast code gate passed. The local missing-field queue and
coverage report identify the next research priorities. The remaining owner
choice is whether a Dials model-page attribution link is acceptable inside a
widget watch result, given the earlier link-free widget screen requirement.
The combined master and saved results have also been exported to the ignored
local JSONL snapshot at
data/watch-archive/local-snapshots/2026-10-25T23-01-48-212Z/. The runtime still
uses its configured database; this snapshot provides local safekeeping, not an
offline database service.
Manual completion workbooks are written to the owner's Desktop by
`scripts/export-manual-catalogue-workbooks.ts`: separate queues for missing
price, movement, diameter, style and photo. Each row has an immutable catalogue
ID, source URLs, Dials availability, a manual Dials check, and a "hide Dials
link" choice that may be used only alongside owner-provided source evidence.

Muse-only catalogue completion follow-up, 2026-10-26: the owner authorized a
new, independent $100 ceiling for up to three passes. The resumable worker
prioritizes the missing-confirmed-price queue and, after a strict exact
brand/reference match, propagates verified fields to every matching local
catalogue row. It keeps a separate allowance journal, rejects a changed budget,
and disables the Perplexity fallback. The $100 limit is a conservative local
reservation, not a claim that every outstanding record can be researched in
this pass. The owner later withdrew the manual-completion workbook workstream;
the worker's local updates remain available in the catalogue instead.

Space City catalogue policy follow-up, 2026-10-26: the owner chose the complete
CC BY 4.0 Space City catalogue as a recommendation-eligible historical-market
layer. Every source observation is retained; repeated observations of one exact
brand/model/reference resolve to one local identity. The first published size
is used as an approximate fit starting point, and the USD median is stored as
an approximate historical market price. It must always state that the price may
have changed and is not retail. An individual photo and a current price check
are deferred until that reference is actually selected for a visitor result;
their URLs are then retained locally. The owner withdrew the one-off priority
workbook, so manual-completion queues are not an active workstream.

Final price/photo pass, 2026-10-26: the owner authorized one simplified,
Muse-only pass for the final 11,598 exact references that meet the technical
qualification but still lack a usable price. Each reference receives at most
one web-grounded lookup for an approximate price and public image URL. The hard
local ceiling is USD 63.79; the worker stops without exceeding it and does not
fall back to Perplexity. Once it is complete, freeze catalogue expansion and
rehydrate every cached result across every feature from the new local catalogue.

Cache rehydration follow-up, 2026-10-27: the bounded Muse pass completed all
11,598 queued references within its USD 63.79 local ceiling (1,252 approximate
prices and 1,466 image URLs added; 59 lookup errors retained for later result-time
handling). No subsequent paid lookup was made. The persisted AI-result cache was
rehydrated only from unique, non-rejected, locally reference-confirmed catalogue
matches: 662 of 2,570 saved cards changed; 1,351 cards without a reference remain
unchanged rather than being guessed. The 240 checked-in archetype cards were also
refreshed locally, with 12 factual changes and no unmatched pick. The static
editorial selection and its rationales were retained: regenerating those lists
would be a separate Muse operation. Reports: `docs/reports/cache-catalogue-refresh.json`
and `docs/reports/archetype-picks-refresh.json`; repeatable non-network command:
`scripts/refresh-archetype-picks.ts`. The next action is result-time completion
of a selected card's missing image/current price, followed by local caching,
without reopening bulk enrichment.

Correction, 2026-10-27: cache rehydration is a technical catalogue-fact merge,
not a second fact-check of an older film/person attribution. It exposed no
semantic claim validation on its own. A source check corrected the Daniel Craig
Skyfall cache by removing Aqua Terra `231.10.30.20.06.001`: it belongs to Eve
(Naomie Harris), not Craig. The Skyfall Planet Ocean `232.30.42.21.01.001` and
blue Aqua Terra `231.10.39.21.03.001` remain separate, sourced Craig entries.
No claim of complete cache fact verification applies until the newly started
full local audit and its targeted external follow-up report are complete.

Local-cache audit baseline, 2026-10-27: the exhaustive no-network audit found
2,569 saved cards in 708 saved searches. It must not be represented as a full
factual review: 1,351 cards have no reference, 548 have a missing or ambiguous
approved local reference match, and 2,558 film/person cards need source-level
attribution review. Sixty-two saved searches contain duplicate display identities;
the renderer suppresses those duplicates but the stored history still needs a
separate reconciliation. The report is
`docs/reports/cached-results-local-audit.json`. External validation is pending;
it must retain sources and never infer a person/film attribution from a watch
catalogue record alone.

Cache validation correction, 2026-10-27: migrations 0087–0089 were applied
before the validation runtime was complete. Their first implementation could
mark a fresh, unchecked answer valid and could misaccount failed reservations;
the parallel provider helper also allowed fallback to make two answers look
independent. Migration 0090 pauses new claims, and the runtime fails closed
for uncached or unverified AI searches pending a working validator and budget
ledger. The live database audit found 708 unverified entries, no valid entries,
and no budget reservations. Local catalogue paths are separate; alternatives
and archetypes are not covered by the shared AI search cache. The missing
validator, cost accounting, per-watch limits, source evidence, and end-to-end
verification remain open; no production completion is claimed.

Server result deduplication follow-up, 2026-10-27: the quiz, film search and
alternatives shared server paths now apply the same display deduplication before
returning results to the website, partner widgets and JSON API. Quiz catalogue
selection deduplicates before its result limit, so other matching models can fill
the shortlist. Streamed progress suppresses repeated watch cards. This does not
validate a film attribution, activate the paused paid-search workflow, or prove
that all feature constraints and external claims have been verified.

Cache-validation development, 2026-10-27: a fail-closed, pure evidence
reconciler now checks the same brand/reference and, where present, the same
person and work in both provider assertions. It requires separately inspected
sources on different hosts and retains the two URLs and check date. Tests cover
the Craig/Harris attribution error and conflicting or unavailable evidence. This
component does not inspect source pages itself and is not connected to provider
calls or cache promotion; the paid runtime remains paused until that work and
the budget ledger are complete.

Source inspection development, 2026-10-27: a separate server-side checker now
fetches the two reported URLs via the public-address redirect guard, requires
successful text responses and matches the brand, exact reference and available
person/work names in visible page text. It ignores scripts, rejects inaccessible
or oversized pages and checks independence after redirects. This is a necessary
lexical gate, not proof that a page links a person to a watch; provider assertions
still need semantic validation. The new checker and reconciler are tested but
remain disconnected from the paid runtime and cache promotion.

Validation budget foundation, 2026-10-27: additive migration 0091 provides
server-only atomic reservations for one to eight watch cards, at USD 0.025 per
card and USD 0.20 per search, within a USD 100 UTC calendar-month ledger. It
works for a cache miss and rejects concurrent active attempts for the same hash.
Settlement checks each card separately, uses the original reservation month,
and conservatively rounds the monthly charge up. Unknown costs must retain or
consume the full reservation; a crash does not automatically release funds.
The SQL was exercised before and after deployment in rolled-back transactions,
including duplicate claim, cost rejection, monthly cap, idempotency and grants.
These RPCs are not yet connected to provider calls. Other existing paid paths,
including alternatives and cron jobs, do not yet share this ledger, so it is
not a global guarantee of USD 100 in provider invoices.

Validation orchestration development: the new orchestration hydrates from the
catalogue, deduplicates up to eight candidates, reserves before any provider
call, runs two injected provider checks, checks cited pages, and settles each
card before returning accepted results. A missing provider or unknown cost
consumes the conservative reservation. Parser tests reject unsupported claims,
missing citations and Muse responses with no completed search; Perplexity cost
must be supplied by its response and Muse cost is conservatively calculated from
usage. The provider request adapters and cache promotion are not connected yet,
and the exact actual provider invoice is not guaranteed by these parsers.

Perplexity API compatibility, 2026-10-27: official documentation says Sonar
Chat Completions support ended 2026-09-27; synchronous requests are being
reformulated by Perplexity, while the recommended Agent API has a different
output and search-result structure. A parser for the current response format
and request builders with bounded search/output settings were added and tested.
They remain disconnected from live execution pending provider cost-bound and
integration verification. Sources: https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/overview
and https://docs.perplexity.ai/docs/agent-api/tools/web-search (retrieved 2026-10-27).

Provider adapter development: a single-attempt request adapter now joins the
budget reservation, local catalogue hydration, both providers, page inspection
and settlement behind a server-side service factory. It pins the model currently
used by Perplexity's documented `fast` mapping for Sonar Pro, disables provider
fallback and retries, limits output/search calls and sends only a bounded watch
brief. A mocked integration test checks order and both sources. This factory is
not connected to visitor routes; provider-side maximum billing, real API response
compatibility, source semantics and atomic cache promotion remain to be verified.

Evidence and price follow-up: film/person verification now requires each model
to return a short source passage; the page checker must find that same passage
and the watch, person and work in it. This reduces false matches from unrelated
names on a page, but does not establish a perfect semantic fact-check. Known
provider cost above the per-watch reservation leaves the attempt reserved for
reconciliation instead of recording a smaller guessed cost. Exact-reference
catalogue hydration now fills a missing price from an approximate local price,
marks it unconfirmed and the common UI says prices are approximate and may
change. This does not activate the paused validation runtime.

Validated snapshot transaction: additive migration 0092 stores a new immutable
cache version without deleting the legacy result. Its server-only publish RPC
checks the attempt and two source records, settles the card costs and inserts
the snapshot in one transaction. Repeating the same publish is idempotent; a
different payload under the same attempt is rejected. The shared cache reader
now accepts only source-v1 snapshots and checks source URLs. SQL tests before
and after migration ran inside rolled-back transactions; no paid provider calls
were made. First-view research and provider cost limits remain paused pending
real integration verification; existing alternatives and cron spending remain
outside this ledger.

Cache reuse race check: migration 0093 rechecks an existing `source-v1`
snapshot under the same per-key lock before allocating funds. If another request
published after the initial cache read, the reservation RPC returns `valid`
instead of allocating a second attempt; the shared cache path reloads that
snapshot. The SQL test was run inside rolled-back transactions before and after
deployment. The first-view callback is wired only as a test injection: no paid
visitor path has been enabled, and new cache misses still need a budgeted
candidate-discovery implementation.

Reference recovery: the validator can now ask both providers to identify a
missing reference, and only proceeds to source inspection if their normalized
references agree and are not placeholders. Tests cover agreement, disagreement
and missing values. This remains an offline-tested component, not an active
visitor feature; no catalogue records or caches were verified by this change.

Muse billing correction: Meta documents search pricing per query, and a single
`web_search_call` can contain multiple queries. The validation parser now
charges for each reported query instead of assuming one query per tool call;
when the query count is unavailable it fails closed and retains the reserved
cost. This fixes undercounting after a response but does not establish an
advance per-request cost ceiling. Sources: https://dev.meta.ai/docs/pricing-rate-limits
and https://dev.meta.ai/docs/api-reference/responses/schemas (retrieved 2026-10-27).

Concurrent cache reads: when a validation is already running, a second
visitor now polls the committed snapshot for a bounded interval and reuses it
without launching another provider call. A local concurrent-request test covers
publication and fail-closed timeout. This does not enable visitor validation;
provider costs, master persistence and missing-cache discovery remain open.

Validated catalogue evidence: migration 0094 adds a service-only publication
wrapper that archives each result's reference and two source records in the
catalogue intake in the same transaction as cache publication and settlement.
It links only an unambiguous non-rejected exact match; otherwise it retains an
unlinked record for identity review. It does not promote manufacturer status or
invent/update specifications, prices or photos. This supplies reference
provenance, not the still-missing fact enrichment. The visitor validation path
remains disabled pending cost and integration work.

Sighting evidence retention: checked source passages and the public person and
work attribution now survive snapshot serialization and the catalogue-intake
archive, alongside each source URL and check time. Only passages actually
checked by the source inspector are retained. This supports later human audit;
it does not establish that a lexical match proves semantic attribution or
validate other specifications. The database archive was tested in a rolled-back
transaction after migration 0094.

Validated-card reconstruction: a source check establishes reference and, when
present, wearer/work attribution; it does not establish every field in a legacy
card. The validation service now discards its old model title, photo, price,
specifications and narrative after source checking, then refills the title and
available fields only from a unique, non-rejected, reference-confirmed local
catalogue match. Without one, it displays the checked reference as the title
and leaves those facts missing. Tests cover stale values and exact local
refill. Film photos now also require a unique confirmed exact-reference match
from the full catalogue; similar model names and ambiguous variants no longer
borrow a photo. This does not search for missing facts or activate visitor
validation.

Validation overrun safeguard: migration 0095 records observed per-card costs
when they exceed $0.025 and atomically halts new reservations in the validation
ledger. The reservation remains held for reconciliation, and a known overrun
is recorded even if the other provider timed out. Requests already in flight
can still accrue charges, and other paid workflows do not use this halt; it is
not a provider-side hard spending cap. Visitor validation stays disabled.

Quiz constraint follow-up: a live proposal no longer records the visitor's
requested style or complications as facts about a watch. Optional requirements
that the current live candidate schema cannot represent now fail closed, and
near fits cannot exceed the visitor's selected case-diameter range. Provider
prompts use that range without also sending the exact wrist measurement.
The live validator still needs supported, source-backed facts before these
optional constraints can yield live results.

For future sessions: read this file and roadmap, inspect changes since the
baseline, and audit only affected areas unless a broader audit is requested.
Update verified facts, hypotheses, dates, cost evidence and this single next
action after meaningful work. Never mark commercial or live checks complete
because a local gate passes. This repository record provides continuity; no
cross-chat assistant memory is claimed.
