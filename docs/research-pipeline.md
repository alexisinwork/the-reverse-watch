# Coverage-first research pipeline

Status: **Phase 5 contract active**
Last verified: **2026-08-30**

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
- 18 accepted catalogue targets linked to all current reviewed variants;
- 13 active coverage-intent targets, with all default discovery jobs reviewed;
- live Supabase parity for 16 brands and all 18 accepted variants across the
  six golden SQL/TypeScript hard-filter profiles; all 20 public catalogue
  tables have RLS enabled and browser roles have no direct table grants;
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
