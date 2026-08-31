# Coverage-first research pipeline

Status: **Phase 5 contract active**
Last verified: **2026-08-31**

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
  research-only M0/M2 context alongside source-led additions through Bertucci;
- 27 accepted catalogue targets linked to all current reviewed variants in the
  local seed, including the newly rendered Vostok 420059 migration;
- 33 coverage-intent targets, with no planned target in the default research
  queue after the source-led Vostok 420059 acceptance;
- live Supabase parity for 22 brands and all 26 remotely applied variants
  across the six golden SQL/TypeScript hard-filter profiles; local migration
  `0031` adds the 23rd brand and 27th variant but awaits a credentialed parity
  run before remote application; all 20 public catalogue tables have RLS
  enabled and browser roles have no direct table grants;
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

A narrow 2026-08-30 Sinn pass subsequently locked 856 UTC to the homogeneous
WatchBuys SI-084 black-calf-leather configuration. The official North American
distributor publishes a new, in-stock USD 2,680 Add to Cart offer and 47.5 mm
lug-to-lug. Sinn's official exact-series manual explicitly identifies case
spring bars, so `attachmentType: spring_bar` is accepted without inferring from
the selected strap. Full configured weight remains unresolved because 70 g is
head-only. Exact-SKU owner rates lack a common protocol or factory guarantee,
and one timed eight-hour lume report lacks independent timed corroboration.
Those three fields remain null.

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

A narrow 2026-08-30 Baltic follow-up subsequently locked the row to MR Classic
Blue product 6584366596167 and Stitched Lion variant 39484285321287 from
Baltic's public Storefront payload. The exact variant publishes EUR 545,
available-for-sale state, and 2026-08-31 fulfillment; an authorized Baltic
representative independently maps it to MR01BLUS35. Baltic's exact Stitched Lion
page explicitly documents a tool-free quick-release spring bar. Identity,
price, and attachment are therefore resolved without mixing the alternative
bracelet or straps. Exact configured weight, exact-applicable rate, lume/no-lume
evidence, and explicit date status remain null.

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

A 2026-08-30 Perplexity-assisted follow-up found an exact-reference specialist
retailer publishing -10/+25 seconds per day. The page gives no measurement
method, source attribution, serial-specific result, or manufacturer guarantee,
and its upper bound differs from Certina's approximate +30 guidance for most
non-chronometers. Certina's official FAQ states that mechanical accuracy varies
and mentions only undisclosed internal tolerances. The three numerical accuracy
fields therefore remain null rather than accepting an unattributed retailer
specification.

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
repeatable lume grade. Swatch's public exact-reference Shopper Products response
also exposes `c_weight = 64`, but gives neither a unit nor a watch-only
configuration. The review records that primary value without mapping it to
`weightFullG`; it cannot resolve explicit full-watch evidence that already
conflicts.

A 2026-08-30 Perplexity-assisted pass revisited only those three gaps. The
official standard manual covers operation and time setting without publishing
an SO28N100 rate tolerance; an exact retailer route offers only qualitative
precision language. No discovered source defines the unit or configuration of
`c_weight = 64`, resolves 18 g versus 22 g, or states a repeatable lume grade or
explicit absence. The review therefore preserves all three nulls.

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

A 2026-08-30 Perplexity-assisted follow-up found exact-reference owner evidence
that the factory bracelet was installed with spring bars and a third-party forum
statement from an Omega-certified watchmaker identifying 068ST2207 as the 3861
bracelet-to-case spring bar. Those sources converge but remain secondary; no
public Omega product or service document corroborates the mechanism. Separate
exact-reference material confirms Super-LumiNova presence without a controlled
charge or elapsed-time performance result. Attachment and lume therefore remain
fail-closed.

A Bulova 98B316 exact-reference dimensional pass resolved lug-to-lug at 54.5
mm. Two independent records publish a 17.5 x 46.5 x 54.5 mm dimensional set,
and a separate specialist reports 54.6 mm case length, consistent after normal
rounding. The row remains research-only for full weight, lume grade, and
attachment type. Weight records vary from approximately 270 g after bracelet
sizing to 274 g and 276 g; exact hands-on lume accounts disagree on nighttime
usability; and the original bracelet's dealer-described spring-pin mount still
lacks manufacturer corroboration.

A subsequent factory-parts pass resolved Bulova 98B316's attachment as
`spring_bar`. Citizen Watch Group's exact-model service lookup identifies Icon
98B316 and lists `Band` and `Spring Bar` as separate replacement entries. This
is direct factory-interface evidence rather than an inference from bracelet
material or a generic strap guide. The row remains research-only for two M1
fields: full configured weight and repeatable lume performance.

A 2026-08-30 Perplexity-assisted follow-up found additional exact-reference
weight fields at 170 g and approximately 400 g, widening the existing 270-276 g
range. None documents a full factory-length bracelet and bare-watch weighing
method. Bulova's exact official page also contains a verified-buyer complaint
about short glow duration, but no controlled charge or elapsed-time observation;
another exact account still describes usable lume. Both fields remain null.

A Blancpain Fifty Fathoms Tech 5019A 12B30 94A geometry follow-up resolved
lug-to-lug at 47 mm. Blancpain's exact dossier establishes its 47 mm diameter
and central-lug construction, and an exact-reference hands-on specification
explicitly reports that this architecture makes the across-wrist span equal to
the diameter. The exact manufacturer product page also publishes a dash for
width between horns, and the dossier documents the proprietary central-lug
construction. Under the explicit applicability contract this is reviewed
`fieldApplicability.lugWidthMm: not_applicable`, not a coerced measurement or an
unknown null. An active conventional-width request now returns the same hard
incompatibility in TypeScript and SQL. The row remains research-only for full
configured weight and numerical rate tolerance.

A narrow 2026-08-30 Perplexity-assisted recheck found no qualifying evidence
for either Blancpain gap. The exact orange-rubber and pin-buckle product page
and June 2026 dossier contain no full assembled-watch mass, and no
exact-reference packaging-free scale protocol was located. They also contain no
numerical 13P5A rate bound, service tolerance, certification result, or
documented exact-reference rate test. The published 4 Hz frequency is not
accuracy, so both fields remain null without importing generic COSC or related
calibre performance.

A Vostok Amphibia 420059 follow-up resolved `lumeGrade: weak`. Two independent
exact-reference reviews report sparse application, difficult low-light reading,
and fast fade; independent verified-purchase and long-term exact-reference owner
accounts corroborate poor performance. The supplied-bracelet attachment remains
open because the retailer's pins answer is ambiguous between bracelet links and
case attachment, and replacement 420-case spring bars do not satisfy the
manufacturer-service corroboration rule.

A later primary-source pass recovered Vostok's exact factory page for
2416/420059. It publishes 39.6 x 46 x 15 mm dimensions, 128 g full configured
weight, 18 mm bracelet width, calibre 2416B, -20/+60 seconds per day, at least
31 hours of reserve, 200 m water resistance, organic crystal, date, and the
lume application locations. The review now uses the official page as
`productUrl`, replaces the retailer-rounded 39 mm diameter with 39.6 mm, and
promotes the 128 g evidence from corroborated secondary to primary. It still
does not identify the bracelet-to-case mechanism, so the row remains
research-only with `attachmentType` as its sole M1 gap.

A 2026-08-30 Perplexity-assisted attachment follow-up found the exact official
factory-shop page and the official case-420 category. They confirm the exact
2416.00/420059 identity, case family, and supplied stainless-steel bracelet but
publish no lug, bar, pin, screw, proprietary connector, integrated interface,
or quick-release specification. The stronger primary sources therefore retain
the gap rather than convert dealer replacement-case evidence into a factory
interface fact.

A second narrow attachment pass found Meranom's Vostok-branded 18 mm by 2 mm
spring-bar listing and its explicit answer that the part fits Amphibia case
420. Direct retrieval validates that statement, but the factory-adjacent
retailer still does not identify the factory-installed bracelet on exact
420059. A separate universal-bracelet page offers case-420 end links, shows the
replacement on 420059, and supplies new spring bars while explicitly
distinguishing that bracelet from the factory item. The evidence proves case
compatibility, not the original configured connector; `attachmentType` remains
null.

A Cartier Tank Must WSTA0107 follow-up resolved the earlier blocked-source and
geometry failures. The exact official page is independently retrievable in
Malaysia and supplies 29.5 x 22 x 6.6 mm rectangular geometry, High Autonomy
quartz, an interchangeable steel bracelet, 30 m resistance, and hours/minutes
only. A current exact Tourneau/Bucherer offer supplies the supported $4,100 U.S.
new-watch path; exact secondary records resolve 16 mm width, Cartier QuickSwitch,
and approximately 79.3 g at the maximum 170 mm bracelet configuration.
Migration `0015` prepares `case_width_mm` and `case_length_mm`; no Cartier row is
accepted. Numerical exact-applicable accuracy and repeatable lume remain open.

The accepted Jaeger-LeCoultre Reverso Tribute Duoface Small Seconds Q3988481
was then audited against its exact manufacturer page. Jaeger-LeCoultre labels
the case `Dimensions (L x W): 47 x 28.3 mm` and explicitly defines L as
lug-to-lug. The local seed therefore stores 47 mm length, 28.3 mm width, no
synthetic diameter, and the separately evidenced 47 mm lug-to-lug. Migration
`0016` applies that correction after `0015`, replaces the field evidence, and
versions both read RPCs so SQL and TypeScript share the same verified
non-round wearing-span fallback.

TUDOR Black Bay 54 M79000N-0001 then became the sixth migration-ready review.
Page 6 of TUDOR's exact ten-page press dossier explicitly identifies the
spring-bar holes passing through the lugs, while the exact-reference fitment
guide independently identifies the corresponding standard spring bars. This
resolves the last M1 gap without inferring an interface from bracelet material.
Migration `0017` adds only that steel-bracelet reference after `0016`; the
reviewed local seed now has 16 brands and 18 variants and covers 496/28,800
cells (1.72%), with 492 single-candidate, 496 under-diversified, and 224
under-evidenced cells. Its PLN snapshot also exposed a coverage bug: source
prices are now converted through the dated EUR base before band derivation, so
the watch maps to `2000_5000` and the currently empty `15000_plus` band is no
longer falsely populated by a unit mismatch.

Migration `0018_add_field_applicability.sql` follows `0017`. It adds an
`observed|not_applicable` value state to field evidence and v3 read contracts;
existing evidence defaults to `observed`, so no historical null is silently
reclassified. The seed renderer updates only exact verified evidence rows for
future accepted non-applicable facts. Blancpain remains outside the seed until
its two remaining M1 gaps—full configured weight and numerical accuracy—are
resolved.

A later exact-reference Cartier WSTA0107 pass resolved `lumeGrade: none`.
MAIER's exact technical sheet explicitly says the hands have no Super-LumiNova,
and the independent exact-reference Chronospex record classifies overall
luminescence as none. Cartier's exact page independently identifies plain
blued-steel hands and a silvered printed dial. The review therefore does not
infer absence merely from omitted manufacturer feature prose. Numerical
exact-applicable quartz accuracy remains the sole M1 gap, so Cartier stays
research-only and no seed or migration row is added.

A 2026-08-30 Perplexity-assisted follow-up searched specifically for an exact
numerical Cartier tolerance. It surfaced a blocked exact regional product route
reported to identify the High Autonomy quartz configuration and calibre 157;
Cartier's independently retrievable movement overview documents approximately
eight years of autonomy. Neither supplies a lower/upper rate bound with a
defined period. A third-party calibre record also lacks a numerical tolerance
and cannot prove exact WSTA0107 applicability. The accuracy gap is therefore
explicitly retained rather than filled with a generic quartz assumption.

The same narrow pass explicitly retained several other gaps instead of forcing
closure: Certina's exact-linked general mechanical manual describes only what
“most” non-chronometers average, Vostok's factory pages do not identify the
bracelet-to-case fastener, conflicting Citizen BM8180-03E observations do not
establish repeatable lume performance, and Omega's exact manual does not name
the factory bracelet interface. These records remain fail-closed.

A 2026-08-30 Perplexity-assisted source-discovery pass revisited Citizen's sole
remaining gap without changing that decision. An exact-reference owner report
separates the hands from the numerals, but the exact-SKU Zappos review corpus
still ranges from all-night visibility to near-impossible dark reading. The
reports provide no controlled charge protocol, timed decay series, or shared
comparison standard, so they are retained as conflict evidence rather than
normalized into a categorical lume grade. Citizen remains research-only.

An Audemars Piguet 16202ST.OO.1240ST.02 applicability pass then resolved
conventional `lugWidthMm` as physically `not_applicable`. AP's own Heritage
record explicitly includes the Royal Oak 16202 in the documented case lineage
and explains that its case extensions constitute both the lugs and the first
bracelet link. This is affirmative manufacturer evidence for the integrated
interface, not an inference from the exact product page's missing width. Price,
lug-to-lug, full configured weight, numerical accuracy, and graded lume remain
open, so the reference stays research-only.

The same AP pass recovered the public endpoint used by the exact U.S. product
page. It returns USD 40,100 and identifies the U.S. market, so those three price
fragments are reviewed as primary exact-reference facts. The response contains
no purchase availability or sales-channel context. The complete commercial
price gate therefore remains open rather than treating a displayed manufacturer
amount as an orderable offer.

A narrow 2026-08-30 Perplexity-assisted pass then tested all five AP gaps under
strict suffix control. A February 2026 exact-reference tariff record
corroborates the USD 40,100 suggested U.S. retail figure but supplies no AP or
authorized-dealer availability, allocation, or transaction channel. The only
numerical case span, approximately 130 g weight, and +2.5 seconds-per-day
observation found belong to anniversary reference `.01`; the weight also lacks
a full-link scale method. The exact `.02` page establishes lume presence only,
not a controlled performance grade. No field is promoted from sibling or
generic 16202/caliber 7121 evidence.

With the ranked queue empty, a new Vaer target was explicitly added for 48
empty affordable-precision cells before provider work began. The first
Perplexity job selected exact S3 Calendar Field variant 41255028424838; direct
review corrected its reference to SKU `S3-CF-SIL20BLK-NY20KHA` and recovered
the live page's USD 189 in-stock offer, 36 x 8.4 x 43 mm geometry, 20 mm lugs,
GM12 -10/+20 seconds-per-month tolerance, 100 m rating, screw-down crown,
sapphire, quick-release straps, date, and 6/10 lume-performance rating. The
6/10 exact performance statement maps to `moderate`. Vaer's 46 g figure is
explicitly case-only, while Shopify's unexplained product/accessory weight
fields and an exactness-uncertain head-only report cannot establish the black
silicone configured mass. The row remains research-only with `weightFullG` as
its sole M1 gap. The ignored ledger now retains 38 attempts (22 succeeded, 16
failed) across 22 target IDs with USD 0.29610 recorded provider cost. The
strict manifest has 22 reviews: six migration-ready, 14 needing more evidence,
and two excluded; 18 targets are accepted and 14 remain active.

The next explicit Nodus target exposed a contract defect before source review:
one provider response failed the target-ID guard, while its retry claimed an
exact Sector Deep yet returned zero claims and zero unresolved fields with
placeholder reasoning embedded in `referenceCode`. Contract v5 now caps
candidate-identity components at 160 single-line characters and requires every
`exactVariantFound: true` result to carry resolved `identity` and `productUrl`
claims. The invalid v4 artifact remains in the ignored immutable ledger, the
target returned to `planned`, and its new fingerprint must pass v5 before it can
move to review.

The v5 rerun initially exhausted three retries on independently rejected
target-ID and resolved/unresolved-field contradictions. Retry prompts now carry
the prior validation error and require a final exact-ID and field-partition
check, so a retry corrects the observed defect instead of repeating an
identical request. The next fingerprint produced a valid 40-fact extraction
for Nodus Sector II Field Titanium Shale. Direct retrieval corrected identity
to embedded manufacturer SKU `SEC-F-SHA` and validated USD 625 US pricing,
current but unavailable state, 38 x 11.7 x 47 mm geometry, 20 mm lugs, 100 g on
the full unsized titanium bracelet, Nodus-regulated -10/+10 seconds per day,
100 m resistance, sapphire, and quick-release spring bars. A narrow Perplexity
follow-up found two exact-model reports explicitly establishing the dedicated
no-date NH38 configuration. Both describe fast initial lume charging, but
neither supplies controlled charge, timed decay, or a repeatable comparison
grade; `lumeGrade` remains the sole M1 gap and no seed row is added.

The next coverage hypothesis is exact Rado HyperChrome Quartz `R32280109` on
black rubber. Rado's current regional product pages already expose 87 g full
weight, 41.5 x 11.7 mm case geometry, calibre R292 PreciDrive/HeavyDrive at
no more than +/-10 seconds per year, 150 m resistance, sapphire, date, and
explicit dual-colour nighttime readability. A current exact-reference record
reports a conservative 47.7 mm wearing span. If independent review also proves
that span and the factory strap-to-case interface without merging an older
specification, the row projects into 72 currently empty `1000_2000`,
zero-maintenance, simple-date cells and adds a new brand to every one. The
target remains only a research hypothesis until provider and direct source
review pass all M1 gates.

The first Rado job returned a valid 29-fact exact-reference extraction. Direct
review selected Rado's localized U.S. page rather than the provider's transient
Swiss locale: exact `R32280109` is a USD 1,400 Add to Cart offer with 41.5 x
11.7 mm geometry, 87 g configured weight, R292 PreciDrive/HeavyDrive at
-10/+10 seconds per year, 150 m resistance, sapphire, and date. The page's
dual-colour Super-LumiNova description establishes material and immediate
night readability, not a timed performance grade; its pin buckle identifies
the wrist closure, not the strap-to-case fastener. A narrow Perplexity pass
found no exact Rado service record for that interface. The only 47.7 mm span
and 20/21 mm width records share an older conflicting 41 x 12.2 mm, 89.6 g,
100 m specification set, so they are rejected rather than blended into the
current row. Lug-to-lug, lug width, lume grade, and attachment type remain the
four M1 gaps. The ignored ledger now retains 45 attempts (25 succeeded, 20
failed) across 24 target IDs with USD 0.31920 recorded provider cost. The
strict manifest has 24 reviews: six migration-ready, 16 needing more evidence,
and two excluded; 18 targets are accepted and 16 remain active.

The next explicit coverage hypothesis is Vostok Europe Nuclear Submarine
`VK61-571H614`, fixed to its titanium case and black silicone strap. The
manufacturer's archived exact-reference page and 2024 catalogue jointly expose
45.7 x 15.6 x 56.2 mm geometry, 22 mm lugs, VK61 accuracy of +/-20 seconds per
month, 300 m resistance, chronograph, date, and continuous tritium illumination.
An exact-reference retailer measurement reports 134 g on silicone, while a live
official-distribution listing exposes EUR 793 and fulfillment within three
working days despite the manufacturer's sold-out archive state. The conservative
silicone row projects into 48 `500_1000`, zero-maintenance chronograph cells,
including 24 currently empty cells, and adds a new brand throughout. Provider
research must still reconcile availability wording, verify the configured mass,
and tie the coin/screwdriver change procedure to the exact proprietary
strap-to-case fastener before the row can become migration-ready.

The target was initially patched into Vacheron Constantin's empty target array;
source-review setup caught the ownership mismatch and moved it to Vostok Europe
before artifact admission. The first provider response then failed contract v5
by asserting an exact match without candidate identity. Its corrected retry
returned 43 facts but declined exact identity because the package includes two
straps. Direct review fixes the wearable row to black silicone while disclosing
the leather accessory. It rejects the provider's stale Helveti in-stock claim:
that exact page says the sale ended. A current Czech official-distribution page
instead supports EUR 793, Add to cart, and stock within three working days while
also saying momentarily unavailable, normalized conservatively to `short_wait`.
Primary evidence resolves 45.7 x 15.6 x 56.2 mm geometry, 22 mm lugs, 300 m,
chronograph, date, strong continuous tritium, and the manufacturer's wider
-20/+20 seconds-per-month VK61 contract. Exact screwdriver-or-coin replacement
plus Vostok Europe's current custom screw-fixed guide maps the interface to
`proprietary`; a narrow Perplexity follow-up's unverified two-TORX detail is
discarded. The same follow-up found no configuration-explicit mass: 100 g lacks
an installed-strap scope, another exact listing labels approximately 100 g as
main-body weight, and unmeasured retailer values span 134-136 g. `weightFullG`
remains the sole M1 gap. The ignored ledger retains 47 attempts (26 succeeded,
21 failed) across 25 target IDs with USD 0.33487 recorded provider cost. The
strict manifest now has 25 reviews: six migration-ready, 17 needing more
evidence, and two excluded; 18 targets are accepted and 17 remain active.

The next explicit coverage hypothesis is BOLDR Odyssey Horizon
`ODY-TI-40-H-BL`, fixed to its supplied integrated Druber strap while retaining
the bundled titanium bracelet only as an accessory. BOLDR's exact live Storefront
record exposes a USD 799 Add to cart offer and the manufacturer page publishes
40 x 13 x 48 mm geometry, a 20 mm nominal lug size, 91 g full Druber-strap
weight, Miyota 9075 flyer GMT, 300 m resistance, a screw-down crown, sapphire,
and an integrated strap. The selected configuration projects into 18
`500_1000`, workhorse-mechanical GMT cells and adds a new brand throughout.
Provider research must still prove the USD purchase market, exact date status,
9075 accuracy applicability, and a repeatable lume grade; Swiss Super-LumiNova
material alone does not satisfy the last field. No pre-screened fact is accepted
before source review.

The first BOLDR extraction returned 38 schema-valid provisional facts. Direct
review confirms the exact manufacturer SKU and Druber configuration but corrects
case thickness from the 12.5 mm body-only figure to 13 mm including the crystal.
BOLDR's own Odyssey launch release explicitly resolves the 4 o'clock date
window, and Miyota publishes the installed 9075's -10/+30 seconds-per-day
tolerance. The initial provider search found only luminous-material labels and
a generic collection-level strength claim, so the target is reset for one
narrow exact-reference performance pass rather than assigning a grade.

That narrow pass also returned schema-valid exact-identity output but explicitly
left `operation.lumeGrade` null: no controlled charge, timed decay, or convergent
independent Horizon assessment was found. Direct review retains the USD 799
US-context in-stock offer, 40 x 13 x 48 mm geometry, 20 mm nominal lug size,
91 g Druber configuration, Miyota 9075 -10/+30 seconds per day, 300 m rating,
sapphire, integrated attachment, GMT, and primary-source date window.
`lumeGrade` is the sole M1 gap, so BOLDR remains research-only. The ignored
ledger now retains 49 attempts (28 succeeded, 21 failed) across 26 target IDs
with USD 0.35916 recorded provider cost. The strict manifest has 26 reviews:
six migration-ready, 18 needing more evidence, and two excluded; 18 targets are
accepted and 18 remain active.

The next source-led hypothesis is Laco Augsburg 39 reference `861988` on its
fixed brown riveted calf-leather strap. Laco's live exact product route exposes
EUR 390 and two-to-three-day delivery plus 39 x 11.55 x 46.5 mm geometry,
18 mm lugs, 81.5 g including the strap, Miyota 82S0, 50 m resistance, and
sapphire. Miyota independently publishes the exact caliber's -20/+40
seconds-per-day contract, 42-hour reserve, and three-hand open-heart function
set without a calendar. The conservative hypothesis adds a new brand to 12
`300_500`, studio, workhorse-mechanical, time-only cells. Provider review must
still establish a repeatable C3 lume grade and the strap-to-case fastener;
luminous material and a riveted wrist closure alone prove neither.

The first Laco extraction returned 30 schema-valid provisional facts and only
two non-M1 or M1 unresolved fields. Laco's FAQ directly improves the installed
LACO 2S contract to its watchmaker-regulated 0/+25 seconds per day, while the
official LACO 2S manual identifies the leather-strap connector pins as spring
bars and documents a time-only function set. An active exact route with EUR 390,
available status, and two-to-three-day delivery supports current production as
a reviewed normalization. `lumeGrade` is now the only M1 uncertainty, so the
target is reset for one exact-reference performance-only pass.

The lume-only pass returned a second valid exact identity but explicitly left
the performance grade null after finding no qualifying source. Independent
retrieval also shows that the first job's purported product-linked LACO 2S
manual URL currently returns 404; its extracted spring-bar statement therefore
cannot pass source review. `lumeGrade` and `attachmentType` remain open. One
final fastener-only pass is queued for a retrievable exact manufacturer/service
record or exact physical inspection corroborated by Laco material; strap rivets
and buckle hardware remain out of scope.

The final attachment pass found Laco's current leather-watch-strap instructions,
which return a valid manufacturer PDF and explicitly require a spring-bar tool
and proper spring-bar installation. Combined with the exact article `861988`
page's identification of the configured strap as Laco calf leather, that closes
`attachmentType` as `spring_bar`; the decorative rivets remain strap construction,
not case fasteners. The first job's alleged LACO 2S PDF remains rejected because
its URL returns 404, while Miyota's live 82S0 function specification independently
supports no-calendar operation. Review retains exact identity, EUR 390 current
German availability, 81.5 g full weight, complete geometry, Laco's installed
0/+25 seconds-per-day regulation, sapphire, 50 m resistance, time-only operation,
and the corrected attachment. No exact controlled or convergent lume-performance
evidence was found, so `lumeGrade` is the sole M1 gap and Laco remains
research-only. The ignored ledger now retains 52 attempts (31 succeeded, 21
failed) across 27 target IDs with USD 0.40434 recorded provider cost. The strict
manifest has 27 reviews: six migration-ready, 19 needing more evidence, and two
excluded; 18 targets are accepted and 19 remain active.

The next explicit source-led target is LIP Churchill T18 reference `671937` on
its dark-blue crocodile-pattern leather strap. LIP's live exact product route
publishes an in-stock EUR 249 French offer, a 38.5 x 21.2 mm rectangular case,
18 mm interface, 27 g configured weight, Ronda 1064 at -10/+20 seconds per
month, 30 m resistance, sapphire, and hours/minutes plus small seconds without
a date. The conservative formal/studio, zero-maintenance hypothesis would add a
new brand across 80 currently empty `under_300` cells and deliberately excludes
field/water use. Exact-reference thickness, case-to-strap attachment, and
explicit no-lume evidence remain mandatory review gates; neither the pin buckle
nor silence about luminous material can satisfy them.

The first LIP worker run rejected one contradictory response, then returned 37
schema-valid provisional facts on attempt two. Direct retrieval confirms the
primary offer and specification set, but the result does not close the three
pre-screened gates. Its duplicate null `caseLengthMm` and numeric value placed
inside `fieldApplicability.lugWidthMm` require review correction. Horel's 8 mm
record describes an older conflicting 21 x 38 mm mineral-crystal/Arabic-dial
configuration, while another secondary record reports 8.5 mm; neither can be
merged into the current sapphire Roman-numeral row. Horel's interchangeable
strap language still omits the case fastener. Maier explicitly says the hands
have no Super-LumiNova, but the same record conflicts with LIP by specifying
mineral rather than sapphire crystal, so it does not independently close the
whole-watch no-lume gate. The target is reset for one narrow pass over current-
configuration thickness, attachment, and explicit hands-and-dial lume absence.
The ignored ledger now retains 54 attempts (32 succeeded, 22 failed) across 28
target IDs with USD 0.42046 recorded provider cost.

The narrow LIP pass rejected one more contradictory response, then resolved the
case attachment from a live exact-reference Masters in Time specification. That
source identifies the current blue leather, Ronda, sapphire, 18 mm configuration
and explicitly separates `Quick release pushpins` at the straight strap mount
from the buckle clasp, supporting `attachmentType: quick_release`. It does not
close the remaining gates: 8.5 mm is still a lone secondary thickness value,
while the conflicting Horel configuration reports 8 mm, and no source consistent
with LIP's current sapphire/ivory Roman-numeral row explicitly covers lume
absence across both hands and dial. Review validates the current EUR 249 French
offer, 21.2 x 38.5 mm non-round geometry, 18 mm lugs, 27 g configured weight,
Ronda 1064 at -10/+20 seconds per month, 30 m resistance, sapphire, quick release,
and no-date small seconds. `caseThicknessMm` and `lumeGrade` are the two M1 gaps,
so LIP remains research-only. The ignored ledger now retains 56 attempts (33
succeeded, 23 failed) across 28 target IDs with USD 0.43617 recorded provider
cost. The strict manifest has 28 reviews: six migration-ready, 20 needing more
evidence, and two excluded; 18 targets are accepted and 20 remain active.

The next explicit target is Marathon 34 mm Black General Purpose Quartz GPQ
SKU `WW194004BK-0808`, fixed to the selected black 16 mm Nylon DEFSTAN strap.
The live exact variant is available with inventory at USD 470 and identifies a
compact fibreshell, Swiss high-torque quartz, tritium, no-date configuration.
The source pattern is promising because the accepted mechanical GPM already
demonstrated retrievable Marathon specifications, movement-manufacturer rate
data, configured-mass corroboration, and fixed-bar service evidence. No value is
inherited: research must independently prove the GPQ's exact dimensions, full
strap-installed weight rather than Shopify shipping or head-only mass, installed
caliber and numerical rate, sapphire, pressure crown, fixed bars, and constant
tritium performance. If complete, the row would diversify 80 currently empty
`300_500`, zero-maintenance studio cells across all wrist and accuracy bands;
30 m resistance deliberately excludes field/water-abuse eligibility.

The first Marathon GPQ extraction returned 40 valid provisional facts but left
mutable commerce and four review gates unresolved. Direct primary retrieval
corrects that under-extraction. The selected variant payload identifies in-stock
SKU `WW194004BK-0808`, black Nylon DEFSTAN, USD 470, and positive inventory.
Marathon's current exact specification sheet independently names the same SKU
and strap plus ETA F06.105 HeavyDrive, 34 x 11.5 x 41 mm geometry, 16 mm lugs,
sapphire, pressure crown, 30 m resistance, no calendar, and tritium tubes on the
hour markers and hour/minute hands. None of those observations substitutes for
the remaining evidence: 133 g in Shopify is a shipping field, no full installed
weight has been validated, F06.105 still needs an authoritative numerical rate,
the GPQ bar mechanism must be tied to this family, and a bare tritium label does
not establish constant performance. One exact four-field pass is queued. The
ignored ledger now retains 57 attempts (34 succeeded, 23 failed) across 29
target IDs with USD 0.45449 recorded provider cost.

The four-field Marathon follow-up closes every M1 gate without using shipment
or sibling-reference data. ETA's current F06.105 sheet establishes a
-0.30/+0.50-second-per-day minimum/maximum range; the exact WW194004 GPQ
hands-on source reports approximately 44 g including its one-piece military
nylon strap and explicitly identifies fixed bars; Marathon's product-family
copy establishes full nighttime visibility and its service material supports a
serviceable fixed-bar mechanism. Those fixed bars normalize to `proprietary`
and the tritium performance to `strong`. The review is migration-ready. The
ignored ledger now retains 58 attempts (35 succeeded, 23 failed) across 29
target IDs with USD 0.46936 recorded provider cost.

The reviewed row is now accepted as catalogue variant
`marathon-ww194004bk-0808` through additive migration
`0021_expand_catalogue_marathon_gpq.sql`. Remote verification confirms the
exact variant, USD 470 price, in-stock snapshot, 23 reference-level evidence
rows, and complete M1 evaluation. Catalogue and SQL hard-filter parity passes
for all 19 accepted variants across the six golden profiles. The 30 m GPQ is
eligible only for `studio_desk_daily`; migration does not inherit the
mechanical sibling's field/water deployment tag.

The next source-led target is exact Seiko Prospex Solar Diver `SNE599P1` on
its all-black hard-coated `M13K113N0` bracelet. Primary pre-screen retrieved
2026-08-30 from the [official Seiko UK product page](https://www.seikoboutique.co.uk/product/seiko-prospex-solar-divers-in-all-black-sne599/)
and [manufacturer specification page](https://www.seikowatches.com/uk-en/products/prospex/sne599):
the exact SKU is orderable at GBP 530 and exposes 41 x 11.3 x 48.8 mm geometry,
20 mm lugs, 157 g configured mass, solar V157 at +/-15 seconds per month,
200 m diver resistance, sapphire, screw-down crown, explicit strong LumiBrite,
and a date display. An [exact original-bracelet listing](https://www.watchstraponline.com/Seiko-watch-strap-SNE599P1-HB-SK-M13K113N0/)
ties that factory part to spring bars. These are routing inputs, not accepted
facts: one bounded Perplexity job and independent source review must still
validate the homogeneous row. The planner ranks its 48 targeted `500_1000`
zero-maintenance field/studio cells as 48 empty, 48 under-diversified, and 48
under-evidenced. The manifest now has 19 accepted, 20 `needs_review`, two
excluded, and one planned target; the ignored provider ledger is unchanged at
58 attempts (35 succeeded, 23 failed) across 29 target IDs and USD 0.46936.

The bounded Seiko job succeeded on its first attempt with 33 provisional facts
and 14 unresolved non-blocking fields. Review corrects four material extraction
problems instead of laundering them into the seed: an unrelated or hijacked
bracelet URL is rejected, clasp semantics are not used as the case interface,
ten months normalizes to approximately 7,300 rather than 730 hours, and the
exact Austrian boutique's internally inconsistent `+/-0.5 seconds per day
(+/-10 seconds per month)` copy is retained as a conflict. The accepted rate is
the wider coherent exact UK manufacturer bound of -15/+15 seconds per 30 days.
Seiko UK's official store explicitly calls the LumiBrite strong and suitable
for professional diving standards; the exact original M13K113N0 listing
explicitly identifies spring-bar attachment. Review therefore closes every M1
gate.

Additive migration `0022_expand_catalogue_seiko_sne599p1.sql` accepts
`seiko-sne599p1`. Remote verification confirms GBP 530 in-stock commerce, the
complete reviewed physical and movement row, date, and 35 reference-level
evidence records. Catalogue and SQL hard-filter parity passes for all 20
variants and six golden profiles. Deterministic coverage rises by the planned
48 cells, from 576 to 624 of 28,800 (2.17%). The manifest now has 20 accepted,
20 `needs_review`, and two excluded targets; 30 reviews include eight
migration-ready decisions. The ignored provider ledger contains 59 attempts
(36 succeeded, 23 failed) across 30 target IDs and USD 0.48496 recorded cost.

The next source-led target is exact Brew Metric Titanium Chronograph
`MTRC-TITAN` on its supplied titanium bracelet. Primary pre-screen retrieved
2026-08-30 from the [official product page](https://www.brew-watches.com/products/metric-titanium):
the live route exposes USD 495 and Add to Cart, 36 x 41.5 x 10.75 mm geometry,
19.85 mm nominal lug width, 89 g full configured weight, titanium case and
bracelet, sapphire, 50 m resistance, and a VK68 meca-quartz chronograph. The
[manufacturer movement guide](https://www.timemodule.com/uploads/attachments/download/Technical%20Guide/VK68_TG.pdf)
specifies less than +/-20 seconds per month for VK68A. Brew's
[current bracelet instructions](https://www.brew-watches.com/blogs/design-timing-and-everyday-ritual/how-to-change-a-watch-strap-step-by-step-guide)
explicitly state that all Metric metal bracelets use quick-release spring bars.
An [exact-colorway report](https://www.hodinkee.com/articles/brew-watch-co-doubles-down-on-retro-with-the-super-metric-chronographs)
identifies Titanium among the Metric variants that omit a date window, while a
manufacturer-hosted exact-product verified-buyer review explicitly reports no
lume. A [current Japanese retailer record](https://www.neuve-a.net/shop/g/g4895239407708/)
maps that product identity to reference `MTRC-TITAN`.

No pre-screened value is accepted. One bounded Perplexity job must independently
validate the exact homogeneous row and retain conflicts without blending steel
Metric, Super Metric, other dial, or replacement-strap facts. The planned row
would open 60 currently empty `300_500`, zero-maintenance, studio chronograph
cells: all five representative wrist bands, all four supported accuracy
tolerances, and the three weight choices satisfied by 89 g. The manifest now
has one planned target; the ignored provider ledger is unchanged at 59 attempts
(36 succeeded, 23 failed) across 30 target IDs and USD 0.48496 recorded cost.

The bounded Brew extraction succeeded on its sole attempt with 49 provisional
facts and 19 unresolved fields. Independent review uses Brew's own live product
payload for SKU `MTRC-TITAN` and exact availability, rejecting the provider's
retailer dependency. It also rejects circular-diameter duplication for the
non-round TV case, visual integrated-bracelet inference, material-as-fastener
prose, and unnormalized commerce and complication values. The accepted geometry
is 36 mm width by 41.5 mm overall case length with no conventional lug-to-lug
claim; Brew's current instructions establish quick-release spring bars at the
published 19.85 mm interval. TMI's exact VK68A guide supplies
-20/+20 seconds per 30 days, exact-colorway reporting establishes no date, and
a manufacturer-hosted verified buyer plus a separate exact owner independently
report no lume. Review leaves no M1 gap.

Additive migration `0023_expand_catalogue_brew_metric_titanium.sql` accepts
`brew-metric-titanium-mtrc-titan`. A renderer correction makes database
completeness use verified overall case length when a non-round row has no
conventional lug-to-lug, matching the existing TypeScript and v3 SQL hard-filter
contract; `integratedBracelet` now also retains its own field evidence. The live
database reports M1 complete, no missing fields, 31 verified reference-level
evidence rows, and 21 accepted variants. Publishable-key catalogue and
hard-filter parity passes for all 21 variants and six golden profiles. Coverage
rises by exactly 60 previously empty cells to 684/28,800 (2.38%). Strict
research reports 21 accepted, 20 `needs_review`, and two excluded targets; 31
reviews include nine migration-ready decisions. The ignored provider ledger
contains 60 attempts (37 succeeded, 23 failed) across 31 target IDs and USD
0.49518 recorded cost. The default queue was empty again at acceptance.

The Mondaine checkpoint accepts exact Classic `A660.30314.11SBBV`, fixed to its
white no-date dial and supplied black vegan grape-leather strap. The first paid
response contains useful source discovery but fails strict normalization: one
null claim is not marked missing and `serviceCountries` appears in both resolved
and unresolved sets. The equals-style worker invocation also exposed that the
CLI understood only spaced options, so `--attempts=1` fell back to the default
three and a second request began before interruption. Its job record remains a
failure with no response or usage invented. The parser now supports both option
forms, and an exact dry run proves the one-attempt target selection without a
provider call.

Independent review revalidates every accepted field from exact sources rather
than accepting the malformed extraction. The [current manufacturer page](https://eu.mondaine.com/products/classic-36mm-edelstahl-poliert-gehausematerial-and-schwarz-vegan-trauben-leder-armband-a660-30314-11sbbv)
supplies EUR 239 availability, 36 mm diameter, 7.5 mm thickness, 18 mm lugs,
37 g configured weight, Ronda 513 RL, 30 m resistance, mineral crystal, and the
quick-change system. The [exact dimensional record](https://nanaple.com/en/products/a660-30314-11sbbv-quartz)
adds 43 mm overall length. The [official Ronda family record](https://www.ronda.ch/en/watch-movement-finder/caliber/515)
supports -10/+20 seconds per month; the exact SBB listing and [Helveti](https://www.helveti.eu/mondaine-classic-a660-30314-11sbbv)
independently establish no date and no luminescence. Review rejects generic
retailer Stop2go/backlight boilerplate because the same structured row conflicts
with Mondaine's exact 37 g mass. No M1 gap remains.

Additive migration `0024_expand_catalogue_mondaine_classic.sql` accepts
`mondaine-classic-a660-30314-11sbbv`. Remote verification reports M0 and M1
complete, 40 verified reference-level evidence rows from six sources, and 22
accepted variants across 18 brands. Publishable-key catalogue and SQL
hard-filter parity passes for all 22 variants and six golden profiles. Coverage
rises by the projected 160 cells to 844/28,800 (2.93%). Strict research reports
22 accepted, 20 `needs_review`, and two excluded targets; 32 reviews include ten
migration-ready decisions. The ignored provider ledger contains 62 attempts (37
succeeded, 25 failed) across 32 target IDs and USD 0.51546 recorded cost. The
default queue is empty; the next target must first pass a source-led exact M1
pre-screen before any provider request.

The next source-led checkpoint plans Bertucci A-2T Original Classic `12022`,
fixed to its black dial and supplied black B-TYPE nylon band. The [exact current
manufacturer page](https://bertucciwatches.com/Bertucci/A2TOC.html) and its
feature/dimension records retrieved 2026-08-30 provide USD 185, a 40 mm matte
titanium case, 49.5 mm overall length, 11 mm thickness, 22 mm integrated fixed
titanium bars, 62 g configured weight, Japanese all-metal quartz operation,
200 m resistance, screw-down crown and back, hardened mineral crystal, date,
and Swiss luminous hands and markers. A [current exact retailer](https://www.outlandusa.com/p/bertucci-mens-a-2t-original-classics-black-black-nylon)
shows `12022` in stock at the same USD 185. Bertucci's Japanese distributor
names Miyota GM10 or 2S60 as exact alternatives, and both official Miyota
records specify -20/+20 seconds per month.

The one bounded Perplexity attempt succeeded at USD 0.01755 with 23 provisional
facts and 26 unresolved fields. Review closes the image-published 49.5 mm span,
11 mm thickness, 22 mm interface, and 62 g mass directly from current Bertucci
assets; rejects stale exact-retailer 100 m and approximately 54 g values; and
keeps the GM10-or-2S60 scalar calibre and differing battery endurance `null`.
The common official Miyota -20/+20-seconds-per-month rate is accepted. Fixed
titanium retention bars normalize to `proprietary`, not integrated bracelet;
the printed 24-hour scale is not a complication; and exact hours-long
manufacturer lume performance maps conservatively to `moderate` without
inheriting Super Classic, solar, other-dial, or other-band evidence.

Migration `0025_expand_catalogue_bertucci_a2t.sql` accepts
`bertucci-a2t-original-classic-12022`. Remote verification reports M0/M1
complete, 42 verified reference-level evidence rows from seven sources, and 23
accepted variants across 19 brands. Publishable-key catalogue and SQL
hard-filter parity passes for all 23 variants and six golden profiles. Its
sourced 49.5 mm span narrows the accepted intent to the three wrist bands from
6.25 inches upward, so it adds exactly 96 cells and raises coverage to
940/28,800 (3.26%). Strict research reports 23 accepted, 20
`needs_review`, and two excluded targets; 33 reviews include eleven
migration-ready decisions. The ignored ledger contains 63 attempts (38
succeeded, 25 failed) across 33 target IDs and USD 0.53301 recorded cost. The
default queue is empty again; a new provider call requires a named homogeneous
candidate that first passes exact source-led M1 and coverage pre-screening.

The next source-led checkpoint plans Luminox Leatherback SEA Turtle
`XS.0307.WO`, fixed to its white dial and case on the supplied white 19 mm
silicone strap. The [exact current manufacturer page](https://ch.luminox.com/en/products/leatherback-sea-turtle-39-mm-outdoor-uhr-0307-wo)
publishes 48 g configured weight, 39 x 12 mm geometry, Ronda 515 quartz, 100 m
resistance, a protected double-gasket crown, hardened mineral crystal, date,
and 24/7 illumination for up to 25 years. A [current exact authorized Polish
offer](https://www.zegarki.zgora.pl/zegarek/24126_Luminox_Leatherback_Sea_Turtle_0300_Series_Whiteout_XS0307WO)
provides PLN 1,315 stock, 24-hour dispatch, and 46 mm lug-to-lug; an [exact
official dealer record](https://www.auer.lu/en/luminox-leatherback-sea-turtle-swiss-carbon-watch-with-date-xs-0307-wo.htm)
identifies pull-crown and pushpin interfaces. Ronda's official 515 record closes
the -10/+20-seconds-per-month rate.

The one bounded Perplexity attempt succeeded at USD 0.02134 with 33 provisional
facts and 16 unresolved fields. Independent review retains the exact white
`XS.0307.WO` configuration, accepts Luminox's configured 48 g manufacturer
value over the authorized retailer's conflicting 40 g row, and rejects black
0301, 44 mm Leatherback Giant, alternate-strap, and generic collection
inheritance. Exact-source constant 24/7 tritium visibility maps to `strong`
lume, while dealer-labelled pushpins and pull crown map to `spring_bar` and
`push_pull`; the unidirectional bezel is not a movement complication.

Migration `0026_expand_catalogue_luminox_leatherback.sql` accepts
`luminox-leatherback-xs-0307-wo`. Forward migration
`0027_repair_luminox_ronda_provenance.sql` preserves both legitimate Ronda 515
retrieval snapshots and repoints only the Luminox movement, accuracy, and date
evidence to the 2026-08-31 review snapshot. Remote verification reports M0/M1
complete, 28 verified reference-level evidence rows from four sources, and 24
accepted variants across 20 brands. Publishable-key catalogue and SQL
hard-filter parity passes for all 24 variants and six golden profiles. The row
opens exactly 128 `300_500`, zero-maintenance, simple-date field/studio cells
across four wrist bands and raises coverage to 1,068/28,800 (3.71%). Strict
research reports 24 accepted, 20 `needs_review`, and two excluded targets; 34
reviews include twelve migration-ready decisions. The ignored ledger contains
64 attempts (39 succeeded, 25 failed) across 34 target IDs and USD 0.55435
recorded cost. The default queue is empty again; another provider call requires
a named homogeneous candidate that first passes exact source-led M1 and
coverage pre-screening.

The subsequent provenance checkpoint makes source retrieval snapshots and
their exact field groupings parity-critical instead of comparing only a flat
field-name set. It found that the migration renderer had emitted only the first
source when two reviewed records corroborated one price. The renderer now
iterates every price and availability evidence group, and migration
`0028_repair_multi_source_price_evidence.sql` additively restores the omitted
Brew live-product-payload and Bertucci exact-retailer price evidence. The
stronger publishable-key audit passes for all 24 variants and six profiles.

A later source-led pass resolves Laco Augsburg 39 article `861988`'s sole
remaining M1 gap without invoking the provider. The existing exact product,
Laco FAQ, Miyota 82S0, and Laco strap-manual evidence already supplied the EUR
390 German offer, 39 x 11.55 x 46.5 mm geometry, 18 mm spring-bar interface,
81.5 g full configured weight, installed 0/+25-seconds-per-day regulation,
42-hour reserve, 50 m resistance, sapphire, and no-date operation. A [verified
July 2026 purchaser report](https://www.trustedshops.de/bewertung/info_XA22FF9B21733A0EAC7FC18702C984C3E.html)
retrieved 2026-08-31 identifies the current black Augsburg 39 with its simple
Miyota 82 movement and reports excellent legibility through morning. Laco's
dated public reply expressly concurs with the brightness and legibility
observation, supporting `strong` performance while leaving the original
C3-material-only normalization rejected.

Migration `0029_expand_catalogue_laco_augsburg.sql` accepts
`laco-augsburg-39-861988`. Remote verification reports M0/M1 complete, 23
verified reference-level evidence rows from five sources, 25 variants across
21 brands, and exact source-group plus six-profile hard-filter parity. The row
adds a second candidate to twelve `300_500`, studio, workhorse-mechanical,
time-only cells. Coverage therefore remains 1,068/28,800 (3.71%), while the
single-candidate count improves from 1,064 to 1,052. Strict research reports 25
accepted, 19 `needs_review`, two excluded, and thirteen migration-ready reviews.
No provider request was made, so the ledger remains 64 attempts (39 succeeded,
25 failed) across 34 target IDs and USD 0.55435 recorded cost. The default queue
is empty again.

A later source-led pass closes Vostok Europe Nuclear Submarine SSN 571
`VK61-571H614`'s sole full-mass gap without invoking the provider. The
[exact OTTO leather configuration](https://www.otto.de/p/vostok-europe-chronograph-nuclear-submarine-herrneuhr-vk61-571h614-lederband-46-mm-CS071P09T/),
retrieved 2026-08-31, explicitly fixes black leather with petrol stitching as
the installed strap, lists black silicone separately as an accessory, and
publishes approximately 135 g. This replaces the earlier silicone-worn
hypothesis rather than merging configurations. The ambiguous 100 g regional
field remains rejected, as do OTTO's contradictory sold-out and cart signals;
the reviewed EUR 793 Czech short-wait snapshot continues to control price and
availability.

Migration `0030_expand_catalogue_vostok_europe.sql` accepts
`vostok-europe-vk61-571h614`. Remote verification reports M0/M1 complete, 29
verified reference-level evidence rows from six sources, 26 variants across 22
brands, and exact source-group plus six-profile hard-filter parity. Its 56.2 mm
wearing span admits only the `7_5_plus` wrist representative, correcting the
three-band planning hypothesis. The row supports 16 cells, opens eight, and
adds a second candidate to eight. Coverage rises to 1,076/28,800 (3.74%);
single-candidate cells remain 1,052 and under-evidenced cells fall to 216.
Strict research reports 26 accepted, 18 `needs_review`, two excluded, and
fourteen migration-ready reviews. No provider request was made, so the ledger
remains 64 attempts (39 succeeded, 25 failed) across 34 target IDs and USD
0.55435 recorded cost. The default queue is empty again.

A 2026-08-31 source-led pre-screen adds one bounded planned target before any
new provider request: BABY-G `BGD-5650-1JF` in its black resin configuration.
Casio's exact primary record reports a 42.1 x 37.9 x 11.3 mm case, 31 g full
mass, Tough Solar/Multi Band 6 operation, 100 m resistance, mineral glass,
Super Illuminator, calendar and +/-15-seconds-per-month fallback accuracy. A
current new USD buy-now offer identifies the exact JF configuration. The 42.1
mm wearing span is below the 43.4 mm representative limit for the `under_5_75`
wrist band, so this targets currently empty affordable, zero-maintenance,
field/studio high-function cells rather than duplicating the accepted 46.7 mm
G-5600UE-1. The provider may run once only after the exact case-to-band
interface and commercial-source qualification are included in its bounded
evidence request; no pre-screened fact is accepted by this planning record.

The one-attempt BABY-G `BGD-5650-1JF` review is `needs_more_evidence`. Its
first provider attempt is retained as a strict-normalization failure, and the
one permitted retry produced a syntactically valid 40-fact provisional
extraction. Direct retrieval of both cited Casio product routes was blocked by
HTTP 403; the live exact Sakurawatches route corroborates reference identity
and official packaging/warranty metadata but did not expose the claimed price,
stock, dimensions, mass, or attachment specification in its retrievable HTML.
Most importantly, the extraction itself leaves the exact case-to-band interface
unresolved. A resin-band label cannot become an attachment enum, and Super
Illuminator is a feature label rather than a performance grade. No price,
technical field, or catalogue row is admitted. The ignored provider ledger is
now 66 attempts (40 succeeded, 26 failed) across 35 target IDs and USD 0.57417
recorded cost; the default queue is empty.

A 2026-08-31 source-led pre-screen adds one planned Swatch reference:
Skin White Classiness `SS08K102-S14`, fixed to its transparent biosourced case,
white silicone strap and transparent buckle. Swatch's current exact US and
Spain product routes identify $125/€120 offers and publish 34 mm, 4.3 mm,
quartz, 3 bar, biosourced case/glass and the supplied strap/buckle. The exact
MATY EAN listing reports 12 g configured mass; the exact Watch.co.uk record
reports 33.7 x 3.9 mm, SW-SF/ETA quartz, a 16.5 mm Swatch-style steel-pin
mount, and hours/minutes only. These sources target four empty under-$300,
under-6.25-inch, zero-maintenance, studio/formal, time-only cells. The planned
provider request must reconcile the dimensional discrepancy and validate
numerical accuracy, lume status, and the custom case-to-band interface; no
pre-screened fact is accepted by this planning record.

The one-attempt Swatch `SS08K102-S14` review is `needs_more_evidence`. The
provider produced 40 provisional facts at USD 0.01776. Current Swatch US and
Spain pages validate the exact white configuration and $125/€120 offers; exact
MATY, Watch.co.uk, and Zegarki.zgora.pl records corroborate 34 mm diameter,
38 mm wearing span, 12 g configured mass, quartz operation, 3 bar resistance,
biosourced materials, no-date hours/minutes display, and the custom Swatch
steel-pin attachment. The 3.9 mm secondary thickness is retained as a conflict
with Swatch's primary 4.3 mm value. No numerical rate bound or qualifying lume
grade was found, so no catalogue row is admitted. The ignored provider ledger
is now 67 attempts (41 succeeded, 26 failed) across 36 target IDs and USD
0.59193 recorded cost; the default queue is empty again.

A 2026-08-31 source-led pre-screen adds one bounded planned Citizen reference:
FORMA Eco-Drive `FRA36-2432` on its homogeneous stainless-steel bracelet.
Citizen Japan's exact product route reports the B023 light-powered movement,
plus or minus 15 seconds per month, approximately one year of reserve, 57 g,
18 x 6 mm case dimensions, crystal glass, and daily-life water resistance at
¥22,000, but currently marks the route out of stock. The exact Nanaple
authorized-retailer listing reports the same reference, approximately
27 x 18 x 6 mm geometry, 56 g, 3 atm, and a current reduced-price offer with
limited stock. The measured coverage planner scores this target at 670 and
identifies four under-diversified under-$300, sub-6.25-inch, zero-maintenance,
monthly-precision, time-only cells. The planned provider
request must reconcile the one-dimensional official case-size publication,
qualify current new-market availability, and establish the bracelet interface
without promoting the out-of-stock official snapshot; no pre-screened fact is
accepted by this planning record.

The bounded Citizen `FRA36-2432` pass remains `needs_more_evidence`. Both
Perplexity attempts failed strict normalization (first on contradictory
resolved/unresolved conditions, retry on contradictory availability), so the
raw responses remain ignored and immutable while this review uses independently
retrieved exact sources. Citizen Japan and Sakura Watches establish the exact
reference, B023 Eco-Drive, monthly ±15-second rate, one-year reserve, 18 x
6 mm published case, and a USD 102 new offer; Infinitown adds the 27 mm
rectangular length, 13 mm interface width, and 3 atm specification. Citizen's
57 g primary value supersedes the secondary 56 g claim. Sakura's simultaneous
Out of stock and Available 102 controls normalize availability to unknown.
Rectangular geometry is kept as length and width, while the exact Naturum
record maps the case-side bracelet connection to `spring_bar`; no source proves
a qualifying lume grade. No catalogue row is admitted. The ignored provider
ledger is now 69 attempts (41 succeeded, 28
failed) across 37 target IDs and USD 0.59193 recorded cost; the default queue is
empty again.

A source-led BABY-G follow-up then independently retrieved Casio Japan and
Europe's exact `BGD-5650-1JF` routes and Sakura's exact retailer page. The
official records establish 42.1 x 37.9 x 11.3 mm rectangular dimensions, 31 g,
resin case and band, Tough Solar/Multi Band 6, 100 m resistance, mineral glass,
shock resistance, the full calendar, alarms/world time, and the +/-15-seconds-
per-month fallback accuracy. Sakura supplies a USD 93 new exact-reference
offer, but its simultaneous Out of stock and Available 93 controls normalize
availability to unknown. Exact Minott and Uhr Casio replacement-band records
document the special pushpin/14 mm interface, mapped to `proprietary`; the
rectangular case is retained as width/length rather than a synthetic diameter.
Super Illuminator is an LED backlight rather than a qualifying lume grade, so
`lumeGrade` is now the sole M1 gap and no catalogue row is admitted. No provider
request was made; the ledger remains 69 attempts (41 succeeded, 28 failed)
across 37 target IDs and USD 0.59193 recorded cost, with the default queue
empty.

The next source-led coverage pre-screen revisits exact Rado HyperChrome Quartz
`R32280109`, the highest-value unresolved candidate at 72 projected empty
`1000_2000`, zero-maintenance, simple-date cells. Rado's current [U.S. product
route](https://www.rado.com/en_us/hyperchrome-r32280109.html) remains the
controlling source for 41.5 x 11.7 mm, 87 g, R292 +/-10-seconds-per-year,
150 m, sapphire, date, and Super-LumiNova material. A current [TheWatchAgency
record](https://www.thewatchagency.com/rado/hyperchrome/r32280109/1316534)
repeats the exact reference and 87 g but carries a stale 41 mm case row and no
interface measurement. The exact [T.H. Baker record](https://www.thbaker.co.uk/rado-mens-hyperchrome-black-rubber-strap-watch-r32280109)
exposes 20 mm lug width and authorized-retailer context, but its 41 mm and
older specification set cannot be merged with the current Rado row. Rado's
current page still names only the pin buckle (a wrist closure). Rado's official
[manual lookup](https://service.rado.com/manuals-and-catalogue) requires a serial
number to select a calibre manual and provides no exact R32280109 strap-service
record; its generic EasyClip guides therefore cannot be applied to this
reference. No exact service/parts source or controlled charge/decay observation
establishes the case fastener, wearing span, or lume grade. No fact is promoted
and no provider request is made; the next evidence attempt must remain narrowly
scoped to those four M1 gaps.

A 2026-08-31 source-led follow-up resolved the sole Vostok Amphibia 420059
`attachmentType` gap. The exact [factory reference](https://www.vostokinc.ru/catalog/amfibiya_muzhskaya/15/amfibiya_420059/)
continues to control the homogeneous 2416/420059 steel-bracelet row and its
18 mm interface width. An exact-reference [owner listing](https://www.reddit.com/r/Watchexchange/comments/1kspylc)
identifies the original bracelet with a missing spring bar, while the
Vostok-World24 [partner spare-parts record](https://vostok-world24.com/en/products/vostok-federstege-edelstahl-fur-russische-uhren)
names 2416/420059 as an applicable 420-case example for its 18 mm spring bars.
The two secondary records are retained as secondary provenance and converge
with the factory's exact bracelet configuration; no generic replacement
bracelet is substituted. `lumeGrade: weak` remains based on the earlier
independent exact-reference performance reports. Migration
`0031_expand_catalogue_vostok.sql` accepts the row with M0/M1 complete. The
row opens eight `under_300`, `field_water_abuse`, `workhorse_mechanical`,
`simple_date` cells across the four wrist bands and both `under_160_g` and
`no_limit` weight bands; coverage is now 1,084/28,800 (3.76%), with 1,060
single-candidate cells and 224 under-evidenced cells. No provider request was
made. The next source-led selection should target the highest-impact remaining
review gap only after an exact or directly applicable M1 path is identified.

The next ranked hypothesis is Cartier Tank Must Small `WSTA0107`: eight
projected `2000_5000`/`5000_10000`, `under_5_75`/`5_75_6_25`,
`formal_architectural`, `zero_maintenance`, `seconds_per_month`,
`under_80_g`/`under_120_g`, `time_only_no_date` cells remain empty and
under-evidenced. A 2026-08-31 official Spain-region [exact page](https://www.cartier.com/es-es/watches/collections/tank/reloj-tank-must-de-cartier-CRWSTA0107)
was reachable and independently corroborates the small High Autonomy quartz
steel-bracelet configuration, 29.5 x 22 x 6.6 mm dimensions, 3 bar rating, and
hours/minutes function. It adds no numerical rate tolerance or defined period;
Cartier's accessible exact-region pages and movement overview remain
insufficient for the accuracy contract. The candidate stays research-only and
no provider request is queued. A source-led exact-calibre search also found only
an unanswered monthly-accuracy owner query, so generic quartz performance is
not promoted. The next selection must continue to require an
exact or directly applicable path for every projected M1 gap.

A source-led BOLDR Odyssey Horizon `ODY-TI-40-H-BL` review then closed its sole
M1 gap. The exact BOLDR row remains homogeneous on the integrated Druber strap
at 91 g, with the bundled 125 g titanium bracelet retained only as accessory
context. Worn & Wound's exact sky-blue Horizon hands-on review records the lume
on the hands and indices still glowing until morning after overnight wear; this
direct elapsed observation maps to `strong` without inferring performance from
Swiss Super-LumiNova material labels. The reviewed target is now
`ready_for_migration`; local seed coverage rises to 1,102/28,800 cells (3.83%)
across 28 variants. Migration `0032_expand_catalogue_boldr.sql` is rendered but
not remotely applied because Supabase credentials are unavailable in this
workspace. No provider request was needed.

With BOLDR removed from the review queue, the coverage planner's next named
hypothesis is Cartier Tank Must Small `WSTA0107` at eight empty,
under-evidenced formal/small-wrist precision cells. Its exact-region source-led
pass still lacks a numerical quartz accuracy bound and period, so it remains
research-only and no provider request is authorized.

The next-ranked Sinn 856 UTC `SI-084` pre-screen also remains open. A used
Japanese listing reports 83.1 g total and a three-position ±10-second/day
timegrapher result, but its model is only `856`, its measured 39 x 39 x 10.6 mm
dimensions conflict with the current exact 40 x 11 mm sheet, and it does not
identify the current leather configuration. The mass and accuracy claims are
therefore rejected; no provider request is authorized.

The next Omega Speedmaster Moonwatch `310.30.42.50.01.001` source-led pass also
remains negative for both projected M1 gaps. An exact-reference mirrored Omega
manual documents the steel bracelet and comfort-adjustment clasp, but contains
no case-to-bracelet connector or spring-bar specification; it is retained as a
rejected lead rather than manufacturer service corroboration. A second
exact-reference review discusses the bracelet but supplies no controlled lume
charge/decay result or attachment mechanism. A 3861 owner lume discussion is a
sapphire sibling rather than the exact Hesalite reference and has no controlled
timed protocol. Existing exact-reference owner and Omega-certified-watchmaker
forum posts still cannot satisfy the manufacturer-corroboration rule for
`attachmentType`, while material-only Super-LumiNova mentions cannot establish
`lumeGrade`. Omega stays research-only and no provider request is authorized;
the next selection must continue to require an exact or directly applicable
path for every remaining M1 field.

The next coverage-led Citizen Garrison `BM8180-03E` pre-screen adds one more
exact-SKU owner discussion but does not close its sole `lumeGrade` gap. The
discussion reports lamp or sunlight charging, initial brightness fading within
minutes, and hands/numerals remaining legible overnight (with another owner
reporting eight-hour legibility), yet it supplies no controlled illuminance,
charge duration, or timed decay series. These observations join the existing
exact-reference reports that conflict from all-night visibility to near-
impossible dark reading. The factory interface remains accepted as
`spring_bar` from Citizen's exact-model parts lookup, but lume stays null and
no provider request is authorized.

The next ranked Certina DS Action Diver 38 mm Titanium `C048.807.44.051.01`
pre-screen also remains negative for its sole `accuracy` gap. An owner
discussion supplies a six-day positional series and other daily readings for
unnamed DS Action/Powermatic 80 divers, but mixes 38 mm, 40.5 mm, and PH1000M
models and never identifies the selected exact reference. Those observations
cannot establish a guaranteed exact-reference bound. Certina's exact page,
manual, and FAQ still provide only approximate or undisclosed general
tolerances; the unattributed exact-retailer claim remains conflicting and
untested. No fact is promoted and no provider request is authorized.

The next Baltic MR Classic Blue `MR01BLUS35` pre-screen remains negative for
configured `weightFullG`, `accuracy`, `lumeGrade`, and `dateStatus`. A blue MR01
hands-on article lists lume as N/A and notes no date window, but examines an
earlier ELA05MN sample rather than the current Stitched Lion configuration. A
Hodinkee specification says Lume: None for a black gold-PVD MR01 sibling; its
different case and dial cannot be transferred. No exact configured weight or
rate bound surfaced, so no facts are promoted and no provider request is
authorized.

The next Blancpain Fifty Fathoms Tech `5019A 12B30 94A` pre-screen found an
additional exact-reference hands-on review. It corroborates the current
47 mm/14.81 mm case, calibre 13P5A, 120-hour reserve, orange rubber and
tool-less strap exchange, date, and dual-color Super-LumiNova, but publishes no
assembled full-watch mass or numerical rate tolerance. The exact primary
dossier and this secondary review therefore leave `weightFullG` and `accuracy`
null; no provider request is authorized.

The next Patek Philippe Grande Sonnerie `6301P-001` pre-screen partially
resolves the review without a provider request. An exact independent U.S.
dealer lists the platinum reference at USD 1,963,500, unworn, with Add to Cart
and U.S. pickup; its explicit non-authorized status makes this a
`secondary_market` snapshot rather than an authorized-retail claim. An exact
Hong Kong dealer and an exact-reference strap specialist converge on a 22 mm
lug width, while the specialist's standard-spring-bar statement remains
secondary and lacks Patek service corroboration. No exact lug-to-lug span,
packaging-free configured weight, controlled lume performance, or
manufacturer-corroborated attachment mechanism surfaced. The price and lug
width gaps are closed for review purposes; the four physical/ownership gaps
remain null and no provider request is authorized.

The next Audemars Piguet Royal Oak Jumbo `16202ST.OO.1240ST.02` pre-screen
partially resolves the commercial gap. Jomashop's exact-reference page exposes
a USD 96,500 grey-market offer, `IN STOCK`, `New`, and Add to Bag controls; AP's
separate USD 40,100 endpoint remains a manufacturer price conflict rather than
an interchangeable offer. AP's integrated-bracelet and Heritage sources still
establish the attachment class and lug-width non-applicability. No exact `.02`
lug-to-lug span, packaging-free configured weight, numerical rate bound, or
controlled lume performance surfaced, so those four M1 gaps remain null and no
provider request is authorized.

The next A. Lange & Söhne Lange 1 Tourbillon Perpetual Calendar Lumen
`720.035FE` pre-screen remains negative for its six review gaps. An exact
reference editorial review corroborates the 41.9 mm platinum case, L225.1,
50-hour reserve, display-wide Lumen treatment, and quick-lock deployant, but
offers only a broad euro price range and no exact weight, lug measurements, or
numerical daily-rate bound. An exact U.S. seller listing also remains price-
and availability-on-request. The existing primary page's numeric and physical
omissions therefore stand; no facts are promoted and no provider request is
authorized.

The next Rado HyperChrome Quartz `R32280109` pre-screen confirms the current
official U.S. row but closes none of its four remaining M1 gaps. Rado's exact
page supplies a homogeneous USD 1,400 in-stock offer, 41.5 x 11.7 mm case,
87 g configured mass, R292 ±10 seconds-per-year accuracy, 150 m resistance,
Super-LumiNova color placement, and a pin buckle. An exact WatchMaxx listing
corroborates the configuration and luminous hands/markers, but it has no
lug-to-lug or lug-width measurement, timed lume observation, or case-fastener
record. An importer page conflicts on thickness, and Rado's generic Easy Clip
service page is not an exact-reference parts record. The older 47.7 mm span and
20/21 mm width remain rejected against the current 41.5 x 11.7 mm, 87 g,
150 m specification set. `lugToLugMm`, `lugWidthMm`, `lumeGrade`, and
`attachmentType` remain null; no provider request is authorized.

The next Bulova Icon Precisionist Chronograph `98B316` pre-screen also leaves
its two review gaps open. A newly found exact-reference hands-on article reports
274 g and says the luminous hands and markers are readable after light exposure,
but it gives no bracelet-length or weighing protocol, charge intensity,
elapsed-decay series, or repeatable brightness comparison. That observation is
consistent with the existing 170/270-276 g conflict and subjective lume reports,
not a basis for selecting a canonical weight or performance class. Bulova's
exact pages and Citizen Watch Group parts lookup still control the already
resolved diameter, lug width, annual Precisionist accuracy, and spring-bar
interface. `weightFullG` and `lumeGrade` remain null; no provider request is
authorized.

The next Cartier Tank Must Small `WSTA0107` pre-screen leaves its sole M1 gap,
`accuracy`, open. An exact-reference Watchfinder listing confirms that a
Cartier-certified service centre inspected accuracy and functionality, but it
publishes no measured rate, tolerance bound, observation period, or test
method. Cartier's exact regional pages and movement overview likewise describe
High Autonomy quartz and battery life without a numerical timekeeping bound;
generic quartz expectations and third-party calibre summaries remain rejected.
No fact is promoted and no provider request is authorized.

The next Sinn 856 UTC SI-084 pre-screen leaves `weightFullG`, `accuracy`, and
`lumeGrade` open. WatchBuys' exact-product owner archive adds individual
approximately ±2 and +5 seconds-per-day observations, but no shared interval,
position or temperature conditions, instrument, or factory guarantee. The
official 70 g value remains head-only, and exact-SKU lume reports still lack an
independent timed charge/decay protocol. The exact WatchBuys product page and
Sinn 856-series manual continue to control the resolved configuration,
47.5 mm span, SW330-2 identity, and spring-bar interface. No fact is promoted
and no provider request is authorized.

A 2026-08-31 exact-reference recheck of WatchBuys' SI-084 product and
verified-owner archive found no new admissible evidence. The page still exposes
70 g as head-only; owner comments remain individual timing anecdotes without a
shared protocol or guarantee, and the repeated eight-hour lume claim after a
one-minute fluorescent charge has no timed brightness series or independent
corroboration. `weightFullG`, `accuracy`, and `lumeGrade` therefore remain null
and the candidate stays research-only.

The next Vaer S3 Calendar Field bundle `S3-CF-SIL20BLK-NY20KHA` pre-screen
leaves its sole M1 gap, `weightFullG`, open. Vaer's exact variant page gives
46 g as case-only mass and its strap payload exposes no unit or scope. A new
exact-SKU aggregator record describes the wrong orange-dial/beige-strap variant
and an implausible resistance value, with no wearable weighing protocol. The
existing exact 6/10 lume performance, dimensions, accuracy, and quick-release
evidence remain valid; no full configured mass is promoted and no provider
request is authorized.

The next Swatch Skin White Classiness `SS08K102-S14` pre-screen leaves its two
M1 gaps, `accuracy` and `lumeGrade`, open. Search discovery found an exact
authorized-retailer specification labelling luminescence absent and repeating
the current dimensions, but direct retrieval is blocked by the retailer's
anti-bot page, so the indexed snippet cannot close the field. No exact
numerical rate bound for the installed SW-SF quartz movement surfaced. The
existing 12 g full-watch mass, 38 mm wearing span, and proprietary Swatch mount
remain unchanged; no facts are promoted and no provider request is authorized.

The next Nodus Sector II Field Titanium Shale `SEC-F-SHA` pre-screen leaves its
sole M1 gap, `lumeGrade`, open. An exact reseller page corroborates the USD 625
out-of-stock titanium-bracelet configuration and repeats the BGW9 Grade A
material description, but supplies no timed charge/decay observation or
repeatable performance class. The exact Nodus page and two hands-on reviews
continue to establish the 100 g unsized-bracelet mass, regulated ±10 seconds
per day, 47 mm span, quick-release interface, and no-date configuration; no
fact is promoted and no provider request is authorized.

The next Citizen FORMA `FRA36-2432` pre-screen leaves its sole M1 gap,
`lumeGrade`, open. A Japanese authorized-retailer recheck independently
repeats the exact B023, 57 g, 18 x 6 mm, ±15-seconds-per-month, and stainless
bracelet specification, but its technical list contains no lume or no-lume
statement. Citizen's own page likewise supplies no qualifying photoluminescent
performance evidence. No fact is promoted and no provider request is
authorized.

The next Casio BABY-G `BGD-5650-1JF` pre-screen leaves its sole M1 gap,
`lumeGrade`, open. Exact Casio Japan and Europe pages describe the light as an
LED Super Illuminator/backlight, and an independently retrievable exact-SKU
retailer page repeats the LED backlight and afterglow wording. None identifies
photoluminescent material or supplies a charge condition, timed decay series,
or repeatable performance class. The 31 g configured mass, rectangular
42.1 x 37.9 x 11.3 mm geometry, Tough Solar/Multi Band 6 operation, and exact
14 mm proprietary pushpin mount remain accepted provisional facts; no fact is
promoted and no provider request is authorized.

The next Certina DS Action Diver 38 mm Titanium `C048.807.44.051.01`
pre-screen remains open only for `accuracy`. An exact Slovak authorized-retailer
page identifies the selected reference and repeats the Powermatic 80.611
configuration, but renders its rate field as the ambiguous `+ - 6-4 sec./day`
without a test method or defined lower and upper bounds. That malformed claim
cannot be normalized. It joins the earlier exact-retailer -10/+25 claim and
Certina's approximate -10/+30 guidance for most non-chronometers; neither is a
variant-specific guaranteed bound. No fact is promoted and no provider request
is authorized.

The next Baltic MR Classic Blue `MR01BLUS35` pre-screen remains negative for
`weightFullG`, `accuracy`, `lumeGrade`, and `dateStatus`. A newly retrieved
exact retailer record independently identifies the Blue Stitched Lion reference
and repeats its 36 mm steel case, Hangzhou CAL5000a, hesalite, and 30 m rating,
but publishes none of the four missing fields. The current exact variant's
primary page still supplies no photoluminescent or explicit no-lume statement,
configured mass, numerical rate bound, or explicit date status; family reviews
and sibling variants remain non-transferable. No fact is promoted and no
provider request is authorized.

The next Swatch Skin White Classiness `SS08K102-S14` pre-screen remains open
only for `accuracy` and `lumeGrade`. An exact Louis Pion retailer record
corroborates the EAN, 34 mm case, two-hand quartz display, and approximately
12 g mass, but publishes no numerical rate bound or lume statement. The exact
Swatch pages and other EAN-linked records continue to establish the homogeneous
configuration; an indexed exact-retailer `luminescence absent` claim remains
unusable because direct retrieval is anti-bot blocked. No fact is promoted and
no provider request is authorized.

The next Swatch SILVERWAKATI `SO28N100` pre-screen remains negative for
`weightFullG`, `accuracy`, and `lumeGrade`. An exact-SKU outlet page repeats
the 34 mm quartz, 3 bar, and plastic configuration, but its blue-case metadata
conflicts with the exact silver/blue product and it publishes no watch-only
weight, numerical rate bound, or lume statement. The existing 18 g/22 g mass
conflict, qualitative quartz wording, and absence of photoluminescent evidence
therefore remain unresolved. No fact is promoted and no provider request is
authorized.

The next Citizen Garrison `BM8180-03E` pre-screen leaves its sole M1 gap,
`lumeGrade`, open. A 2026-08-31 exact-SKU search rechecked Citizen's luminous
hands-and-markers specification and the existing Donatwald and owner reports,
but found no controlled illuminance, charge duration, timed decay series, or
repeatable comparison standard. The conflicting exact-reference observations
therefore remain useful context rather than a catalogue grade; no fact is
promoted and no provider request is authorized.

The next LIP Churchill T18 `671937` pre-screen remains open for
`caseThicknessMm` and `lumeGrade`. Lepage's exact authorized-retailer page
matches the current ivory/blue/sapphire configuration but reports 9.2 mm
thickness, conflicting with the exact specialist's 8.5 mm; the older 8.0 mm
record belongs to a mineral/Arabic configuration. Without a current primary or
convergent exact-reference measurement, thickness stays null. Lepage also gives
no whole-watch lume statement, so no grade is promoted and no provider request
is authorized.

The next Bulova Icon Precisionist Chronograph `98B316` pre-screen remains open
for `weightFullG` and `lumeGrade`. A newly retrieved exact-reference retailer
record reports 229 g and 12.40 mm thickness, conflicting with the exact
current dimensional set at 17.5 mm and the existing 270-276 g hands-on records;
its luminous-hands/numerals prose has no charge or timed-decay protocol. The
record is rejected as an unscoped or mismatched configuration, so neither
remaining field is promoted and no provider request is authorized.

The next Omega Speedmaster Moonwatch Professional `310.30.42.50.01.001`
pre-screen remains open for `attachmentType` and `lumeGrade`. Omega's official
bracelet-maintenance page recommends authorized service for bracelet changes but
does not identify the exact factory connector; the exact owner and
Omega-certified-watchmaker forum evidence for a spring bar remains secondary
without public Omega product/service corroboration. Exact-reference sources
continue to establish Super-LumiNova presence without a controlled charge,
decay, or repeatable performance comparison. No fact is promoted and no
provider request is authorized.

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
