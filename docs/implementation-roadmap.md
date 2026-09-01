# The Reserve implementation roadmap

This is the controlling delivery sequence. It implements the owner's
[`full original plan`](original_context.md), the
[`requirements ledger`](original-plan-requirements.md), and the accepted
[`SQL-first architecture`](sql-first-recommendation-architecture.md). Before
planning or implementing any phase, read `original_context.md` from its first
line through its final line. Record evidence at phase boundaries and continue
automatically. Verified work is committed and pushed directly to `main`.

The original file preserves the evolution from seven to eight questions and a
vector-first technical sketch. The 2026-08-28 audit supersedes the fixed
eight-step funnel and removes embeddings/vector infrastructure from the launch
critical path without discarding history, psychology, perception, or dossier
requirements.

## System shape

```text
Browser
  -> React Router action/API boundary
      -> Zod validation and numeric normalization
      -> PostgreSQL hard filters over reference variants
      -> versioned explicit soft score
      -> deterministic brand/archetype diversity
      -> cited result plus rejection reasons
  -> three recommendations and two or three “why not” candidates

Research jobs
  -> source discovery
  -> structured TypeScript/Zod normalization
  -> field-level evidence and human review
  -> PostgreSQL brands + reference variants + snapshots
  -> coverage and staleness audits
```

The model is never the catalogue. No LLM, embedding model, vector extension,
vector database, Mastra workflow, Ollama endpoint, or RunPod deployment is
required for the baseline.

## Verification cadence

Development through Phase 4 uses the fast deterministic gate:

```bash
npm run check
```

That gate covers formatting, linting, strict types, unit tests, and the
production build. Playwright/E2E execution and browser installation remain
deferred until Phase 7, after the deterministic recommendation flow works.
Deferred specs must remain current.

## Phase 0 — Baseline and decisions

Status: **complete**

- Repository audit, roadmap, secret exclusions, and environment inventory.
- Owner selected React Router/TypeScript and Vercel.
- Historical choice of eight independent questions recorded.

The later questionnaire/catalogue audit is an additive decision, not a rewrite
of this historical checkpoint.

## Phase 1 — Application foundation and landing-page parity

Status: **complete**

- React Router v7 Framework Mode, Vite, and strict TypeScript.
- Landing-page parity, reusable design tokens, and preserved Beehiiv embed.
- Health route, error boundary, fast quality gate, deployment and rollback docs.

Restart details are recorded in [`session-handoff.md`](session-handoff.md).

## Phase 2 — Progressive diagnostic questionnaire

Status: **complete — verified 2026-08-28**

Original-plan traceability: [progressive questionnaire](original-plan-requirements.md#progressive-questionnaire).

Goal: collect the smallest trustworthy profile first, then continue through a
visible, skippable personal profile without making semantic infrastructure a
prerequisite.

Deliverables:

- One shared TypeScript constants module for price bands, wrist display bands,
  units, and answer enums. Exact budget and wrist values are canonical.
- Zod schemas and inferred types for the core profile and refinement fields.
- Six-screen accessible core flow: budget, wrist, deployment,
  movement/service+accuracy, weight, and complications/date.
- Seven personal-profile screens after essential fit and before the result. The
  first four give perception, visual impression, provenance, and emotional
  purpose dedicated choice-card screens; the remaining three expose all other
  optional dimensions.
- Refine contract for social signal, aesthetic, provenance, emotional objective,
  market stance, geometry/attachment, acquisition/premium, resale, lume/crown,
  geography, cosmetic tolerance, condition, and allergy.
- Recoverable browser state, Back/Next controls, keyboard behavior, and server
  rejection of forged or incomplete submissions.
- Privacy-preserving analytics contract; actual analytics provider integration
  may wait until Phase 7.

Verification:

- Boundary tests prove every price and wrist value derives exactly one band.
- Premium allowance is explicit, bounded to `0..100`, and applied by one shared
  function.
- Required complication combinations and no-date conflicts fail safely.
- Focused tests cover navigation, persistence, validation, and core completion.
- The result is a profile summary, not a fabricated watch recommendation.

Evidence: `/quiz` implements six essential screens followed directly by seven
personal-profile screens covering all 21 optional dimensions; server and
browser use the same Zod/domain contract. Session recovery, the wrist screen's
millimetre/inch selector and canonical millimetre conversion, boundary rules,
premium/speculative rules, and the complete flow are covered by the fast gate.

## Phase 3 — Reference-variant schema and coverage feasibility

Status: **complete — verified 2026-08-28**

Goal: prove the data model and combinatorial coverage before collecting 200
brands.

Deliverables:

- Additive PostgreSQL migrations separating `brands`, `collections`,
  `reference_models`, and materially homogeneous `reference_variants`.
- Structured geometry, movement, operation, material, attachment, production,
  and commercial fields required by the questionnaire.
- Price and market snapshots instead of one stored price tier.
- Source registry and field-level evidence ledger with verification and
  staleness policy.
- Explicit definitions for hype, liquidity, momentum, and
  `speculative_bubble`.
- M0/M1/M2 completeness calculation against active filter requirements.
- Seed manifest selected across budget, movement, size, deployment, weight, and
  complication cells.
- Coverage-audit script that reports empty, single-result, and under-evidenced
  cells before bulk research.

Verification:

- A family with multiple sizes/materials cannot enter as one filterable row.
- Missing facts remain `null` and cannot satisfy an active hard requirement.
- Mutable facts have expiry policies; stable facts are not invalidated by a
  document-level date.
- Schema constraints reject invalid units, ratios, enum values, and evidence
  links.
- Coverage report runs over the complete defined axis set without capped
  first/last windows.

Evidence 2026-08-28: six additive migrations are applied to the selected
Supabase project. The server-only catalogue contains 11 brands and 12 sourced,
homogeneous variants, including separate steel and two-tone Rolex Explorer
rows. Field evidence, retail/availability/FX expiry, M0/M1/M2 evaluations, and
typed deployment/friction profiles are loaded. Browser roles have no grants and
the security advisor is clean. The regenerated full-matrix audit reports 180 of
28,800 cells covered (0.63%), all single-candidate and under-diversified, with
116 under-evidenced cells. That low number is the required feasibility result
and controls Phase 5 priorities.

## Phase 4 — Deterministic recommendation MVP

Status: **complete — live SQL path verified 2026-08-28**

Goal: produce reproducible and explainable recommendations without AI
infrastructure.

Deliverables:

- SQL hard filters for budget, fit, deployment, movement/accuracy,
  complications, weight, allergy, condition/channel, and active hard refinements.
- Versioned weighted scorer over reviewed reference and brand-context tags.
- Per-factor score trace and deterministic tie-breakers.
- `speculative_bubble` suppression rule and disclaimer path.
- Top-three diversity: at most one reference per brand and distinct primary
  archetypes.
- Two or three rejection explanations (“why not”).
- Explicit empty-result relaxation proposals in the accepted order; no silent
  hard-filter relaxation.
- Golden profiles, boundary fixtures, and deterministic fallback response.

Verification:

- No result violates an active hard constraint.
- Unknown hard-filter facts move a variant to “verification required.”
- Golden profiles have expected inclusions, exclusions, and relaxation prompts.
- Re-running the same catalogue/profile/scorer version yields the same order and
  explanation trace.
- The seed catalogue exercises non-empty, rare, and empty coverage cells.

Completion of Phase 4 proves the core product decision loop.

Completion evidence 2026-08-28: recommendation engine v2 implements fail-closed budget,
FX, fit, deployment, ownership friction, accuracy, weight, function, date,
geometry, attachment, acquisition, availability, condition, resale, lume,
crown, geography, allergy, and speculative gates over the reviewed server seed.
It logs score factors, enforces one brand and one archetype in the top three,
returns verification-required and why-not sections, proposes relaxations, and
discloses selected soft preferences that the seed cannot yet score. `/quiz`
renders this evidence and its sources.

Migrations `0007` and `0008` expose narrow, versioned read-only RPC contracts
for accepted catalogue facts and the complete hard-filter partition.
`anon`/`authenticated` still have no table grants; migration `0009` also removes
the unnecessary authenticated RPC grant. The server uses only the Supabase URL
and publishable key, strictly validates both responses, caches valid catalogue
facts for 60 seconds, and falls back as one visible unit to the reviewed bundle
and local deterministic predicates. It never mixes an unvalidated SQL partition
with live facts.

The parity audit compares every decision fact and every hard-reject/missing-fact
code across all 12 variants and six golden profiles. The live SQL partition,
the bundled TypeScript partition, and final result ordering match. Production
Vercel has the public Supabase runtime values and the source register states
whether each response used the live SQL path or the explicit fallback.

## Phase 5 — Research pipeline and catalogue expansion

Status: **engineering complete — owner-directed Rolex workbook expansion verified 2026-08-31**

Goal: expand from the validated seed to the planned approximately 200 brands
without sacrificing field evidence or coverage.

Deliverables:

- Complete brand manifest with tier, target variants, coverage purpose, and
  review state.
- TypeScript research worker with concurrency limits, retries, resumability,
  raw-response retention, and cost logging.
- Zod-validated structured output; Markdown dossiers are generated editorial
  artifacts, not parsing sources of truth.
- Primary-source validation and a human review queue.
- Field-specific refresh schedule for price, availability, market behavior,
  production state, ownership, dimensions, and stable mechanics.
- Detailed M2 brand context: history, ownership, psychology, buyer archetypes,
  perception, social signal, design DNA, service reality, risks, and sourced
  narrative.
- Repeated coverage audits during expansion.

Verification:

- Failed jobs resume without duplicating variants, facts, or evidence.
- Every accepted fact retains source and review metadata.
- Every manifest brand reaches an accepted dossier/reference state or an
  evidence-backed exclusion.
- M1 coverage, not raw brand count, controls recommendation eligibility.

Owner scope amendment 2026-08-31: brand/model research, source review, and
catalogue population are no longer an agent delivery gate. The owner will
perform that editorial/research work directly. This does not weaken the M1
eligibility, provenance, homogeneous-variant, or fail-closed requirements; it
separates the completed ingestion/review machinery from the records later
supplied through it. Phase 5 engineering is complete when that machinery and
its handoff pass independently of catalogue size.

Checkpoint 2026-08-29: the complete 200-dossier owner knowledge pack is
schema-validated and linked as research-only M0/M2 context. Together with one
existing roadmap brand, the strict manifest now contains 201 brands, links 16
reviewed seed variants, and retains 15 active coverage targets. The coverage-ranked,
resumable Perplexity worker uses native JSON Schema plus Zod validation,
immutable artifacts, fingerprint reuse, globally increasing attempts, bounded
concurrency, rate-limit handling, and explicit review artifacts. Provider
extraction still cannot mark a fact accepted.

The first live P0 discovery batch reviewed exact Cartier WSTA0107, Casio
G-5600UE-1, and Swatch SO28N100 candidates. All three remain
`needs_more_evidence`: no row entered the recommendation catalogue because the
M1 source gate was not complete. The review caught a different-reference Swatch
lug-width citation, null/contradictory extraction fields, unsupported HKD price
normalization, and the need to represent rectangular case geometry without
calling one dimension a diameter. Details and the next queue are in
[`research-pipeline.md`](research-pipeline.md).

The second live batch produced valid provisional results for Christopher Ward
C63-39AGM4-S00W0-B0 and Citizen BM8180-03E; two Sinn attempts failed the strict
null/contradiction guards. Independent review completed every M1 field for the
Christopher Ward exact SKU and generated additive migration `0010`, increasing
the local projection from 180 to 212 covered cells. Citizen remains
`needs_more_evidence` for graded lume and attachment semantics despite official
resolution of E101 accuracy and a weight-source conflict. Migration `0010`
must be applied and live parity proved before this checkpoint is pushed because
the Supabase MCP OAuth refresh expired during verification.

The third live batch produced valid provisional results for Sinn 856 UTC,
Marathon WW194003BK-0108, and Omega 310.30.42.50.01.001. Source review retained
all three as research-only. Sinn lacks a homogeneous priced attachment variant,
full-watch weight, lug-to-lug, accuracy, and graded lume; Marathon lacks numeric
full weight, accuracy, attachment-interface, and categorical lume evidence; and
Omega's exact official pages were independently blocked while its extracted
bracelet material did not satisfy attachment semantics. The strict manifest now
has eight reviews (one migration-ready, seven needing more evidence), and the
next ranked queue starts with Seiko, Vostok, and Baltic coverage targets.

A 2026-08-30 Perplexity-assisted Sinn follow-up reduced the 856 UTC review from
six gaps to three without blending attachment options. Sinn's official North
American distributor exposes homogeneous SKU SI-084 with black calf-leather
strap as a new, in-stock USD 2,680 Add to Cart offer and publishes a 47.5 mm
lug-to-lug span. Sinn's exact-series manual explicitly documents spring bars on
the case, resolving `attachmentType: spring_bar` from manufacturer instructions
rather than strap material. The only weight remains 70 g head-only; exact-SKU
owner rate reports use incompatible methods; and lume reports include one
eight-hour observation after a one-minute charge without independent timed
corroboration. Weight, accuracy, and lume remain fail-closed.

The fourth live batch independently reviewed Seiko HCC004J1, Vostok 420059,
and Baltic MR Classic Blue without promoting any row. Seiko is M1-complete
except for graded lume and attachment semantics after official sources resolved
66 g full weight and no-date status. Vostok still lacks full weight, graded
lume, and attachment type and relies on a factory-adjacent retailer rather than
a manufacturer source. Baltic remains a multi-attachment configuration family
with only a starting price and no exact manufacturer reference. The strict
checkpoint has 11 reviews (one migration-ready, ten needing more evidence); the
next queue is Orient, Certina, and Tudor.

A 2026-08-30 Baltic follow-up then reduced that review from seven gaps to four.
Perplexity did not expose a stable selected configuration, but direct retrieval
of Baltic's public Storefront payload identified MR Classic Blue product
6584366596167 and Stitched Lion variant 39484285321287. That exact primary
variant is available for sale at EUR 545 with 2026-08-31 fulfillment; Baltic's
authorized Turkish representative maps the same configuration to MR01BLUS35.
Baltic's exact Stitched Lion page explicitly specifies a tool-free quick-release
spring bar, resolving the case interface without inferring from leather. Full
configured weight, exact-applicable accuracy, lume/no-lume status, and explicit
date status remain fail-closed.

The fifth live batch reviewed Orient RA-AC0M03S and Certina
C048.807.44.051.01 without promoting either row; Tudor exhausted two strict
extraction retries. Exact global Orient evidence leaves only attachment type
unresolved. Certina source review corrected two mixed reference URLs and leaves
only numerical movement accuracy unresolved. The strict checkpoint has 13
reviews (one migration-ready, 12 needing more evidence); Tudor remains planned,
followed by Blancpain and Patek in the ranked queue.

The sixth live batch independently reviewed Tudor M79000N-0001 and Blancpain
5019A 12B30 94A without promoting either row; Patek exhausted two strict
extraction retries. Exact TUDOR evidence resolves its localized price,
thickness, lug width, accuracy, lume, and no-date status but leaves lug-to-lug,
full weight, and the bracelet attachment interface unresolved. Exact Blancpain
evidence resolves its current U.S. offer, proprietary central-lug system, lume,
and date but leaves lug-to-lug, conventional lug width, full weight, and
numerical accuracy unresolved. The strict checkpoint has 15 reviews (one
migration-ready, 14 needing more evidence); the next queue is Patek, Bulova,
Audemars Piguet, and A. Lange & Söhne.

The seventh live batch excluded two exact but out-of-contract selections rather
than weakening their coverage intents. Bulova Series X 98B429 is current but
its reviewed $1,220 U.S. sale price exceeds the intended $300-$1,000 bands.
Audemars Piguet 15510ST.OO.1320ST.01 is the discontinued 2022 50th Anniversary
Royal Oak rather than a current variant. Replacement planned targets preserve
both original coverage intents and explicitly rule out the disqualifying choice.
Patek retained two more strict extraction failures. The strict checkpoint has
17 reviews (one migration-ready, 14 needing more evidence, two excluded); the
next queue is Patek, replacement Bulova, replacement Audemars Piguet, and
A. Lange & Söhne.

The eighth live batch exhausted that replacement queue and independently
reviewed four exact references without promoting an incomplete row. Patek
6301P-001 resolved on its sixth attempt and now has exact specifications plus
the applicable -1/+2 seconds-per-day Patek Philippe Seal standard, but its
displayed USD price has no complete market/availability context and fit, weight,
lume, and attachment gaps remain. Bulova 98B316 satisfies the replacement
target's attainable price intent with a current £679 UK offer and official
-10/+10 seconds-per-year Precisionist evidence; lug-to-lug, full weight, graded
lume, and attachment semantics remain unresolved. Audemars Piguet
16202ST.OO.1240ST.02 fixes the previous lifecycle mismatch and is documented as
a current integrated Royal Oak, while price and five M1 specification classes
remain missing. A. Lange & Söhne 720.035FE is an exact live limited reference
with display-wide Lumen evidence, but price-on-request and five physical or
ownership gaps prevent migration. The strict checkpoint has 21 reviews (one
migration-ready, 18 needing more evidence, two excluded), and the ranked
research queue is empty. Further provider work requires a new explicit
coverage target or a source-led attempt to close an existing review gap.

A source-led gap pass subsequently made Orient RA-AC0M03S the second
migration-ready Phase 5 candidate. Orient's exact pages already supplied the
£294.99 UK offer, fixed 38.4 x 12.5 x 44 mm black-leather configuration, 54 g
weight, F6724 -15/+25 seconds-per-day specification, 30 m rating, date, and
explicit no-lume state. An exact-reference specialist fitment guide, whose
recommendations were tested on the watch, documents the standard 20 mm
spring-bar interface and is corroborated by Orient's own spring-bar service
instructions. The seed source contract now represents this evidence honestly
as `secondary_editorial`; it is not mislabeled as manufacturer evidence.
Generated migration `0011` adds only this reviewed row after `0010`. At that
checkpoint the local seed had 14 variants and projected to 244/28,800 cells
(0.85%), while the live database remained at 12 rows. Certina's product-linked
manual was also checked, but its approximate range for “most”
non-chronometers is not an exact-reference guarantee, so Certina remains
research-only. That checkpoint had 14 accepted targets and 17 active targets;
the review outcomes were two migration-ready, 17 needing more evidence, and two
excluded.

A 2026-08-30 Perplexity-assisted Certina accuracy pass explicitly retained that
last gap. An exact-reference specialist retailer publishes -10/+25 seconds per
day but gives no test method, source attribution, serial-specific result, or
manufacturer guarantee; the upper bound also differs from Certina's approximate
-10/+30 guidance for most non-chronometers. Certina's official FAQ confirms
that mechanical accuracy varies and refers only to undisclosed internal
tolerances. No authoritative exact-reference or Powermatic 80.611 numerical
guarantee was found, so the row remains `needs_more_evidence`.

A subsequent near-complete review pass resolved Seiko HCC004J1's attachment as
`spring_bar` from an exact-reference standard-attachment description. It did
not infer lume: Seiko Netherlands' Lumibrite rows conflict with an independent
exact-reference report of no luminous paint. Citizen BM8180-03E also remains
research-only because exact-reference lume observations conflict and an
aftermarket compatibility listing is not factory-interface evidence. The
review and accepted-catalogue counts therefore remain unchanged.

The same pass resolved TUDOR M79000N-0001's lug-to-lug span at 45.8 mm from an
exact-reference specialist measurement corroborated by a separate rounded
46 mm hands-on measurement. Its weight remains open because bracelet sizing
produces conflicting 135 g and 139 g reports; its replacement-strap spring-bar
fitment also lacks the manufacturer-side corroboration required to establish
the factory attachment. TUDOR therefore remains research-only with two gaps.

Vostok 420059 also moved from three gaps to two: two exact-reference dealer
records independently agree on an approximately 128 g steel-bracelet weight.
Its production-undated qualitative lume report is not a repeatable grade, and
dealer-supplied 420-case spring-bar parts do not meet the manufacturer-service
corroboration rule for the factory bracelet. It remains research-only.

Marathon WW194003BK-0108 subsequently became the third migration-ready Phase 5
candidate. Exact current manufacturer pages, TMI's exact NH35A technical guide,
and an exact configured dealer record resolve its full M1 row, including 45 g
full weight and a -20/+40 seconds-per-day bound. Its self-powered full-night
tritium maps to `strong`; the one-piece strap, fixed-bar evidence, and
manufacturer service path map the fixed interface to `proprietary`. Generated
migration `0012` adds only Marathon after `0010` and `0011`. The local seed now
at that checkpoint had 15 variants and projected to 280/28,800 cells (0.97%),
while live Supabase remained at 12 rows. That strict checkpoint had 15 accepted
targets, 16 active targets, and 21 reviews: three migration-ready, 16 needing
more evidence, and two excluded.

Casio G-SHOCK G-5600UE-1 then became the fourth migration-ready candidate. Its
exact official product and module 3496 guide resolve the solar movement, fit,
51 g weight, 200 m rating, functions, rate, and full-auto Super Illuminator,
mapped to `strong` nighttime illumination without claiming luminous paint. A
current exact U.S. StockX buy-now offer supplies a supported secondary-market
snapshot, while an exact 16 mm configured listing and the genuine Casio
band/spring-rod component chain establish `spring_bar`. Migration rendering now
records `shockResistant` evidence and derives SQL price kind from acquisition
channel, correctly writing the offer as `secondary_ask`. Generated migration
`0013` adds only Casio after `0012`. At that checkpoint the local seed had 16
variants and projected to 408/28,800 cells (1.42%), while live Supabase remained
at 12 rows. That strict checkpoint had 16 accepted targets, 15 active targets,
and 21
reviews: four migration-ready, 15 needing more evidence, and two excluded.
Migrations `0010` through `0013` were pending at that checkpoint.

An exact-reference Omega follow-up then resolved the Speedmaster
310.30.42.50.01.001 accuracy gap. Omega's official certification page includes
the exact reference under its 0/+5 seconds-per-day Master Chronometer standard,
and a five-year exact-reference test independently measured +4 and +2 seconds
per day in two positions. The row remains research-only because luminous
material is not a graded performance result, specialist strap fitment lacks
manufacturer corroboration of the factory bracelet mechanism, and omitted
complications do not prove explicit no-date status.

Seiko Presage HCC004J1 then became the fifth migration-ready candidate. An
exact official Singapore boutique specification explicitly says
`Lumibrite: N/A`; Seiko's corporate directory identifies the boutique operator
as its Singapore distributor, and an independent exact-reference hands-on
review corroborates the absence of luminous paint. The contradictory
Netherlands lume rows are rejected because their page visibly continues into
unrelated Astron 5X53 GPS Solar and titanium product copy. Migration `0014`
adds only this reviewed row after `0013`. The local seed now has 15 brands and
17 variants and projects to 448/28,800 cells (1.56%), while live Supabase
remains at 12 rows. The current strict checkpoint is 17 accepted targets, 14
active targets, and 21 reviews: five migration-ready, 14 needing more evidence,
and two excluded. Migrations `0010` through `0014` must be applied in order and
17-row parity proved before the bundled seed or commits are pushed.

A subsequent exact-model Citizen service lookup resolved BM8180-03E's
attachment as `spring_bar`: Citizen Watch Group's official parts system lists
spring-bar replacement part 509-2074 for that exact Garrison reference. The row
remains research-only because its exact-reference lume accounts conflict and no
controlled repeatable grade was found; lume is now its only M1 gap.

A 2026-08-30 narrow Perplexity-assisted source-discovery pass explicitly
retained that last gap. One exact-reference owner report distinguishes dim hands
that remain visible overnight from numerals that fade quickly, while the
exact-SKU Zappos review corpus spans all-night dial visibility, near-impossible
dark reading, and weak numerals after charging. None supplies a controlled
charge protocol, timed decay series, or comparison standard. The additional
evidence therefore documents component, condition, or production variability;
it does not support a stable `weak`, `moderate`, or `strong` grade. Citizen
remains `needs_more_evidence`, and the accepted-catalogue counts are unchanged.

A subsequent exact-reference pass resolved TUDOR M79000N-0001's normalized
full-length bracelet weight at 139 g. Independent new and unworn/full-set dealer
records report the same value with approximately 19.5-21 cm of bracelet; the
135 g owner measurement is retained as a sized-bracelet observation rather than
used for the full configuration. The last attachment gap was then resolved by
TUDOR's exact Black Bay 54 press dossier, which explicitly identifies
spring-bar holes passing through the lugs, corroborating the exact-reference
fitment guide's spring-bar description. Migration `0017` adds only this
homogeneous steel-bracelet row after `0016`.

An exact-reference Swatch SO28N100 follow-up reduced its M1 gaps from ten to
three. Swatch's embedded product payload resolves 34 x 8.75 x 39.2 mm geometry;
a current CHF 70 official-retailer offer resolves price and short-wait channel
semantics; and the exact original 17 mm strap plus Swatch's connector-pin guide
establish a proprietary pinned attachment. Two exact-reference specifications
explicitly establish no-date status. The row remains research-only because
full-watch sources conflict at 18 g versus 22 g, Swatch publishes no numerical
quartz rate bound applicable to SO28N100, and black hands or omitted feature
prose cannot establish a repeatable lume grade. A subsequent trace of Swatch's
public exact-reference Shopper Products response found `c_weight = 64`, but the
first-party field has no unit or watch-only configuration. It is retained as
reviewed evidence rather than misclassified as wearable mass, so the weight gap
remains open.

A 2026-08-30 Perplexity-assisted three-field pass explicitly retained all
remaining Swatch gaps. Swatch's standard manual documents time setting but no
SO28N100 numerical rate bound; an exact retailer route uses only qualitative
precision wording. No new source defines `c_weight = 64`, reconciles the 18 g
and 22 g records, or establishes either repeatable lume performance or an
explicit no-lume state. Weight, accuracy, and lume therefore remain null rather
than being filled from generic quartz behavior or visual inference.

Omega's exact 310.30.42.50.01.001 product page and downloadable product sheet
became independently retrievable on follow-up, validating the steel-on-steel
configuration, current $7,800 U.S. in-stock offer, 42 x 13.54 x 47.5 mm
geometry, 20 mm lug width, approximately 134 g total weight, calibre 3861, and
the remaining primary technical fields. Two independent exact-reference
specifications explicitly report no date display, reducing Omega's M1 gaps from
three to two. It remains research-only because the exact sources do not support
a repeatable lume grade or manufacturer-corroborated factory attachment type.

A 2026-08-30 Perplexity-assisted Omega gap pass found direct exact-reference
owner evidence that the factory bracelet uses spring bars and a third-party
forum statement from an Omega-certified watchmaker identifying bracelet-to-case
part 068ST2207 as a 1.80 mm spring bar for the 3861 bracelet. Neither is public
Omega product or service material, so the manufacturer-corroboration rule still
prevents acceptance. Exact-reference lume material likewise establishes only
Super-LumiNova presence, with no controlled charge, elapsed-time series, or
convergent performance grade. Both M1 gaps remain null.

An exact-reference Bulova 98B316 dimensional follow-up resolves its previously
missing lug-to-lug at 54.5 mm: two specifications publish the same 17.5 x 46.5
x 54.5 mm set, with a separate specialist reporting 54.6 mm case length. The
row remains research-only with three M1 gaps. Full-weight records span 274 g,
276 g, and approximately 270 g after bracelet sizing; exact lume accounts
disagree on nighttime usability; and the original bracelet's dealer-described
spring-pin mount lacks manufacturer corroboration of the factory interface.
Citizen Watch Group's later exact-model service lookup supplies that missing
corroboration by listing a dedicated `Spring Bar` entry separately from the
98B316 band. The row now has two M1 gaps: full configured weight and repeatable
lume grade.

A 2026-08-30 Perplexity-assisted Bulova pass widened rather than resolved those
gaps. Additional exact-reference listings publish 170 g and an approximately
400 g item-weight field, conflicting with 270-276 g hands-on records; none
documents a full-length factory bracelet and bare-watch weighing protocol. The
official exact page carries a verified-buyer complaint that the glow could last
longer, but it supplies no controlled charge or elapsed-time result and remains
in tension with another exact account calling the lume usable. Weight and lume
therefore remain fail-closed.

Blancpain Fifty Fathoms Tech 5019A 12B30 94A now has a reviewed 47 mm
lug-to-lug span. Blancpain's exact technical dossier establishes the 47 mm
diameter and central-lug construction, while an exact-reference hands-on
specification explicitly reports that the lack of projecting conventional lugs
makes lug-to-lug equal to diameter. The manufacturer-published dash for width
between horns is now captured as a reviewed physical `not_applicable` value
under the explicit applicability contract. Unknown null remains missing
evidence, while an active conventional-width request deterministically rejects
this architecture in both TypeScript and SQL. The row remains research-only for
full configured weight and numerical accuracy.

A 2026-08-30 Perplexity-assisted Blancpain follow-up retained both remaining
gaps. The exact orange-rubber and pin-buckle product page and June 2026 dossier
publish dimensions, materials, calibre, 4 Hz frequency, and reserve but no
assembled bare-watch mass. No exact-reference packaging-free scale measurement
was located. The same primary sources publish no numerical 13P5A rate bound,
service tolerance, certification result, or documented exact-reference rate
test; 4 Hz is an operating frequency, not accuracy. Weight and accuracy remain
fail-closed rather than inheriting generic COSC or sibling-calibre values.

Vostok Amphibia 420059 now has a reviewed `weak` lume grade. Two independent
exact-reference reviews report sparse application, difficult low-light reading,
and fast fade; a verified-purchase report and a separate long-term exact-model
owner independently describe the lume as underwhelming or poor. The convergence
supports the performance class rather than merely inferring it from luminous
material. The row remains research-only for factory attachment: the available
pins discussion is ambiguous between bracelet links and the case interface, and
replacement-case spring bars still lack manufacturer-service corroboration.
The exact factory product page now upgrades the core evidence to primary,
corrects the retailer-rounded diameter from 39 to 39.6 mm, and directly reports
the 128 g steel-bracelet weight, but it names only bracelet material and width
rather than the case attachment mechanism.

A 2026-08-30 Perplexity-assisted attachment pass found Vostok's exact official
factory-shop route and the official case-420 category. Both independently
confirm 2416.00/420059, the 420 case family, and the supplied stainless-steel
bracelet, but neither supplies a lug, bar, pin, screw, connector, or exploded
interface specification. Replacement-case spring bars and ambiguous bracelet
pin discussions therefore remain insufficient. `attachmentType` stays null,
and Vostok remains `needs_more_evidence` with one M1 gap.

A second narrow attachment pass found a directly retrievable Meranom listing
for Vostok-branded 18 mm by 2 mm spring bars whose retailer answer explicitly
says they fit Amphibia case 420. That proves a compatible removable case part,
not the connector installed on exact factory bracelet configuration 420059. A
separate replacement-bracelet page offers case-420 end links and new spring
bars while distinguishing the replacement from the factory bracelet. The row
therefore remains fail-closed rather than upgrading compatibility evidence into
an exact configured attachment fact.

Cartier Tank Must WSTA0107 now has an honest non-round geometry path instead of
a synthetic diameter. The runtime contract accepts a complete 29.5 x 22 mm
length/width pair, fit uses evidenced overall length only when conventional
lug-to-lug is unavailable, the UI labels it as wrist span, and focused tests
cover the fail-closed behavior. Additive migration `0015` prepares the two
PostgreSQL columns without changing an accepted row. The exact official product,
a current $4,100 authorized-retailer offer, an exact QuickSwitch specialist
record, and three convergent 79-80 g records initially reduced Cartier to two
M1 gaps. A subsequent exact-reference pass resolved `lumeGrade: none` from
MAIER's explicit no-Super-LumiNova specification plus Chronospex's independent
no-luminescence classification; Cartier's own description corroborates the
plain blued-steel-hand configuration. Numerical exact-applicable accuracy is
now the sole M1 gap. It remains research-only.

A 2026-08-30 Perplexity-assisted Cartier accuracy pass explicitly retained that
gap. It surfaced a blocked exact regional product route reported to identify
the High Autonomy quartz configuration and calibre 157, while Cartier's
independently retrievable movement overview describes approximately eight years
of autonomy and reduced energy consumption. Neither supplies a numerical
lower/upper rate tolerance with a defined period. A third-party calibre
database also supplies no numerical bound and does not establish exact WSTA0107
applicability. Generic quartz performance therefore remains prohibited, and
Cartier stays `needs_more_evidence`.

The applicability contract then resolved one Audemars Piguet Royal Oak
16202ST.OO.1240ST.02 gap without inventing a width. AP's own Heritage record
explicitly includes model 16202 and states that its case extensions constitute
both the lugs and first bracelet link. Conventional between-horns
`lugWidthMm` is therefore reviewed `not_applicable`, while price, lug-to-lug,
full weight, numerical accuracy, and graded lume remain fail-closed. The AP
reference remains research-only.

AP's public exact-product price endpoint subsequently supplied a USD 40,100
U.S. amount. It does not expose purchase availability or channel context, so
the amount, currency, and market are retained as reviewed fragments while the
complete commercial price gate remains open.

A 2026-08-30 Perplexity-assisted AP follow-up retained all five gaps. An
independently retrieved exact-reference tariff record corroborates USD 40,100
as a February 2026 suggested U.S. retail price, but neither it nor AP's exact
page and endpoint establishes stock, allocation, orderability, or a homogeneous
sales channel. Numerical case span, approximately 130 g weight, and a +2.5
seconds-per-day observation surfaced only for anniversary reference `.01`, not
the required non-anniversary `.02`; the weight also lacks a full-link scale
protocol. AP publishes lume presence but no controlled charge or timed
performance result. Price, fit span, weight, accuracy, and lume therefore remain
fail-closed.

The same geometry policy was then applied to the already accepted
Jaeger-LeCoultre Reverso Tribute Duoface Small Seconds Q3988481. Its exact
manufacturer page labels the case 47 x 28.3 mm as length x width and explicitly
identifies length as lug-to-lug. The seed now stores `caseDiameterMm: null`,
`caseWidthMm: 28.3`, `caseLengthMm: 47`, and `lugToLugMm: 47`. Additive
migration `0016` corrects the relational row and evidence, recalculates
rectangular-aware completeness, and introduces v2 catalogue/hard-filter RPCs
with the same verified case-span fallback as TypeScript.

With the TUDOR addition, the reviewed local seed contains 16 brands and 18
variants. Adding its PLN price exposed and fixed a coverage-audit currency bug:
the finite matrix now converts every source price through the dated catalogue
FX snapshot into the canonical EUR base before deriving a display band, rather
than comparing raw PLN, USD, GBP, or CHF numbers to the same thresholds. Live
Supabase remains at 11 brands and 12 variants until migrations `0010` through
`0018` are applied and 18-row fact and six-profile predicate parity passes.
Migration `0018` adds the field-evidence value state and v3 RPC pair; the
application targets v3 and otherwise falls back as one unit.

On 2026-08-29 the owner explicitly requested delivery of the complete
accumulated branch despite the unavailable Supabase maintenance session. The
push is safe at the application boundary because the versioned RPC loader validates
the entire response and exact variant set and otherwise visibly falls back to
the reviewed 18-row bundle and deterministic local filters. This delivery
decision does not complete the relational checkpoint: migrations `0010`
through `0018`, live 18-row fact parity, and six-profile SQL predicate parity
remain the first database continuation task.
The push through `6a43255` subsequently reached the connected Vercel production
project. The deployed asset matched the local reviewed build, all three short
read-only endpoints returned 200, and a valid core recommendation request
selected `bundled_seed` with the expected visible RPC-validation fallback. This
confirms the intended temporary operating mode rather than relational parity.

The applicability checkpoint implements the Phase 5 distinction
raised by the Claude Q11 audit. Catalogue version 2 carries a sparse
`fieldApplicability` object, verified null values require an explicit
`not_applicable` state, and conventional-width requests receive
`lug_width_not_applicable` instead of a missing-fact code. Migration `0018`
persists the state in field evidence and exposes the v3 catalogue/hard-filter
pair without reclassifying any historical null. The reviewed Blancpain record
therefore closes only its conventional-width gap and remains research-only for
weight and accuracy. Commit `c0ebca7` is pushed and production smoke checks
confirmed catalogue-version-2 bundled fallback while the live v3 RPC pair is
unavailable.

On 2026-08-30 the connected Supabase project received migrations `0010`
through `0018` in order. The first 18-row parity run exposed two audit defects
rather than accepting a divergent database: Casio's secondary-market snapshot
had no linked verified price evidence because the renderer queried only
`retail/new`, and Seiko's bundled record claimed availability evidence despite
an explicit unknown state. Migration `0019` repairs only the Casio evidence
link, the renderer now derives both snapshot and evidence kinds from the same
channel mapping, unsupported Seiko availability evidence is removed, and the
parity time is derived from the shared mutable-fact freshness window. Migration
`0020` enables RLS on all 20 public catalogue tables without adding direct-table
policies or browser grants. The live database now has 16 brands, 18 accepted
variants, and 404 verified evidence rows; public v3 fact parity and all six
SQL/TypeScript predicate/result profiles pass after RLS. The advisor retains
expected informational no-policy notices for the server-only RLS tables and
the explicit warnings for the two intentionally public, fixed-SQL,
empty-`search_path` `SECURITY DEFINER` RPCs; unused-index findings remain
informational during expansion.
Commit `70ef32d` then reached Vercel production as
`dpl_AVbxq6wNLVRYemwwoiXXfyVcHXDG`. All three short endpoints returned 200, a
valid core submission selected the live Supabase facts and SQL hard-filter path
without the bundled-fallback notice, and the surrounding Vercel runtime-error
window was empty.

The empty ranked queue then received a new explicit Vaer target covering 48
empty affordable-precision cells. Its first Perplexity job selected S3 Calendar
Field variant 41255028424838; direct primary-source review resolved exact SKU
`S3-CF-SIL20BLK-NY20KHA`, the current USD 189 in-stock two-strap bundle, 36 x
8.4 x 43 mm geometry, GM12 -10/+20 seconds-per-month tolerance, 100 m rating,
screw-down crown, sapphire, quick-release straps, date, and Vaer's exact 6/10
lume-performance score mapped to `moderate`. The page's 46 g value is explicitly
case-only. Neither unexplained Shopify shipping fields nor an uncertain
head-only report establishes full watch-plus-silicone mass, so `weightFullG`
remains the sole M1 gap and the row is not promoted. The current strict
checkpoint has 22 reviews (six migration-ready, 14 needing more evidence, and
two excluded), 18 accepted targets, and 14 active targets.

A subsequent explicit Nodus target exposed a strict-extraction hole rather than
producing reviewable evidence. The first response failed target-ID equality;
the second claimed an exact Sector Deep while returning no claims or unresolved
fields and placing placeholder reasoning inside the reference code. Research
contract v5 now limits identity components to 160 plain single-line characters
and requires resolved `identity` and `productUrl` claims whenever an exact
variant is asserted. The invalid v4 artifact remains immutable and ignored; the
Nodus target is reset to `planned` under a new fingerprint.

Contract v5 then rejected three further Nodus responses for target-ID and
resolved/unresolved contradictions. The worker now includes each validation
error in the next retry prompt and requires an exact target-ID and final field
partition check. A clean fingerprint subsequently selected Sector II Field
Titanium Shale; direct review corrected the identity to embedded manufacturer
SKU `SEC-F-SHA` and validated its USD 625 US offer, current but unavailable
state, 38 x 11.7 x 47 mm geometry, 20 mm lugs, 100 g full unsized titanium
bracelet, Nodus-regulated -10/+10 seconds-per-day tolerance, 100 m resistance,
sapphire, quick-release spring bars, and explicit no-date configuration. A
narrow Perplexity follow-up found only fast initial-charge descriptions for
the BGW9 Grade A lume, not controlled or timed performance evidence.
`lumeGrade` therefore remains the sole M1 gap and the row stays research-only.

The next explicit coverage target is Rado HyperChrome Quartz `R32280109` on
black rubber. Primary pre-screening exposes 87 g full weight, R292
PreciDrive/HeavyDrive at +/-10 seconds per year, 150 m resistance, sapphire,
date, and explicit nighttime readability. With a conservatively pre-screened
47.7 mm wearing span, the homogeneous configuration would add a new brand to
72 currently empty `1000_2000`, zero-maintenance, simple-date cells. The target
still requires independent exact-reference span and factory attachment
evidence before any review can become migration-ready.

The first Rado extraction resolved cleanly, but direct review retained four
gaps. Rado's exact U.S. route validates a current USD 1,400 Add to Cart offer,
41.5 x 11.7 mm geometry, 87 g configured mass, R292 PreciDrive/HeavyDrive at
-10/+10 seconds per year, 150 m resistance, sapphire, and date. Its
dual-colour Super-LumiNova prose is not a repeatable performance grade, and the
pin buckle is the wrist closure rather than the case fastener. A narrow
Perplexity pass found no exact Rado service/parts interface record. The only
47.7 mm lug-to-lug and 20/21 mm width records are bundled with an older
conflicting 41 x 12.2 mm, 89.6 g, 100 m specification set, so they cannot be
merged into the current row. Lug-to-lug, lug width, lume grade, and attachment
type remain fail-closed; the row is not promoted.

The next explicit target is Vostok Europe Nuclear Submarine
`VK61-571H614`, constrained to the titanium case on its supplied black silicone
strap. Archived manufacturer evidence already publishes 45.7 x 15.6 x 56.2 mm
geometry, 22 mm lugs, 300 m resistance, continuous tritium illumination, date,
chronograph, and VK61 accuracy of +/-20 seconds per month. A current
official-distribution listing exposes EUR 793 and fulfillment within three
working days, while an exact-reference retailer measurement reports 134 g on
silicone. If independent review reconciles the offer's contradictory
availability labels and proves the exact screw-fixed interface, the homogeneous
row would enter 48 supported `500_1000`, zero-maintenance chronograph cells,
including 24 currently empty cells. No archived, retailer, or sibling fact is
accepted merely by appearing in this pre-screen.

Review corrected an initial manifest-placement error that had attached the
target to Vacheron Constantin; the target and its artifact now belong to Vostok
Europe. Contract v5 rejected the first provider response for missing exact
candidate identity, and the retry treated the two supplied straps as an identity
block. Direct review defines one black-silicone wearable row while preserving
the leather strap as an accessory. It also rejects the stale Helveti offer, which
now says sale ended, and normalizes a Czech official-distribution EUR 793 Add to
cart plus three-working-day fulfillment record to `short_wait`, never in-stock.
The manufacturer controls at -20/+20 seconds per month, not Helveti's tighter
retailer-only figure. Exact screwdriver-or-coin replacement combined with the
current manufacturer guide's custom screw-fixed branch supports `proprietary`,
and ten-year continuous fifteen-tube illumination supports `strong`. Configured
mass does not pass: 100 g has no installed-strap scope, one source labels it
main-body weight, and 134-136 g retailer records lack a scale protocol. A narrow
Perplexity follow-up confirmed the mass gap, so `weightFullG` remains null and
the otherwise complete row is not promoted.

The next explicit target is BOLDR Odyssey Horizon `ODY-TI-40-H-BL`, constrained
to the supplied integrated Druber strap while the bundled titanium bracelet is
recorded only as an accessory. BOLDR's live exact-SKU record exposes USD 799 and
Add to cart; the manufacturer page publishes 40 x 13 x 48 mm geometry, 20 mm
nominal lug size, 91 g full configured weight, Miyota 9075 flyer GMT, 300 m
resistance, sapphire, and an integrated strap. That source-led hypothesis spans
18 `500_1000`, workhorse-mechanical GMT cells and adds a new brand throughout.
Independent review must still establish the USD purchase market, date status,
exact-applicable 9075 tolerance, and repeatable lume performance rather than
mapping Super-LumiNova material to a grade.

The first BOLDR provider result is schema-valid with 38 provisional facts.
Direct review corrects body-only 12.5 mm to 13 mm complete thickness and uses
BOLDR's Odyssey launch release to resolve the explicit 4 o'clock date window;
Miyota's exact 9075 page supplies -10/+30 seconds per day. Lume remains open:
the first search found material labels, a lume photograph, and generic
collection-level strength prose but no controlled or convergent exact-reference
performance evidence. A narrow exact-reference pass is queued instead of
forcing a grade.

The narrow pass found no qualifying Horizon performance evidence and explicitly
returned `operation.lumeGrade: null`. Direct review therefore keeps the exact
current USD 799 offer, homogeneous 91 g Druber configuration, 40 x 13 x 48 mm
geometry, 20 mm nominal lug size, Miyota 9075 -10/+30 seconds per day, 300 m
rating, sapphire, integrated attachment, GMT, and primary-source date window,
but does not promote the row. `lumeGrade` remains its sole M1 gap. The strict
checkpoint now contains 26 reviews (six migration-ready, 18 needing more
evidence, and two excluded), with 18 accepted and 18 active targets.

The next explicit target is Laco Augsburg 39 reference `861988` in its brown
riveted calf-leather configuration. The current manufacturer page publishes
EUR 390 with two-to-three-day delivery, 39 x 11.55 x 46.5 mm geometry, 18 mm
lugs, 81.5 g including the strap, Miyota 82S0, 50 m resistance, and sapphire;
Miyota publishes the exact caliber's -20/+40 seconds-per-day rate, 42-hour
reserve, and no-calendar function set. The source-led row spans 12 `300_500`,
studio, workhorse-mechanical, time-only cells and adds a new brand. Lume
performance and the strap-to-case fastener remain explicit review gates rather
than being inferred from C3 material or strap rivets.

The first Laco result contains 30 valid provisional facts. Direct FAQ retrieval
confirms that Laco regulates the installed LACO 2S to 0/+25 seconds per day;
the product-linked LACO 2S manual identifies the strap connector pins as spring
bars and documents only time-setting functions. The active exact product route
supports a reviewed current-production normalization. Lume is therefore the
sole remaining M1 uncertainty, and one exact-reference performance-only pass is
queued without admitting sibling Augsburg or generic Laco claims.

The lume-only retry found no qualifying exact-reference performance result and
left the grade null. Direct retrieval also rejects the first result's alleged
LACO 2S manual source because its URL currently returns 404, preventing review
of the extracted spring-bar sentence. Both `lumeGrade` and `attachmentType`
therefore remain fail-closed. A final exact-reference fastener pass is queued
for a retrievable manufacturer/service record or corroborated physical
inspection, explicitly excluding decorative rivets and buckle hardware.

The final attachment pass surfaced Laco's current leather-watch-strap manual,
which is retrievable as a valid manufacturer PDF and explicitly requires a
spring-bar tool plus proper spring-bar installation. Together with exact article
`861988`'s Laco calf-leather configuration, this resolves `attachmentType` as
`spring_bar` without treating decorative strap rivets as case fasteners. The
first job's 404 LACO 2S PDF remains rejected; Miyota's live 82S0 function list
independently supplies the no-calendar basis. Review validates the current EUR
390 German offer, 81.5 g full weight, exact geometry, Laco-regulated 0/+25
seconds-per-day movement, sapphire, 50 m resistance, time-only function, and
attachment, but does not promote the row. `lumeGrade` remains the sole M1 gap
after the narrow exact-reference pass found no controlled or convergent
performance evidence. The strict checkpoint now contains 27 reviews (six
migration-ready, 19 needing more evidence, and two excluded), with 18 accepted
and 19 active targets; the ignored ledger contains 52 attempts (31 succeeded,
21 failed) across 27 target IDs and USD 0.40434 recorded provider cost.

The next explicit target is LIP Churchill T18 reference `671937`, fixed to its
dark-blue crocodile-pattern leather strap. Its live manufacturer page publishes
an in-stock EUR 249 French offer, exact 38.5 x 21.2 mm rectangular geometry,
18 mm interface, 27 g full configured weight, Ronda 1064 at -10/+20 seconds per
month, 30 m resistance, sapphire, and a no-date hours/minutes/small-seconds
layout. The source-led row adds a new brand to 80 currently empty `under_300`,
zero-maintenance formal/studio cells while excluding field/water deployment.
Perplexity-assisted review must still prove exact thickness, case-to-strap
attachment, and no-lume status; a pin buckle is not a case fastener, and an
omitted lume claim is not evidence of absence.

The first LIP run rejected a resolved/unresolved contradiction and then
returned 37 valid provisional facts. Independent retrieval preserves the live
primary specification set but rejects the result's duplicate null case-length
fact and its misfiled numeric lug applicability. The only 8 mm source describes
an older conflicting 21 x 38 mm mineral-crystal/Arabic-dial configuration,
while another secondary record reports 8.5 mm. Interchangeable strap remains
insufficient to distinguish spring bars from quick release. Maier explicitly
states that the hands lack Super-LumiNova, but its exact-reference sheet also
conflicts with LIP by listing mineral rather than sapphire crystal and does not
establish the dial's status. Thickness, attachment, and whole-watch no-lume
evidence therefore remain fail-closed, and one narrow current-configuration
pass is queued. The ignored ledger contains 54 attempts (32 succeeded, 22
failed) across 28 target IDs and USD 0.42046 recorded provider cost.

The narrow LIP retry rejected another resolved/unresolved contradiction before
finding live exact-reference attachment evidence. Masters in Time identifies
the blue leather, Ronda, sapphire, 18 mm row and separately specifies quick-
release pushpins at the straight strap mount and a buckle clasp, resolving
`attachmentType: quick_release` without conflating the wrist closure. Its 8.5 mm
thickness remains one uncorroborated secondary value; the other 8 mm source is
the conflicting older mineral/Arabic configuration. No current-configuration
source explicitly covers lume absence across both dial and hands. Review retains
the current EUR 249 French offer, 21.2 x 38.5 mm rectangular geometry, 18 mm
lugs, 27 g full weight, -10/+20 seconds per month, 30 m resistance, sapphire,
quick release, and no-date small seconds, but does not promote the row.
`caseThicknessMm` and `lumeGrade` remain the two M1 gaps. The strict checkpoint
now contains 28 reviews (six migration-ready, 20 needing more evidence, and two
excluded), with 18 accepted and 20 active targets; the ignored ledger contains
56 attempts (33 succeeded, 23 failed) across 28 target IDs and USD 0.43617
recorded provider cost.

The next source-led target is Marathon 34 mm Black General Purpose Quartz GPQ
SKU `WW194004BK-0808`, constrained to its selected black 16 mm Nylon DEFSTAN
strap. The current exact variant is available with inventory at USD 470 and
identifies the fibreshell, Swiss high-torque quartz, tritium, no-date row. The
accepted mechanical GPM provides a successful source-routing pattern but no
facts are inherited: review must independently establish GPQ geometry, full
strap-installed weight rather than shipping or head-only mass, installed
caliber and numerical accuracy, sapphire, pressure crown, fixed service bars,
and constant tritium performance. A complete result would diversify 80 empty
`300_500`, zero-maintenance studio cells across all representative wrists,
accuracy profiles, and weight limits; 30 m resistance excludes field/water
deployment.

The first Marathon GPQ job returned 40 schema-valid provisional facts but did
not expose the selected commerce payload or exact specification sheet fully.
Direct primary review does: the live variant identifies in-stock USD 470 SKU
`WW194004BK-0808` on black Nylon DEFSTAN with positive inventory, while
Marathon's current exact sheet supplies ETA F06.105 HeavyDrive, 34 x 11.5 x
41 mm geometry, 16 mm lugs, sapphire, pressure crown, 30 m resistance, no
calendar, and tritium placement. Review still fails closed on full installed
weight because Shopify's 133 g is a shipping field, numerical F06.105 accuracy,
an exact GPQ fixed-bar source, and performance language beyond bare tritium
material. One narrow four-field pass is queued. The ignored ledger contains 57
attempts (34 succeeded, 23 failed) across 29 target IDs and USD 0.45449 recorded
provider cost.

The exact four-field Marathon follow-up resolves the row without inheritance.
ETA's current F06.105 specification supplies the -0.30/+0.50-second-per-day
minimum/maximum range. An exact WW194004 GPQ hands-on source reports
approximately 44 g including the installed one-piece military nylon strap and
explicit fixed bars; Marathon's official full-night product language and
service path corroborate strong constant illumination and a serviceable fixed
mechanism. Package/shipping weights, head-only mass, F06.412, and a dealer's
conflicting F06.115 remain rejected. The review is ready for additive migration
with no M1 gaps. The ignored ledger contains 58 attempts (35 succeeded, 23
failed) across 29 target IDs and USD 0.46936 recorded provider cost.

Additive migration `0021_expand_catalogue_marathon_gpq.sql` accepts the row as
`marathon-ww194004bk-0808`. The remote database reports the exact variant,
in-stock USD 470 snapshots, 23 reference-level evidence rows, and complete M1.
Catalogue and SQL hard-filter parity passes for all 19 accepted variants and
six golden profiles. The accepted eligibility remains
`studio_desk_daily` only; the 30 m GPQ does not inherit the mechanical
sibling's field/water deployment tag.

The next coverage checkpoint selects Seiko Prospex Solar Diver `SNE599P1` on
the exact all-black `M13K113N0` bracelet. Manufacturer pages retrieved
2026-08-30 expose an orderable GBP 530 offer, complete 41 x 11.3 x 48.8 mm
geometry, 20 mm lugs, 157 g configured mass, V157 solar operation at +/-15
seconds per month, 200 m diver resistance, sapphire, screw-down crown, strong
LumiBrite, and date. An exact original-bracelet source separately identifies
spring-bar mounting. No value is accepted from the pre-screen: one planned
bounded research job must validate the exact homogeneous configuration and
retain any conflicts. The planner reports all 48 targeted `500_1000`,
zero-maintenance field/studio cells as empty, under-diversified, and
under-evidenced. The manifest now contains 19 accepted, 20 `needs_review`, two
excluded, and one planned target; the provider ledger remains 58 attempts (35
succeeded, 23 failed) across 29 target IDs at USD 0.46936.

The bounded Seiko extraction succeeded with 33 provisional facts and 14
unresolved non-blocking fields. Independent review rejects an unrelated
bracelet URL and the provider's clasp/interface conflation, corrects ten months
from 730 to approximately 7,300 hours, and retains an exact Austrian boutique
rate conflict. That regional page says both +/-0.5 seconds per day and +/-10
seconds per month, so the accepted row uses Seiko UK's wider coherent
-15/+15-seconds-per-30-days exact bound. The exact UK store explicitly calls
the applied LumiBrite strong and suitable for professional diving standards;
the exact original M13K113N0 listing explicitly documents spring bars. No M1
gap remains.

Additive migration `0022_expand_catalogue_seiko_sne599p1.sql` now accepts
`seiko-sne599p1`. The live database reports the exact GBP 530 in-stock row,
date, complete physical and movement facts, and 35 reference-level evidence
records. Catalogue and SQL hard-filter parity passes for 20 variants across all
six golden profiles. The row contributes all 48 planned cells, raising coverage
from 576 to 624/28,800 (2.17%). Strict research now reports 20 accepted, 20
`needs_review`, and two excluded targets, with 30 review artifacts. The ignored
ledger contains 59 attempts (36 succeeded, 23 failed) across 30 target IDs and
USD 0.48496 recorded provider cost.

The next source-led checkpoint selects Brew Metric Titanium Chronograph
`MTRC-TITAN` on its supplied titanium bracelet. Primary pre-screening retrieved
2026-08-30 exposes a current USD 495 order path, 36 x 41.5 x 10.75 mm case,
19.85 mm nominal lug width, 89 g configured mass, titanium case and bracelet,
sapphire, 50 m resistance, and VK68 meca-quartz chronograph operation. TMI's
exact VK68A guide publishes a less-than +/-20-seconds-per-month rate; Brew's
own current bracelet guide explicitly includes every Metric bracelet in its
quick-release spring-bar statement. Exact-reference evidence also identifies
the Titanium colorway as no-date and a manufacturer-hosted verified buyer
explicitly reports no lume. These remain routing inputs, not accepted facts:
one bounded Perplexity job and independent source review must keep the row
separate from steel Metric, Super Metric, other dial, and replacement-strap
facts. If all M1 gates survive review, the row opens 60 currently empty
`300_500`, zero-maintenance, studio chronograph cells across every wrist and
supported accuracy band.

The single bounded Brew job succeeded with 49 provisional facts and 19
unresolved fields. Independent review replaces the provider's retailer-sourced
reference code with Brew's own live product-payload SKU, normalizes the TV case
to 36 mm width by 41.5 mm overall length rather than inventing a circular
diameter, and rejects the visual `integrated` inference because Brew's current
instructions prove quick-release spring bars. TMI's exact VK68A guide closes
the -20/+20-seconds-per-month rate, exact-colorway reporting closes no-date,
and two independent exact-owner observations converge on no lume. No M1 gap
remains.

Additive migration `0023_expand_catalogue_brew_metric_titanium.sql` accepts
`brew-metric-titanium-mtrc-titan`. The renderer now treats verified overall
case length as the non-round wearing-span alternative in completeness scoring
and retains field-level provenance for `integratedBracelet`. Remote verification
reports the exact MTRC-TITAN row, M1 complete with no missing fields, 31 verified
reference-level evidence rows, and 21 total accepted variants. Publishable-key
catalogue and SQL hard-filter parity passes for all 21 variants and six golden
profiles. Deterministic coverage rises by 60 cells to 684/28,800 (2.38%). The
default research queue is empty again.

The Mondaine checkpoint accepts exact Classic `A660.30314.11SBBV`, fixed to its
white no-date dial and supplied black vegan grape-leather strap. The first paid
response was preserved but failed strict normalization because it represented a
null claim as observed and duplicated `serviceCountries` as unresolved. The
equals-style `--target=... --attempts=1` invocation also exposed a worker parser
bug: it fell back to three attempts and began a second request before the run was
interrupted. The worker now accepts both spaced and equals-style options; the
second job is recorded as failed without inventing response or usage values.

Independent review revalidated every accepted field from exact sources. The
[manufacturer page](https://eu.mondaine.com/products/classic-36mm-edelstahl-poliert-gehausematerial-and-schwarz-vegan-trauben-leder-armband-a660-30314-11sbbv)
supplies the current EUR 239 EU offer, 36 mm diameter, 7.5 mm thickness, 18 mm
lugs, 37 g configured weight, Ronda 513 RL, 30 m resistance, mineral crystal,
and quick-change interface. The [exact dimensional record](https://nanaple.com/en/products/a660-30314-11sbbv-quartz)
adds 43 mm overall length, while the [official Ronda family record](https://www.ronda.ch/en/watch-movement-finder/caliber/515)
supports -10/+20 seconds per month. Exact SBB and [Helveti](https://www.helveti.eu/mondaine-classic-a660-30314-11sbbv)
records establish no date and no luminescence across the watch. Generic
Stop2go/backlight retailer boilerplate is rejected because its structured exact
row also conflicts with Mondaine's 37 g whole-watch mass.

Additive migration `0024_expand_catalogue_mondaine_classic.sql` is live. Remote
verification reports M0 and M1 complete, 40 verified reference-level evidence
rows from six sources, 22 accepted variants across 18 brands, and exact
publishable-key catalogue plus six-profile SQL hard-filter parity. The row adds
all 160 projected cells, raising deterministic coverage to 844/28,800 (2.93%).
Strict research reports 22 accepted, 20 `needs_review`, and two excluded targets;
32 reviews include ten migration-ready decisions. The ignored provider ledger
contains 62 attempts (37 succeeded, 25 failed) across 32 target IDs and USD
0.51546 recorded cost. With the default queue empty, the next checkpoint begins
with a source-led exact-reference pre-screen and does not invoke the provider
until a named homogeneous candidate has complete projected M1 evidence.

That source-led pre-screen selects Bertucci A-2T Original Classic `12022`,
fixed to the black dial and supplied black B-TYPE nylon band. The [current exact
manufacturer page](https://bertucciwatches.com/Bertucci/A2TOC.html) and its
feature/dimension records retrieved 2026-08-30 expose USD 185, a 40 mm matte
titanium case, 49.5 mm overall length, 11 mm thickness, 22 mm fixed titanium
retention bars, 62 g configured weight, Japanese all-metal quartz operation,
200 m resistance, screw-down crown and back, hardened mineral crystal, date,
and Swiss luminous hands and markers. The current Japanese distributor names
Miyota GM10 or 2S60; both official Miyota records specify -20/+20 seconds per
month. A [current exact retailer](https://www.outlandusa.com/p/bertucci-mens-a-2t-original-classics-black-black-nylon)
shows the black/black `12022` in stock at USD 185.

The single bounded provider attempt succeeded with 23 provisional facts and 26
unresolved fields at USD 0.01755. Independent review closes the provider's
image-extraction gaps from Bertucci's current dimension and feature sheets,
rejects the stale exact-retailer 100 m and approximately 54 g rows, and maps the
fixed titanium retention bars to the existing `proprietary` strap-interface
enum rather than an integrated bracelet. The printed 24-hour dial scale is not
accepted as a complication. Both exact distributor-listed calibres share the
reviewed -20/+20-seconds-per-month rate, but scalar calibre and their differing
battery endurance remain `null` rather than selecting one without evidence.
Exact manufacturer performance copy supports a conservative `moderate` lume
grade; no Super Classic, solar, other-dial, or other-band fact is inherited.

Additive migration `0025_expand_catalogue_bertucci_a2t.sql` is live. Remote
verification reports M0 and M1 complete, 42 verified reference-level evidence
rows from seven sources, 23 accepted variants across 19 brands, and exact
publishable-key catalogue plus six-profile SQL hard-filter parity. The sourced
49.5 mm span narrows the planning intent to the three wrist bands from 6.25
inches upward; the row therefore adds exactly 96 `under_300`, zero-maintenance,
simple-date field/studio cells, raising deterministic coverage to 940/28,800
(3.26%). Strict research reports 23 accepted, 20
`needs_review`, and two excluded targets; 33 reviews include eleven
migration-ready decisions. The ignored provider ledger contains 63 attempts
(38 succeeded, 25 failed) across 33 target IDs and USD 0.53301 recorded cost.
The next Phase 5 checkpoint returns to source-led exact-reference selection;
the provider must not run until a named homogeneous candidate has complete
projected M1 evidence and an explicit coverage purpose.

That source-led pre-screen selects Luminox Leatherback SEA Turtle
`XS.0307.WO`, fixed to its white dial, white 39 mm fiberglass-compound case,
and supplied white 19 mm silicone strap. The [current manufacturer page](https://ch.luminox.com/en/products/leatherback-sea-turtle-39-mm-outdoor-uhr-0307-wo)
publishes 48 g configured weight, 12 mm thickness, Ronda 515 quartz, 100 m
resistance, a protected double-gasket crown, hardened mineral crystal, date,
and constant 24/7 illumination for up to 25 years. A [current exact authorized
Polish offer](https://www.zegarki.zgora.pl/zegarek/24126_Luminox_Leatherback_Sea_Turtle_0300_Series_Whiteout_XS0307WO)
adds PLN 1,315 stock with 24-hour dispatch and a 46 mm lug-to-lug span, while
an [exact official dealer record](https://www.auer.lu/en/luminox-leatherback-sea-turtle-swiss-carbon-watch-with-date-xs-0307-wo.htm)
identifies a pull crown and pushpin strap mount. The [official Ronda 515
record](https://www.ronda.ch/en/watch-movement-finder/caliber/515) supplies the
-10/+20-seconds-per-month rate.

The one bounded Perplexity attempt succeeded with 33 provisional facts and 16
unresolved fields at USD 0.02134. Independent review preserves exact
`XS.0307.WO` identity, accepts Luminox's configured 48 g manufacturer value
over the authorized retailer's conflicting 40 g row, and excludes black 0301
references, 44 mm Leatherback Giant cases, alternate straps, and generic
collection facts. Constant self-powered 24/7 visibility maps to `strong` lume;
the exact dealer's pushpins and pull crown map to `spring_bar` and `push_pull`;
and the bezel is not treated as a movement complication.

Additive migration `0026_expand_catalogue_luminox_leatherback.sql` and the
forward-only source-snapshot repair
`0027_repair_luminox_ronda_provenance.sql` are live. The repair preserves both
Ronda 515 retrieval snapshots while attaching the Luminox movement, accuracy,
and date evidence to the independently reviewed 2026-08-31 snapshot. Remote
verification reports M0 and M1 complete, 28 verified reference-level evidence
rows from four sources, 24 accepted variants across 20 brands, and exact
publishable-key catalogue plus six-profile SQL hard-filter parity. The row adds
exactly 128 `300_500`, zero-maintenance, simple-date field/studio cells across
four wrist bands, raising deterministic coverage to 1,068/28,800 (3.71%).
Strict research reports 24 accepted, 20 `needs_review`, and two excluded
targets; 34 reviews include twelve migration-ready decisions. The ignored
provider ledger contains 64 attempts (39 succeeded, 25 failed) across 34 target
IDs and USD 0.55435 recorded cost. The default queue is empty; the next Phase 5
checkpoint must again begin with source-led exact-reference and coverage
pre-screening before any provider request.

The post-acceptance provenance audit strengthens catalogue parity from a flat
set of evidenced fields to each field group's complete source-retrieval
signature. That stricter comparison exposed two older corroborating price
sources that were present in the seed but omitted from SQL because the
migration renderer selected only the first `price` evidence group. The renderer
now emits every reviewed price and availability source, and additive migration
`0028_repair_multi_source_price_evidence.sql` restores the exact Brew product
payload and Bertucci retailer price evidence. Publishable-key parity passes
again for all 24 variants and six profiles under the stronger contract.

A source-led gap-resolution pass then returns to Laco Augsburg 39 article
`861988`, fixed to the black dial and brown riveted calf-leather strap. The
existing exact manufacturer, Laco FAQ, Miyota 82S0, and live Laco leather-strap
manual evidence already established the EUR 390 German offer, 39 x 11.55 x
46.5 mm geometry, 18 mm spring-bar interface, 81.5 g configured weight, LACO
2S regulation of 0/+25 seconds per day, 42-hour reserve, 50 m resistance,
sapphire, and no-date operation. A [July 2026 verified-purchase
report](https://www.trustedshops.de/bewertung/info_XA22FF9B21733A0EAC7FC18702C984C3E.html)
newly retrieved 2026-08-31 identifies the current black Augsburg 39/Miyota 82
configuration and reports excellent nighttime legibility through morning;
Laco's dated public response explicitly concurs with the brightness and
legibility observation. That exact full-night evidence maps to `strong` while
the provider's C3-material-only inference remains rejected.

Additive migration `0029_expand_catalogue_laco_augsburg.sql` is live. Remote
verification reports M0/M1 complete, 23 verified reference-level evidence rows
from five sources, 25 accepted variants across 21 brands, and exact
publishable-key catalogue plus six-profile SQL hard-filter parity. The row adds
a second candidate to exactly twelve `300_500`, studio, workhorse-mechanical,
time-only cells: total coverage remains 1,068/28,800 (3.71%), while
single-candidate cells fall from 1,064 to 1,052. Strict research reports 25
accepted, 19 `needs_review`, and two excluded targets; 34 reviews include
thirteen migration-ready decisions. No provider request was made, so the
ignored ledger remains 64 attempts (39 succeeded, 25 failed) across 34 target
IDs and USD 0.55435 recorded cost.

A subsequent source-led pass resolves the Vostok Europe Nuclear Submarine SSN
571 `VK61-571H614` mass gap without another provider request. The
[configuration-specific OTTO listing](https://www.otto.de/p/vostok-europe-chronograph-nuclear-submarine-herrneuhr-vk61-571h614-lederband-46-mm-CS071P09T/),
retrieved 2026-08-31, explicitly identifies black leather with petrol stitching
as the installed strap, lists black silicone separately as a supplied
accessory, and publishes approximately 135 g in that configuration. Review
therefore replaces the earlier black-silicone hypothesis with one homogeneous
leather-worn row; the ambiguous regional 100 g value remains rejected as
head-only or unscoped. OTTO's contradictory sold-out and cart state is also
rejected, leaving the independently reviewed Czech EUR 793 short-wait snapshot
canonical.

Additive migration `0030_expand_catalogue_vostok_europe.sql` is live. Remote
verification reports M0/M1 complete, 29 verified reference-level evidence rows
from six sources, 26 accepted variants across 22 brands, and exact
publishable-key catalogue plus six-profile hard-filter parity. The verified
56.2 mm wearing span corrects the earlier three-band pre-screen to
`7_5_plus` only. The row supports 16 `500_1000`, zero-maintenance chronograph
cells, opens eight, and adds a second candidate to eight; coverage rises to
1,076/28,800 (3.74%), single-candidate cells remain 1,052, and
under-evidenced cells fall from 224 to 216. Strict research reports 26 accepted,
18 `needs_review`, and two excluded targets; 34 reviews include fourteen
migration-ready decisions. With no provider call, the ignored ledger remains
64 attempts (39 succeeded, 25 failed) across 34 target IDs and USD 0.55435
recorded cost. The default queue is empty again.

Additive migrations `0031_expand_catalogue_vostok.sql` and
`0032_expand_catalogue_boldr.sql` are now live. Connected verification reports
24 brands and 28 accepted variants, and the publishable-key catalogue plus all
six SQL/TypeScript hard-filter profiles pass exact parity. The homogeneous
BOLDR row remains on its 91 g integrated Druber strap; the bundled titanium
bracelet is accessory context only. Local and live coverage is 1,102/28,800
cells, and no provider request was needed.

Phase 5 engineering closeout on 2026-08-31 validates the complete reusable
pipeline without performing further watch research. The strict manifest audit
passes at 204/204 planned brand slots with all 200 owner knowledge dossiers
linked; the knowledge intake validates 951 reference families and 1,748 source
links; all 28 accepted catalogue variants remain linked to canonical manifest
targets; and all 37 committed review artifacts pass their state/provenance
contract. The default research queue is empty. The worker's retained-attempt
index, successful-fingerprint reuse, monotonically increasing resume attempt,
and bounded `Retry-After` behavior now have deterministic tests. A provider-free
dry run exits cleanly without selecting or calling a target. The existing
field-specific refresh windows, provisional-only extraction contract, human
review gate, immutable ignored artifacts, additive migration renderer,
coverage audit, and SQL/TypeScript parity path remain the owner handoff for any
future catalogue records.

The owner's subsequent Rolex workbook request reopens only that named research
scope. All 34 family/size rows are represented by 35 exact-reference Sonar Pro
targets, with the two Explorer 36 material configurations kept separate. The
extended workbook retains 35 exact-reference rows and 1,757 evidence rows;
every provider fact remains provisional until an independent review decision.
Submariner `124060` and Sea-Dweller `126600` passed the full independent M1
gate and entered additive migration `0036_expand_catalogue_rolex_workbook.sql`.
The owner's later explicit curator decision approves all 35 exact references
for recommendation use through additive migration
`0037_approve_rolex_workbook_recommendations.sql`. The other 33 retain their
evidence gaps and `owner_approved_for_recommendation` outcome; the Deepsea
dial/URL caution remains recorded, and missing facts remain null-safe. The
reviewed snapshot contains 71 variants, including all 35 workbook references
and 10 separately owner-supplied Rolex configurations, and projects
1,911/28,800 local coverage cells (6.64%). The detailed trace is in
[`rolex-catalogue-expansion.md`](rolex-catalogue-expansion.md).

The follow-up owner reference ledger retains all 34 explicitly supplied
reference numbers and official family URLs. All 34 resolve against the
accepted snapshot; the combined Rolex corpus contains 45 distinct variants,
each explicitly approved for recommendation use. Connected verification
reports 71 total variants, 45 Rolex variants, 34/34 requested references, and
exact six-profile SQL/TypeScript parity after additive speculative-filter
repair migration `0039_repair_speculative_hard_filter.sql`.

Owner model-list planning checkpoint 2026-08-31: the owner has now supplied a
field/evidence template and three catalogue-interest lists with 220 brand rows
and 1,786 top-level model expressions. This authorizes concrete planning and a
future named owner-managed research run; it does not itself accept any list
claim or reopen generic autonomous target selection. The controlling
[`owner model research expansion plan`](owner-model-research-expansion.md)
requires lossless atomization, a version-8 research contract for every template
field, one `sonar-pro` request per atomic target under GPT-5.6 Luna, independent
field review, and the existing M1/additive-migration gates. The plan is a
separate owner-managed continuation and does not reorder the controlling phase
sequence.

Phase 7 integration preflight on 2026-08-31 ran the deferred Chromium suite in
both desktop and mobile projects. All eight landing, health, error-boundary,
and six-screen diagnostic tests passed after supplying the runner's missing
shared libraries from a user-space package extraction. The Beehiiv assertion
audits only the application-owned boundary; vendor iframe accessibility remains
outside the page's control.

The same checkpoint smoke-tested the latest protected Vercel production
deployment: `/`, `/quiz`, and `/health` returned 200, and a valid questionnaire
version-2 core submission returned 200 with `catalogueOrigin: supabase`. The
temporary share link used for the check was not retained as application
configuration.

The first operational slice adds server middleware for an unguessable request
ID, structured method/path/status/duration logs, `Server-Timing`, and security
headers (`X-Content-Type-Options`, frame/referrer/permissions policies, and a
vendor-scoped CSP). React Router's generated inline hydration bootstrap requires
`'unsafe-inline'` in `script-src`; the policy still restricts executable origins
and explicitly allows only the Beehiiv and Cloudflare challenge hosts.
Deployment `dpl_Hutab5bkN38Z5VgQH4ywKsvpNmAj` reached `READY` from commit
`a4b520b`; a protected production response exposed all of these headers plus a
unique `X-Request-ID` and measured `Server-Timing` value.

## Phase 6 — Optional free-text and semantic evaluation

Status: **closed — SQL-first retained after 2026-08-31 pilot**

Goal: determine whether AI improves free-text intake or aesthetic nuance enough
to justify operational complexity.

Experiments:

- Structured profile extraction from free text with Zod validation.
- Semantic comparison of curated reference/claim passages for aesthetic and
  psychological fit.
- Optional PostgreSQL `pgvector`; no separate vector database at current scale.
- Provider adapters may include OpenAI and Ollama/RunPod. Mastra is added only
  if orchestration complexity justifies it.

Entry gate:

- Phase 4 deterministic fixtures and quality/latency/cost baseline exist.

Exit decision:

- Adopt only functionality that measurably improves held-out fixtures without
  hard-filter violations or unsupported facts. Otherwise retain the SQL-first
  engine and close the experiment.

Arbitrary fixed-size dossier chunking is explicitly out of scope.

The deterministic entry-gate harness now evaluates the six shared golden
profiles through the real recommendation function. At 1,000 iterations per
profile over the 28-variant catalogue, all runs are deterministic, no
recommendation violates its hard-filter partition, the slowest profile averages
0.2854 ms per evaluation on this runner, and provider cost is USD 0.00. These
measurements establish the comparison baseline; no semantic provider is yet in
the production path.

A bounded semantic pilot then sent three synthetic held-out free-text profiles
to the configured GPT-5.6 Terra Responses API with strict JSON Schema output.
Only 11 of 21 expected fields matched exactly (52.38%); categorical misses
included deployment, ownership, weight, date, and speculative-risk constraints.
The 651-token response is retained in
`data/evaluation/phase-6-semantic-pilot-2026-08-31.json`, but no model output
entered the recommendation path and the pilot is not adopted.

Follow-on checkpoint 2026-08-31: Worn & Wound's exact sky-blue Horizon
hands-on review records the hands and indices still glowing until morning after
overnight wear. This direct elapsed observation closes BOLDR's sole M1 gap as
`strong` without treating Swiss Super-LumiNova material labels as performance
evidence. The homogeneous 91 g integrated Druber-strap row is now
`ready_for_migration`; seed coverage is 1,102/28,800 cells across 28 variants.
Migrations `0031` and `0032` are applied remotely, and the publishable-key
catalogue plus six-profile SQL/TypeScript parity audit passes for all 28 live
variants.

## Phase 7 — Product integration, email, deployment, and evaluation

Status: **complete — production funnel verified at the owner-approved boundary**

Goal: turn the recommendation engine into a production funnel.

Deliverables:

- Results UI with comparison, score factors, trade-offs, citations, “why not,”
  verification gaps, and edit/restart controls.
- Explicit Beehiiv opt-in; results remain visible without subscribing.
- Rate limiting, abuse controls, caching, timeouts, and observability.
- Evaluation dashboard for hard-filter validity, ranking quality, latency, cost,
  completion, refinement use, and subscription conversion.
- Full deferred browser/integration suite and production deployment/rollback.

The first operational control is now explicit but deliberately staged. The
quiz action parses `QUIZ_RATE_LIMIT_MAX_REQUESTS` and
`QUIZ_RATE_LIMIT_WINDOW_SECONDS`, rejects partial or invalid configuration with
HTTP 503, and enforces a process-local window with standard limit/reset headers
when both measured values are present. When both Upstash REST credentials are
configured, the same contract uses the official distributed sliding-window
adapter; Redis timeouts and failures become a visible 503 rather than an
allowed request. Both policy variables remain unset: the production log sample
contained only five requests in seven days (four `/` and one `/quiz`), and the
Vercel Web Analytics query for 2026-08-24 through 2026-08-31 reported zero
visitors and pageviews. No quota is defensible yet. The local bucket is
defense in depth and is not presented as a production-wide control.

Configured Upstash Redis now also provides atomic per-channel email-delivery
deduplication. Each validated email request uses an opaque hash of its channel,
intent, profile, and address with a 15-minute expiry; a repeated successful
request is reported as already requested without calling Beehiiv or Resend.
Provider failures release their claim for retry, and claim failures prevent the
provider call while keeping the recommendation response visible. Beehiiv and
Resend requests use a shared 10-second abort deadline. The traffic-derived
quota remains pending until production observations justify a value.

The result screen now keeps recommendations visible without an email and offers
a separate, checked opt-in field. The server validates the address and consent
before calling the configured channels; missing credentials, provider errors,
and malformed requests are surfaced in the result UI without exposing the
address or hiding the recommendation. Beehiiv records the newsletter opt-in
and requests its configured welcome email. When `RESEND_API_KEY` and
`EMAIL_FROM` are paired, the same request sends a deterministic dossier through
Resend's email API. The dossier contains only accepted catalogue facts, score
traces, explicit verification/rejection reasons, and reviewed source links; it
states that historical/prose context is unavailable rather than inventing it.
Beehiiv and Resend outcomes are independent, so a partial delivery is visible.
Configured Upstash also deduplicates repeated successful channel deliveries;
only the traffic-derived quota remains open.

Each accepted quiz action also emits a privacy-safe `quiz_funnel` runtime event
with intent, catalogue origin, result counts, returned hard-filter violations,
evaluation duration, deterministic provider cost, ranking-score summaries, and
subscription status. Vercel custom-event access requires a paid plan, so the
same validated aggregates now persist through narrow Supabase RPCs rather than
introducing an unapproved upgrade. The RLS-enabled raw table has no browser
table grants; `/evaluation` reads only a bounded aggregate summary. The first
meaningful forward action records a timestamp-only start. Pageview analytics
still remove query parameters and fragments before collection. The dashboard
covers completion, refinement use, hard-filter validity, operational score
distributions, latency, cost, and subscription outcomes; its event contract
and denominator rules are recorded in
`docs/phase-7-evaluation-dashboard.md`. No profile answers, email addresses,
IP addresses, or request identifiers enter the store. Traffic-derived
conclusions remain pending until the deployment has enough observations.

Migration `0033_add_quiz_funnel_evaluation.sql` is applied. Its raw event table
has RLS enabled, `anon` has neither select nor insert table privileges, and only
the narrow record and bounded-summary functions are executable. Security and
performance advisors reported no new error-level findings; the expected
no-policy informational notice reflects the intentional no-direct-table-access
design. Production deployment `dpl_4cdupPTWSxdy7AHDx34KzSgfcYWL` from commit
`8a7329a` is `READY`. One automated provider-free sample produced one start and
one core evaluation, zero hard-filter violations, 867.2 ms evaluation latency,
USD 0 provider cost, and a 29.4 top/mean confirmed score. `/evaluation` renders
that durable summary, and the deployment has no error/fatal runtime logs.

The result screen now also exposes a true restart control. Restart clears the
stored core and refinement draft and returns to the first screen; a new start
is recorded only if the visitor advances again.

Sentry error reporting now covers the React Router client, server render,
loaders, actions, middleware, and the branded root boundary without enabling
default PII collection. Expected route-miss 404s and aborted requests are
excluded from server reporting. The CSP derives only the configured DSN's HTTPS
envelope origin for `connect-src`; invalid or non-HTTPS DSNs cannot widen the
policy. Source-map upload remains optional and requires the auth token,
organization, and project values as one complete build-time set. The configured
DSN accepted and flushed a privacy-safe automated verification event.

On 2026-08-31 the full deferred Playwright suite passed: 10 desktop/mobile
tests covering the landing page, health response, error boundary, six-screen
quiz flow, optional refinement submission, and cited-result rendering.
Chromium's missing host libraries were loaded from a temporary user-space
directory for the run; no browser binaries, system packages, or repository
artifacts were added. The current Vercel Web Analytics window still reports
zero visitors and pageviews, while runtime logs contain one privacy-safe quiz
evaluation event, so no production conversion rate or quota is inferred.

The Sentry checkpoint moves Playwright from the Vite development server to a
fresh production build served by `react-router-serve`. Its landing assertion
verifies the application-owned Beehiiv loader while aborting the third-party
response, so external iframe latency cannot mask hydration failures. The same
10-test desktop/mobile matrix passes against that production-mode server.
Vercel exposes the DSN to the client build but not to the request middleware at
runtime, so the CSP also receives a build-time fallback containing only the
validated public HTTPS envelope origin. The runtime DSN remains preferred and
neither path places the DSN key in a response header.
The Vercel `SENTRY_DSN` entry was present but empty; it was securely repaired
from the already-verified local value and redeployed without printing it. The
live `/`, `/quiz`, `/health`, and `/evaluation` responses now return 200 and
admit the validated Sentry envelope origin in CSP.

Verification:

- Full flow works from landing through core result, refinement, cited
  recommendations, and optional email.
- Consent, empty results, incomplete data, provider-free operation, and external
  failures are tested.
- Beehiiv and Resend adapters are tested independently, including paired-config
  parsing, request contracts, provider failures, and visible partial delivery.
  A consented production core request returned recommendations, reported the
  Beehiiv request as sent, and kept the independently unavailable Resend channel
  visible. A follow-up Beehiiv lookup confirmed one active subscription with
  the expected `the_reserve_diagnostic` source. The owner accepted this as the
  production email boundary and directed that the current Resend state remain
  unchanged; live Resend dossier delivery is not a Phase 7 exit condition.
- Production smoke checks pass on `www.thereserve.watch` and the Vercel alias.
  The apex domain currently presents the `www`-only certificate because its
  third-party DNS now publishes three apex A records: the correct Vercel target
  `76.76.21.21` plus conflicting `216.198.79.1` and `162.255.119.72` targets.
  Vercel still reports the domain as misconfigured. Canonical-domain
  verification remains open until the two conflicting records are removed and
  certificate issuance completes.

The production Beehiiv key and publication ID pass a non-mutating publication
lookup and identify the configured publication. The consented production test
above closes Beehiiv's live-delivery checkpoint. The Vercel Resend variables
exist but are empty, while the validated local API key is active. The intended
`@thereserve.watch` sender domain was absent from Resend, so it was created
additively on 2026-08-31 and now awaits its three Namecheap DNS records (DKIM,
MAIL FROM MX, and MAIL FROM SPF). Resend remains disabled in Production; this
avoids deploying a sender path known to return a provider rejection. On
2026-08-31 the owner directed that this existing state be preserved and removed
DNS and live Resend verification from the phase boundary. The tested adapter,
visible unavailable/partial states, and source-backed dossier remain ready for
a later additive enablement if the owner revisits the provider.

The authoritative DNS preflight then found existing, conflicting email
infrastructure at every required Resend hostname: `resend._domainkey` contains
a different DKIM key, while `send` resolves through Forge/RMTA and publishes
Forge MX/SPF data. These records must not be overwritten until the owner
confirms whether the existing sender is still required. A separate Resend
sending subdomain is the additive alternative if that infrastructure must be
preserved. A same-day recheck against both authoritative Namecheap nameservers
confirmed that these are still the published records, not resolver propagation.
The same authoritative check still returns all three apex A records, Vercel
reports the domain as misconfigured, and the apex TLS certificate does not
cover `thereserve.watch`. The owner explicitly deferred DNS reconciliation;
`www.thereserve.watch` and the stable Vercel alias are the verified Phase 7
production surfaces.

## Phase 8 — Celebrity & cinema watch discovery

Status: **complete — verified 2026-09-01**

Goal: use sourced public-figure and screen-watch research plus a lightweight
archetype quiz as a discovery funnel into the existing deterministic diagnostic.

The detailed plan, evidence model, delivery packets, and editorial guardrails
are in [`phase-8-celebrity-cinema-watches.md`](phase-8-celebrity-cinema-watches.md).
Subsequent commercial expansion is sequenced in
[`future-expansion-strategy.md`](future-expansion-strategy.md).

Packet 8.1 begins without public-figure research or catalogue changes.
Additive migrations `0034_add_discovery_claims.sql` and
`0035_harden_discovery_trigger_grants.sql` define separate entities, works,
events, attributions, claim evidence, image-rights decisions, and correction
records. All seven tables have RLS enabled and no browser table or sequence
grants. The invoker trigger has an empty search path and no browser execution
grant. A database publication trigger and the shared Zod contract both require
accepted supporting evidence and an image-rights decision; confirmed claims
additionally require exact-reference precision, while family-only and disputed
labels remain explicit. Discovery links may target only an already reviewed
`reference_variant` and cannot promote catalogue facts. The source and
publication vocabulary is recorded in
[`phase-8-discovery-source-contract.md`](phase-8-discovery-source-contract.md).

Both migrations are applied to the connected Supabase project. Live
verification reports all seven tables at zero rows after a rolled-back gate
fixture, RLS enabled, zero `anon`/`authenticated` select or insert privileges,
no missing foreign-key indexes, and no browser execution privilege on the
trigger. The transaction proved an unsupported confirmed attribution is
rejected before accepted evidence exists and the same attribution publishes
after accepted evidence plus a text-only image-rights decision. Security and
performance advisors add only the expected no-policy and unused-index
informational notices for intentionally inaccessible, empty packet-8.1 tables;
they report no new error-level finding.

Packet 8.2 adds a source-ranked editorial protocol, explicit contradiction and
correction workflow, and a 21-card executable pilot corpus. The reviewed mix is
10 cinema stories, 3 television stories, and 8 public-figure stories. Twelve
claims have exact-reference support, eight retain the public model-family-only
label, and one authenticated production prop remains deliberately unidentified.
The corpus is text-only, stores no third-party images, and all
`referenceVariantId` values are null; it neither changes nor assumes catalogue
facts. Shared validation enforces 20–30 independent cards, accepted supporting
evidence, matching entity/work/event relationships, source retrieval times,
image decisions, unique story/attribution identities, and representation from
all three editorial categories. The protocol and source index are in
[`phase-8-editorial-protocol.md`](phase-8-editorial-protocol.md).

Packet 8.3 publishes the pilot at `/watches` through a narrow application-owned
read model. Index, entity, work, and attribution routes expose accepted claims
without raw database access; each attribution shows its public confidence and
precision, editorial qualification, reviewed citations, correction state, and
the handoff to `/quiz`. Shared-work grouping keeps the three Oppenheimer and two
Mad Men claims separate while presenting them under one work. The deliberately
unidentified Community prop renders as unconfirmed with no guessed brand or
model. Route and browser tests cover the index, citation detail, 404 handling,
uncertainty, diagnostic handoff, and accessibility.

Packet 8.4 adds `/watches/archetype`, a deterministic four-question editorial
quiz with six dispositions and a first-party CSS share card. Its versioned
weighted scoring separates mechanical connoisseurship, recognised benchmarks,
expressive collecting, architecture, custody, and field utility; an exhaustive
180-combination test keeps every result reachable. Complete answers produce a
reproducible share URL; incomplete, forged, or out-of-vocabulary values fail
closed. The `/quiz` handoff accepts only validated social-signal and aesthetic
values. Directional price comfort and operating context are not promoted into
hard constraints, so the diagnostic still requires exact budget, wrist,
operating, and technical answers. The archetype requires no email, and
newsletter/dossier consent remains separate.

Packet 8.5 adds an aggregate-only discovery funnel with strict TypeScript and
PostgreSQL event/dimension validation. It measures discovery page views,
archetype starts/completions/shares, core handoffs, completed recommendations,
explicit opt-ins, and a dormant future outbound-market event without retaining
answers, URLs, contact data, IPs, user IDs, or request IDs. The dedicated table
has RLS, no browser table/sequence grants, and only narrow write/90-day-summary
RPC access. `/evaluation` reports the trailing 30-day ratios with honest zero
denominators. The evaluation contract defines minimum samples and
retain/revise/stop gates; editorial operations define monthly link checks,
90/180-day claim review, immediate safety downgrades, and correction service
levels. Phase 8 is complete without catalogue population or research changes.

## Post-Phase-8 landing and access refinement

Status: **verified — isolated fast gate passed**

The 2026-09-01 owner direction refreshes the landing hierarchy and moves
newsletter subscription to the entry boundary of the full reference
diagnostic. The gauge mark and wordmark form one horizontal lockup. Two large,
descriptive action panels immediately follow the documentary manifesto: the
public celebrity/cinema evidence archive and the subscriber reference
diagnostic.

The public archive and its four-question archetype remain available without an
email. The handoff into `/quiz` now requires a successful explicit Beehiiv
subscription. The server issues an opaque, signed, expiring, HttpOnly access
grant only after Beehiiv accepts the request; both the quiz loader and action
fail closed without it. The cookie contains no email address. This supersedes
the former optional-email entry rule while preserving already generated
recommendations and the separate, explicit results-page delivery consent.

Verification:

- Landing unit coverage confirms the locked action, explicit consent, Beehiiv
  request, and signed access-cookie response.
- Access-domain tests cover missing configuration, valid grants, tampering, and
  expiry; quiz route coverage checks both GET redirect and POST rejection.
- The deferred browser suite is updated to use a server-signed test grant. Its
  execution remains governed by the repository quality-gate instruction.

Follow-up 2026-09-01: the first live signup attempt exposed an empty Production
`SESSION_SECRET` value. The already verified local 64-character secret was
restored as a Sensitive Production variable and the paired Preview entry was
refreshed without printing either value; the next production deployment picks
up the repaired configuration. Configuration failures now emit only component
and validation reason, never values. The email field and submit button also use
an explicit gap and complete borders so the global keyboard focus ring cannot
overlap the button.

## Post-Phase-8 guided discovery continuation

Status: **planned — owner-approved 2026-09-01**

The owner approved a guided continuation that preserves the four-question
archetype and adds a result fork: proceed to the existing full personal quiz,
or find watches through a film/series, actor or public figure, or fictional
character. Unknown subjects may enter a private, deduplicated research queue;
Perplexity may discover sources and produce structured provisional candidates,
but independent review and the existing publication gates remain mandatory.

Execute packets D0–D8 from
[`guided-celebrity-cinema-discovery-plan.md`](guided-celebrity-cinema-discovery-plan.md)
in order. This additive continuation does not reopen completed Phase 8, start
commercial Phase 9, or authorize autonomous brand/model catalogue research.

## Environment-variable ownership

| Variable | Required in | Purpose |
| --- | --- | --- |
| `APP_URL` | Phase 1 | Canonical application origin. |
| `SESSION_SECRET` | Post-Phase-8 access refinement | Signs the subscriber diagnostic-access grant; required by the web runtime. |
| `SUPABASE_URL` | Phase 4 | Public project endpoint for the narrow accepted-facts RPCs. |
| `SUPABASE_PUBLISHABLE_KEY` | Phase 4 | Public API key; it has RPC execute only and no table grants. |
| `DATABASE_URL` | Optional Phase 5/7 | Direct SQL workers only if a later job needs them; not required by the web runtime. |
| `DIRECT_DATABASE_URL` | Phase 3/5 maintenance | Additive migrations and maintenance outside the web runtime. |
| `PERPLEXITY_API_KEY` | Phase 5 | Research source discovery. |
| `OPENAI_API_KEY` | Optional Phase 5/6 | Structured normalization audit or semantic experiment. |
| `AI_PROVIDER` | Optional Phase 6 | Experimental provider selection. |
| `OPENAI_INGESTION_MODEL` | Optional Phase 5 | Structured normalization model. |
| `OPENAI_RECOMMENDATION_MODEL` | Optional Phase 6 | Free-text/semantic experiment. |
| `OPENAI_AUDIT_MODEL` | Optional Phase 5/6 | Selective quality audit. |
| `OPENAI_EMBEDDING_MODEL` | Optional Phase 6 | Semantic experiment only. |
| `OLLAMA_BASE_URL`, `OLLAMA_CHAT_MODEL` | Optional Phase 6 | Ollama experiment. |
| `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID` | Optional Phase 6 | Hosted Ollama experiment. |
| `BEEHIIV_API_KEY`, `BEEHIIV_PUBLICATION_ID` | Phase 7 | Explicit subscription opt-in. |
| `SENTRY_DSN` | Optional Phase 7 | Client/server production error reporting and the exact CSP envelope origin. |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Optional Phase 7 build | Complete set required for Sentry source-map upload; the auth token remains secret. |

Only `.env.example` is committed. Real values belong in ignored local files and
encrypted deployment settings.
