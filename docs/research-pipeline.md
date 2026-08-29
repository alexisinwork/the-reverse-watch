# Coverage-first research pipeline

Status: **Phase 5 contract active**
Last verified: **2026-08-29**

This pipeline expands the relational catalogue without turning provider output,
Markdown, or a brand name into an accepted fact. PostgreSQL remains canonical;
the research layer produces provisional evidence for review.

## Boundaries

```text
coverage audit
  -> brand/reference planning manifest
  -> resumable discovery/extraction job
  -> immutable raw artifact
  -> Zod-normalized provisional facts
  -> human/source review
  -> additive SQL migration
  -> live catalogue + parity + coverage audits
```

- [`brand-manifest.json`](../data/research/brand-manifest.json) describes why a
  brand/reference slot should be researched. Its coverage intent is a
  hypothesis, not a watch specification.
- `app/domain/research.ts` is the versioned Zod contract for the manifest, jobs,
  and provisional facts.
- Extraction can emit only `reviewStatus: provisional`. It cannot write
  `accepted` facts or mutate the live catalogue.
- An accepted manifest target must link to a canonical catalogue variant. The
  manifest audit also requires every accepted bundled variant to be linked.
- Markdown dossiers are generated M2 editorial artifacts. They never become the
  parser input for M0/M1 decision facts.

No chunking, embedding model, vector extension, vector database, Mastra, Ollama,
or RunPod service is involved in this phase.

## Manifest and queue

Run:

```bash
npm run audit:research
npm run plan:research
```

The first command rejects duplicate brand/target IDs, invalid state transitions,
broken accepted catalogue links, and missing accepted seed rows. `--strict`
also requires the manifest to reach its declared approximately 200-brand target;
it is expected to fail while Phase 5 is incomplete.

The planner intersects each active coverage intent with all 28,800 core cells.
It reports how many targeted cells are empty, under three brands, or lack a
complete M1 candidate. A score combines those ratios, intent specificity, and
the manually reviewed P0–P3 priority. It does not predict that a planned watch
will pass those cells; source research must prove every dimension first.

Current checkpoint:

- the complete 200-dossier owner knowledge pack is linked into the manifest as
  research-only M0/M2 context, alongside one existing roadmap brand;
- 17 accepted catalogue targets linked to all current reviewed variants;
- 14 active coverage-intent targets, with all default discovery jobs reviewed;
- P0 tranche led by small formal quartz, compact solar field tools, ultralight
  time-only watches, compact mechanical GMTs, and affordable small-wrist
  mechanicals.

The first live batch on 2026-08-29 produced schema-valid provisional artifacts
for Cartier WSTA0107, Casio G-5600UE-1, and Swatch SO28N100. Independent review
did not promote any of them:

- Cartier still needs independently fetchable price, fit, weight, and accuracy
  evidence, and its rectangular 29.5 x 22 mm case cannot be collapsed into a
  circular `caseDiameterMm` fact.
- Casio has strong official dimensional, weight, solar, accuracy, water, and
  function evidence, but still needs a supported price/FX path, band-interface
  width, attachment classification, and reviewed illumination mapping.
- Swatch's official page supports identity, quartz, and 3 bar; the extracted
  lug-width source was for a different reference and was rejected.

Committed artifacts under `data/research/reviewed/` retain those decisions and
M1 gaps. Paid raw/normalized/job artifacts remain ignored.

The next ranked batch researched Christopher Ward mechanical GMT, Sinn compact
mechanical GMT, and Citizen compact lightweight solar. Exact primary-source
review made Christopher Ward C63-39AGM4-S00W0-B0 the first Phase 5
`ready_for_migration` candidate: its official page supplies every M1 field,
including the independently retrieved U.S. price and 20 mm interface. The
additive seed row raises exact core coverage from 180 to 212 cells. Citizen
BM8180-03E remains `needs_more_evidence` after its official E101 manual resolved
accuracy and its official regional page resolved a weight conflict; generic
luminous wording does not establish a graded lume class, and buckle is a clasp,
not the strap attachment. The first two Sinn responses failed strict extraction
consistency and remain immutable failed attempts rather than reviewable facts.

A third ranked batch subsequently produced valid provisional artifacts for Sinn
856 UTC, Marathon WW194003BK-0108, and Omega 310.30.42.50.01.001. Independent
review held all three at `needs_more_evidence`:

- Sinn's current official sheet describes several separately priced attachment
  configurations and reports 70 g without a strap, so it does not establish one
  homogeneous full-watch row; lug-to-lug, accuracy, attachment type, and graded
  lume also remain unresolved.
- Marathon's exact product page and specification sheet establish its identity,
  $575 USD offer, dimensions, movement, 3 ATM rating, and no-date status, but
  provide no numeric full weight, accuracy tolerance, attachment-interface
  classification, or categorical lume grade.
- Omega's exact official product page and sheet were blocked during independent
  retrieval. The detailed provider result remains provisional, and `Steel
  bracelet` was rejected as an attachment-interface value.

The strict checkpoint now contains eight committed reviews: one
`ready_for_migration` and seven `needs_more_evidence`. The next coverage-ranked
queue begins with Seiko compact mechanical no-date, Vostok affordable mechanical
field, and Baltic compact mechanical.

That fourth ranked batch also produced three valid provisional artifacts, but
no accepted row:

- Seiko HCC004J1 is now supported by exact official product, store, and calibre
  sources through full weight and no-date status. It remains research-only
  because neither omitted feature text nor a supplied leather strap establishes
  the catalogue's categorical lume grade or attachment interface.
- Vostok 420059 has detailed exact-reference evidence from Meranom, which
  explicitly identifies itself as a retailer near the factory rather than the
  manufacturer. Its independently observed sale price changed from the
  extraction's $172 to $164, and full weight, graded lume, and attachment type
  remain missing.
- Baltic MR Classic Blue is a configuration family: the official page requires
  a strap or bracelet selection and displays only a configuration-dependent
  starting price. It lacks an exact manufacturer reference, full weight,
  accuracy, graded lume, attachment type, and explicit date status.

The strict manifest now contains 11 reviews: one `ready_for_migration` and ten
`needs_more_evidence`. The next queue begins with Orient affordable mechanical
date, Certina midprice mechanical tool, and Tudor compact mechanical tool.

The fifth ranked batch produced reviewable Orient and Certina artifacts while
Tudor exhausted two strict retries:

- Orient RA-AC0M03S is now supported by exact global and regional official
  sources through 54 g full weight, -15/+25 seconds per day accuracy, date, and
  an explicit empty luminous-light specification mapped to no lume. Only the
  strap-to-case attachment interface remains an M1 gap.
- Certina C048.807.44.051.01 initially mixed product URLs for `.051.00` and
  `.081.00`. Independent review replaced them with the exact `.051.01` page,
  resolving price, 300 m ISO diver status, full weight, quick release, strong
  lume, and date. Certina still publishes no numerical Powermatic 80.611 rate
  tolerance, so the row remains research-only.
- Tudor's two responses failed strict null and resolved/unresolved consistency
  guards. The target remains planned; neither failed payload is reviewable.

The strict manifest now contains 13 reviews: one `ready_for_migration` and 12
`needs_more_evidence`. The next queue begins with a fresh strict Tudor retry,
Blancpain specialist dive, and Patek formal high complication.

The sixth ranked batch produced reviewable Tudor and Blancpain artifacts while
Patek exhausted two strict retries:

- Tudor M79000N-0001 is independently supported by exact official product,
  family, and press sources through a Poland-localized PLN 19,450 offer,
  37 x 11.2 mm case, 20 mm lug width, MT5400 -2/+4 daily rate, 200 m rating,
  Grade A lume mapped to strong, and no-date status. TUDOR does not publish its
  lug-to-lug length, full configured weight, or bracelet-to-case interface, so
  the row remains research-only.
- Blancpain 5019A 12B30 94A is independently supported by its exact current
  product page and June 2026 technical dossier, including the $27,200 U.S.
  direct offer, 47 x 14.81 mm Grade 23 titanium case, 120-hour caliber 13P5A,
  300 m rating, proprietary central-lug system, strong dual-color lume, and
  date. Lug-to-lug, conventional lug width, full configured weight, and
  numerical accuracy remain unresolved.
- Patek's two responses failed the strict null and resolved/unresolved
  consistency guards. The target remains planned; neither payload is
  reviewable.

The strict manifest now contains 15 reviews: one `ready_for_migration` and 14
`needs_more_evidence`. The next queue begins with Patek formal high
complication, Bulova precision quartz chronograph, Audemars Piguet integrated
specialist, and A. Lange & Söhne formal high art.

The seventh ranked batch brought Patek to four retained failures and produced
schema-valid Bulova and Audemars Piguet artifacts, but independent review
excluded both selected candidates from their coverage targets:

- Bulova Series X 98B429 is a current exact Precisionist chronograph, but its
  independently observed U.S. sale price is $1,220, above the target's
  $300-$1,000 bands. Review also corrected an invented zero accuracy lower
  bound to the official Precisionist -10/+10 seconds per year and retained five
  unresolved M1 fields.
- Audemars Piguet 15510ST.OO.1320ST.01 is an exact 41 mm steel Royal Oak, but it
  is the discontinued 2022 50th Anniversary reference rather than the requested
  current variant. Review rejected AP folding clasp as an attachment interface
  and independently mapped AP's documented bracelet construction to integrated.
- Each exclusion has a replacement planned target carrying the original
  coverage intent, with the disqualifying price or archived-anniversary choice
  stated explicitly in its selection prompt.

The strict manifest now contains 17 reviews: one `ready_for_migration`, 14
`needs_more_evidence`, and two `excluded`. The next queue begins with Patek,
the replacement attainable Bulova and current Audemars Piguet targets, and
A. Lange & Söhne.

The eighth ranked batch completed those four targets. One further Patek failure
was retained before a sixth-attempt success; Audemars Piguet also retained one
strict failure before its replacement succeeded. Bulova and A. Lange & Söhne
produced valid artifacts on their first replacement-batch attempts. Independent
review kept every result provisional:

- Patek Philippe Grande Sonnerie 6301P-001 is an exact current platinum
  reference. Its product page resolves 44.8 x 12.03 mm geometry, caliber
  GS 36-750 PS IRM, 72-hour reserve, non-water-resistant status, and a displayed
  $1,649,923 figure; the Patek Philippe Seal independently supplies -1/+2
  seconds per day. The dollar display does not identify a complete market or
  availability snapshot, and lug-to-lug, lug width, full weight, graded lume,
  and attachment semantics remain missing.
- Bulova Icon Precisionist Chronograph 98B316 is current and within the intended
  band at £679 on the exact UK page. Exact Canadian specifications resolve
  46.5 mm diameter, 24 mm lug width, and NN50 Precisionist identity; Bulova's
  official collection standard resolves -10/+10 seconds per year, and an
  exact-reference Costco listing supplies 17.5 mm thickness. Lug-to-lug, full
  weight, graded lume, and attachment semantics remain unresolved; conflicting
  approximate enthusiast weights were rejected.
- Audemars Piguet Royal Oak Jumbo Extra-Thin 16202ST.OO.1240ST.02 is the requested
  current reference, with exact 39 x 8.1 mm geometry, caliber 7121, 52-hour
  reserve, 50 m rating, date, and an officially documented integrated bracelet.
  The exact page exposes no usable price, and lug-to-lug, lug width, full weight,
  numerical accuracy, and graded lume remain missing.
- A. Lange & Söhne 720.035FE is an exact live, limited-to-50 platinum reference
  with 41.9 x 13 mm geometry, automatic caliber L225.1, 50-hour reserve, 3-bar
  rating, perpetual calendar, moon phase, and display-wide Lumen treatment
  mapped to strong. Its price is upon request, while fit dimensions, full
  weight, numerical accuracy, and attachment semantics remain incomplete.

The ignored ledger now retains 37 attempts: 21 succeeded and 16 failed,
spanning 21 target IDs, with USD 0.27503 recorded provider cost. The strict
manifest contains 21 reviews: one `ready_for_migration`, 18
`needs_more_evidence`, and two `excluded`. `npm run plan:research` now emits no
queued targets. New jobs must either close a named review gap from independently
identified exact-reference evidence or begin from a new explicit coverage
intent; empty-queue status is not permission for broad prestige collection.

A source-led gap-resolution pass then revisited the two candidates that each
had one M1 gap. Orient RA-AC0M03S advanced to `ready_for_migration`: an
independent exact-reference strap-fitment guide explicitly documents its
standard 20 mm spring bars, says the recommended straps were tested on that
watch, and distinguishes the factory interface from replacement quick-release
bars. Orient's own spring-bar service instructions corroborate the mechanism.
The accepted catalogue source enum now includes `secondary_editorial` so this
field-level evidence retains its real provenance. Certina
C048.807.44.051.01 did not advance: the manual linked from its exact product
page says only that most non-chronometers average around -10/+30 seconds per
day, which is neither universal nor a guaranteed bound for the selected
reference.

Generated migration `0011_expand_catalogue_orient.sql` is replay-safe and adds
only the reviewed Orient row after migration `0010`. At that checkpoint the
local seed had 14 variants and covered 244/28,800 cells (0.85%); 148 covered
cells contained an under-evidenced candidate. Strict research reported 14
accepted targets, 17 active targets, and 21 reviews: two
`ready_for_migration`, 17 `needs_more_evidence`, and two `excluded`. The live
database remained at 12 rows, so neither migration nor the bundled seed could
be pushed until `0010` and `0011` were applied in order and 14-row SQL parity
passed.

The next source-led pass checked the two-field Seiko HCC004J1 and Citizen
BM8180-03E reviews. An exact-reference retailer explicitly defines HCC004J1's
standard attachment as spring-loaded bars between the lugs, resolving
`spring_bar`; however, Seiko Netherlands reports Lumibrite while an independent
exact-reference inspection reports no luminous paint, so its lume grade remains
open. Citizen remains unchanged: exact-reference owner accounts conflict on
lume performance, and an aftermarket band-compatibility listing does not prove
the factory attachment interface. Neither candidate advances to migration.

The same pass reduced TUDOR Black Bay 54 M79000N-0001 from three gaps to two.
An exact-reference specialist measured 45.8 mm lug-to-lug and a separate
hands-on review reports 46 mm, consistent after rounding. Weight remains open
because complete-bracelet reports vary between 135 g and 139 g with bracelet
sizing, while the exact spring-bar fitment guide lacks manufacturer-side
corroboration of the factory bracelet mechanism. TUDOR therefore remains
research-only for weight and attachment.

Vostok 420059 likewise moved from three gaps to two after independent
exact-reference dealer records agreed on an approximately 128 g steel-bracelet
configuration. Its only exact-reference lume-performance account is
uncontrolled and production-undated, and dealer evidence that replacement 420
cases use spring bars does not satisfy the manufacturer-service corroboration
rule for the factory bracelet. Lume and attachment remain open.

Marathon WW194003BK-0108 then became the third `ready_for_migration` review.
The exact current product and specification sheet establish the configured
offer and physical facts; TMI's NH35A technical guide supplies the exact
movement's published -20/+40 seconds-per-day static bound; and an
exact-configuration dealer record supplies 45 g full weight. Marathon's
full-night tritium description supports `strong` lume under the catalogue's
self-powered-light policy. Its one-piece DEFSTAN strap, fixed-bar owner record,
and manufacturer spring-bar service path map the non-user-removable interface
to the existing `proprietary` attachment class rather than ordinary
`spring_bar`.

Generated migration `0012_expand_catalogue_marathon.sql` is replay-safe and
adds only that reviewed row after migrations `0010` and `0011`. The local seed
at that checkpoint had 15 variants and covered 280/28,800 cells (0.97%): 276
were single-candidate, all 280 were under-diversified, and 184 contained an
under-evidenced candidate. Strict research reported 15 accepted targets, 16
active targets, and 21 reviews: three `ready_for_migration`, 16
`needs_more_evidence`, and two `excluded`.

Casio G-SHOCK G-5600UE-1 then became the fourth `ready_for_migration` review.
The exact official product and module 3496 guide establish its solar movement,
fit, 51 g weight, 200 m rating, functions, rate, and full-auto white LED Super
Illuminator. The latter maps to `strong` nighttime illumination without claiming
photoluminescent paint. A current exact U.S. StockX buy-now offer supplies a
supported secondary-market snapshot, while the exact configured 16 mm listing
and genuine Casio band/spring-rod component chain establish a standard
`spring_bar` interface.

The migration renderer now includes `shockResistant` in field evidence and
derives `retail`, `grey_market_ask`, or `secondary_ask` from the accepted price
channel instead of labeling every snapshot retail. Generated migration
`0013_expand_catalogue_casio.sql` is replay-safe and adds only Casio after
`0012`. At that checkpoint the local seed had 16 variants and covered
408/28,800 cells (1.42%):
404 are single-candidate, all 408 are under-diversified, and 184 contain an
under-evidenced candidate. Strict research reported 16 accepted targets, 15
active targets, and 21 reviews: four `ready_for_migration`, 15
`needs_more_evidence`, and two `excluded`. Live Supabase remained at 12 rows;
at that checkpoint migrations `0010` through `0013` were pending.

A follow-up exact-reference Omega pass resolved only the accuracy gap for
Speedmaster 310.30.42.50.01.001. Omega's certification page explicitly includes
that reference and states the Master Chronometer daily-average limit of 0/+5
seconds; a five-year exact-reference review independently reports +4 and +2
seconds per day in two measured positions. The row remains research-only:
luminescent material alone is not a performance grade, specialist strap fitment
does not manufacturer-corroborate the factory bracelet mechanism, and omission
from a complication list is not explicit no-date evidence.

Seiko Presage HCC004J1 then became the fifth `ready_for_migration` review. The
exact official Singapore boutique page explicitly reports `Lumibrite: N/A`,
Seiko's corporate directory authenticates the page operator as its Singapore
distributor, and an independent exact-reference hands-on review reports that
the watch lacks luminous paint. The conflicting Netherlands rows are rejected
for this fact because that same page visibly switches to unrelated Astron 5X53
GPS Solar, titanium-case, and titanium-bracelet copy. This resolves
`lumeGrade: none` without hiding the conflict.

Generated migration `0014_expand_catalogue_seiko.sql` is replay-safe and adds
only HCC004J1 after `0013`. The reviewed local seed now has 15 brands and 17
variants and covers 448/28,800 cells (1.56%): 444 are single-candidate, all 448
are under-diversified, and 224 contain an under-evidenced candidate. Strict
research reports 17 accepted targets, 14 active targets, and 21 reviews: five
`ready_for_migration`, 14 `needs_more_evidence`, and two `excluded`. Live
Supabase remains at 12 rows, so migrations `0010` through `0014` and the bundled
seed remain unpushed until they are applied in order and 17-row SQL parity
passes.

A subsequent exact-model Citizen service lookup resolved BM8180-03E's factory
attachment: Citizen Watch Group's official parts system lists a dedicated
`Spring Bar` replacement, part 509-2074, alongside the exact watch's band. The
row remains research-only with one M1 gap because its exact-reference lume
accounts still conflict and no controlled repeatable performance grade has
been found.

An exact-reference follow-up resolved TUDOR M79000N-0001's normalized
full-length bracelet weight at 139 g. Independent new and unworn/full-set dealer
records converge on that value with approximately 19.5-21 cm of bracelet; the
lower 135 g owner measurement is explicitly from a sized bracelet and is not
used for the full configuration. TUDOR remains research-only with
`attachmentType` as its only M1 gap: the exact specialist fitment guide names
spring bars, but TUDOR's product and service material does not identify the
factory mechanism.

A Swatch SO28N100 source-led pass resolved seven of its ten original M1 gaps.
The exact official embedded payload supplies 34 mm diameter, 8.75 mm thickness,
and 39.2 mm lug-to-lug. A current exact Swiss official-retailer offer supplies a
CHF 70 new-watch price with two-to-four-week delivery. The exact original
ASO28N100 replacement strap supplies a 17 mm, non-straight steel-pin mount, and
Swatch's official strap guide corroborates its push-out connector-pin mechanism;
the catalogue therefore maps the interface to `proprietary`, not `spring_bar`.
Two exact-reference specifications explicitly report no date. SO28N100 remains
research-only for three fields: conflicting 18 g and 22 g full-watch records,
no published exact-applicable numerical quartz tolerance, and no explicit
repeatable lume grade.

An Omega 310.30.42.50.01.001 follow-up recovered both exact official sources
that had previously been inaccessible. The current product page now exposes a
$7,800 U.S. InStock offer, while the exact product sheet validates 42 x 13.54 x
47.5 mm geometry, 20 mm lug width, approximately 134 g total weight, manual
calibre 3861, 50-hour reserve, 50 m water resistance, Hesalite crystal, comfort
setting, and chronograph function. Two independent exact-reference
specifications explicitly report no date display. Omega remains research-only
for `lumeGrade` and `attachmentType`: presence of luminous material is not a
repeatable performance grade, and third-party fitment does not establish the
factory bracelet interface without manufacturer corroboration.

A Bulova 98B316 exact-reference dimensional pass resolved lug-to-lug at 54.5
mm. Two independent records publish a 17.5 x 46.5 x 54.5 mm dimensional set,
and a separate specialist reports 54.6 mm case length, consistent after normal
rounding. The row remains research-only for full weight, lume grade, and
attachment type. Weight records vary from approximately 270 g after bracelet
sizing to 274 g and 276 g; exact hands-on lume accounts disagree on nighttime
usability; and the original bracelet's dealer-described spring-pin mount still
lacks manufacturer corroboration.

A Blancpain Fifty Fathoms Tech 5019A 12B30 94A geometry follow-up resolved
lug-to-lug at 47 mm. Blancpain's exact dossier establishes its 47 mm diameter
and central-lug construction, and an exact-reference hands-on specification
explicitly reports that this architecture makes the across-wrist span equal to
the diameter. The row remains research-only for conventional lug width, full
configured weight, and numerical rate tolerance.

A Vostok Amphibia 420059 follow-up resolved `lumeGrade: weak`. Two independent
exact-reference reviews report sparse application, difficult low-light reading,
and fast fade; independent verified-purchase and long-term exact-reference owner
accounts corroborate poor performance. The supplied-bracelet attachment remains
open because the retailer's pins answer is ambiguous between bracelet links and
case attachment, and replacement 420-case spring bars do not satisfy the
manufacturer-service corroboration rule.

## Job idempotency and retention

Each research attempt receives a UUID and a SHA-256 request fingerprint over
the target ID, provider/preset, normalized request, and contract version.
Retries increment `attempt`; they do not overwrite an earlier raw artifact.
The same successful fingerprint may be reused rather than billed twice.
The worker defaults to one active provider request, honors `Retry-After`, and
caps retry waits at 60 seconds; higher concurrency remains an explicit CLI
choice.

Job states are `queued -> running -> succeeded|failed`. A succeeded job records:

- provider and model/preset;
- queued, started, and completed timestamps;
- immutable raw and normalized artifact paths;
- every discovered source URL;
- null error state.

A failed job retains its error and any raw response. Resumption creates a new
globally incremented attempt with the same fingerprint unless the request
contract changes. A successful extraction moves the manifest target to
`needs_review`; reuse repairs that transition if a prior process stopped after
writing the successful job.

Raw and normalized artifacts live under the ignored paths documented in
`data/research/README.md`. This prevents paid output, large captures, or
copyrighted excerpts from leaking into git while retaining local auditability.
Reviewed decisions may be committed when they contain structured facts and
source links rather than copied source text.

## Source and acceptance policy

Research order for a reference variant:

1. official product page, technical sheet, and manual;
2. official service/ownership material for brand-level claims;
3. central bank for FX;
4. reviewed market source only for market facts the manufacturer cannot
   establish;
5. independently tested, exact-reference specialist evidence for a physical
   interface fact only when manufacturer product and service material
   corroborate the mechanism and the source is retained as secondary rather
   than relabeled as primary.

Manufacturer absence is not evidence of a negative. Missing weight,
lug-to-lug, service geography, availability, or market ratios remains `null`.
Retail price from one country cannot establish another purchase market.

Before a provisional fact becomes accepted, review verifies:

- the URL supports the exact value and variant/material/size;
- units and condition/channel/country are explicit;
- observed/retrieved timestamps and the field-specific expiry are present;
- the target row is homogeneous;
- value hash and source relationship are reproducible;
- conflicts are retained and resolved, not overwritten silently.

Acceptance is an additive migration followed by:

```bash
npm run project:seed-coverage
npm run render:seed-migration -- db/migrations/00NN_expand_catalogue.sql --only=<variant-id>
npm run audit:research
npm run audit:coverage
npm run audit:catalogue-parity
npm run check
```

The live RPC remains fail-closed if a newly accepted row cannot satisfy the
strict catalogue shape or exact SQL hard-filter coverage contract.

## Batch policy

Research and accept small batches organized around one coverage problem, not
one prestige tier. The first planned batch is:

1. compact formal quartz;
2. compact solar field/high-function tool;
3. ultralight low-cost time-only;
4. compact mechanical GMT alternatives;
5. affordable small-wrist mechanical alternatives.

After each batch, compare the number of newly covered cells, complete M1 cells,
and distinct brands in eligible top-three sets. A reference that adds no useful
coverage may still enter as reviewed context, but it does not displace a P0
research job merely to raise the brand count.
