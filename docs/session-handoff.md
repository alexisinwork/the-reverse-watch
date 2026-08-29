# Session handoff

Last updated: 2026-08-29

This is the restart point for the next working session. The controlling
sequence is [`implementation-roadmap.md`](implementation-roadmap.md), which
implements the owner's [`full original plan`](original_context.md) and the
accepted
[`SQL-first architecture`](sql-first-recommendation-architecture.md). Read the
original context from first line to final line before continuing the active
phase.

## Current checkpoint

- Active phase: **Phase 5 — coverage-first catalogue expansion, in progress**.
- Phases 0–4 are complete and verified.
- `/quiz` now returns confirmed, verification-required, relaxation, why-not,
  score-trace, and source sections after the six core screens or optional
  refinement groups.
- Nine additive migrations are applied to Supabase; additive migrations `0010`
  through `0016` are prepared and locally verified but not yet applied
  because the Supabase MCP OAuth refresh expired. This continuation also
  confirmed that no Supabase tool/CLI session or configured Vercel credential
  is available locally. Tables remain server-only;
  the application uses two narrow read-only RPCs for accepted facts and SQL
  hard-filter codes. No subscriber, DNS, or destructive database change was
  made.
- Local `main` is 24 commits ahead of `origin/main` after the current checkpoint
  is committed. The evidence and geometry
  checkpoints through Cartier are committed locally, and the branch remains
  intentionally unpushed until migrations `0010` through `0016` are applied and
  17-row live SQL parity is proven.
- Chunking, embeddings, `pgvector`, a separate vector database, Mastra, Ollama,
  and RunPod are outside the launch critical path.

## Accepted 2026-08-28 audit decisions

- The owner's Claude questionnaire/database audit remains a controlling
  checklist, not background commentary. Its full text is preserved in
  [`original_context.md`](original_context.md), and
  [`original-plan-requirements.md`](original-plan-requirements.md) indexes the
  implementation evidence so later catalogue work does not drift from it.
- Brand is sourced context; a homogeneous reference variant is the filtering
  and ranking unit.
- Price and wrist circumference are canonical numeric values. Display bands are
  derived from one shared TypeScript module.
- Material, size, movement, attachment, or materially different commercial
  behavior splits a variant row.
- Missing facts never satisfy an active hard filter.
- Evidence, verification tier, and staleness attach to each field value.
- Non-round cases retain sourced width and overall length; they are never forced
  into a circular diameter. Verified overall length can supply wrist span only
  when verified conventional lug-to-lug is unavailable.
- The baseline engine is PostgreSQL hard filtering plus explicit versioned
  scoring, diversity quotas, rejection reasons, and visible relaxation prompts.
- Semantic retrieval is an optional later experiment for free text or
  demonstrably nuanced aesthetics only.
- The implemented audit surface includes exact numeric budget and wrist values
  with shared display bands; progressive core/refinement questions for
  accuracy, complications, geography, purchase condition/vintage, cosmetic
  tolerance, and nickel allergy; bounded market-premium handling; field-level
  evidence; fail-closed SQL hard filters; speculative-candidate suppression;
  deterministic score traces, diversity, why-not explanations, and visible
  relaxations; and the complete 28,800-cell coverage audit.
- The audit is not complete at the data layer: only 17 homogeneous variants are
  accepted locally, 448 of 28,800 cells are covered, every covered cell is
  under-diversified, and 224 are under-evidenced. Phase 5 must close that
  breadth and evidence gap before the 200-brand knowledge pack can be treated as
  a recommendation catalogue. Phase 7 dossier, funnel, and owner-media work
  also remains pending; none of this reopens vectors as a launch dependency.

## Phase 2 delivered

- `app/domain/questionnaire.ts` contains the shared price/wrist bands, all core
  and refinement enums, Zod schemas, premium calculation, normalization, and
  speculative-candidate gate.
- `/quiz` collects exact budget and wrist values, deployment,
  service/accuracy, weight, complications/date, then optional identity, fit,
  market, operation, geography, condition, cosmetic, and allergy preferences.
- Core and refine submissions are validated on the server. The result is built
  by deterministic recommendation engine v2 from accepted seed facts; missing
  or expired hard facts cannot become confirmed recommendations.
- Draft state recovers from browser `sessionStorage`; access does not require
  email.
- The obsolete root `questionnaire.js` prototype was removed. Its history and
  code sketch remain in git and `original_context.md`.
- The landing page links to the diagnostic without changing the Beehiiv embed.

## Phase 3 delivered

- `db/migrations/0001_reference_variant_catalogue.sql` defines additive
  PostgreSQL types and tables for brands, ownership periods, service regions,
  collections, models, variants, complications, price/market snapshots, traits,
  editorial claims, sources, per-field evidence, completeness, and review.
- Migrations `0001` through `0009` are applied to Supabase project
  `osfqexnzgkksfvaocjvl`; none enables `pgvector`.
- `docs/catalogue-schema.md` maps questionnaire requirements to fields and
  records refresh/null/completeness policy.
- `app/domain/coverage.ts` and `scripts/audit-coverage.ts` enumerate the defined
  pre-collection core matrix and report empty, single-candidate,
  under-diversified, and under-evidenced cells.
- The applied baseline has 11 brands and 12 variants. The reviewed local seed
  now has 15 brands and 17 variants after adding Christopher Ward
  C63-39AGM4-S00W0-B0, Orient RA-AC0M03S, Marathon WW194003BK-0108, Casio
  G-5600UE-1, and Seiko HCC004J1. Migrations `0010` through `0014` each carry
  only their additive row and its sources, price, availability, evidence,
  deployment, friction, traits, and product URL.
- Migration `0015` adds only nullable rectangular case width/length columns.
  Migration `0016` corrects the already accepted Reverso Q3988481 from a
  synthetic 28.3 mm diameter to manufacturer-labelled 47 x 28.3 mm length and
  width, preserves its explicit 47 mm lug-to-lug, and introduces v2 catalogue
  and hard-filter RPCs with SQL/TypeScript non-round fit parity.
- The current local audit reports 448 of 28,800 cells covered (1.56%): 444 are
  single-candidate, all 448 are under-diversified, and 224 are under-evidenced.
  The applied live baseline remains 180 cells until migrations `0010` through
  `0016` are applied in order.
- Browser roles have no table grants. The security advisor's only current
  findings are the two intentional anonymous `SECURITY DEFINER` RPC warnings;
  both functions have an empty `search_path`, fixed read-only SQL, and no
  dynamic statements. Performance findings remain unused-index information.

## Phase 4 checkpoint delivered

- `app/domain/recommendation.ts` contains the versioned explicit hard-filter,
  score, tie-break, diversity, verification, why-not, and relaxation policy.
- Candidate-specific premium handling prevents a grey/secondary allowance from
  expanding an authorized-dealer price.
- Price, availability, and cross-currency FX snapshots fail closed after their
  own expiry. Purchase/service geography is not inferred from an unrelated
  market.
- `data/catalogue/seed-catalogue.json` is a strict source-backed runtime
  snapshot. `scripts/render-seed-migration.ts` and
  `scripts/project-seed-coverage.ts` regenerate its database and coverage
  artifacts.
- Provenance and cosmetic preferences are visibly disclosed as unscored until
  reviewed brand/surface data exists.
- `recommendation_catalogue_v2()` returns the accepted relational catalogue in
  the strict Zod runtime shape. `recommendation_hard_filter_v2(profile, as_of)`
  returns the authoritative hard-reject and missing-fact partition.
- The server validates both RPC responses, requires exact variant coverage,
  caches valid catalogue facts for 60 seconds, and visibly falls back as one
  unit to the reviewed bundle plus local predicates.
- `npm run audit:catalogue-parity` proved fact and predicate parity for all 12
  applied baseline variants across six golden profiles. It must be rerun for
  all 17 variants immediately after migrations `0010` through `0016` are
  applied in order. PostgreSQL
  owns the live hard-filter partition; TypeScript owns scoring, explanations,
  diversity, and fallback.
- Vercel Production and Preview have the public Supabase URL and publishable
  key. Neither role has table access, and the web request path uses no database
  password.

## Verification evidence

On 2026-08-29 for the Phase 5 continuation:

- `npm run check` passes formatting, lint, strict type/route generation, all 55
  tests across 13 files, and the production build.
- `npm run audit:knowledge` validates 200 dossiers and 951 family rows against
  their source files; `npm run audit:research -- --strict` validates all 201
  manifest brands, 200 knowledge links, 12 accepted seed links, and three review
  artifacts.
- `npm run audit:coverage` still validates all 28,800 cells and the unchanged 12
  accepted variants. No provisional Phase 5 fact entered the catalogue, so the
  last verified live SQL parity remains authoritative for that unchanged set.
- Eight local worker attempts were retained: three succeeded, five failed with
  raw artifact pointers, and the successful provider cost recorded by the job
  ledger totals USD 0.04055. Raw, normalized, and job files remain ignored.
- Commit-candidate data contains only Markdown, CSV, and reviewed JSON/contract
  artifacts; a secret-pattern scan found no credential-like strings.

For the second Phase 5 research batch on the same date:

- Christopher Ward C63-39AGM4-S00W0-B0 passed independent primary-source review
  with complete M1 decision facts and is present in the 13-row local seed.
- Citizen BM8180-03E remains `needs_more_evidence` for graded lume and the
  strap-to-case attachment interface. Official sources resolved E101 accuracy,
  power duration, and a 54 g versus 48 g conflict in favor of the manufacturer.
- Two Sinn attempts failed strict extraction validation and did not advance the
  target. Across the batch, two jobs succeeded and one target exhausted two
  retained failures.
- `npm run audit:research -- --strict` passes with 201 brands, 13 accepted
  links, 18 active targets, and five committed reviews. `npm run audit:coverage`
  reports 212 covered cells (0.74%). The fast gate is locally passing after the
  count fixtures were updated.
- `db/migrations/0010_expand_catalogue_christopher_ward.sql` is a generated,
  replay-safe one-row expansion. A local commit is safe, but do not push it
  until Supabase is reconnected, `0010` is applied, and catalogue/SQL parity
  passes.

For the third Phase 5 research batch on the same date:

- Sinn 856 UTC, Marathon WW194003BK-0108, and Omega
  310.30.42.50.01.001 all produced schema-valid provisional artifacts and were
  independently reviewed. All three remain `needs_more_evidence`; no seed or
  migration row was added.
- Sinn's official current sheet reports 70 g without a strap and presents
  several separately priced attachment configurations. Marathon's exact
  official page and sheet still omit numeric full weight, rate tolerance, and
  attachment-interface semantics. Omega's exact official sources were blocked
  during independent retrieval, and its extracted `Steel bracelet` value is a
  material rather than an attachment type.
- The local ledger now retains 15 attempts: eight succeeded and seven failed,
  spanning eight targets, with USD 0.11923 recorded provider cost. Paid raw,
  normalized, and job artifacts remain ignored.
- `npm run audit:research -- --strict` passes with 201 brands, 13 accepted
  links, 18 active targets, and eight reviews: one `ready_for_migration` and
  seven `needs_more_evidence`. Coverage remains 212/28,800 cells (0.74%).
- The next ranked queue is Seiko compact mechanical no-date, Vostok affordable
  mechanical field, then Baltic compact mechanical. Migration `0010` and its
  Supabase parity gate still take precedence over pushing either local commit.

For the fourth Phase 5 research batch on the same date:

- Seiko HCC004J1, Vostok 420059, and Baltic MR Classic Blue all produced valid
  provisional artifacts and completed independent review. All remain
  `needs_more_evidence`; no catalogue or migration row was added.
- Seiko's official U.S. page, Japanese store, and 6R51 manual resolve the exact
  configuration through 66 g full weight and no-date status, leaving graded
  lume and attachment interface as the two M1 gaps. Vostok still lacks full
  weight, categorical lume, and attachment type, and its source is a retailer
  that explicitly says it is near—but not part of—the factory. Baltic's page is
  a strap/bracelet configuration family with only a starting price and no exact
  manufacturer reference.
- Independent retrieval caught Vostok's provider price drifting from $172 to a
  current $164 sale price. The stale value is rejected and the observed value
  retained only in the reviewed artifact.
- The ignored local ledger now retains 18 attempts: 11 succeeded and seven
  failed, spanning 11 targets, with USD 0.15448 recorded provider cost.
- Strict research now reports 201 brands, 13 accepted links, 18 active targets,
  and 11 reviews: one `ready_for_migration` and ten `needs_more_evidence`.
  Coverage remains 212/28,800 cells (0.74%). The next queue is Orient, Certina,
  and Tudor.

For the fifth Phase 5 research batch on the same date:

- Orient RA-AC0M03S and Certina C048.807.44.051.01 produced schema-valid
  provisional artifacts and completed independent review. Both remain
  `needs_more_evidence`; Tudor produced two retained failures and remains
  planned without a review artifact.
- Orient's exact global product page supplies 54 g full weight, -15/+25 seconds
  per day, date, and an explicit blank luminous-light field mapped to no lume.
  Its only remaining M1 gap is the strap-to-case attachment interface.
- Certina extraction mixed `.051.00` for the product and `.081.00` for price
  into candidate `.051.01`. Review rejected both URLs, independently resolved
  the exact CHF 925 `.051.01` product, and validated 300 m ISO dive status,
  104 g, quick release, strong lume, and date. No manufacturer numerical rate
  tolerance is published for Powermatic 80.611, leaving accuracy as its sole M1
  gap.
- The ignored local ledger now retains 23 attempts: 13 succeeded and ten
  failed, spanning 14 targets, with USD 0.17898 recorded provider cost.
- Strict research now reports 13 reviews: one `ready_for_migration` and 12
  `needs_more_evidence`. Coverage remains 212/28,800 cells (0.74%). The next
  queue is Tudor, Blancpain, and Patek.

For the sixth Phase 5 research batch on the same date:

- Tudor M79000N-0001 and Blancpain 5019A 12B30 94A produced schema-valid
  provisional artifacts and completed independent review. Both remain
  `needs_more_evidence`; Patek produced two retained failures and remains
  planned without a review artifact.
- TUDOR's exact product page replaced the provider's inferred USD snapshot
  with the independently observed Poland-localized PLN 19,450 offer and
  resolves thickness, lug width, accuracy, Grade A lume mapped to strong, and
  no-date status. Lug-to-lug, full configured weight, and the bracelet-to-case
  interface remain M1 gaps.
- Blancpain's exact U.S. page supports the $27,200 Add to Cart offer for the
  orange-rubber and pin-buckle SKU. Its exact technical dossier resolves the
  47 x 14.81 mm Grade 23 titanium case, 120-hour caliber 13P5A, 300 m rating,
  proprietary central-lug interface, strong dual-color lume, and date.
  Lug-to-lug, conventional lug width, full configured weight, and numerical
  accuracy remain M1 gaps.
- Patek's two responses failed the strict null and resolved/unresolved
  consistency guards; neither payload is reviewable.
- The ignored local ledger now retains 27 attempts: 15 succeeded and 12
  failed, spanning 16 targets, with USD 0.20003 recorded provider cost.
- Strict research now reports 15 reviews: one `ready_for_migration` and 14
  `needs_more_evidence`. Coverage remains 212/28,800 cells (0.74%). The next
  queue is Patek, Bulova, Audemars Piguet, and A. Lange & Söhne.
- Supabase OAuth token refresh still fails. Migration `0010`, live 13-row
  catalogue parity, and all pushing remain intentionally held.

For the seventh Phase 5 research batch on the same date:

- Patek retained two more failures with the same null and
  resolved/unresolved-field contract violations, bringing that target to four
  failed attempts without a reviewable artifact.
- Bulova Series X Precisionist 98B429 and Audemars Piguet Royal Oak
  15510ST.OO.1320ST.01 produced valid provisional artifacts, but independent
  review excluded both selections from their targets rather than weakening the
  requested coverage.
- The exact Bulova U.S. page shows a $1,220 sale price, above the target's
  $300-$1,000 bands. Review replaced the provider's unsupported zero accuracy
  lower bound with official -10/+10 seconds-per-year collection evidence and
  retained thickness, lug-to-lug, full-weight, graded-lume, and attachment gaps.
- The exact AP reference is the discontinued 2022 50th Anniversary model, not
  a current homogeneous offer. Review rejected AP folding clasp as an
  attachment interface and used AP's official design documentation to map the
  bracelet as integrated.
- Both exclusions have replacement planned targets with the original coverage
  intents and explicit instructions not to repeat the disqualifying choice.
- The ignored local ledger now retains 31 attempts: 17 succeeded and 14 failed,
  spanning 18 targets, with USD 0.22373 recorded provider cost.
- Strict research now reports 17 reviews: one `ready_for_migration`, 14
  `needs_more_evidence`, and two `excluded`. Active-target count remains 18;
  coverage remains 212/28,800 cells (0.74%). The next queue is Patek,
  replacement Bulova, replacement Audemars Piguet, and A. Lange & Söhne.

For the eighth Phase 5 research batch on the same date:

- Patek retained a fifth strict failure, then produced a valid exact-reference
  artifact on attempt six for Grande Sonnerie 6301P-001. Primary review resolves
  its core specifications and the Patek Philippe Seal -1/+2 seconds-per-day
  standard, but the displayed USD price lacks complete market and availability
  context and five physical/ownership facts remain unresolved.
- Bulova replacement 98B316 is a current exact Icon Precisionist chronograph at
  £679 on the UK manufacturer page. Exact manufacturer evidence resolves 46.5
  mm diameter, 24 mm lug width, NN50 identity, and -10/+10 seconds per year; an
  exact Costco listing supplies 17.5 mm thickness. Four M1 gaps remain.
- Audemars Piguet replacement 16202ST.OO.1240ST.02 succeeded after one strict
  failure and fixes the previous archived-reference mismatch. The current exact
  Royal Oak is officially integrated, but price, fit dimensions, full weight,
  accuracy, and graded lume remain incomplete.
- A. Lange & Söhne 720.035FE is an exact live limited platinum reference with
  its core specifications, supported complications, and display-wide Lumen
  mapping independently reviewed. Price-on-request and five other M1 classes
  keep it research-only.
- The ignored local ledger now retains 37 attempts: 21 succeeded and 16 failed,
  spanning 21 target IDs, with USD 0.27503 recorded provider cost.
- Strict research now reports 21 reviews: one `ready_for_migration`, 18
  `needs_more_evidence`, and two `excluded`. All 18 active targets have review
  artifacts, `npm run plan:research` emits an empty queue, and coverage remains
  212/28,800 cells (0.74%).
- Supabase OAuth refresh remains unavailable. Migration `0010`, live 13-row
  parity, and every push remain held; no incomplete eighth-batch candidate was
  added to the catalogue.

For the post-batch evidence-gap pass on the same date:

- Orient RA-AC0M03S is now the second migration-ready review. Its exact primary
  pages already resolved every M1 fact except attachment; an exact-reference
  specialist guide documents the standard 20 mm spring-bar interface, says its
  strap recommendations were tested on that watch, and is corroborated by
  Orient's own spring-bar service instructions. The accepted source registry
  records the specialist page as `secondary_editorial` rather than primary.
- Certina C048.807.44.051.01 remains research-only. The official mechanical
  manual linked from its exact product page states an approximate range only
  for most non-chronometers, not a guaranteed numerical tolerance for this
  reference.
- Generated migration `0011_expand_catalogue_orient.sql` is an additive,
  replay-safe one-row expansion intended to run after `0010`. At that checkpoint
  the local seed had 13 brands/14 variants and coverage was 244/28,800 cells
  (0.85%), with 148 under-evidenced cells.
- Strict research at that checkpoint reported 14 accepted targets, 17 active
  targets, and 21 reviews: two `ready_for_migration`, 17
  `needs_more_evidence`, and two `excluded`. The worker queue remained empty.
- Live Supabase remained 11 brands/12 variants, with `0010` and `0011` awaiting
  application and a 14-row catalogue/six-profile SQL parity proof.
- A follow-up exact-reference pass resolved Seiko HCC004J1's attachment as
  `spring_bar`, but retained its lume gap because an official regional Lumibrite
  specification conflicts with an independent exact-reference report of no
  luminous paint. Citizen BM8180-03E retained both gaps: exact-reference owner
  reports disagree on lume performance, and aftermarket fitment evidence does
  not establish the factory attachment. Neither review entered the seed.
- TUDOR Black Bay 54 M79000N-0001 now has a reviewed 45.8 mm lug-to-lug value,
  corroborated by a separate 46 mm rounded measurement. It remains
  research-only because bracelet-size-dependent weight reports conflict and
  exact replacement-strap fitment is not manufacturer corroboration of the
  factory bracelet attachment.
- Vostok 420059 now has a reviewed 128 g steel-bracelet weight corroborated by
  two exact-reference dealer records. It remains research-only for lume and
  attachment because the lume report is uncontrolled and 420-case replacement
  parts do not establish the factory bracelet mechanism under the source policy.
- Marathon WW194003BK-0108 is now the third migration-ready review. Its exact
  current product and specification sheet, the exact NH35A movement guide, and
  an exact configured dealer record resolve the $575 offer, 45 g full weight,
  and -20/+40 seconds-per-day bound. Marathon's full-night tritium claim maps to
  `strong`; the one-piece DEFSTAN strap, fixed-bar owner evidence, and
  manufacturer spring-bar service path map the fixed service interface to the
  existing `proprietary` class. Generated migration `0012` adds only this row
  after `0010` and `0011`.
- At that checkpoint the local seed had 14 brands/15 variants and covered
  280/28,800 cells (0.97%): 276 single-candidate, 280 under-diversified, and 184
  under-evidenced. Strict research reported 15 accepted targets, 16 active
  targets, and 21 reviews: three `ready_for_migration`, 16
  `needs_more_evidence`, and two `excluded`.
- Casio G-5600UE-1 is now the fourth migration-ready review. Its exact product
  and module 3496 guide resolve solar operation, fit, 51 g weight, 200 m rating,
  functions, rate, and full-auto Super Illuminator, mapped to `strong`
  nighttime illumination without claiming luminous paint. A current exact U.S.
  StockX buy-now offer supplies the supported secondary-market snapshot; an
  exact 16 mm listing and the genuine band/spring-rod component chain establish
  `spring_bar`.
- The renderer now records `shockResistant` evidence and derives SQL price kind
  from the accepted acquisition channel, so the Casio snapshot is correctly
  `secondary_ask`. Generated migration `0013` adds only this row after `0012`.
- At that checkpoint the local seed had 15 brands/16 variants and covered
  408/28,800 cells (1.42%): 404 single-candidate, 408 under-diversified, and 184
  under-evidenced. Strict research reported 16 accepted targets, 15 active
  targets, and 21
  reviews: four `ready_for_migration`, 15 `needs_more_evidence`, and two
  `excluded`.
- Live Supabase remained 11 brands/12 variants at that checkpoint, with
  migrations `0010` through `0013` pending.
- Omega Speedmaster 310.30.42.50.01.001 now has a reviewed 0/+5
  seconds-per-day accuracy bound. Omega's official Master Chronometer page
  explicitly includes the exact reference, and a five-year exact-reference
  review corroborates it with +4 and +2 seconds-per-day measurements. Omega
  now also has independently retrieved exact official product and product-sheet
  support for its configuration, current $7,800 U.S. in-stock offer, geometry,
  approximately 134 g total weight, movement, and operation. Two independent
  exact-reference specifications explicitly resolve no-date status. Omega
  remains research-only for categorical lume and manufacturer-corroborated
  factory attachment.
- Seiko Presage HCC004J1 is now the fifth migration-ready review. Thong Sia's
  exact official Seiko Boutique page reports `Lumibrite: N/A`; Seiko's
  corporate directory identifies Thong Sia as its Singapore distributor, and
  an independent exact-reference hands-on review corroborates that the watch
  lacks luminous paint. The conflicting Netherlands rows are rejected for lume
  because that same page visibly mixes in unrelated Astron 5X53 GPS Solar and
  titanium product copy. Generated migration `0014` adds only this row after
  `0013`.
- The local seed is now 15 brands/17 variants and covers 448/28,800 cells
  (1.56%): 444 single-candidate, 448 under-diversified, and 224 under-evidenced.
  Strict research reports 17 accepted targets, 14 active targets, and 21
  reviews: five `ready_for_migration`, 14 `needs_more_evidence`, and two
  `excluded`.
- Live Supabase remains 11 brands/12 variants. Apply migrations `0010` through
  `0016`, prove 17-row catalogue and six-profile SQL parity, and only then push
  the local commits.
- Citizen BM8180-03E now needs only a repeatable lume grade. Citizen Watch
  Group's exact-model parts lookup lists dedicated spring-bar part 509-2074
  alongside the watch's band, resolving the factory interface as `spring_bar`.
  The conflicting exact-reference lume observations remain insufficient for a
  categorical grade.
- TUDOR M79000N-0001 now needs only manufacturer-corroborated factory attachment
  evidence. Independent exact-reference new and unworn/full-set records resolve
  normalized full-length bracelet weight at 139 g with approximately 19.5-21 cm
  of bracelet; the lower 135 g owner report is explicitly a sized-bracelet
  observation and is not used for the full configuration.
- Swatch SO28N100 now needs only resolved full-watch weight, a numerical
  exact-applicable quartz rate bound, and a repeatable lume grade. Swatch's
  embedded exact product payload resolves 34 x 8.75 x 39.2 mm geometry; a
  current supported-currency official-retailer offer resolves price; the exact
  original strap plus Swatch's connector-pin guide resolve a 17 mm proprietary
  interface; and two exact-reference specifications explicitly report no date.
  The conflicting 18 g and 22 g records are retained rather than normalized.
- Bulova 98B316 now needs full configured weight, a repeatable lume grade, and
  manufacturer-corroborated factory attachment evidence. Two exact-reference
  dimensional sets report 54.5 mm case length and a third reports 54.6 mm,
  resolving lug-to-lug at 54.5 mm. Weight records at 274 g, 276 g, and
  approximately 270 g after bracelet sizing remain explicit rather than being
  forced into one value.
- Blancpain Fifty Fathoms Tech 5019A 12B30 94A now needs conventional lug-width
  handling, full configured weight, and numerical accuracy. Blancpain's exact
  dossier establishes its 47 mm diameter and central-lug construction; an
  exact-reference hands-on specification explicitly reports 47 mm lug-to-lug
  because no conventional lugs project beyond the case.
- Vostok Amphibia 420059 now needs only manufacturer-corroborated factory
  attachment evidence. Two independent exact-reference reviews report sparse,
  difficult-to-read, fast-fading lume, corroborated by exact-reference owners;
  this convergence maps to `weak`. The available pins answer remains ambiguous
  between bracelet links and the case interface and is not normalized.
- Cartier Tank Must WSTA0107 now needs only a numerical exact-applicable
  accuracy bound and a repeatable lume grade. The additive geometry contract and
  migration `0015` preserve the official 29.5 x 22 mm rectangular case without
  inventing a diameter; exact reviewed sources also resolve the $4,100 U.S.
  authorized-retailer offer, 16 mm interface, approximately 79.3 g maximum
  bracelet weight, and Cartier QuickSwitch attachment. No Cartier row was added.
- The accepted Jaeger-LeCoultre Reverso Tribute Duoface Small Seconds Q3988481
  now uses the manufacturer's explicit `L x W` semantics: `caseLengthMm: 47`,
  `caseWidthMm: 28.3`, `caseDiameterMm: null`, with the separately labelled
  47 mm lug-to-lug retained for fit. Migration `0016` updates field evidence,
  rectangular-aware completeness, and both public read contracts without
  weakening any hard filter.
- The latest evidence sequence is committed as `db77f92` (Swatch), `760979c`
  (Omega), `a6fb895` (Bulova), `e17a2db` (Blancpain), and `abf958d` (Vostok),
  followed by the Cartier geometry/evidence and Reverso correction checkpoint.
  `npm run check` passes formatting, lint, type generation, TypeScript, all 59
  tests across 13 files, and the production build. The strict research,
  coverage, and knowledge audits pass, and a PostgreSQL parser accepts all 15
  statements in migration `0016`.

On 2026-08-28 for Phases 1–4:

- `npm run check` passes formatting, lint, strict type/route generation, all 41
  tests across nine files, and the production build.
- `npm run audit:coverage` validates all 28,800 cells without capped windows.
- The deferred Playwright suite was updated with the core diagnostic flow but
  was not executed, per the Phase 7 cadence.
- Supabase applied all nine migrations. Live RPC parity, row counts, zero table
  grants for browser roles, and both advisors were checked after the final
  migration.
- Vercel deployment `dpl_FvEFUWbHRQrkGmDFAziEP6F5xP1o` reached `READY`; `/`,
  `/quiz`, `/health`, and a core recommendation POST returned 200. The response
  identified the Supabase facts/SQL-filter path and returned Grand Seiko; no
  recent runtime errors were present.

## Exact continuation

1. Reconnect the Supabase MCP for project `osfqexnzgkksfvaocjvl`, apply
   `0010_expand_catalogue_christopher_ward.sql` and then
   `0011_expand_catalogue_orient.sql`, followed by
   `0012_expand_catalogue_marathon.sql`, and then
   `0013_expand_catalogue_casio.sql`, followed by
   `0014_expand_catalogue_seiko.sql`, followed by
   `0015_add_rectangular_case_geometry.sql`, followed by
   `0016_correct_reverso_rectangular_geometry.sql`. Run live 17-row catalogue and
   six-profile SQL parity. Only push after that succeeds so production never
   sees divergent bundled and relational catalogues.
2. Resolve or explicitly retain the first review gaps. Citizen BM8180-03E still
   needs an authoritative repeatable lume grade. TUDOR M79000N-0001 now needs
   only manufacturer-corroborated attachment evidence. Cartier WSTA0107 now
   needs only numerical exact-applicable quartz accuracy and a repeatable lume
   grade; its rectangular geometry is supported but remains research-only.
   Swatch SO28N100 needs resolved full-watch weight, a numerical
   exact-applicable quartz rate bound, and a repeatable lume grade. Do not
   accept a row merely to make the batch non-empty.
3. Retain Citizen BM8180-03E, Sinn 856 UTC, and Omega
   310.30.42.50.01.001 as research-only until their recorded review gaps are
   independently resolved. Omega's accuracy and no-date status are now resolved;
   its lume and attachment gaps remain. Do not salvage contradictory or blocked
   provider claims manually.
4. Convert only M1-complete reviewed candidates into small additive catalogue
   migrations. Keep every knowledge-pack family research-only until it is split
   into homogeneous variants and independently sourced.
5. Rerun coverage, strict catalogue validation, SQL parity, and the fast gate
   after every accepted batch.
6. Continue prioritizing coverage and original-plan purpose over raw brand
   count even though the 200-dossier pack is now fully represented.
7. If database access remains unavailable, do not rerun the now-empty default
   queue. Close a named existing review gap only from independently identified
   exact-reference evidence, or add a new target with an explicit coverage or
   original-plan purpose before invoking the worker. Do not repeat excluded
   Bulova 98B429 or AP 15510ST.OO.1320ST.01, substitute generic calibre
   performance for a missing published exact-applicable bound, infer an
   attachment interface from the supplied strap or bracelet, or treat a blank
   conventional lug width as a reviewed non-applicable policy.
8. Keep embeddings, chunking, Mastra, Ollama, and RunPod out of the production
   path until the optional held-out evaluation has a deterministic baseline to
   beat.

## Phase 5 continuation delivered 2026-08-29

- The complete 200-dossier knowledge pack is parsed into a strict research-only
  intake: 200 dossiers, 951 family rows, 248 required variant splits, 169
  dossiers mapped through Q1-Q16, and 1,748 unique cited URLs.
- The manifest now contains 201 brands (the pack plus one existing roadmap
  brand), all 16 reviewed seed links, and 15 active coverage-led targets.
  Knowledge hash/count drift and missing review artifacts fail the strict audit.
- The default worker queue is the same coverage-ranked queue shown by
  `npm run plan:research`; successful fingerprints are reusable, attempts remain
  monotonic across runs, raw failures retain pointers, and rate limiting is
  handled at safe default concurrency one.
- Perplexity Agent requests use the current `POST /v1/agent` preset contract and
  native JSON Schema, followed by strict Zod validation. Extraction remains
  provisional and a successful job moves only to `needs_review`.
- The first live Cartier/Casio/Swatch batch produced three committed review
  decisions, all `needs_more_evidence`. No incomplete variant entered the
  catalogue or PostgreSQL.
- The second batch accepted Christopher Ward C63-39AGM4-S00W0-B0 into the local
  reviewed seed, kept Citizen BM8180-03E research-only, and rejected both Sinn
  responses at the strict extraction boundary. The additive database migration
  is prepared but deliberately unpushed until live parity can be verified.

## Earlier Phase 5 start

- `app/domain/research.ts` defines strict manifest, coverage-intent, job,
  provisional-fact, knowledge-link, and review contracts. Accepted facts cannot
  be emitted by extraction.
- `npm run audit:research` checks manifest, knowledge-intake, accepted-catalogue,
  and review integrity. `npm run plan:research` ranks target hypotheses against
  all core coverage cells.
- `docs/research-pipeline.md` records idempotency, raw artifact retention,
  provisional review, source hierarchy, acceptance gates, and the small-batch
  policy. No semantic infrastructure was added.

## Existing operational notes

- Local `.env` is ignored and real values must not be printed or committed.
- Vercel remains the active host. The historical domain discrepancy between
  repository intent (`thereserve.watch`) and older `thereverse.watch` aliases
  remains a later reversible routing task.
- Supabase project scope previously recorded is `osfqexnzgkksfvaocjvl`; never
  perform destructive removals, truncation, or resets.
