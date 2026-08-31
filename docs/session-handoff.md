# Session handoff

Last updated: 2026-08-31

This is the restart point for the next working session. The controlling
sequence is [`implementation-roadmap.md`](implementation-roadmap.md), which
implements the owner's [`full original plan`](original_context.md) and the
accepted
[`SQL-first architecture`](sql-first-recommendation-architecture.md). Read the
original context from first line to final line before continuing the active
phase.

## Current checkpoint

- Active phase: **Phase 7 — product integration and production verification, in progress**.
- Phases 0–4 are complete and verified.
- `/quiz` now returns confirmed, verification-required, relaxation, why-not,
  score-trace, and source sections after the six core screens or optional
  refinement groups.
- Migrations `0001` through `0032` are applied to the connected Supabase
  project. The live v3 catalogue contains all 24 brands and 28 accepted
  variants, and exact catalogue plus six-profile SQL/TypeScript predicate and
  result parity passes. All 20 public catalogue tables have RLS enabled with no
  direct browser grants or policies; the application uses only two narrow,
  read-only v3 RPCs for accepted facts and SQL hard-filter codes.
- Migration `0031_expand_catalogue_vostok.sql` adds the reviewed Vostok 420059
  row, and `0032_expand_catalogue_boldr.sql` adds the reviewed BOLDR Odyssey
  Horizon `ODY-TI-40-H-BL` row on its homogeneous 91 g integrated Druber strap;
  the bundled 125 g titanium bracelet remains accessory context. Worn & Wound's
  exact Horizon hands-on review records the hands and indices glowing until
  morning after overnight wear, closing the sole lume gap as `strong`. Local
  and live seed coverage is now 1,102/28,800 cells across 28 variants. The
  publishable-key parity audit passes for all six golden profiles.
- The deferred Chromium preflight now passes all eight desktop/mobile landing,
  health, error-boundary, and six-screen diagnostic tests. The E2E test scopes
  accessibility checks to application-owned markup and leaves the cross-origin
  Beehiiv iframe to the vendor's contract.
- The Phase 6 entry-gate harness evaluates six shared golden profiles through
  the real recommendation function. At 1,000 iterations per profile, all runs
  are deterministic, hard-filter violations are zero, the slowest profile
  averages 0.2854 ms per evaluation on this runner, and provider cost is USD
  0.00. Semantic functionality remains an experiment, not a production
  dependency.
- The first bounded semantic pilot used strict structured output on three
  synthetic free-text profiles. It matched 11/21 expected fields (52.38%) and
  missed categorical hard constraints, so it was not adopted; the 651-token
  usage record is retained in the evaluation artifact and no model output
  entered the recommendation path.
- Phase 6 is closed on that evidence; the SQL-first deterministic engine remains
  the production baseline. Phase 7 integration verification is now the active
  sequence.
- The latest protected Vercel production deployment passed smoke checks for `/`,
  `/quiz`, and `/health`; a valid version-2 core submission returned HTTP 200
  and selected `catalogueOrigin: supabase` against the live 28-variant
  catalogue. A temporary share link was used only for the check and is not
  configuration.
- Server middleware now emits request IDs, structured duration/status logs,
  `Server-Timing`, and security headers with a vendor-scoped CSP. The full
  desktop/mobile browser matrix remains green after allowing React Router's
  required inline hydration bootstrap and Beehiiv's Cloudflare challenge host.
- Behavior deployment `dpl_2t4qVXZgf7MresTePzzMiGC5BggK` is `READY` from commit
  `70e092a`; it includes the explicit quiz policy, optional distributed adapter,
  Beehiiv opt-in, privacy-safe funnel events, and source-backed Resend dossier
  delivery below, including the four named dossier contract sections.
  Protected production smoke checks on that deployment return 200 for `/`,
  `/quiz`, and `/health`; the deployment-scoped error-level runtime-log query
  is empty.
- The quiz action now has an explicit rate-limit policy parser and a tested
  process-local fallback: both `QUIZ_RATE_LIMIT_MAX_REQUESTS` and
  `QUIZ_RATE_LIMIT_WINDOW_SECONDS` must be positive integers, partial or invalid
  configuration returns a visible 503, and a configured window returns 429 plus
  reset metadata after exhaustion. The variables remain unset because the
  available production sample contains only five requests in seven days (four
  `/` and one `/quiz`); the Vercel Web Analytics query for 2026-08-24 through
  2026-08-31 reported zero visitors and pageviews, so no quota was guessed. The
  official Upstash sliding-window adapter now
  takes over automatically when both Redis REST credentials and policy values
  are configured; partial credentials or Redis timeouts fail visibly with 503.
  The policy remains unset, and deduplication plus a traffic-derived quota are
  still pending, so the local bucket is not claimed as global enforcement.
- The result screen now preserves access without email and exposes a separate,
  checked email opt-in. Server-side validation rejects malformed addresses or
  an address without consent; valid requests call the configured channels while
  missing configuration and provider failures remain visible and do not hide
  the recommendation. Beehiiv records the subscription and requests its
  configured welcome email. Paired `RESEND_API_KEY` and `EMAIL_FROM` values
  additionally send a deterministic, source-backed dossier whose historical
  and prose context is explicitly marked unavailable. Beehiiv and Resend
  outcomes are independent, with partial delivery shown in the result UI.
- Quiz actions now emit privacy-safe `quiz_funnel` runtime events containing
  only intent, catalogue origin, result counts, and subscription status. No
  profile answers or addresses are logged. This supplies the initial Vercel-log
  evaluation surface; conversion conclusions remain pending until production
  traffic provides enough observations.
- After BOLDR acceptance, the coverage planner again ranks Cartier Tank Must
  Small `WSTA0107` first at eight empty, under-evidenced formal/small-wrist
  precision cells. Its exact Spain-region product page confirms the
  configuration and dimensions but still supplies no numerical quartz rate
  bound or period. A source-led exact-calibre search found only an unanswered
  monthly-accuracy owner query; keep it research-only and do not invoke the
  provider.
- The next-ranked Sinn 856 UTC `SI-084` pre-screen found a used listing with
  83.1 g total mass and a three-position ±10-second/day timegrapher result, but
  its model identity and 39 x 39 x 10.6 mm measurements conflict with the
  current exact Sinn sheet. It does not identify the current leather SKU, so
  both claims remain rejected and no provider request is authorized.
- On 2026-08-29 the owner explicitly requested that the complete accumulated
  branch be pushed. The 28 existing local commits plus the handoff checkpoint
  were therefore delivered to `origin/main`, superseding the earlier
  temporary no-push instruction. The deployed server requests the v3 RPC pair,
  strictly validates the response and exact variant coverage, and falls back as
  one unit to the reviewed 21-row bundle plus deterministic local predicates
  if those RPCs become unavailable or divergent. The 21-row live SQL parity
  requirement is now satisfied.
- The owner-requested push advanced `origin/main` through `f505270`. The Git
  remote SHA matched local HEAD immediately afterward. The resulting Vercel
  deployment served the same `quiz-D6lju-YI.js` asset as the reviewed local
  build; `/`, `/quiz`, and `/health` returned 200. A valid core recommendation
  POST returned `catalogueOrigin: bundled_seed` and the visible notice `Live
  catalogue validation failed; using the reviewed bundled snapshot.` This is
  the expected safe state while live Supabase lacks the v3 RPC pair.
- Applicability commit `c0ebca7` then advanced `origin/main`, and the remote SHA
  again matched local. Production `/`, `/quiz`, and `/health` returned 200. A
  valid core recommendation evaluated catalogue version 2 across all 18 bundled
  variants, returned `catalogueOrigin: bundled_seed`, and retained the expected
  live-catalogue validation notice. This proves the v3 application target fails
  safely as one unit while production Supabase still exposes only v1.
- Relational checkpoint commit `70ef32d` advanced `origin/main` after the live
  migrations, 18-row parity, RLS, strict research/knowledge/coverage audits,
  and the 68-test fast gate passed. Vercel deployment
  `dpl_AVbxq6wNLVRYemwwoiXXfyVcHXDG` reached `READY`; `/`, `/quiz`, and
  `/health` returned 200; a valid questionnaire-version-2 core POST selected
  the live Supabase facts and SQL hard-filter path without a bundled-fallback
  notice; and the surrounding 30-minute runtime-error window was empty.
- Chunking, embeddings, `pgvector`, a separate vector database, Mastra, Ollama,
  and RunPod are outside the launch critical path.
- Seiko Prospex Solar Diver `SNE599P1` is accepted on its exact all-black
  `M13K113N0` bracelet. Review retains the conflicting regional rate copy,
  selects the wider coherent -15/+15-seconds-per-month UK bound, corrects the
  provider's ten-month conversion to approximately 7,300 hours, and proves
  strong LumiBrite plus spring-bar attachment without treating the clasp as the
  interface. Migration `0022` is live; 20-row catalogue/SQL parity passes, and
  coverage is now 624/28,800 cells (2.17%).
- Brew Metric Titanium Chronograph `MTRC-TITAN` is accepted on its exact
  titanium bracelet. Review rejects circular-diameter duplication and visual
  integrated-bracelet inference, then validates the non-round 36 x 41.5 mm
  case, 89 g mass, TMI VK68 -20/+20-seconds-per-month rate, quick-release
  interface, no-date configuration, and convergent exact-owner no-lume status.
  Migration `0023` is live with M1 complete and 31 verified reference-level
  evidence rows; 21-row parity passes and coverage is 684/28,800 (2.38%).
- Mondaine Classic `A660.30314.11SBBV` is accepted on the exact white no-date
  dial and supplied black vegan grape-leather quick-change strap. Independent
  review revalidated all accepted fields after the paid response failed strict
  normalization, and exact SBB plus Helveti records establish whole-watch no
  luminescence. Migration `0024` is live with M0/M1 complete and 40 verified
  reference-level evidence rows from six sources; 22-row public parity passes
  and coverage is 844/28,800 (2.93%).
- Bertucci A-2T Original Classic `12022` is accepted on the exact black dial
  and supplied black B-TYPE nylon band. Review closes current manufacturer
  dimension-sheet gaps, rejects stale exact-retailer 100 m and approximately
  54 g rows, preserves the GM10-or-2S60 scalar calibre and differing battery
  endurance as `null`, accepts their common -20/+20-seconds-per-month rate,
  maps fixed titanium retention bars to `proprietary`, and rejects the printed
  24-hour scale as a complication. Migration `0025` is live with M0/M1
  complete and 42 verified reference-level evidence rows from seven sources;
  23-row public parity passes and coverage is 940/28,800 (3.26%).
- Luminox Leatherback SEA Turtle `XS.0307.WO` is accepted on the exact white
  dial and fiberglass-compound case with the supplied white 19 mm silicone
  strap. Review prefers Luminox's configured 48 g manufacturer value over the
  authorized retailer's conflicting 40 g row, validates 39 x 12 x 46 mm
  geometry, Ronda 515 -10/+20-seconds-per-month quartz operation, strong
  constant tritium visibility, spring-bar attachment, protected push-pull
  crown, 100 m resistance, mineral crystal, and date, and excludes black 0301,
  44 mm Giant, alternate-strap, and generic collection inheritance. Migration
  `0026` is live with M0/M1 complete and 28 verified reference-level evidence
  rows from four sources. Forward migration `0027` preserves both Ronda source
  snapshots and attaches the Luminox evidence to its independently reviewed
  snapshot. 24-row public parity passes, and coverage is 1,068/28,800 (3.71%).
- Catalogue parity now compares each evidence field group through its complete
  source-retrieval signature instead of flattening provenance to field names.
  The stronger audit exposed omitted corroborating price evidence for Brew and
  Bertucci: the renderer previously selected only the first source carrying a
  price fact. It now emits every price and availability source, and additive
  migration `0028` restores both omitted rows. Public-key parity passes for all
  24 variants and six profiles under the stronger contract.
- Laco Augsburg 39 article `861988` is accepted on the exact black dial and
  brown riveted calf-leather strap. Existing exact sources establish the EUR
  390 German offer, 39 x 11.55 x 46.5 mm geometry, 18 mm spring-bar interface,
  81.5 g configured weight, installed 0/+25-seconds-per-day regulation,
  42-hour reserve, 50 m resistance, sapphire, and no date. A July 2026 verified
  current-model purchaser reports excellent legibility through morning, and
  Laco publicly concurs; this closes the sole M1 gap as strong lume without
  accepting C3 material alone as performance. Migration `0029` is live with 23
  verified reference-level evidence rows from five sources. Exact 25-row
  parity passes. The row adds a second candidate to twelve sparse cells, so
  coverage remains 1,068/28,800 (3.71%) while single-candidate cells improve to
  1,052.
- Vostok Europe Nuclear Submarine SSN 571 `VK61-571H614` is accepted as the
  exact titanium watch worn on its black leather strap with petrol stitching;
  the supplied black silicone strap remains an accessory and is not blended
  into the scored configuration. Primary evidence establishes 45.7 x 15.6 x
  56.2 mm geometry, 22 mm lugs, VK61A -20/+20-seconds-per-month hybrid
  operation, 300 m resistance, strong continuous tritium, a proprietary
  screw-fixed interface, chronograph, and date. The [exact OTTO leather
  listing](https://www.otto.de/p/vostok-europe-chronograph-nuclear-submarine-herrneuhr-vk61-571h614-lederband-46-mm-CS071P09T/),
  retrieved 2026-08-31, explicitly separates the installed leather strap from
  the silicone accessory and publishes approximately 135 g; its contradictory
  commercial state is rejected, so the reviewed Czech EUR 793 short-wait offer
  remains canonical. Migration `0030` is live with M0/M1 complete and 29
  verified reference-level evidence rows from six sources. Exact 26-row and
  six-profile parity passes. The 56.2 mm span limits compatibility to the
  `7_5_plus` wrist band: the row supports 16 cells, opens eight, and adds a
  second candidate to eight others. Coverage is now 1,076/28,800 (3.74%),
  single-candidate cells remain 1,052, and under-evidenced cells fall to 216.
- Vostok Amphibia Classic `420059` is now accepted on the exact blue Scuba
  Dude dial and supplied stainless-steel bracelet. The factory page controls
  the current homogeneous row at 39.6 x 46 x 15 mm, 128 g, 18 mm bracelet,
  Vostok 2416B automatic movement, -20/+60 seconds per day, 200 m, acrylic
  crystal, weak lume, and date. An exact-reference owner listing identifies
  the original bracelet with a missing spring bar, and Vostok-World24's
  partner spare-parts page names 2416/420059 as a 420-case example for its
  18 mm spring bars; the interface is accepted as `spring_bar` with secondary
  provenance. Migration `0031` is rendered and the review is M0/M1 complete.
  The row opens eight `under_300`, `field_water_abuse`,
  `workhorse_mechanical`, `simple_date` cells across four wrist bands and two
  weight bands. Coverage is 1,084/28,800 (3.76%), single-candidate cells are
  1,060, and under-evidenced cells are 224. No provider request was made.
- The Mondaine provider ledger preserves two failed attempts: the first
  returned useful raw research at USD 0.02028 but failed strict normalization;
  the second was interrupted before a response was persisted after an
  equals-style CLI parsing defect caused `--attempts=1` to fall back to three.
  The worker now accepts spaced and equals-style options, and the interrupted
  record retains null response/usage rather than a fabricated cost. The full
  ignored ledger is now 64 attempts (39 succeeded, 25 failed) across 34 target
  IDs with USD 0.55435 recorded cost.
- BABY-G `BGD-5650-1JF` remains `needs_more_evidence` after a source-led
  follow-up. Its first provider attempt remains a strict-normalization failure
  and its one permitted retry produced 40 provisional facts at USD 0.01982; no
  new provider request was made. Independently retrievable Casio Japan/Europe
  exact routes establish 42.1 x 37.9 x 11.3 mm rectangular dimensions, 31 g,
  resin case/band, Tough Solar/Multi Band 6, 100 m resistance, mineral glass,
  shock resistance, calendar, alarms/world time, and +/-15-seconds-per-month
  fallback accuracy. Sakura's exact USD 93 new offer has contradictory Out of
  stock and Available 93 controls, so availability is unknown. Exact-family
  replacement-band records resolve the case-side interface as proprietary
  pushpin/special mount. The rectangular case is stored as width/length, and
  `lumeGrade` is now the sole M1 gap; no catalogue row is promoted. The full
  provider ledger remains 69 attempts (41 succeeded, 28 failed) across 37
  target IDs and USD 0.59193 recorded cost. The default queue is empty.

- Swatch Skin White Classiness `SS08K102-S14` is reviewed
  `needs_more_evidence`. Its one provider attempt produced 40 provisional facts
  at USD 0.01776. Current Swatch US/Spain pages and exact MATY, Watch.co.uk, and
  Zegarki.zgora.pl records establish the white configuration, $125/€120 offers,
  34 mm diameter, 38 mm wearing span, 12 g mass, quartz, 3 bar, biosourced
  materials, no-date display, and proprietary Swatch steel-pin attachment. The
  3.9 mm secondary thickness remains a conflict with the primary 4.3 mm value.
  No numerical accuracy bound or qualifying lume grade was found, so no row is
  promoted. The provider ledger now has 67 attempts (41 succeeded, 26 failed)
  across 36 target IDs and USD 0.59193 recorded cost. The default queue is
  empty again. Citizen FORMA Eco-Drive `FRA36-2432` is now reviewed
  `needs_more_evidence`: both provider attempts failed strict normalization, but
  the raw responses and independent exact-source review establish the 57 g,
  18 x 6 mm B023 solar reference, a 27 mm rectangular length, 13 mm interface
  width, ±15-seconds-per-month rate, one-year reserve, 30 m resistance, and a
  USD 102 new Sakura offer whose contradictory stock controls normalize to
  unknown. The rectangular geometry is not collapsed into a diameter; an exact
  Naturum record resolves the case-side bracelet connection to `spring_bar`,
  while a qualifying lume grade remains null. The
  provider ledger is now 69 attempts (41 succeeded, 28 failed) across 37 target
  IDs and USD 0.59193 recorded cost. The default queue is empty.

  Vostok Amphibia Classic `420059` is now accepted in migration `0031` after
  exact-owner and Vostok-World24 partner spare-part evidence closes its sole
  attachment gap as `spring_bar`; the row opens eight cells and raises
  coverage to 1,084/28,800 (3.76%). The Rado HyperChrome Quartz `R32280109`
  pre-screen is retained as a negative result: its projected 72 cells remain
  blocked by four gaps without an exact service or controlled-lume path. The
  next ranked hypothesis is Cartier Tank Must Small `WSTA0107`, with eight
  projected formal, small-wrist, high-price time-only cells. Cartier's exact
  Spain-region page now corroborates the configuration and dimensions but adds
  no numerical rate tolerance or defined period, so the candidate remains
  research-only and no provider request is queued.

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
- The audit is not complete at the data layer: only 26 homogeneous variants are
  accepted locally, 1,076 of 28,800 cells are covered, every covered cell is
  under-diversified, and 216 are under-evidenced. Phase 5 must close that
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
- Migrations `0001` through `0020` are applied to Supabase project
  `osfqexnzgkksfvaocjvl`; none enables `pgvector`.
- `docs/catalogue-schema.md` maps questionnaire requirements to fields and
  records refresh/null/completeness policy.
- `app/domain/coverage.ts` and `scripts/audit-coverage.ts` enumerate the defined
  pre-collection core matrix and report empty, single-candidate,
  under-diversified, and under-evidenced cells.
- The applied live catalogue and reviewed local seed both have 16 brands and 18
  variants after adding Christopher Ward
  C63-39AGM4-S00W0-B0, Orient RA-AC0M03S, Marathon WW194003BK-0108, Casio
  G-5600UE-1, Seiko HCC004J1, and TUDOR M79000N-0001. Migrations `0010`
  through `0014` and `0017` each carry
  only their additive row and its sources, price, availability, evidence,
  deployment, friction, traits, and product URL.
- Migration `0015` adds only nullable rectangular case width/length columns.
  Migration `0016` corrects the already accepted Reverso Q3988481 from a
  synthetic 28.3 mm diameter to manufacturer-labelled 47 x 28.3 mm length and
  width, preserves its explicit 47 mm lug-to-lug, and introduces v2 catalogue
  and hard-filter RPCs with SQL/TypeScript non-round fit parity.
- Migration `0017` adds only the homogeneous Black Bay 54 M79000N-0001 after
  exact manufacturer spring-bar-hole evidence resolved its final attachment
  gap.
- Migration `0018` adds the explicit field-evidence applicability state and v3
  RPC pair. Existing evidence remains `observed`; no historical null is
  reclassified. Verified non-applicable conventional lug width is a hard
  incompatibility, while unknown null remains verification-required.
- The current local audit reports 496 of 28,800 cells covered (1.72%): 492 are
  single-candidate, all 496 are under-diversified, and 224 are under-evidenced.
  Coverage price bands now use the dated EUR base instead of raw source-currency
  numbers; this honestly exposes the current `15000_plus` band as empty rather
  than misclassifying the PLN-priced TUDOR row.
- Migration `0019` restores the verified evidence link for Casio's existing
  `secondary_ask` price snapshot; migration `0020` enables RLS on every public
  catalogue table without adding browser table policies or grants.
- Browser roles have no table grants. The security advisor's current findings
  are expected informational no-policy notices for the server-only RLS tables
  plus intentional anonymous and inherited signed-in execution warnings for
  the two public v3 `SECURITY DEFINER` RPCs; both functions have an empty
  `search_path`, fixed read-only SQL, and no dynamic statements. Performance
  findings remain unused-index information.

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
- `recommendation_catalogue_v3()` returns the accepted relational catalogue in
  the strict catalogue-version-2 Zod runtime shape, including sparse reviewed
  applicability states. `recommendation_hard_filter_v3(profile, as_of)` returns
  the authoritative hard-reject and missing-fact partition.
- The server validates both RPC responses, requires exact variant coverage,
  caches valid catalogue facts for 60 seconds, and visibly falls back as one
  unit to the reviewed bundle plus local predicates.
- `npm run audit:catalogue-parity` proves fact, predicate, and result parity for
  all 18 applied variants across six golden profiles. PostgreSQL
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
- A 2026-08-30 Sinn follow-up now locks the 856 UTC review to WatchBuys SI-084,
  the black-calf-leather configuration sold by Sinn's official North American
  distributor. Its current page supplies a new, in-stock USD 2,680 Add to Cart
  offer and 47.5 mm lug-to-lug. Sinn's exact-series manual directly documents
  case spring bars, resolving the factory interface without inferring from
  leather or buckle type. Full configured weight remains unresolved because 70
  g is head-only; exact-SKU rate reports lack a common protocol; and a single
  timed eight-hour lume observation lacks independent timed corroboration.
  Sinn now has three rather than six M1 gaps.
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
  reference. A 2026-08-30 Perplexity-assisted follow-up found an exact
  specialist-retailer -10/+25 seconds-per-day claim, but it is unattributed,
  untested, and differs from Certina's approximate +30 upper guidance. The
  official FAQ refers only to undisclosed internal tolerances, so accuracy
  remains null.
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
  factory attachment. A 2026-08-30 Perplexity-assisted pass found convergent
  exact-reference owner and Omega-certified-watchmaker forum evidence for
  spring bars, but no public Omega product or service corroboration. Lume
  sources still establish material presence without repeatable performance.
- Seiko Presage HCC004J1 is now the fifth migration-ready review. Thong Sia's
  exact official Seiko Boutique page reports `Lumibrite: N/A`; Seiko's
  corporate directory identifies Thong Sia as its Singapore distributor, and
  an independent exact-reference hands-on review corroborates that the watch
  lacks luminous paint. The conflicting Netherlands rows are rejected for lume
  because that same page visibly mixes in unrelated Astron 5X53 GPS Solar and
  titanium product copy. Generated migration `0014` adds only this row after
  `0013`.
- The local seed is now 16 brands/18 variants and covers 496/28,800 cells
  (1.72%): 492 single-candidate, 496 under-diversified, and 224 under-evidenced.
  Strict research reports 18 accepted targets, 13 active targets, and 21
  reviews: six `ready_for_migration`, 13 `needs_more_evidence`, and two
  `excluded`.
- Live Supabase remains 11 brands/12 variants. Apply migrations `0010` through
  `0018` and prove 18-row catalogue and six-profile SQL parity before treating
  Supabase as active. The owner-authorized application push now operates on the
  visible bundled fallback in the meantime.
- Citizen BM8180-03E now needs only a repeatable lume grade. Citizen Watch
  Group's exact-model parts lookup lists dedicated spring-bar part 509-2074
  alongside the watch's band, resolving the factory interface as `spring_bar`.
  The conflicting exact-reference lume observations remain insufficient for a
  categorical grade.
- TUDOR M79000N-0001 is now migration-ready and accepted in the local seed.
  TUDOR's exact Black Bay 54 dossier explicitly identifies spring-bar holes
  passing through the lugs, while the exact-reference fitment guide identifies
  the corresponding spring bars. This resolves the final interface gap without
  inferring it from the bracelet. The separately corroborated normalized
  full-length weight remains 139 g, and the 45.8 mm hands-on lug-to-lug is
  retained as a measured value.
- The PLN-priced TUDOR row exposed a pre-existing coverage-projection defect:
  raw currency amounts were passed directly to shared price-band thresholds.
  Coverage now converts every source price through the dated EUR FX snapshot
  first. TUDOR correctly projects into `2000_5000`, and the current
  `15000_plus` coverage gap remains visible instead of being filled by a unit
  mismatch.
- Swatch SO28N100 now needs only resolved full-watch weight, a numerical
  exact-applicable quartz rate bound, and a repeatable lume grade. Swatch's
  embedded exact product payload resolves 34 x 8.75 x 39.2 mm geometry; a
  current supported-currency official-retailer offer resolves price; the exact
  original strap plus Swatch's connector-pin guide resolve a 17 mm proprietary
  interface; and two exact-reference specifications explicitly report no date.
  The conflicting 18 g and 22 g records are retained rather than normalized.
  Swatch's public exact-reference Shopper Products response additionally exposes
  `c_weight = 64`, but supplies no unit or watch-only configuration. The value is
  recorded as primary evidence and explicitly rejected for `weightFullG` rather
  than being mistaken for wearable mass.
- Bulova 98B316 now needs only full configured weight and a repeatable lume
  grade. Citizen Watch Group's exact-model service lookup identifies Icon
  98B316 and lists its band and a dedicated spring-bar replacement separately,
  resolving the factory interface as `spring_bar`. Two exact-reference
  dimensional sets report 54.5 mm case length and a third reports 54.6 mm,
  resolving lug-to-lug at 54.5 mm. Weight records at 274 g, 276 g, and
  approximately 270 g after bracelet sizing remain explicit rather than being
  forced into one value. A 2026-08-30 Perplexity-assisted pass added conflicting
  170 g and approximately 400 g listing fields without a full-bracelet
  bare-watch protocol. The official verified-buyer lume complaint also lacks a
  controlled charge or elapsed-time result, so both M1 gaps remain null.
- Blancpain Fifty Fathoms Tech 5019A 12B30 94A now needs only full configured
  weight and numerical accuracy. Blancpain's exact dossier establishes its 47
  mm diameter and central-lug construction; an exact-reference hands-on
  specification reports 47 mm lug-to-lug, and the exact manufacturer width
  dash is reviewed as a physical `not_applicable` conventional lug width. A
  2026-08-30 Perplexity-assisted pass and independent official-source recheck
  found no packaging-free full-watch scale measurement and no numerical 13P5A
  rate bound, service tolerance, certification result, or documented exact-watch
  test. The published 4 Hz frequency is not accuracy, so both gaps remain null.
- The Blancpain width dash exposed and now closes a cross-layer applicability
  gap related to Claude's Q11 audit. Catalogue version 2, the strict seed
  parser, the TypeScript hard filter, migration `0018`, and the v3 RPC pair all
  distinguish reviewed `not_applicable` from unknown null. The former produces
  `lug_width_not_applicable` for an active conventional-width request; the
  latter remains verification-required. No historical null was reclassified.
- Vostok Amphibia 420059 now needs only manufacturer-corroborated factory
  attachment evidence. Its exact factory page now supplies primary 39.6 x 46 x
  15 mm geometry, 128 g full configured weight, 18 mm bracelet width, calibre,
  rate, reserve, WR, crystal, date, and lume-location evidence; it supersedes
  the retailer-rounded 39 mm diameter and retailer product URL. Two independent
  exact-reference reviews report sparse, difficult-to-read, fast-fading lume,
  corroborated by exact-reference owners, so the performance maps to `weak`.
  The factory still names only bracelet material and width, while the available
  pins answer remains ambiguous between bracelet links and the case interface;
  `attachmentType` is therefore still null. A 2026-08-30 Perplexity-assisted
  pass added Vostok's exact official shop route and case-420 category, but both
  still omit any connector or exploded-interface specification.
- Cartier Tank Must WSTA0107 now needs only a numerical exact-applicable
  accuracy bound. MAIER's exact-reference technical sheet explicitly reports
  no Super-LumiNova on the hands, and the independent exact-reference
  Chronospex record classifies overall luminescence as none; Cartier's exact
  page independently identifies plain blued-steel hands and a silvered printed
  dial. This resolves `lumeGrade: none` without inferring absence from omitted
  marketing copy. The additive geometry contract and migration `0015` preserve
  the official 29.5 x 22 mm rectangular case without inventing a diameter;
  exact reviewed sources also resolve the $4,100 U.S. authorized-retailer
  offer, 16 mm interface, approximately 79.3 g maximum bracelet weight, and
  Cartier QuickSwitch attachment. No Cartier row was added.
- Audemars Piguet Royal Oak 16202ST.OO.1240ST.02 now has a reviewed
  `fieldApplicability.lugWidthMm: not_applicable` fact. AP's own Heritage
  record explicitly includes model 16202 in the documented case lineage and
  states that the case extensions themselves constitute both the lugs and the
  first bracelet link. This resolves conventional between-horns width from
  affirmative physical evidence rather than from the product page's omission.
  The public endpoint called by AP's exact U.S. product page also resolves a
  USD 40,100 amount/currency/market fragment, but it supplies no purchase
  availability or channel. The complete price gate, lug-to-lug, full configured
  weight, numerical accuracy, and graded lume remain open; no AP row was added.
  A detailed 16202 hands-on video was not used for its measured 48.6 mm case
  span, 57.4 mm fixed-bracelet span, or short-lived lume: its own movement
  segment explicitly identifies the 50th-anniversary rotor, making that watch
  the sibling `.01` variant rather than exact `.02` evidence. A 2026-08-30
  Perplexity-assisted pass likewise found only `.01` values for numerical case
  span, approximately 130 g weight, and a +2.5 seconds-per-day observation. An
  exact-reference February 2026 tariff record corroborates the USD 40,100
  suggested retail figure but not stock, allocation, orderability, or an AP or
  authorized sales channel. No controlled exact `.02` lume result surfaced, so
  all five gaps remain null.
- The accepted Jaeger-LeCoultre Reverso Tribute Duoface Small Seconds Q3988481
  now uses the manufacturer's explicit `L x W` semantics: `caseLengthMm: 47`,
  `caseWidthMm: 28.3`, `caseDiameterMm: null`, with the separately labelled
  47 mm lug-to-lug retained for fit. Migration `0016` updates field evidence,
  rectangular-aware completeness, and both public read contracts without
  weakening any hard filter.
- The latest evidence sequence is committed as `db77f92` (Swatch), `760979c`
  (Omega), `a6fb895` (Bulova), `e17a2db` (Blancpain), and `abf958d` (Vostok),
  followed by the Cartier geometry/evidence, Reverso correction, TUDOR
  expansion, applicability checkpoint `c0ebca7`, and production fallback smoke
  `4bc4de8`. The latest pushed research checkpoints are `26bcd6a` for Cartier
  no-lume evidence, `e79d6bf` for AP lug-width applicability, and `ad393f2` for
  AP's primary price fragment. `npm run check` passes formatting, lint, type
  generation, TypeScript, all 66
  tests across 13 files, and the production build. The strict research,
  coverage, and knowledge audits pass, and a PostgreSQL parser accepts all 15
  statements in migration `0016`, all 61 statements in migration `0017`, and
  all 14 statements in migration `0018`.

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

1. Select the next named homogeneous reference with a source-led pre-screen.
   Record its uncovered-cell purpose and prove every projected M1 class from
   exact or directly applicable sources before invoking the provider. The
   default queue is empty; do not spend on a generic brand sweep or accept a
   brand-level rollup as a reference fact.
2. Treat the live 27-row v3 catalogue and six-profile parity as the relational
   baseline. After every new accepted variant, add one forward migration,
   rerun exact live parity through the publishable-key RPC path, and retain the
   all-or-nothing bundled fallback for any divergence.
3. Resolve or explicitly retain the first review gaps. A 2026-08-30
   Perplexity-assisted source pass explicitly retained Citizen BM8180-03E's sole
   lume gap: exact-reference reports separate hands from numerals but still span
   all-night visibility to near-impossible dark reading without a controlled
   charge or timed decay method. A separate 2026-08-30 Cartier pass surfaced a
   blocked exact regional route reported to name calibre 157 and validated the
   official high-efficiency-quartz overview, but found only battery-autonomy
   claims, not a numerical rate bound and period. WSTA0107's accuracy gap is
   therefore explicitly retained; its rectangular geometry and explicit
   no-lume evidence remain supported.
   A 2026-08-30 Swatch pass explicitly retained full-watch weight, numerical
   exact-applicable quartz rate, and lume as gaps: `c_weight = 64` remains
   undefined, explicit 18 g and 22 g records conflict, the official standard
   manual provides no exact rate bound, and no source establishes repeatable
   lume or an explicit no-lume state. A 2026-08-30 Vostok pass retained the
   sole attachment gap after the exact factory-shop route and case-420 category
   still omitted any connector or exploded-interface specification; the later
   exact-owner and Vostok-World24 partner records now close that gap as
   `spring_bar` with secondary provenance. AP
   16202ST's conventional lug width is now verified non-applicable, but its five
   remaining gaps keep it research-only.
4. Retain Citizen BM8180-03E, Sinn 856 UTC, and Omega
   310.30.42.50.01.001 as research-only until their recorded review gaps are
   independently resolved. Omega's accuracy and no-date status are now resolved;
   its lume and attachment gaps remain after the 2026-08-30 secondary spring-bar
   pass found no public Omega corroboration and no repeatable lume test. Do not
   salvage contradictory or blocked provider claims manually.
5. Convert only M1-complete reviewed candidates into small additive catalogue
   migrations. Keep every knowledge-pack family research-only until it is split
   into homogeneous variants and independently sourced.
6. Rerun coverage, strict catalogue validation, SQL parity, and the fast gate
   after every accepted batch.
7. Continue prioritizing coverage and original-plan purpose over raw brand
   count even though the 200-dossier pack is now fully represented.
8. Do not rerun the now-empty default queue. Close a named existing review gap
   only from independently identified exact-reference evidence, or add a new
   target with an explicit coverage or original-plan purpose before invoking
   the worker. Do not repeat excluded
   Bulova 98B429 or AP 15510ST.OO.1320ST.01, substitute generic calibre
   performance for a missing published exact-applicable bound, infer an
   attachment interface from the supplied strap or bracelet, or treat a blank
   conventional lug width as non-applicable without exact reviewed evidence.
9. Keep embeddings, chunking, Mastra, Ollama, and RunPod out of the production
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

## Phase 5 continuation — Omega exact-reference pre-screen (2026-08-31)

The next ranked coverage candidate, Omega Speedmaster Moonwatch
`310.30.42.50.01.001`, remains research-only. A mirrored exact-reference Omega
manual confirms the steel bracelet and comfort-adjustment clasp but omits the
case-to-bracelet connector and any lume performance. A second exact-reference
review likewise discusses the bracelet without identifying its attachment
mechanism or providing a controlled lume charge/decay observation. A 3861
owner lume thread covers a sapphire sibling, not this Hesalite reference, and
does not provide a controlled timed protocol. The existing exact-reference
owner and Omega-certified-watchmaker forum evidence for spring bars remains
secondary and lacks public Omega product/service corroboration; material-only
Super-LumiNova evidence remains insufficient for a categorical lume grade. Both
M1 gaps (`attachmentType`, `lumeGrade`) stay null, no provider request was made,
and the next source-led selection must target the next named candidate only
after a complete exact-source path is identified.

The next coverage-led Citizen Garrison `BM8180-03E` pre-screen added an
exact-SKU owner discussion reporting lamp or sunlight charging, brightness
fading within minutes, and overnight legibility (another owner reports eight
hours). It supplies no controlled illuminance, charge duration, or timed decay
series and joins existing exact-reference reports that conflict from all-night
visibility to near-impossible dark reading. Citizen's exact-model parts lookup
already resolves the factory interface as `spring_bar`; `lumeGrade` remains the
sole null M1 field, so no provider request was made.

The next named Certina DS Action Diver 38 mm Titanium `C048.807.44.051.01`
pre-screen also remains open only for `accuracy`. A Certina owner discussion
reports a six-day positional series and other daily readings for unnamed DS
Action/Powermatic 80 divers, but mixes 38 mm, 40.5 mm, and PH1000M models and
never identifies the selected reference. The readings therefore cannot become
an exact-reference guarantee. Certina's official page, manual, and FAQ still
offer only approximate or undisclosed general tolerances, while the
unattributed exact-retailer claim is conflicting and untested. No provider
request was made; the next candidate must wait for an exact applicable bound.

The next Baltic MR Classic Blue `MR01BLUS35` pre-screen remains negative for
configured `weightFullG`, `accuracy`, `lumeGrade`, and `dateStatus`. A blue MR01
hands-on article lists lume as N/A and notes no date window, but examines an
earlier ELA05MN sample rather than the current Stitched Lion configuration. A
Hodinkee specification says Lume: None for a black gold-PVD MR01 sibling; its
different case and dial cannot be transferred. No exact configured weight or
rate bound surfaced, so no facts were promoted and no provider request was
made.

The next Blancpain Fifty Fathoms Tech `5019A 12B30 94A` pre-screen found an
additional exact-reference hands-on review. It corroborates the current
47 mm/14.81 mm case, calibre 13P5A, 120-hour reserve, orange rubber and
tool-less strap exchange, date, and dual-color Super-LumiNova, but publishes no
assembled full-watch mass or numerical rate tolerance. The exact primary
dossier and this secondary review therefore leave `weightFullG` and `accuracy`
null; no provider request was made.

The 2026-08-31 exact authorized-dealer recheck adds no closure: Teddy
Baldassarre repeats the 47 mm/14.81 mm titanium configuration and 13P5A movement
but publishes neither configured full-watch weight nor a numerical rate
tolerance. Both M1 fields remain null; no provider request was made.

The next Patek Philippe Grande Sonnerie `6301P-001` pre-screen partially
resolves the review without provider spend. An exact independent U.S. dealer
lists the platinum reference at USD 1,963,500, unworn, with Add to Cart and
U.S. pickup; because it explicitly disclaims Patek authorization, the snapshot
is classified `secondary_market`. An exact Hong Kong dealer and exact-reference
strap specialist converge on a 22 mm lug width, but the specialist's
spring-bar claim remains secondary and lacks Patek service corroboration. No
exact lug-to-lug span, packaging-free configured weight, controlled lume
performance, or manufacturer-corroborated attachment mechanism surfaced. Price
and lug width are now resolved in review; those four physical/ownership gaps
remain null and no provider request was made.

The 2026-08-31 exact-reference recheck of Patek's current 6301P-001 page found
no new admissible evidence for lug-to-lug, configured weight, lume performance,
or attachment mechanism. The Patek Philippe Seal accuracy standard remains
accepted, but those four fields stay null; no provider request was made.

The next Audemars Piguet Royal Oak Jumbo `16202ST.OO.1240ST.02` pre-screen
partially resolves the commercial gap. Jomashop's exact-reference page exposes
a USD 96,500 grey-market offer with `IN STOCK`, `New`, and Add to Bag controls;
AP's separate USD 40,100 endpoint remains a manufacturer price conflict. AP's
integrated-bracelet and Heritage sources still establish the attachment class
and lug-width non-applicability. No exact `.02` lug-to-lug span,
packaging-free configured weight, numerical rate bound, or controlled lume
performance surfaced. Those four M1 gaps remain null and no provider request
was made.

The 2026-08-31 exact-reference search and official-page recheck found no new
admissible evidence for `16202ST.OO.1240ST.02` lug-to-lug, configured weight,
accuracy, or lume performance. AP's integrated-bracelet and non-applicable
lug-width decisions remain primary-source controlled; all four gaps stay null
and no provider request was made.

The next A. Lange & Söhne Lange 1 Tourbillon Perpetual Calendar Lumen
`720.035FE` pre-screen remains negative for price, lug-to-lug, lug width,
configured weight, accuracy, and attachment. An exact-reference editorial
review corroborates the 41.9 mm platinum case, L225.1, 50-hour reserve,
display-wide Lumen treatment, and quick-lock deployant, but offers only a broad
euro price range and no exact missing measurements or numerical daily-rate
bound. An exact U.S. seller listing is also price- and availability-on-request.
No facts were promoted and no provider request was made.

The 2026-08-31 exact-reference search and official-page recheck found no new
admissible price, lug, configured-weight, accuracy, or attachment evidence for
`720.035FE`. The display-wide Lumen mapping remains accepted, while those six
review gaps stay null; no provider request was made.

The next Rado HyperChrome Quartz `R32280109` pre-screen confirms the current
official U.S. row but closes none of its four remaining M1 gaps. Rado's exact
page supplies a homogeneous USD 1,400 in-stock offer, 41.5 x 11.7 mm case,
87 g configured mass, R292 ±10 seconds-per-year accuracy, 150 m resistance,
Super-LumiNova color placement, and a pin buckle. An exact WatchMaxx listing
corroborates the configuration and luminous hands/markers, but has no
lug-to-lug or lug-width measurement, timed lume observation, or case-fastener
record. An importer page conflicts on thickness, and Rado's generic Easy Clip
service page is not an exact-reference parts record. The older 47.7 mm span and
20/21 mm width remain rejected against the current specification set. Those
four gaps remain null and no provider request was made.

A 2026-08-31 exact-reference recheck of Rado's Great Britain route independently
repeats the current 41.5 x 11.7 mm, 87 g, 150 m, R292 ±10 seconds-per-year,
Super-LumiNova, and pin-buckle record. Its GBP offer is a separate market
snapshot, so the homogeneous U.S. price remains canonical; no lug, timed-lume,
or strap-interface evidence was added, and all four gaps remain null.

The next Bulova Icon Precisionist Chronograph `98B316` pre-screen also leaves
its two review gaps open. A newly found exact-reference hands-on article reports
274 g and says the luminous hands and markers are readable after light exposure,
but gives no bracelet-length or weighing protocol, charge intensity,
elapsed-decay series, or repeatable brightness comparison. That observation is
consistent with the existing 170/270-276 g conflict and subjective lume reports,
not a basis for selecting a canonical weight or performance class. The existing
exact primary and service-part records still control the resolved dimensions,
annual accuracy, and spring-bar interface. `weightFullG` and `lumeGrade` remain
null and no provider request was made.

A 2026-08-31 exact-reference owner review adds another conflicting measurement
set: approximately 262 g with all bracelet links, 251 g after removing three,
and roughly 53 mm lug-to-lug. The independent dimensional records converge on
54.5-54.6 mm, while full-watch records span 270-276 g; its very weak-lume
description is subjective and untimed. No value was promoted, and both review
gaps remain null.

The next Cartier Tank Must Small `WSTA0107` pre-screen leaves its sole M1 gap,
`accuracy`, open. An exact-reference Watchfinder listing confirms that a
Cartier-certified service centre inspected accuracy and functionality, but it
publishes no measured rate, tolerance bound, observation period, or test
method. Cartier's exact regional pages and movement overview likewise describe
High Autonomy quartz and battery life without a numerical timekeeping bound;
generic quartz expectations and third-party calibre summaries remain rejected.
No fact was promoted and no provider request was made.

A 2026-08-31 exact-reference recheck also found an official-agent retailer
listing for `WSTA0107`; it repeats the 29.5 x 22 mm steel-bracelet High
Autonomy quartz configuration but supplies no numerical rate tolerance,
observation period, or test method. The sole `accuracy` gap remains null and no
provider request was made.

The next Sinn 856 UTC SI-084 pre-screen leaves `weightFullG`, `accuracy`, and
`lumeGrade` open. WatchBuys' exact-product owner archive adds individual
approximately ±2 and +5 seconds-per-day observations, but no shared interval,
position or temperature conditions, instrument, or factory guarantee. The
official 70 g value remains head-only, and exact-SKU lume reports still lack an
independent timed charge/decay protocol. The exact product page and Sinn
856-series manual continue to control the resolved configuration, 47.5 mm span,
SW330-2 identity, and spring-bar interface. No fact was promoted and no
provider request was made.

The 2026-08-31 exact-reference recheck of WatchBuys SI-084 found no admissible
new evidence: 70 g is still explicitly head-only, owner timing comments remain
uncontrolled watch-specific observations, and the repeated eight-hour lume claim
after a one-minute fluorescent charge has no timed brightness series or
independent corroboration. All three M1 gaps remain null; no provider request was
made.

A further 2026-08-31 exact-model owner-thread search found anecdotes from about
-5 to +8 seconds per day and an unsourced claim that Sinn regulates to ±5
seconds per day. The thread does not identify the SI-084 strap configuration or
provide a shared interval, conditions, instrument, or manufacturer document;
the accuracy gap remains null.

The next Vaer S3 Calendar Field bundle `S3-CF-SIL20BLK-NY20KHA` pre-screen
leaves its sole M1 gap, `weightFullG`, open. Vaer's exact variant page gives
46 g as case-only mass and its strap payload exposes no unit or scope. A new
exact-SKU aggregator record describes the wrong orange-dial/beige-strap variant
and an implausible resistance value, with no wearable weighing protocol. The
existing exact 6/10 lume performance, dimensions, accuracy, and quick-release
evidence remain valid; no full configured mass was promoted and no provider
request was made.

The 2026-08-31 exact-reference Vaer recheck found no admissible full-weight
evidence: 46 g remains explicitly case-only, and the variant payload's raw
weight values still lack units and wearable scope. `weightFullG` remains null;
no provider request was made.

A further 2026-08-31 exact-model search found a marketplace item-weight field of
230 g, but it does not identify the reviewed two-strap SKU, worn strap selection,
or a bare-watch weighing protocol. The unscoped item value is rejected; the sole
`weightFullG` gap remains null and no provider request was made.

The next Swatch Skin White Classiness `SS08K102-S14` pre-screen leaves its two
M1 gaps, `accuracy` and `lumeGrade`, open. Search discovery found an exact
authorized-retailer specification labelling luminescence absent and repeating
the current dimensions, but direct retrieval is blocked by the retailer's
anti-bot page, so the indexed snippet cannot close the field. No exact
numerical rate bound for the installed SW-SF quartz movement surfaced. The
existing 12 g full-watch mass, 38 mm wearing span, and proprietary Swatch mount
remain unchanged; no facts were promoted and no provider request was made.

The 2026-08-31 recheck of Swatch's official Rakuten storefront confirms the
exact White Classiness configuration and 34 x 4.3 x 38 mm case, but adds no
numerical accuracy bound or lume evidence. Both M1 gaps remain null; no provider
request was made.

A further 2026-08-31 exact-reference search found an EAN-linked Ocarat
authorized-retailer record for `SS08K102-S14`; it repeats the 34 mm quartz,
3 bar, white-silicone configuration but supplies no numerical rate tolerance,
observation period, or lume statement. Both M1 gaps remain null; no provider
request was made.

The next Nodus Sector II Field Titanium Shale `SEC-F-SHA` pre-screen leaves its
sole M1 gap, `lumeGrade`, open. An exact reseller page corroborates the USD 625
out-of-stock titanium-bracelet configuration and repeats the BGW9 Grade A
material description, but supplies no timed charge/decay observation or
repeatable performance class. The exact Nodus page and two hands-on reviews
continue to establish the 100 g unsized-bracelet mass, regulated ±10 seconds
per day, 47 mm span, quick-release interface, and no-date configuration; no
fact was promoted and no provider request was made.

The 2026-08-31 exact-SKU Nodus recheck found no admissible lume evidence. BGW9
Grade A remains a material description, and the available rapid-charging
comments have no timed decay protocol; `lumeGrade` remains null and no provider
request was made.

A further 2026-08-31 exact-reference aggregator check labels the Shale record
luminous but simultaneously misstates the current case thickness, movement
variant, and no-date display. Its green-lume label has no charge protocol,
elapsed-decay series, or repeatable comparison; `lumeGrade` remains null and no
provider request was made.

The next Citizen FORMA `FRA36-2432` pre-screen leaves its sole M1 gap,
`lumeGrade`, open. A Japanese authorized-retailer recheck independently
repeats the exact B023, 57 g, 18 x 6 mm, ±15-seconds-per-month, and stainless
bracelet specification, but its technical list contains no lume or no-lume
statement. Citizen's own page likewise supplies no qualifying photoluminescent
performance evidence. No fact was promoted and no provider request was made.

The 2026-08-31 exact-reference search across Citizen Japan and Japanese
retailer records found no lume or no-lume specification for FRA36-2432. The
existing B023, 57 g, and ±15-seconds-per-month evidence remains coherent;
`lumeGrade` stays null and no provider request was made.

A further 2026-08-31 exact-reference Japanese retailer record repeats the B023,
±15-seconds-per-month, and stainless-bracelet configuration but reports 56 g
instead of Citizen Japan's 57 g and supplies no lume statement. The mass conflict
and sole `lumeGrade` gap remain unresolved; no provider request was made.

The next Casio BABY-G `BGD-5650-1JF` pre-screen leaves its sole M1 gap,
`lumeGrade`, open. Exact Casio Japan and Europe pages describe the light as an
LED Super Illuminator/backlight, and an independently retrievable exact-SKU
retailer page repeats the LED backlight and afterglow wording. None identifies
photoluminescent material or supplies a charge condition, timed decay series,
or repeatable performance class. The 31 g configured mass, rectangular
42.1 x 37.9 x 11.3 mm geometry, Tough Solar/Multi Band 6 operation, and exact
14 mm proprietary pushpin mount remain accepted provisional facts. No provider
request was made.

The 2026-08-31 exact-reference search found only the same Casio LED Super
Illuminator/backlight evidence. It is not photoluminescent, and no timed
charge/decay protocol exists; `lumeGrade` remains null and no provider request
was made.

The next Certina DS Action Diver 38 mm Titanium `C048.807.44.051.01`
pre-screen remains open only for `accuracy`. An exact Slovak authorized-retailer
page identifies the selected reference and repeats the Powermatic 80.611
configuration, but renders its rate field as the ambiguous `+ - 6-4 sec./day`
without a test method or defined lower and upper bounds. That malformed claim
cannot be normalized. It joins the earlier exact-retailer -10/+25 claim and
Certina's approximate -10/+30 guidance for most non-chronometers; neither is a
variant-specific guaranteed bound. No provider request was made.

The 2026-08-31 exact-reference check of an additional Certina-authorized Finnish
retailer confirms the titanium bracelet and Powermatic 80.611 configuration but
publishes no numerical rate tolerance. Accuracy remains null; the unattributed
`-10/+25` reseller claim and Certina's approximate family guidance remain
unpromoted.

The next Baltic MR Classic Blue `MR01BLUS35` pre-screen remains negative for
`weightFullG`, `accuracy`, `lumeGrade`, and `dateStatus`. A newly retrieved
exact retailer record independently identifies the Blue Stitched Lion reference
and repeats its 36 mm steel case, Hangzhou CAL5000a, hesalite, and 30 m rating,
but publishes none of the four missing fields. The current exact variant's
primary page still supplies no photoluminescent or explicit no-lume statement,
configured mass, numerical rate bound, or explicit date status; family reviews
and sibling variants remain non-transferable. No provider request was made.

The 2026-08-31 Baltic search found an additional retailer record, but it lists
the reference ambiguously as `MR01BLUS35 (or MR02BLUS35)` and adds none of the
four missing fields. It was rejected; weight, accuracy, lume, and date remain
null and no provider request was made.

The next Swatch Skin White Classiness `SS08K102-S14` pre-screen remains open
only for `accuracy` and `lumeGrade`. An exact Louis Pion retailer record
corroborates the EAN, 34 mm case, two-hand quartz display, and approximately
12 g mass, but publishes no numerical rate bound or lume statement. The exact
Swatch pages and other EAN-linked records continue to establish the homogeneous
configuration; an indexed exact-retailer `luminescence absent` claim remains
unusable because direct retrieval is anti-bot blocked. No provider request was
made.

The next Swatch SILVERWAKATI `SO28N100` pre-screen remains negative for
`weightFullG`, `accuracy`, and `lumeGrade`. An exact-SKU outlet page repeats
the 34 mm quartz, 3 bar, and plastic configuration, but its blue-case metadata
conflicts with the exact silver/blue product and it publishes no watch-only
weight, numerical rate bound, or lume statement. The existing 18 g/22 g mass
conflict, qualitative quartz wording, and absence of photoluminescent evidence
therefore remain unresolved. No provider request was made.

The next Citizen Garrison `BM8180-03E` pre-screen leaves its sole M1 gap,
`lumeGrade`, open. A 2026-08-31 exact-SKU search rechecked Citizen's luminous
hands-and-markers specification and the existing Donatwald and owner reports,
but found no controlled illuminance, charge duration, timed decay series, or
repeatable comparison standard. The conflicting exact-reference observations
therefore remain useful context rather than a catalogue grade. No provider
request was made.

A further 2026-08-31 exact-reference review corpus adds conflicting comments
ranging from effective/all-night lume to impossible dark reading and a response
that fades quickly. Because the owners do not report controlled illuminance,
charge duration, or a timed decay series, the sole `lumeGrade` gap remains null;
no provider request was made.

The next LIP Churchill T18 `671937` pre-screen remains open for
`caseThicknessMm` and `lumeGrade`. Lepage's exact authorized-retailer page
matches the current ivory/blue/sapphire configuration but reports 9.2 mm
thickness, conflicting with the exact specialist's 8.5 mm; the older 8.0 mm
record belongs to a mineral/Arabic configuration. Without a current primary or
convergent exact-reference measurement, thickness stays null. Lepage also gives
no whole-watch lume statement, so no grade is promoted and no provider request
was made.

A further 2026-08-31 exact-reference retailer record also reports 8.5 mm for
`671937`, matching the specialist value, but the 9.2 mm Lepage measurement still
conflicts and no current primary thickness is published. No whole-watch lume
statement surfaced; both M1 gaps remain null and no provider request was made.

The next Bulova Icon Precisionist Chronograph `98B316` pre-screen remains open
for `weightFullG` and `lumeGrade`. A newly retrieved exact-reference retailer
record reports 229 g and 12.40 mm thickness, conflicting with the exact
current dimensional set at 17.5 mm and the existing 270-276 g hands-on records;
its luminous-hands/numerals prose has no charge or timed-decay protocol. The
record is rejected as an unscoped or mismatched configuration, so neither
remaining field is promoted and no provider request was made.

The next Omega Speedmaster Moonwatch Professional `310.30.42.50.01.001`
pre-screen remains open for `attachmentType` and `lumeGrade`. Omega's official
bracelet-maintenance page recommends authorized service for bracelet changes but
does not identify the exact factory connector; the exact owner and
Omega-certified-watchmaker forum evidence for a spring bar remains secondary
without public Omega product/service corroboration. Exact-reference sources
continue to establish Super-LumiNova presence without a controlled charge,
decay, or repeatable performance comparison. No provider request was made.

A further 2026-08-31 exact-reference search found a seller listing that labels
the bracelet "Spring Bar Micro" and an owner thread naming spring-bar parts.
Both are secondary and neither is public Omega product/service documentation;
they corroborate the lead without satisfying the manufacturer-interface gate.
No controlled lume observation surfaced, so both gaps remain null and no provider
request was made.

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
