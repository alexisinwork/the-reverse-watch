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

Goal: collect the smallest trustworthy profile first, then offer optional
refinement without making semantic infrastructure a prerequisite.

Deliverables:

- One shared TypeScript constants module for price bands, wrist display bands,
  units, and answer enums. Exact budget and wrist values are canonical.
- Zod schemas and inferred types for the core profile and refinement fields.
- Six-screen accessible core flow: budget, wrist, deployment,
  movement/service+accuracy, weight, and complications/date.
- Early deterministic profile summary with an optional “refine” path.
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

Evidence: `/quiz` implements the six required screens and four optional refine
groups; server and browser use the same Zod/domain contract; session recovery,
boundary rules, premium/speculative rules, and the complete core flow are
covered by the fast gate (13 tests at the phase checkpoint).

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

Status: **in progress — coverage-first expansion started 2026-08-28**

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

The fourth live batch independently reviewed Seiko HCC004J1, Vostok 420059,
and Baltic MR Classic Blue without promoting any row. Seiko is M1-complete
except for graded lume and attachment semantics after official sources resolved
66 g full weight and no-date status. Vostok still lacks full weight, graded
lume, and attachment type and relies on a factory-adjacent retailer rather than
a manufacturer source. Baltic remains a multi-attachment configuration family
with only a starting price and no exact manufacturer reference. The strict
checkpoint has 11 reviews (one migration-ready, ten needing more evidence); the
next queue is Orient, Certina, and Tudor.

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

A subsequent exact-reference pass resolved TUDOR M79000N-0001's normalized
full-length bracelet weight at 139 g. Independent new and unworn/full-set dealer
records report the same value with approximately 19.5-21 cm of bracelet; the
135 g owner measurement is retained as a sized-bracelet observation rather than
used for the full configuration. TUDOR remains research-only because the exact
specialist fitment guide's spring-bar description still lacks manufacturer
corroboration of the factory attachment mechanism.

An exact-reference Swatch SO28N100 follow-up reduced its M1 gaps from ten to
three. Swatch's embedded product payload resolves 34 x 8.75 x 39.2 mm geometry;
a current CHF 70 official-retailer offer resolves price and short-wait channel
semantics; and the exact original 17 mm strap plus Swatch's connector-pin guide
establish a proprietary pinned attachment. Two exact-reference specifications
explicitly establish no-date status. The row remains research-only because
full-watch sources conflict at 18 g versus 22 g, Swatch publishes no numerical
quartz rate bound applicable to SO28N100, and black hands or omitted feature
prose cannot establish a repeatable lume grade.

Omega's exact 310.30.42.50.01.001 product page and downloadable product sheet
became independently retrievable on follow-up, validating the steel-on-steel
configuration, current $7,800 U.S. in-stock offer, 42 x 13.54 x 47.5 mm
geometry, 20 mm lug width, approximately 134 g total weight, calibre 3861, and
the remaining primary technical fields. Two independent exact-reference
specifications explicitly report no date display, reducing Omega's M1 gaps from
three to two. It remains research-only because the exact sources do not support
a repeatable lume grade or manufacturer-corroborated factory attachment type.

An exact-reference Bulova 98B316 dimensional follow-up resolves its previously
missing lug-to-lug at 54.5 mm: two specifications publish the same 17.5 x 46.5
x 54.5 mm set, with a separate specialist reporting 54.6 mm case length. The
row remains research-only with three M1 gaps. Full-weight records span 274 g,
276 g, and approximately 270 g after bracelet sizing; exact lume accounts
disagree on nighttime usability; and the original bracelet's dealer-described
spring-pin mount lacks manufacturer corroboration of the factory interface.

Blancpain Fifty Fathoms Tech 5019A 12B30 94A now has a reviewed 47 mm
lug-to-lug span. Blancpain's exact technical dossier establishes the 47 mm
diameter and central-lug construction, while an exact-reference hands-on
specification explicitly reports that the lack of projecting conventional lugs
makes lug-to-lug equal to diameter. The row remains research-only for
conventional lug width, full configured weight, and numerical accuracy.

## Phase 6 — Optional free-text and semantic evaluation

Status: **optional, pending deterministic baseline evidence**

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

## Phase 7 — Product integration, email, deployment, and evaluation

Status: **pending**

Goal: turn the recommendation engine into a production funnel.

Deliverables:

- Results UI with comparison, score factors, trade-offs, citations, “why not,”
  verification gaps, and edit/restart controls.
- Explicit Beehiiv opt-in; results remain visible without subscribing.
- Rate limiting, abuse controls, caching, timeouts, and observability.
- Evaluation dashboard for hard-filter validity, ranking quality, latency, cost,
  completion, refinement use, and subscription conversion.
- Full deferred browser/integration suite and production deployment/rollback.

Verification:

- Full flow works from landing through core result, refinement, cited
  recommendations, and optional email.
- Consent, empty results, incomplete data, provider-free operation, and external
  failures are tested.
- Production smoke checks pass on the canonical domain.

## Environment-variable ownership

| Variable | Required in | Purpose |
| --- | --- | --- |
| `APP_URL` | Phase 1 | Canonical application origin. |
| `SESSION_SECRET` | Phase 2 if server sessions are used | Signed server-side state; not required for browser `sessionStorage`. |
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
| `SENTRY_DSN` | Optional Phase 7 | Production error reporting. |

Only `.env.example` is committed. Real values belong in ignored local files and
encrypted deployment settings.
