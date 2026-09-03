# Model-list intake audit — 2026-09-02

This audit compares the three owner-supplied model lists with the accepted
reference catalogue. The lists are interest/intake material, not verified
catalogue facts. The lossless machine-readable result is
[`model-intake-index.json`](../data/research/model-intake-index.json); rebuild
it with `npm run audit:model-intake`.

## Scope and result

- 220/220 source brand rows were parsed.
- 1,786/1,786 top-level model expressions were preserved with source file,
  SHA-256, line, ordinal, and stable expression ID.
- 71 exact reference variants are currently accepted in the seed catalogue,
  spanning 24 brands; 45 are Rolex variants.
- 2 source expressions contain an accepted exact reference match.
- 57 expressions have only a family/model-level match and still require
  reference, size, material, movement, and configuration atomization.
- 195 expressions belong to brands with accepted catalogue rows but have no
  matching accepted reference/model.
- 1,145 expressions belong to manifest brands with no accepted catalogue row.
- 387 expressions still require canonical-brand resolution; aliases are kept
  unresolved where merging would change the reference or service namespace.

The `needs_atomization` state is intentional. Slash alternatives, parenthetical
variants, dimensions, materials, and reference codes can produce multiple
homogeneous targets. No raw list expression is written into PostgreSQL.

## Highest-priority gaps found by parallel audits

The top-15 list is materially covered only for Rolex, Grand Seiko, and one
Jaeger-LeCoultre Reverso variant. Patek Philippe, Audemars Piguet, Vacheron
Constantin, Cartier, Omega, A. Lange & Söhne, IWC, Breguet, Blancpain,
Breitling, Zenith, and Chopard have no accepted exact variant in the current
catalogue. Suggested first exact candidates remain research-only until their
M1 fields are independently reviewed: Patek Nautilus 5811/1G-001, AP Royal Oak
16202ST, Vacheron Overseas 4520V, Cartier Tank Must WSTA0107, Grand Seiko
SLGH005, IWC Mark XX IW328201, Breguet Classique 5177BB/29/9V6, Blancpain
Fifty Fathoms 5015 1130 52A, Breitling Navitimer AB0138211B1A1, Zenith
Chronomaster Sport 03.3100.3600/21.R951, and Chopard Alpine Eagle XL Chrono
298609-3001.

The `other brands.txt` list has 45 brands and 869 expressions. The accepted
catalogue covers only a small partial subset: Citizen, Hamilton, Laco,
Longines, NOMOS, Seiko, Tissot, Tudor, and a few related seed rows. The main
missing priority candidates identified in source review are Casio GA2100-1A1,
Citizen NJ0150-56E, Hamilton H70455133, Longines L3.410.4.93.6, Oris
01 733 7787 4135-07 4 22 37FC, Panerai PAM01288, TAG Heuer WBP231N.FT6234,
Seiko SPB121J1, and Junghans 27/3400.02. Their official product pages are
evidence leads, not acceptance decisions.

The `last 100 brands.txt` list has 160 brand rows and 797 expressions. Most
brands have no accepted reference at all. Current partial coverage is limited
to a few existing rows such as Mido, Christopher Ward, Brew, Marathon, BOLDR,
Orient, Vostok, Timex, and Nodus; every other expression needs exact-reference
resolution and review. The first practical queue is Orient Mako/Kamasu, Vostok
710/090 and Amphibia 1967, Timex Field Post Solar, Serica 5303/4512/8315,
Tutima M2 Seven Seas, Raketa Big Zero, ZRC Grands Fonds Heritage, Vario 1918,
and Wempe Iron Walker GMT.

## Rolex recheck

The existing owner workbook and follow-up intake are complete for their stated
scope: 35 workbook targets, 34 supplied follow-up references, and 45 accepted
Rolex variants. That scope is not the same as the current Rolex collection.

The official Rolex collection now lists Land-Dweller as a separate family. It
is absent from the owner list and accepted catalogue. The first exact review
target is current white Rolesor Land-Dweller 40, `M127334-0001` / reference
`127334`, with official US price $16,450, 40 mm case, calibre 7135, about 66
hours of reserve, -2/+2 seconds per day, 100 m water resistance, date, and an
integrated Flat Jubilee bracelet. The exact target is in the manifest and its
review artifact is `needs_more_evidence`: exact-reference weight, wearing span,
attachment classification, and graded lume evidence are still missing.

The recheck also queued, as separate homogeneous targets, current GMT-Master II
`126710BLNR` and Yacht-Master 42 `M226658-0001`. They must not be merged with
the existing BLRO/GRNR, RLX titanium, or other material configurations.

The current Rolex page also exposes further exact-reference gaps that remain
research leads rather than accepted rows: Land-Dweller `127234`, `127235`,
`127236`, `127335`, `127336`, `127285TBR`, `127286TBR`, `127385TBR`, and
`127386TBR`; current Yacht-Master II `126680-0001` and `126688-0001`; GMT-Master
II material/dial variants including `126713GRNR`, `126715CHNR`, `126718GRNR`,
`126711CHNR`, `126720VTNR`, and `126729VTNR`; Oyster Perpetual variants such as
`134303-0001`, `126000-0016`, `277200-0014`, and `124200-0007`; plus current
precious-metal or dial variants of Daytona, Datejust, Day-Date, Submariner,
Sea-Dweller, Yacht-Master, and 1908. Each one must be atomized into its exact
reference/configuration before a separate review packet is created.

The recheck also found follow-up provenance work, not silent replacement: the
owner intake labels historical Yacht-Master II `116688` as current; `126710BLRO`
may be archived in the current view and needs status review; `268621-0003` has a
source-check URL mismatch; and some current GRNR price/material evidence is
stale. These existing records are retained until an additive correction is
independently reviewed.

Sources retrieved 2026-09-02: [Rolex collection](https://www.rolex.com/watches),
[Rolex all models](https://www.rolex.com/watches/find-rolex),
[Land-Dweller 127334](https://www.rolex.com/en-us/watches/land-dweller/m127334-0001),
and [Land-Dweller model index](https://www.rolex.com/en-us/watches/land-dweller/all-models).

## Acceptance boundary

Parallel audits produced research leads, not catalogue additions. Every future
target must be atomized to one exact homogeneous configuration, run through the
Perplexity `sonar-pro` worker when selected, independently checked against
primary sources, and accepted only through the existing reviewed-artifact and
additive-migration path. Unknown facts remain `null`; they do not satisfy hard
filters.

## Follow-up research batch (retrieved 2026-09-02)

The next Perplexity `sonar-pro` batch and independent primary-source review
confirmed these exact references as research-only candidates:

- Orient Diver Design 40 / Mako 40 `RA-AC0Q01B` — [manufacturer product page](https://orient-watch.com/en/orient/collection/sports/diver-design-40/RA-AC0Q01B/).
- Serica 5303 `5303-3` Crystal Blue and `5303-1` Enamel Black — [5303-3](https://serica-watches.com/en/collections/collection-5303/products/5303-3-diving-chronometer), [5303-1](https://serica-watches.com/en/collections/collection-5303/products/5303-1-diving-chronometer).
- Wempe Iron Walker Automatic GMT 42 `WI250004` — [US product page](https://www.wempe.com/en-us/watches/wempe-glashuette-i-sa/iron-walker/iron-walker-automatic-gmt-42-wi250004) and [German product page](https://www.wempe.com/de-de/uhren/wempe-glashuette-i-sa/iron-walker/iron-walker-gmt-wi250004).
- Seiko Prospex Alpinist `SPB121J1` — [Poland product page](https://www.seikowatches.com/pl-pl/products/prospex/spb121j1).
- Longines Spirit 37 `L3.410.4.93.6` — [US product page](https://www.longines.com/en-us/p/watch-longines-spirit-l3-410-4-93-6).

Their review artifacts remain `needs_more_evidence`; no catalogue or database
row was created. The same batch also confirmed from official collection pages
that Serica `5303-2` is a separate exact target. Timex `TW2V00400`, Raketa
`W-11-16-10-0283`, and Tutima `6151-01` were independently identified, but
their first Perplexity extractions failed the contract validation and therefore
remained planned until retry. The failed responses attempted to use `null`
with `observed`/`estimated_class`, or left a field both resolved and unresolved;
they were not accepted as evidence.

The contract retry then succeeded for Timex `TW2V00400`, Raketa
`W-11-16-10-0283`, Tutima `6151-01`, Serica `5303-2`, Citizen `NJ0150-56E`,
and Hamilton `H70455133`. Their exact identities and source-backed facts are
now represented by separate review artifacts, all still `needs_more_evidence`
because at least one hard M1 field (for example configured weight, numeric
accuracy, lug geometry, or attachment interface) remains unresolved. The
corresponding primary sources are [Timex](https://timex.com/products/expedition-field-post-solar-36mm-recycled-fabric-strap-watch-tw2v00400), [Raketa](https://world.raketa.com/product/big-zero-0283), [Tutima](https://tutima.com/watch/seven-seas-6151-01/), [Serica 5303-2](https://serica-watches.com/en/collections/collection-5303/products/5303-2-diving-chronometer), [Citizen](https://www.citizenwatch.com/us/en/product/NJ0150-56E), and [Hamilton](https://www.hamiltonwatch.com/en-us/h70455133-khaki-field-auto.html).

An important intake correction is recorded: Orient `RA-AC0Q` is a family
prefix, not an exact reference. The exact candidate is `RA-AC0Q01B`, while the
manufacturer currently lists additional distinct `RA-AC0Q` references. These
must be researched as separate homogeneous variants.

## Rolex exact-reference expansion (retrieved 2026-09-02)

The Rolex recheck added 36 current exact configuration targets to the manifest.
They remain research-only: all 36 ultimately received valid Perplexity extractions and
independent primary-source identity checks. Several intermediate attempts hit
rate limits or contract-validation errors; those responses were retried and
never treated as confirmation. No Rolex target from this expansion remains
`planned`.

- Land-Dweller: `127234-0001`, `127235-0001`, `127236-0001`, `127335-0001`,
  `127336-0001`, `127285TBR-0002`, `127286TBR-0001`, `127385TBR-0003`, and
  `127386TBR-0001` — [official Land-Dweller catalogue](https://www.rolex.com/en-us/watches/land-dweller/all-models), with direct cards for
  [127234](https://www.rolex.com/en-us/watches/land-dweller/m127234-0001),
  [127235](https://www.rolex.com/en-us/watches/land-dweller/m127235-0001),
  [127236](https://www.rolex.com/en-us/watches/land-dweller/m127236-0001),
  [127335](https://www.rolex.com/en-us/watches/land-dweller/m127335-0001),
  [127336](https://www.rolex.com/en-us/watches/land-dweller/m127336-0001),
  [127285TBR](https://www.rolex.com/en-us/watches/land-dweller/m127285tbr-0002),
  [127286TBR](https://www.rolex.com/en-us/watches/land-dweller/m127286tbr-0001),
  [127385TBR](https://www.rolex.com/en-us/watches/land-dweller/m127385tbr-0003), and
  [127386TBR](https://www.rolex.com/en-us/watches/land-dweller/m127386tbr-0001).
- GMT-Master II: `126710BLNR-0002/-0003`, `126713GRNR-0001`,
  `126715CHNR-0001/-0002`, `126718GRNR-0001/-0002`, `126711CHNR-0002`,
  `126720VTNR-0001/-0002`, and `126729VTNR-0001` — [official all-models page](https://www.rolex.com/watches/gmt-master-ii/all-models).
- Oyster Perpetual: `134303-0001`, `134300-0006`, `276208-0002`,
  `276205-0001`, `124205-0002`, `126000-0016`, `277200-0014`,
  `124200-0007`, and `124200-0008` — [official all-models page](https://www.rolex.com/en-us/watches/oyster-perpetual/all-models).
- Daytona and Day-Date: [Daytona 126506-0001](https://www.rolex.com/en-us/watches/cosmograph-daytona/m126506-0001), [Day-Date 228236-0007](https://www.rolex.com/en-us/watches/day-date/m228236-0007), and [Day-Date 228236-0018](https://www.rolex.com/en-us/watches/day-date/m228236-0018).
- Yacht-Master and Yacht-Master II: [126680-0001](https://www.rolex.com/watches/yacht-master-ii/m126680-0001), [126688-0001](https://www.rolex.com/watches/yacht-master-ii/m126688-0001), [126655-0002](https://www.rolex.com/watches/yacht-master/m126655-0002), the existing [226658-0001](https://www.rolex.com/en-us/watches/yacht-master/m226658-0001), and [268621-0004](https://www.rolex.com/watches/yacht-master/m268621-0004).

Rolex's official pages confirm the exact current configuration boundaries, but
do not publish every M1 field required by this project (notably full configured
weight, lug-to-lug, lug width, and sometimes thickness). Those values remain
missing rather than inherited from a family page. The manifest now reports 70
`needs_review` targets, no `planned` targets, and 133 review artifacts; accepted
catalogue rows remain unchanged.

## Fifty-third parallel exact-reference batch (retrieved 2026-09-03)

Four Seiko references returned schema-valid Perplexity results and were checked
against manufacturer pages:

- Seiko 5 Sports `SRPD55` — [official product page](https://www.seikowatches.com/us-en/products/5sports/srpd55) confirms the exact 4R36 configuration.
- Seiko 5 Sports Field GMT `SSK023` — [official product page](https://www.seikowatches.com/us-en/products/5sports/ssk023) confirms the exact 4R34 GMT configuration.
- Seiko Prospex 1965 Diver `SPB143J1` — [official product page](https://www.seikowatches.com/ph-en/products/prospex/spb143j1) confirms the J1 suffix and exact diver configuration; the target's shorter `SPB143` label is retained as the family shorthand.
- Seiko Prospex Solar Diver `SNE573P1` — [official regional product page](https://www.seikowatches.com/middleeast-en/products/prospex/sne573) and [exact-reference retailer evidence](https://us.firstclasswatches.com/seiko-prospex-compact-solar-385mm-scuba-diver-sne573p1-p-73030/) confirm the P1 configuration.

All four remain research-only `needs_more_evidence`; no M1 facts or catalogue
rows were promoted. The manifest now reports 261 `needs_review` targets, one
`planned` target, and 324 review artifacts; accepted catalogue rows remain
unchanged.

## Fifty-fourth parallel exact-reference batch (retrieved 2026-09-03)

Four Citizen references returned schema-valid Perplexity results:

- Eco-Drive `BM8180-03E` — the exact code is present on [Citizen's current product URL](https://www.citizenwatch.com/us/en/product/BM8180-03E.html), but that page currently renders the name Garrison while the exact-reference retailer evidence says Chandler. The nomenclature conflict remains unresolved.
- Tsuyosa Automatic `NJ0150-81Z` — [official Citizen India evidence](https://www.citizenwatches.co.in/products/mechanical/nj0150-81z) and [official European corroboration](https://citizenwatch.eu/en/p/nj0150-81z/) confirm the yellow-dial integrated-bracelet reference.
- Zenshin Mechanical `NJ0180-80X` — [official Citizen Europe page](https://citizenwatch.eu/en/p/nj0180-80x/) confirms the Super Titanium green-dial reference.
- Series 8 831 `NA1010-84X` — [official corporate family material](https://www.citizen.com.ph/html/en/news/what-s-news/series8.html) and [specialist exact-reference evidence](https://www.deployant.com/new-and-reviewed-citizen-series-8-the-hands-on-in-depth-review/) corroborate the model; no current dedicated factory product card was located.

All four remain research-only `needs_more_evidence`; no M1 facts or catalogue
rows were promoted. The manifest now reports 265 `needs_review` targets, one
`planned` target, and 328 review artifacts; accepted catalogue rows remain
unchanged.

## High-priority cross-brand exact candidates (retrieved 2026-09-02)

The next parallel research batch added nine exact candidates from brands that
previously had no accepted reference variant. All nine received valid final
Perplexity `sonar-pro` extractions and independent primary-source identity
checks. They remain `needs_more_evidence`; no catalogue row was created because
the M1 review still has unresolved physical, price, or fit fields.

- Patek Philippe Nautilus `5811/1G-001` — [official card](https://www.patek.com/en/collection/nautilus/5811-1G-001).
- Audemars Piguet Royal Oak Jumbo `16202ST.OO.1240ST.02` — [official card](https://www.audemarspiguet.com/us/en/watch-collection/royal-oak/16202ST.OO.1240ST.02).
- Vacheron Constantin Overseas: `4520V/210A-B128`, `4520V/210A-B483`,
  `4520V/210R-B705`, and `4520V/210R-B967` — [official blue-dial card](https://www.vacheron-constantin.com/ww/en/collections/overseas/4520v-210a-b128.html), [black dial](https://www.vacheron-constantin.com/ww/en/collections/overseas/4520v-210a-b483.html), [pink-gold blue dial](https://www.vacheron-constantin.com/ww/en/collections/overseas/4520v-210r-b705.html), and [pink-gold green dial](https://www.vacheron-constantin.com/ww/en/collections/overseas/4520v-210r-b967.html).
- Cartier Tank Must small `WSTA0107` — [official card](https://www.cartier.com/en-my/watches/collections/tank/tank-must-de-cartier-watch-CRWSTA0107.html).
- Omega Seamaster Aqua Terra 150M 38 mm `220.10.38.20.03.001` — [official card](https://www.omegawatches.com/en-us/watch-omega-seamaster-aqua-terra-150m-co-axial-master-chronometer-38-mm-22010382003001).
- IWC Pilot's Watch Mark XX `IW328201` — [official card](https://www.iwc.com/eu-en/watches/pilot-watches/iw328201-pilots-watch-mark-xx).

The exact family references are not merged: `4520V` is only a family prefix and
the Vacheron suffix determines dial/material configuration; `16202ST` is
likewise insufficient without the full AP product code. At the end of this
batch, the manifest reported 79 `needs_review` targets and 142 review
artifacts; the 73 accepted catalogue rows remained unchanged.

## Second high-priority exact batch (retrieved 2026-09-02)

Six more current references were confirmed from official manufacturer pages and
validated through the Perplexity `sonar-pro` contract:

- Breguet Classique `5177BB/29/9V6` — [official card](https://www.breguet.com/en/watches/classique/classique-5177/5177bb299v6).
- Blancpain Fifty Fathoms Automatique `5015 1130 52A` — [official card](https://www.blancpain.com/en-us/fifty-fathoms/fifty-fathoms-automatique-5015-1130-52a).
- Breitling Navitimer B01 Chronograph 43 `AB0138211B1A1` — [official card](https://www.breitling.com/us-en/watches/navitimer/navitimer-b01-chronograph-43-my22/AB0138211B1A1/).
- Zenith Chronomaster Sport `03.3100.3600/21.R951` — [official card](https://www.zenith-watches.com/int/product/chronomaster-sport-03-3100-3600-21-r951).
- Chopard Alpine Eagle XL Chrono `298609-3001` — [official card](https://www.chopard.com/en-us/watch/298609-3001.html).
- A. Lange & Söhne LANGE 1 `191.039` — [official card](https://www.alange-soehne.com/us-en/timepieces/lange-1/lange-1/lange-1-in-750-white-gold-191-039).

They remain research-only because exact configuration identity is confirmed but
at least one M1 decision field is still unresolved for each row. The manifest
now reports 85 `needs_review` targets and 148 review artifacts; accepted
catalogue rows remain unchanged.

## Tool/value exact batch (retrieved 2026-09-02)

Six additional current configurations were confirmed through official product
pages and valid Perplexity `sonar-pro` extractions:

- Sinn 857 UTC `857.010` — [official card](https://www.sinn.de/fr/montres/857-utc.html).
- Certina DS Action Diver 38mm Titanium `C048.807.44.051.01` — [official card](https://www.certina.com/pl/watch/ds-action-diver-38mm-titanium/c0488074405101) and [official product sheet](https://www.certina.com/pl/watch-sheet/138286).
- Bulova Lunar Pilot `96B251` — [official card](https://www.bulova.com/global/product/96B251.html).
- Baltic Aquascaphe Classic Blue Gilt and Black Gilt — [Blue Gilt](https://baltic-watches.com/en/products/aquascaphe-classic-blue-gilt) and [Black Gilt](https://baltic-watches.com/en/products/aquascaphe-classic-black-gilt). Baltic publishes `SB01` as a family code rather than a full SKU, so the dial and selected FKM attachment are retained in each target boundary.
- Junghans max bill Automatic `27/4700.02` — [official card](https://junghans.de/shop/uhren/junghans-max-bill/max-bill-automatic/max-bill-automatic-16/).

All six remain research-only pending M1 completion. Certina's official sheet
confirms 38 mm, 104 g, 19 mm lug width, 45.01 mm lug-to-lug, Powermatic 80.611,
300 m resistance, and titanium construction, while date state and accuracy
remain null because the primary source does not state them. The manifest now
reports 91 `needs_review` targets and 154 review artifacts; accepted catalogue
rows remain unchanged.

## Fourth parallel exact-reference batch (retrieved 2026-09-02)

Six additional exact configurations were confirmed by parallel agents against
current manufacturer pages and then validated through the Perplexity
`sonar-pro` contract. Two initial responses failed because Perplexity marked
`null` claims as observed; after isolated retries both completed successfully.

- Oris Aquis Date Calibre 400 `01 400 7769 4135-07 8 22 09PEB` — [official card](https://www.oris.ch/en-US/product/watch/aquis/aquis-date-calibre-400/01-400-7769-4135-07-8-22-09PEB).
- Oris Divers Sixty-Five 60th Anniversary Edition `01 733 7772 4034-Set` — [official card](https://www.oris.ch/en-US/product/watch/divers/divers-sixty-five/01-733-7772-4034-Set).
- Stowa Flieger Classic 40 `FL02-18-1-0-2-S` — [official card](https://www.stowa.de/flieger-classic-40_29).
- Alpina Alpiner Extreme Automatic `AL-525TB3AE6B` — [official card](https://us.alpinawatches.com/product/AL-525TB3AE6B.html).
- Frederique Constant Classics Index Automatic `FC-303MC5B6` — [official card](https://frederiqueconstant.com/watches/collection/men/men_classics/men_classics_automatic/fc-303mc5b6/).
- Zodiac Super Sea Wolf 53 Compression `ZO9255` — [official card](https://www.zodiacwatches.com/en-us/products/super-sea-wolf-53-compression-automatic-stainless-steel-watch/ZO9255.html); the official page is currently out of stock.

These six remain `needs_more_evidence`: identity, exact reference, and product
URL are independently confirmed, while unresolved M1 facts remain null and
cannot satisfy hard filters. Zodiac `ZO9270` was deliberately not added: only
an out-of-stock merchandising mention was found, without a separate current
detail card carrying the exact configuration. The manifest now reports 97
`needs_review` targets and 160 review artifacts; accepted catalogue rows remain
unchanged.

## Fifth parallel exact-reference batch (retrieved 2026-09-02)

Six further brands without exact targets were checked in parallel. Each exact
reference was confirmed on a manufacturer product page and completed a valid
Perplexity `sonar-pro` extraction after isolated retries for initial contract
errors:

- TAG Heuer Carrera Date `WBN2110.BA0639` — [official card](https://www.tagheuer.com/us/en/timepieces/collections/tag-heuer-carrera/39-mm-calibre-5-automatic/WBN2110.BA0639.html).
- Panerai Luminor Marina `PAM01707` — [official card](https://www.panerai.com/en/collections/watch-collection/luminor/pam01707-luminor-marina.html).
- Glashütte Original Senator Chronograph `1-37-24-01-02-71` — [official card](https://www.glashuette-original.com/en/watches/senator/senator-chronograph-1-37-24-01-02-71/).
- Piaget Polo Date `G0A51032` — [official card](https://www.piaget.com/eu-en/watches/piaget-polo/automatic-steel-watch-g0a51032).
- Bulgari Octo Finissimo Automatic 37 mm `104351` — [official card](https://www.bulgari.com/en-us/product/104351).
- Bell & Ross BR-03 Astro `BR03A-EMM-CE/SRB` — [official card](https://bellross.com/en-us/products/br-03-astro-rubber-strap); the page currently marks the configuration unavailable.

All six are research-only `needs_more_evidence` artifacts. Exact identity,
reference, and product URL are confirmed; unresolved M1 facts remain null and
cannot satisfy hard filters. The manifest now reports 103 `needs_review`
targets and 166 review artifacts; accepted catalogue rows remain unchanged.

## Sixth parallel exact-reference batch (retrieved 2026-09-02)

DOXA was independently checked against its official product page and then
validated through the Perplexity `sonar-pro` contract:

- DOXA SUB 300T Professional `840.10.351.10` — [official card](https://doxawatches.com/products/sub-300t-professional); orange Professional dial, steel Beads of Rice bracelet, and 1,200 m water-resistance configuration.

The candidate remains research-only `needs_more_evidence`: exact identity,
reference, and product URL are confirmed, while unresolved M1 facts remain
null and cannot satisfy hard filters. Parallel agent capacity was exhausted
while checking Squale, Nivada Grenchen, Fortis, Hanhart, and Mühle-Glashütte;
no unverified candidate was added for those brands. The manifest now reports
104 `needs_review` targets and 167 review artifacts; accepted catalogue rows
remain unchanged.

## Seventh parallel exact-reference batch (retrieved 2026-09-02)

The Perplexity worker found two exact candidates among the next five P3 brands;
both were independently checked against official manufacturer sources:

- Squale 1521 Full Luminous Bracelet `1521FULL.SQ20L` — [official product page](https://www.squale.ch/en/1521-full-luminous-bracelet) and [official catalog](https://www.squale.ch/live/assets/media/upload/Squale_Catalog.pdf).
- Hanhart 417 ES 42 mm `H721.210-` — [official product page](https://www.hanhart.com/en/product/417-es-42-mm/).

Both remain research-only `needs_more_evidence`; exact identity and source URL
are confirmed, while unresolved M1 facts remain null. Nivada Grenchen, Fortis,
and Mühle-Glashütte returned contract-invalid or incomplete Perplexity
responses and remain planned rather than being populated with guesses. The
manifest now reports 106 `needs_review` targets and 169 review artifacts;
accepted catalogue rows remain unchanged.

## Eighth parallel exact-reference batch (retrieved 2026-09-02)

Isolated Perplexity retries produced two additional exact candidates, each
checked against official manufacturer material:

- Nivada Grenchen Antarctic Spider 38mm Automatic `32023A` — [official product page](https://nivadagrenchenofficial.com/products/antarctic-spider).
- Mühle-Glashütte S.A.R. Rescue-Timer LUMEN `M1-41-08-KB` — [official product page](https://www.muehle-glashuette.de/en/watch/s-a-r-rescue-timer-lumen-rubber-strap/) and [official technical catalog](https://www.muehle-glashuette.de/wp-content/uploads/Muehle_WW_2022.pdf).

Both remain research-only `needs_more_evidence`; exact identity and
manufacturer provenance are recorded, while unresolved M1 facts remain null.
Fortis was intentionally not promoted: Perplexity proposed `F8120028`, while
the current official Marinemaster page identifies `F8120024`; that reference
conflict remains planned for resolution. The manifest now reports 108
`needs_review` targets and 171 review artifacts; accepted catalogue rows remain
unchanged.

## Ninth parallel exact-reference batch (retrieved 2026-09-02)

Three more current configurations were found by Perplexity and checked against
official manufacturer pages:

- Zelos Swordfish Ti 42mm Frost `Swordfish-Ti-42-Frost` — [official card](https://zeloswatches.com/products/swordfish-ti-42mm-frost).
- Formex Essence ThirtyNine Automatic Chronometer Black Pearl `0339.1.6641.101` — [official card](https://formexwatch.com/watches/essence-39-automatic-chronometer-black-pearl/).
- Traska Summiteer 38 Charcoal Black `2196` — [official card](https://www.traskawatch.com/products/summiteer-38-charcoal-black) and [official generation reference page](https://www.traskawatch.com/pages/reference-points-summiteer).

All three remain research-only `needs_more_evidence`; exact configuration and
manufacturer provenance are recorded, while unresolved M1 facts remain null.
The manifest now reports 111 `needs_review` targets and 174 review artifacts;
accepted catalogue rows remain unchanged.

## Tenth parallel exact-reference batch (retrieved 2026-09-02)

UNIMATIC produced a valid Perplexity extraction and was independently checked
against its official product card and technical sheet:

- UNIMATIC Modello Quattro `U4S-T-LB` — [official product card](https://www.unimaticwatches.com/u4s-t-lb/) and [official technical sheet](https://www.unimaticwatches.com/wp-content/uploads/2026/03/TECH-SPECS-U4S-T-LB.pdf). The exact 40 mm titanium, mint NATO, time-only limited-edition configuration is in stock at the checked retrieval date.

It remains research-only `needs_more_evidence`; exact identity and
manufacturer provenance are recorded, while unresolved M1 facts remain null.
Farer `Alert` has an official card, but its Perplexity response remained
contract-invalid after retries, so it stays planned. The manifest now reports
112 `needs_review` targets and 175 review artifacts; accepted catalogue rows
remain unchanged.

## Eleventh parallel exact-reference batch (retrieved 2026-09-02)

Two current configurations were found by Perplexity and confirmed against
official manufacturer pages:

- Lorier Neptune `737080` — [official card](https://www.lorierwatches.com/products/watch-neptune-black-nodate-bracelet-737080).
- Farer Alert, Three Hand Series III — [official card](https://farer.com/products/alert). Farer publishes the stable product identifier `Alert` but no separate SKU on the card; it is recorded as a product identifier, not an invented reference.

Both remain research-only `needs_more_evidence`; exact configuration and
manufacturer provenance are recorded, while unresolved M1 facts remain null.
The manifest now reports 114 `needs_review` targets and 177 review artifacts;
accepted catalogue rows remain unchanged.

## Twelfth parallel exact-reference batch (retrieved 2026-09-02)

The Fortis reference conflict was resolved by an isolated Perplexity retry and
primary-source recheck:

- Fortis Marinemaster M-40 `F8120024` — [official card](https://www.fortis-swiss.com/products/marinemaster-m-40), Amber Orange on Horizon Strap.

The earlier `F8120028` proposal is rejected. The corrected exact identity is
recorded as research-only `needs_more_evidence`; unresolved M1 facts remain
null and cannot satisfy hard filters. The manifest now reports 115
`needs_review` targets and 178 review artifacts; accepted catalogue rows remain
unchanged.

## Thirteenth parallel exact-reference batch (retrieved 2026-09-02)

Autodromo's current Monoposto Series Two Azzurro product variant was found by
Perplexity and checked against the [official product card](https://autodromo.com/products/monoposto?variant=42336117817478).
The manufacturer exposes the exact color variant but no separate SKU, so the
product-and-color identifier is retained without inventing a reference.

It remains research-only `needs_more_evidence`; unresolved M1 facts remain
null and cannot satisfy hard filters. The manifest now reports 116
`needs_review` targets and 179 review artifacts; accepted catalogue rows remain
unchanged.

## Fourteenth parallel exact-reference batch (retrieved 2026-09-02)

Four additional brand targets were sent through the Perplexity research worker
and checked against current official manufacturer pages:

- Bremont Altitude MB Meteor, Black Dial, Titanium Bracelet
  `ALT42-MT-TI-BKBK-B` — [official product card](https://us.bremont.com/products/alt42-mt-ti-bkbk-b).
- MAEN Hudson 38 MK5 `M1.1.7` — [official product card](https://www.maenwatches.com/en-us/products/hudson-38-mk5-m1-1-7?currency=USD)
  and [official collection specification](https://www.maenwatches.com/en-us/collections/hudson-38-mk5).
- Venezianico Nereide Ultraleggero 42 `3921506` — [official US card](https://us.venezianico.com/products/nereide-ultraleggero-42-3921506)
  and [official localized specification card](https://it.venezianico.com/products/nereide-ultraleggero-42-3921506).
- Halios Seaforth IV — [official current product card](https://halioswatches.com/products/seaforth-iv-gs).

The first three have stable manufacturer references and exact identity
provenance. Halios publishes a current model page with selectable case, bezel,
dial, and strap options but no formal SKU; the generated configuration string
was rejected rather than treated as a real reference. All four remain
research-only `needs_more_evidence`; unresolved M1 facts remain null, and no
catalogue rows were added. The manifest now reports 120 `needs_review` targets
and 183 review artifacts; accepted catalogue rows remain unchanged.

## Fifteenth parallel exact-model batch (retrieved 2026-09-02)

Three more current configurations were sent through Perplexity and checked
against official manufacturer cards:

- Oak & Oscar The Atwood White Panda — [official product card](https://oakandoscar.com/collections/standard-production/products/the-atwood?variant=43433571713077)
  and [official model page](https://oakandoscar.com/pages/the-atwood).
- MARCH LA.B AM2 Automatic Steel — [official product card](https://march-lab.com/en/products/montres-am2-automatiques-steel).
- Duckworth Prestex Verimatic 39mm Orange Fumé on Rubber — [official product card](https://www.duckworthprestex.com/products/verimatic-automatic-39mm-rubber).

The official pages confirm the current model/configuration identities, but the
first two do not publish a separate manufacturer SKU and the Duckworth page
does not support the extracted `D891-05` code. Those identifiers are therefore
rejected rather than promoted. All three remain research-only
`needs_more_evidence`; unresolved M1 facts remain null, and no catalogue rows
were added. The manifest now reports 123 active research targets (120
`needs_review` and 3 `planned`) and 186 review artifacts; accepted catalogue
rows remain unchanged.

## Sixteenth parallel exact-model batch (retrieved 2026-09-02)

Two further references were returned by Perplexity and checked against
official manufacturer material:

- RESERVOIR Airfight Propeller First Gen `RSV02.AF/230-122-1` — [official model page](https://www.reservoir-watch.com/vintage-watch-collections/aeronautic/airfight/airfight-propeller-firstgen/)
  and [official press room](https://www.reservoir-watch.com/pressroom/).
- RGM Model 150-P Pilot `150-P` — [official model page](https://www.rgmwatches.com/model-150/).

Both exact identities and references have primary-source support, but remain
research-only `needs_more_evidence` while current availability and complete
field-level M1 evidence are reviewed. Damasko DF10 Black remains `planned`
after four contract-invalid Perplexity responses; null claims were not accepted
as facts. The manifest now reports 126 active research targets (125
`needs_review` and 1 `planned`) and 188 review artifacts; accepted catalogue
rows remain unchanged.

Damasko was then retried successfully: [DF10 Black `SW10434.25`](https://www.damasko-watches.com/en/DF10-Black/SW10434.25)
is now an exact research-only identity review. Its primary page confirms the
reference and core dimensions, but it remains `needs_more_evidence` until the
complete M1 field set is closed. The manifest therefore now reports 126
`needs_review` targets and 189 review artifacts; accepted catalogue rows remain
unchanged.

## Seventeenth parallel exact-reference batch (retrieved 2026-09-02)

Two current luxury references were returned by Perplexity and checked against
official manufacturer product pages:

- Hublot Big Bang Reloaded All Black 44mm `421.CX.1140.NR.RLD` — [official product card](https://www.hublot.com/en-ae/watches/big-bang/big-bang-reloaded-all-black-44-mm).
- Girard-Perregaux Laureato 42mm Infinite Grey `81010-11-3475-1CM` — [official product card](https://www.girard-perregaux.com/watches/laureato/81010-11-3475-1cm).

Both exact references match the official cards and remain research-only
`needs_more_evidence`; unresolved M1 facts remain null and no catalogue rows
were added. The manifest now reports 128 `needs_review` targets and 191 review
artifacts; accepted catalogue rows remain unchanged.

## Eighteenth parallel exact-reference batch (retrieved 2026-09-02)

Three additional high-horology references were returned by Perplexity and
checked against primary manufacturer material:

- Ulysse Nardin Diver Hammerhead Shark `1183-170LE-3A-HAMMER/3A` — [official product card](https://www.ulysse-nardin.com/en-us/watches/diver/1183-170le-3a-hammer-3a).
- H. Moser & Cie. Streamliner Two Hands 34mm `6400-1200` — [official product card](https://www.h-moser.com/en/streamliner/streamliner-two-hands-6400-1200).
- F.P. Journe Chronomètre Bleu `CB` — [official 2025-2028 catalogue](https://www.fpjourne.com/sites/default/files/catalog/fichier/F.P.JOURNE_Catalogue_2025_2028_ENG.pdf).

All three exact identities and references are supported by primary sources. The
F.P. Journe source is an official catalogue rather than a current product
checkout page, so online availability remains unresolved. All remain
research-only `needs_more_evidence`; unresolved M1 facts remain null and no
catalogue rows were added. The manifest now reports 131 `needs_review` targets
and 194 review artifacts; accepted catalogue rows remain unchanged.

## Nineteenth parallel exact-reference batch (retrieved 2026-09-02)

Four additional current luxury references were sent through the Perplexity
worker and checked against manufacturer pages, with a secondary reference
check where the manufacturer does not publish a public SKU:

- Richard Mille RM 30-01 Le Mans Classic — [official model page](https://www.richardmille.com/collections/rm-30-01-lmc). The model identity, RMAR2 movement, 150-piece limit, and 50 m rating are confirmed; the official page publishes no separate SKU, so `RM 30-01 LMC` remains a model/reference label.
- Parmigiani Fleurier Tonda PF Automatic 36mm Steel Platinum Silver Sand `PFC804-1020001-100182` — [official product card](https://www.parmigiani.com/en/watches/tonda-pf-automatic-steel-silver-sand/). The official card confirms the exact product reference and current configuration; the regional `-EN` display suffix is retained only in the intake label.
- MB&F Legacy Machine Sequential Flyback EVO `11.TR.LG` — [official model page](https://www.mbandf.com/machines/mbf-machines/legacy-machines/lm-sequential-flyback-evo) plus [retailer MPN correlation](https://www.watches-of-switzerland.co.uk/MBand.F-LM-Sequential-Flyback-Evo-11.TR.LG/p/18520061). MB&F confirms the model and configuration, while `11.TR.LG` is dealer-correlated rather than an official MB&F SKU; retailer item `18520061` is explicitly not used as the reference.
- Laurent Ferrier Classic Tourbillon White Enamel Grand Feu Red Gold `LCF001.02.R5.E10` — [official product card](https://laurentferrier.ch/collections/catalogue/products/classic-tourbillon-white-enamel-grand-feu-redgold). The exact red-gold reference is kept separate from the different yellow-gold white-enamel reference `LCF001.02.J1.E10`.

All four remain research-only `needs_more_evidence`; exact identities and
available reference provenance are recorded, unresolved M1 facts remain null,
and no catalogue rows were added. The manifest now reports 135
`needs_review` targets and 198 review artifacts; accepted catalogue rows remain
unchanged.

## Twentieth parallel exact-reference batch (retrieved 2026-09-02)

Four additional high-horology model identities were sent through the
Perplexity worker and checked against primary manufacturer material:

- Kari Voutilainen 28MPR — [official model page](https://www.voutilainen.ch/portfolio/28mpr/) and [official order-status notice](https://www.voutilainen.ch/the-ultimate-vingt-8-28mpr/). The model and three 15-piece material editions are confirmed, but the manufacturer states that orders closed after 2025-12-31; no current-availability claim is made.
- URWERK UR-1001 Zeit Device `UR-1001` — [official product page](https://www.urwerk.com/collections/ur-special-projects/ur-1001). The exact model/reference and Zeit Device variation are confirmed; the manufacturer does not publish a separate SKU on the page.
- De Bethune DB28xs Aérolite `DB28XSZM` — [official technical specification](https://www.debethune.ch/wp-content/uploads/2024/08/DB28xs_Aerolite_technical_specifications_EN.pdf) and [DB28XS collection](https://www.debethune.ch/collections/db28xs/). The exact reference and primary technical provenance are confirmed; stock status is unresolved.
- Czapek & Cie. Promenade Transparence Bleu — [official product page](https://www.czapek.com/shop/promenade-transparence-bleu-7077). The exact current product identity is confirmed, but no separate manufacturer SKU is published on the checked card.

All four remain research-only `needs_more_evidence`; no catalogue rows were
added and unresolved M1 facts remain null. The manifest now reports 139
`needs_review` targets and 202 review artifacts; accepted catalogue rows remain
unchanged.

## Twenty-first parallel exact-reference batch (retrieved 2026-09-02)

Four additional current or currently documented luxury configurations were
sent through the Perplexity worker and checked against manufacturer pages:

- Arnold & Son HM London Skyline Steel 39.5mm — [official product page](https://www.arnoldandson.com/collections/hm/hm-london-skyline-steel/). The official card confirms the exact steel model and 20-piece edition, but leaves its Reference field blank; the secondary `1764` label is not accepted as a watch SKU.
- Angelus Chronodate Titanium Black `0CDZF.B03A.M009T` — [official product page](https://angelus-watches.com/collections/lab/chronodate-titanium-black/). The exact manufacturer reference and titanium/carbon configuration are confirmed.
- BOVET 1822 19Thirty Blue Meteorite Titanium `NTT0011` — [official product page](https://www.bovet.com/timepiece/19thirty-ntt0011/) and [official collection page](https://www.bovet.com/collections/fleurier/19thirty/). The exact reference and variant are confirmed.
- Speake-Marin Resilience Titanium 38mm `413802000` — [official product page](https://speake-marin.com/watch/resilience-titanium/). The exact 38mm reference is confirmed separately from the 42mm `414202000` configuration.

All four remain research-only `needs_more_evidence`; no catalogue rows were
added and unresolved M1 facts remain null. The manifest now reports 143
`needs_review` targets and 206 review artifacts; accepted catalogue rows remain
unchanged.

## Twenty-second parallel exact-reference batch (retrieved 2026-09-02)

Four additional current configurations were sent through the Perplexity worker
and checked against primary manufacturer pages:

- Chronoswiss Delphis Glacier `CH-1423T.1-BKSI` — [official product page](https://chronoswiss.com/en/eu/delphis-glacier-CH-1423T.1-BKSI).
- Vulcain Monopusher Heritage Black & White `VUL-MP-002` — [official product page](https://vulcain.ch/products/monopusher-heritage-vul-mp-002).
- YEMA Superman Gilt CMM.10 `12.14.69.SN.M2` — [official product page](https://yema.com/products/yema-superman-gilt-cmm-10-12-14-69-sn-m2). The 39mm boundary is retained separately from the 41mm option.
- Maurice Lacroix AIKON Automatic Date 39mm `AI6007-SS000-130-7` — [official product page](https://www.mauricelacroix.com/us_en/watches/aikon-automatic-date-39mm/AI6007-SS000-130-7.html).

All four remain research-only `needs_more_evidence`; exact identities and
manufacturer references are recorded, unresolved M1 facts remain null, and no
catalogue rows were added. The manifest now reports 147 `needs_review` targets
and 210 review artifacts; accepted catalogue rows remain unchanged.

## Twenty-third parallel exact-reference batch (retrieved 2026-09-02)

Four additional current or explicitly listed manufacturer configurations were
sent through the Perplexity worker and checked against primary brand pages:

- Baume & Mercier Clifton 10793 `M0A10793` — [official Clifton product page](https://www.baume-et-mercier.com/fr/fr/collections/clifton-homme/montre-clifton-10793-seconde-au-centre.html) and [official men's catalogue](https://www.baume-et-mercier.com/us/en/watches/mens-watches.html).
- EBEL 1911 Product SKU `1216585` — [official product page](https://www.ebel.com/en/shop-watches/ebel-1911-1216585.html).
- Eberhard & Co. LANCIA HF blue dial `41048.02` — [official product page](https://www.eberhard-co-watches.ch/en/novita/lancia-hf/), which separately maps the white `.01`, blue `.02`, and black `.03` variants.
- Konstantin Chaykin Matroskin — [official product page](https://chaykin.ru/collections/watches/wristmons/matroskin/) and [official technical PDF](https://chaykin.ru/upload/iblock/76f/oiyexxnnvybta7o8xgoz3m5wca1ookzg.pdf). The manufacturer publishes no conventional alphanumeric reference, so the model-level identity is preserved without inventing one.

All four remain research-only `needs_more_evidence`; exact identities and
manufacturer identifiers (or the documented absence of one) are recorded,
unresolved M1 facts remain null, and no catalogue rows were added. The
manifest now reports 151 `needs_review` targets and 214 review artifacts;
accepted catalogue rows remain unchanged.

## Twenty-fourth parallel exact-reference batch (retrieved 2026-09-02)

Three additional watch configurations passed the Perplexity worker and were
checked against primary manufacturer pages:

- Poljot International Kirovsky II `2415.1981115` — [official product page](https://www.poljot-international.com/produkt/kirovsky?lang=en).
- Pequignet Royale Paris Chrono, silver dial with blue counters `9120313/C` — [official product page](https://showroom.pequignet.com/en/products/montre-royale-paris-chrono-compteurs-bleu-39-5-mm).
- MING 57.05 Comet leather strap — [official product page](https://www.ming.watch/featured-product/ming-57-05-comet-strap). MING publishes the model and configuration but no conventional reference code; a path-like value returned by Perplexity was explicitly rejected.

All three remain research-only `needs_more_evidence`; exact identities and
manufacturer identifiers (or the documented absence of one) are recorded,
unresolved M1 facts remain null, and no catalogue rows were added. The Cuervo
y Sobrinos target was not promoted because all five worker attempts failed
schema validation or lacked a resolved product URL. The manifest now reports
154 `needs_review` targets and 217 review artifacts; accepted catalogue rows
remain unchanged.

## Twenty-fifth parallel exact-reference batch (retrieved 2026-09-02)

Four additional manufacturer configurations passed the Perplexity worker and
were checked against primary brand pages:

- Kurono Tokyo 2026 Anniversary Special Projects Malachite `孔雀石` — [official product page](https://kuronotokyo.com/pages/kurono-anniversary-malachite). The page publishes no conventional reference code; an inferred `CM026B` value was rejected.
- Cuervo y Sobrinos Espléndidos Heritage champagne/silver `2452.1HLE` — [official product page](https://www.cuervoysobrinos.com/swiss-watches/esplendidos/heritage-champagne-silver/).
- Studio Underd0g 01SERIES Desert Sky Gen3 `01DST` — [official product page](https://underd0g.com/products/01dst).
- anOrdain Model 2 Racing Green Large — [official product page](https://anordain.com/products/model-2-racing-green). The page offers selectable movement and strap configurations but no conventional reference code; an inferred `M2RGL` value was rejected.

All four remain research-only `needs_more_evidence`; exact identities and
manufacturer identifiers (or the documented absence of one) are recorded,
unresolved M1 facts remain null, and no catalogue rows were added. Fears
Brunswick 38 remains the next `planned` target because it was not selected by
the coverage planner in this run. The manifest now reports 158 `needs_review`
targets and 221 review artifacts; accepted catalogue rows remain unchanged.

## Twenty-sixth parallel exact-reference batch (retrieved 2026-09-02)

Four additional configurations passed the Perplexity worker and were checked
against primary manufacturer pages:

- Fears Brunswick 38 Polar White — [official product page](https://www.fearswatches.com/products/brunswick-white). Fears publishes no conventional reference code; a path-like value was rejected.
- Vertex M100A — [official product page](https://vertex-watches.com/en-us/products/the-m100).
- Furlan Marri Cornes de Vache Blue Sector — [official product page](https://www.furlanmarri.com/products/blue-sector). The official page confirms the model but does not publish the inferred `20202` value; it was rejected.
- Garrick S7 Timepiece — [official product page](https://garrick.co.uk/products/s7-timepiece).

All four remain research-only `needs_more_evidence`; exact identities and
manufacturer identifiers (or the documented absence of one) are recorded,
unresolved M1 facts remain null, and no catalogue rows were added. The
manifest now reports 162 `needs_review` targets and 225 review artifacts;
accepted catalogue rows remain unchanged.

## Twenty-seventh parallel exact-reference batch (retrieved 2026-09-02)

Three additional configurations passed the Perplexity worker and were checked
against primary manufacturer pages:

- Tornek-Rayville TR-660 w/Sapphire Inlay (1201) Non-date — [official product page](https://tornek-rayville.us/products/tr-660-w-sapphire-inlay-1201-non-date-3167895). The page confirms the exact configuration and specifications, but its displayed `$999,491.00` price is anomalous and a path-like secondary reference was rejected.
- Wolbrook X-15 Limited Edition Skindiver WT Professional Tool-Watch `23-SWP-001-NYB-BLK-X15` — [official product page](https://wolbrook.com/products/skindiver-wt-professional-tool-watch-x-15-edition). The exact manufacturer SKU and configuration are confirmed.
- Benrus TYPE-I BLACK — [official Japan product page](https://www.benrus.co.jp/collection/type1_black.html). The model is confirmed; the retailer-only `TYPE1-BK` string and incorrect `benrus.jp` provisional URL were rejected.

All three remain research-only `needs_more_evidence`; no M1 facts or catalogue
rows were promoted. CWC RN Quartz Diver Mk.2 remains `planned` because all
five worker attempts returned schema-invalid Perplexity payloads and therefore
produced no evidence artifact. The manifest now reports 165 `needs_review`
targets and 228 review artifacts; accepted catalogue rows remain unchanged.

## Twenty-eighth parallel exact-reference batch (retrieved 2026-09-02)

Four additional configurations passed the Perplexity worker and were checked
against primary manufacturer pages:

- Excelsior Park EP 884-SI 01 — [official product page](https://excelsiorparkwatches.com/products/884-si-01). The exact reference and leather configuration are confirmed.
- Ollech & Wajs OW Ocean Graph MkII — [official product page](https://ow-watch.com/products/ow-ocean-graph-1). The exact model is confirmed, while the retailer-only `OW-OCEAN-GRAPH-MKII-2` code and retailer URL were rejected.
- CWC RN Quartz Diver Mk.2 `RN300-MT QS120` — [official product page](https://www.cwcwatch.com/collections/m-o-d-spec/products/cwc-rn-divers-watch-matte-top-mk2). The exact reference and matte-top configuration are confirmed after the earlier schema-invalid attempts.
- Gallet MultiChron Sub — [official Icons page](https://www.gallet.com/us-en/icons/). The historical model is confirmed; `/icons/` was rejected as a non-reference path because Gallet publishes no commercial SKU for it.

All four remain research-only `needs_more_evidence`; no M1 facts or catalogue
rows were promoted. Precista PRS-10 remains `planned` for the next worker run.
The manifest now reports 169 `needs_review` targets and 232 review artifacts;
accepted catalogue rows remain unchanged.

## Twenty-ninth parallel exact-reference batch (retrieved 2026-09-02)

Three additional configurations passed the Perplexity worker and were checked
against primary manufacturer pages:

- Precista Military PRS-10 Sapphire — [official product page](https://www.timefactors.com/products/precista-prs-10-sapphire). The exact model and manufacturer URL are confirmed.
- Universal Genève Compax Prêt-à-Porter `UGCO001` — [official product page](https://www.universalgeneve.com/en/compax-pp/ugco001). The exact reference and panda configuration are confirmed.
- Favre-Leuba Deep Raider Day Date `00.20312.110.02.210` — [official product page](https://www.favreleuba.com/deep-raider-day-date-00-20312-110-02-210). The exact two-tone reference is confirmed; the worker's URL for the neighboring steel variant was rejected.
- Minerva The Unveiled Crownless `MB137544` — [official Montblanc product page](https://www.montblanc.com/en-us/minerva-the-unveiled-crownless-MB137544.html). The exact Minerva model, identifier, and manufacturer URL are confirmed after a dedicated retry.

All four remain research-only `needs_more_evidence`; no M1 facts or catalogue
rows were promoted. Lemania remains `planned` after its worker payloads failed
schema validation and yielded no evidence artifact. The manifest now reports
173 `needs_review` targets and 236 review artifacts; accepted catalogue rows
remain unchanged.

## Thirtieth parallel exact-reference batch (retrieved 2026-09-03)

Three additional configurations passed the Perplexity worker and were checked
against primary manufacturer pages:

- Eterna 1942 Heritage Pulsometer Limited Edition `1942.41.80.1177` — [official product page](https://shop.eterna.com/en-ch/products/1942-heritage-pulsometer). The exact light-blue reference and manufacturer URL are confirmed.
- Movado Museum Classic `0607963` — [official product page](https://www.movado.com/us/en/shop-watches/museum-classic-0607963.html). The exact black-PVD reference and manufacturer URL are confirmed.
- Cyma Grand Maestro The Chess `W02-00818-001` — [official product page](https://cyma.ch/products/w02-00818-001). The exact reference is confirmed against the manufacturer page; the retailer-only provisional URL was rejected.

All three remain research-only `needs_more_evidence`; no M1 facts or catalogue
rows were promoted. Montblanc `MB129371` and Lemania remain `planned` pending
valid exact-reference evidence. The manifest now reports 176 `needs_review`
targets and 239 review artifacts; accepted catalogue rows remain unchanged.

## Thirty-first parallel exact-reference batch (retrieved 2026-09-03)

Three additional configurations passed the Perplexity worker and were checked
against primary manufacturer pages:

- Rotary RW 1895 Pilot Automatic `GB05470/52` — [official product page](https://rotarywatches.com/products/rotary-commando-gents-watch-gb05470-52). The exact reference and configuration are confirmed.
- Roamer Premier Automatic `986983 47 85 20` — [official product page](https://roamer.ch/products/premier-automatic-2). The exact SKU is confirmed; the worker's family URL was rejected.
- Cortébert Northstar `CB-3004-44` — [official product page](https://cortebert1790.com/products/northstar-sunset-gold-cb-3004-44). The exact reference is confirmed; the worker's home-page URL was rejected.

All three remain research-only `needs_more_evidence`; no M1 facts or catalogue
rows were promoted. Record Watch Co. remains `planned` because no exact signed
watch identity survived schema validation. The manifest now reports 179
`needs_review` targets and 242 review artifacts; accepted catalogue rows remain
unchanged.

## ZRC 1904 exact variants

ZRC 1904 is present in the last-100 source list but has no linked knowledge
dossier in the 204-brand manifest, so these are documented as verified research
leads rather than inserted into the catalogue. The official [Grands Fonds
Heritage collection](https://zrc1904.com/category/collections/watches-grands-fonds/gf-heritage/)
currently confirms six separate 39 mm configurations:

- `GF3811121113` [S2-Metal](https://zrc1904.com/product/gf3811121113-s2-metal/) — steel bracelet and ceramic bezel.
- `GF3811121118` [S2-Rubber](https://zrc1904.com/product/s2-rubber-new/) — FKM Tropic rubber and ceramic bezel.
- `GF3813231114` [Chesnut](https://zrc1904.com/product/gf3813231114-chesnut/) — brown gradient dial and aluminium bezel.
- `GF3815235118` [Crimson](https://zrc1904.com/product/crimson-gf3815235118/) — red gradient dial, date, and FKM Tropic rubber.
- `GF3813121318` [Smoke](https://zrc1904.com/product/heritage-smoke-gf3813121318/) — smoke dial, no date, and FKM Tropic rubber.
- `GF3811231314` [Milanese](https://zrc1904.com/product/gf3811231314-milanese/) — Milanese mesh, aluminium bezel, and date.

All six share the family-level 39 mm steel monobloc, crown-at-6, sapphire, and
300 m water-resistance architecture, but the exact bezel, dial, date, and
attachment boundaries differ. The structured S2-Rubber configuration is used
over an inconsistent prose sentence on that page: it specifies FKM Tropic
rubber and a pin buckle. A ZRC dossier and exact research targets must be added
before these references can enter the manifest or PostgreSQL.

## Thirty-second parallel exact-reference batch (retrieved 2026-09-03)

Four additional configurations passed the Perplexity worker and were checked
against primary or specialist reference sources:

- Enicar Sherpa Graph `072-02-01` — [specialist reference guide](https://enicar101.com/sherpa-graph-mkiii/). The historical exact reference is confirmed; no current manufacturer page exists for this vintage model.
- Solvil et Titus Saber 3 Hands Date Automatic `W06-03423-001` — [official global storefront](https://www.solvil-et-titus.com/). The exact reference is listed by the manufacturer at the Saber collection/homepage level, and the exact product route is retained.
- Smiths Everest PRS-25 36mm — [official Time Factors product page](https://www.timefactors.com/products/smiths-everest-prs-25-36mm-black-dial). The exact reference and black-dial configuration are confirmed; the current sold-out state does not invalidate identity.
- Sea-Gull 1963 Times Edition Reissue `819.17.1963A` — [official product page](https://en.seagullwatch.com/tr/products/seagull-1963-chronograph-watch-times-edition-reissue-37-3mm-1963a). The exact model number and 37.3mm configuration are confirmed.

All four remain research-only `needs_more_evidence`; no M1 facts or catalogue
rows were promoted. Every accepted identity has an explicit source check, while
the incomplete M1 fields remain null. The manifest now reports 183
`needs_review` targets and 246 review artifacts; accepted catalogue rows remain
unchanged.

## Thirty-third parallel exact-reference batch (retrieved 2026-09-03)

Four additional configurations passed the Perplexity worker and were checked
against primary or specialist reference sources:

- Shanghai A623 Revival `SD078.1553.018.08` — [official product page](https://shanghaiwatch.com/products/shanghai-watch-in-red-a623-revival-mechanical-watch). The exact reference and 36mm configuration are confirmed.
- Beijing The Great Wall Watch `BG030007` — [official product page](https://beijingwatches.com/products/beijing-the-great-wall-brick-texture-dial-watch-41mm). The exact reference and brick-texture 41mm configuration are confirmed.
- HMT Pilot vintage hand-wound — [specialist collection page](https://clockhouse.in/collection/hmt/hmt-pilot-hand-wound). The model identity is confirmed, but no single factory reference is established; the worker's URL path was rejected as a reference code.
- Luch One-hand `71950990` — [official product page](https://luch.by/en/kollektsii/odnostrelochnik/71950990/). The exact reference is confirmed.

All four remain research-only `needs_more_evidence`; no M1 facts or catalogue
rows were promoted. HMT remains explicitly reference-ambiguous rather than
receiving an invented code. The manifest now reports 187 `needs_review` targets
and 250 review artifacts; accepted catalogue rows remain unchanged.

## Thirty-fourth parallel exact-reference batch (retrieved 2026-09-03)

Four additional configurations passed the Perplexity worker and were checked
against primary or specialist reference sources:

- Slava Tradition `1221434/300-2427` — [specialist reference page](https://smirs.com/russian-watches/td-slava/slava-2427/). The exact historical configuration is confirmed; no current official product page was found.
- Molnija AChS-1 Version 6.0 `0010102-6.0` — [official manual](https://molnija.shop/upload/iblock/2fc/ozd49mm954gaa5e835k1a8p6rfioh3nb.pdf). The manufacturer confirms the Version 6.0 model; the exact article code comes from a specialist retailer and the retailer URL was not promoted.
- AGAT 295 Damascus 46mm article `46-1206` — [official product page](https://agatwatch.ru/collection/exclusive/chasy-agat-295-damask-46-mm/). The exact article and configuration are confirmed.
- Union Glashütte Belisar Chronograph Sport `D014.927.11.057.00` — [official product page](https://www.union-glashuette.com/en_int/d0149271105700.html). The exact reference and stainless-steel/ceramic configuration are confirmed.

All four remain research-only `needs_more_evidence`; no M1 facts or catalogue
rows were promoted. The manifest now reports 191 `needs_review` targets and
254 review artifacts; accepted catalogue rows remain unchanged.

## Thirty-fifth parallel exact-reference batch (retrieved 2026-09-03)

Four additional configurations passed the Perplexity worker and were checked
against primary or specialist reference sources:

- MeisterSinger N°01 Ivory `AM3303` — [official N°01 collection](https://meistersinger.com/en/category/all-watches/classic/n01/) plus [specialist reference listing](https://www.uhrenschmuck24.ch/en/meistersinger-n-01-elfenbein-o-43mm-am3303.html). The model is confirmed by the manufacturer and the exact variant code by the secondary listing.
- Schaumburg Watch AQM 4 1/2 product no. `1013` — [official product page](https://www.schaumburgwatch.net/en/p/aqm-4-1-2). The exact model and product number are confirmed; the worker's secondary `SCH-AQM412` code was rejected.
- Kudoke Classic — [official product page](https://www.kudoke.eu/en/classic-2/). The exact model is confirmed; the page publishes no numeric reference code, so the worker's model label was rejected as a code.
- Lang & Heyne Hektor Edition II — [official product page](https://www.lang-und-heyne.de/en/modelle/hektor-edition-ii/). The exact model is confirmed; the URL path was rejected as a reference code.

All four remain research-only `needs_more_evidence`; no M1 facts or catalogue
rows were promoted. The manifest now reports 195 `needs_review` targets and
258 review artifacts; accepted catalogue rows remain unchanged.

## Thirty-sixth parallel exact-reference batch (retrieved 2026-09-03)

Four additional configurations passed the Perplexity worker and were checked
against primary or specialist reference sources:

- Bruno Söhnle Stuttgart Automatik II Big `17-12173-361` — [official product page](https://www.brunosoehnle-glashuette.com/de/herrenuhren/extravagant/stuttgart-automatik-ii-big-17-12173-361). The exact product number and configuration are confirmed.
- Moritz Grossmann Benu Power Reserve `MG-003704` — [official model page](https://en.grossmann-uhren.com/watch/power-reserve/) plus [specialist reference source](https://monochrome-watches.com/2025-new-sector-dials-moritz-grossmann-benu-power-reserve-price-introducing/). The model family is confirmed by the manufacturer and the exact sector-dial reference by specialist editorial evidence.
- Sarpaneva Korona K3 Northern Stars Guilloché — [official product page](https://studiosarpaneva.com/products/k3-northern-stars-guilloche). The exact model and Candy Factory Pink configuration are confirmed; the descriptive label was not treated as a reference code.
- Habring² Doppel-Felix A11R — [official archive page](https://www.habring2.com/index.php/en/archive/doppel-felix). The exact model is confirmed; the worker's URL path was rejected as a reference code and A11R is retained only as movement context.

All four remain research-only `needs_more_evidence`; no M1 facts or catalogue
rows were promoted. The manifest now reports 199 `needs_review` targets and
262 review artifacts; accepted catalogue rows remain unchanged.

## Thirty-seventh parallel exact-reference batch (retrieved 2026-09-03)

Four additional configurations passed the Perplexity worker and were checked
against primary or specialist reference sources:

- D. Dornblüth & Sohn Caliber 99.1-M `99.1-M` — [official product page](https://www.dornblueth.com/details-en-D.Dornbl%C3%BCth%20&%20Sohn%20-%20caliber%2099.1-M%20small%20second%2040mm-23.html). The exact small-second 40mm configuration and reference are confirmed.
- Greubel Forsey Quadruple Tourbillon Secret — [official history page](https://greubelforsey.com/en/history-timepieces/quadruple-tourbillon-secret). The exact model and limited configuration are confirmed; the URL path was not treated as a reference code.
- Philippe Dufour Simplicity 37mm white gold — [official maker page](https://philippedufour.ch/en/philippe-dufour/) plus [Phillips auction record](https://www.phillips.com/detail/philippe-dufour/130502). The model is confirmed and the reviewed-market configuration is retained, but no manufacturer reference code is established.
- Roger W. Smith Series Two 40mm yellow gold — [official Watches page](https://rwsmithwatches.com/watches) plus [specialist retailer archive](https://www.acollectedman.com/products/buy-roger-smith-series-2-yellow-gold-watch). The Series Two family and 40mm option are confirmed; the URL path was not treated as a reference code.

All four remain research-only `needs_more_evidence`; no M1 facts or catalogue
rows were promoted. The manifest now reports 203 `needs_review` targets and
266 review artifacts; accepted catalogue rows remain unchanged.

## Thirty-eighth parallel exact-reference batch (retrieved 2026-09-03)

Four additional configurations passed the Perplexity worker and were checked
against primary or specialist reference sources:

- Romain Gauthier Continuum Titanium Edition One `MON00500` — [FHH reference page](https://www.hautehorlogerie.org/fr/watches-and-culture/paysage-horloger/montres-et-nouveautes/continuum-titanium-edition-one) plus [specialist reference page](https://www.thewatchpages.com/watches/romain-gauthier-c-by-romain-gauthier-titanium-edition-one-mon00500/). The exact 28-piece titanium configuration and reference are confirmed.
- Grönefeld 1941 Principia `G-06` — [official configuration page](https://www.gronefeld.com/model/white-gold-br-or-br-stainless-steel-6). The exact model, G-06 calibre, and white-gold/light-blue configuration are confirmed.
- RESSENCE TYPE 1 Slim Black `T13S-BXX1-VBA` — [official product page](https://ressencewatches.com/products/type-1-slim-black). The exact product SKU and configuration are confirmed; ROCS 1.3 is retained as movement context, not a watch reference.
- Trilobe Nuit Fantastique Grained Silver `NF05AG` — [official product page](https://trilobe.com/us/collections/nuit-fantastique/grained-silver/). The exact model, reference, titanium construction, and selectable case-size boundary are confirmed.

All four remain research-only `needs_more_evidence`; no M1 facts or catalogue
rows were promoted. The manifest now reports 207 `needs_review` targets and
270 review artifacts; accepted catalogue rows remain unchanged.

## Thirty-ninth parallel exact-reference batch (retrieved 2026-09-03)

Four additional configurations passed the Perplexity worker and were checked
against primary or specialist reference sources:

- Singer Reimagined Track1 Flamboyant Red Edition `SR007` — [official Track1 product page](https://singerreimagined.com/singer-track1-sklt-edition/) plus [specialist exact-version article](https://monochrome-watches.com/the-singer-reimagined-track-1-flamboyant-red-edition-specs-price/). The Track1 family and exact Flamboyant Red configuration are confirmed.
- BYRNE Gyro Dial Zero — [official product page](https://en.byrnewatch.com/byrne-gyro-dial-311-zero). The exact model and configuration are confirmed; no separate manufacturer reference code is published.
- HYT Moon Runner Desert `H02984-A` — [official product page](https://www.hytwatches.com/en/moonrunner/desert/index.html). The exact reference, configuration, and limited-edition boundary are confirmed.
- Hautlence Vortex Bronze — [specialist exact-version article](https://monochrome-watches.com/hautlence-vortex-bronze-extreme-high-end-goes-bronze-well-live-photos-specs-price/). The historical model is confirmed; `HLR2` is retained as movement context, not a watch reference.

All four remain research-only `needs_more_evidence`; no M1 facts or catalogue
rows were promoted. The manifest now reports 211 `needs_review` targets and
274 review artifacts; accepted catalogue rows remain unchanged.

## Fortieth parallel exact-reference batch (retrieved 2026-09-03)

Four additional configurations passed the Perplexity worker and were checked
against primary or specialist reference sources:

- Jacob & Co. Astronomia Sky `AT110.40.AA.AA.A` — [specialist exact-reference page](https://www.thewatchpages.com/watches/jacob-co-astronomia-sky-at11040aaaaa) plus [official Astronomia Sky locator](https://jacobandco.com/timepieces/astronomia-sky). The exact rose-gold/yellow-sapphire identity and reference are retained; the official locator was not used to promote M1 facts.
- Franck Muller Cintrée Curvex Crazy Hours `5850CHDCODR30CD5NE` — [official Crazy Hours page](https://www.franckmuller.com/crazy-hours) and [official US catalogue](https://franckmuller-usa.com/cintree_curvex_men_crazy_hours). The exact 30th Anniversary Color Dreams reference is confirmed.
- Roger Dubuis Excalibur Double Tourbillon `RDDBEX1131` — [official product page](https://www.rogerdubuis.com/watches/excalibur/double-tourbillon-white-gold-45mm-rddbex1131). The exact white-gold 45mm reference is confirmed.
- Gérald Charles Maestro 2.0 Ultra-Thin `GC2.0-A-00` — [official model page](https://www.geraldcharles.com/products/maestro-2-0-ultra-thin-green) plus [authorized retailer exact black listing](https://www.mayors.com/Gerald-Charles-Maestro-2.0-Ultra+Thin-39mm-Mens-Watch-Black-GC2.0+A+00/p/18620001). The exact black-dial reference is corroborated; no M1 fact is promoted from the retailer listing.

All four remain research-only `needs_more_evidence`; no M1 facts or catalogue
rows were promoted. The manifest now reports 215 `needs_review` targets and
278 review artifacts; accepted catalogue rows remain unchanged.

## Forty-first parallel exact-reference batch (retrieved 2026-09-03)

Four additional configurations passed the Perplexity worker and were checked
against primary or specialist reference sources:

- Daniel Roth Extra Plat Platinum `DBBG01A1` — [official Extra Plat page](https://www.danielroth.com/watch/extraplat/extraplat-souscription/) plus [specialist platinum launch report](https://monochrome-watches.com/2026-daniel-roth-extra-plat-platinum-edition-grey-guilloche-dial-introducing-price/). The exact platinum reference is confirmed; the official page currently exposes the yellow-gold Souscription configuration, so no M1 fact is transferred across variants.
- Gérald Genta Arena Retrograde with Smiling Disney Mickey Mouse `103613` — [specialist exact-version report](https://www.monochrome-watches.com/gerald-genta-arena-retrograde-with-smiling-disney-mickey-mouse-2021-hands-on-price/) plus [exact-reference listing](https://www.thewatchpages.com/watches/gerald-genta-arena-retro-mickey-mouse-disney-103613). The exact reference and 150-piece identity are corroborated; the current Bulgari site no longer exposes the historical product page.
- ArtyA Purity Tourbillon Sport Edition Orange — [official product page](https://www.artya.com/purity-tourbillon-sport) plus [specialist introduction](https://monochrome-watches.com/introducing-artya-purity-tourbillon-sport-edition-sapphire-crystal-telos-skeleton-specs-price/). The exact model and orange configuration are confirmed, but no manufacturer reference code is published.
- Louis Moinet Memoris Spirit `LM-84.20.50` — [official product page](https://louismoinet.com/watches/memoris-spirit-lm-84-20-50/). The exact titanium reference, 60-piece boundary, and product identity are confirmed.

All four remain research-only `needs_more_evidence`; no M1 facts or catalogue
rows were promoted. The manifest now reports 219 `needs_review` targets and
282 review artifacts; accepted catalogue rows remain unchanged.

## Forty-second parallel exact-reference batch (retrieved 2026-09-03)

Four additional configurations passed the Perplexity worker and were checked
against primary or specialist reference sources:

- L'Epée 1839 Time Machine Bucherer Exclusive `74.6001/114_BUC` — [official model page](https://www.lepee1839.ch/collection/collections-creative-art/time-machine) plus [Bucherer listing](https://www.bucherer.com/de/en/watches/l%E2%80%99epee/time-machine-2/1392-063-3.html). The exact clock reference is confirmed; the review explicitly preserves that this is a table clock, not a wristwatch.
- Louis Erard x Alain Silberstein Le Régulateur `85358TT09.BTT82` — [official product page](https://www.louiserard.com/products/le-regulateur-louis-erard-x-alain-silberstein-2). The exact collaboration reference is confirmed; the worker's mismatching reference was rejected.
- Ikepod Hemipod gen3 02 `HE02-RU-LB` — [official Hemipod collection](https://ikepod.com/en/30-hemipod) plus [official product URL](https://ikepod.com/en/watches/250-hemipod-he02-gen3.html). The exact product code is confirmed; the direct product page's conflicting title is not used to alter the collection identity.
- DeWitt Academia Endless Drive `AC.ED.001` — [official product page](https://dewitt.ch/product/academia-endless-drive/) plus [specialist exact-reference report](https://monochrome-watches.com/dewitt-academia-endless-drive-hands-on-price/). The exact reference and rose-gold/black-rubber configuration are confirmed.

All four remain research-only `needs_more_evidence`; no M1 facts or catalogue
rows were promoted. The manifest now reports 223 `needs_review` targets and
286 review artifacts; accepted catalogue rows remain unchanged.

## Forty-third parallel exact-reference batch (retrieved 2026-09-03)

Three configurations passed the Perplexity worker and were checked against
primary or specialist reference sources:

- Armand Nicolet JS9-41 Diver `A481AGN-NR-MA2481AA` — [official product page](https://www.armandnicolet.com/product-page/a481agn-nr-ma2481aa) plus [exact-reference listing](https://www.thewatchpages.com/watches/armand-nicolet-js9-41-a481agn-nr-ma2481aa/). The exact black-dial steel-bracelet reference is confirmed.
- Mathey-Tissot Type 21 Chrono Automatic `H1821CHATLNO` — [official product page](https://matheytissot.com/products/type-21-chrono-automatic-h1821chatlno). The exact reference and configuration are confirmed.
- Delma Blue Shark IV `54701.760.6.034` — [official black/black product page](https://www.delmawatches.com/products/blue-shark-4-black-black). The canonical SKU is confirmed; the worker's mismatching code was rejected.

Claude Meylan Tortue Swirls remains `planned` because six Perplexity attempts
did not produce a schema-valid exact product URL. The three confirmed targets
remain research-only `needs_more_evidence`; no M1 facts or catalogue rows were
promoted. The manifest now reports 226 `needs_review` targets and 289 review
artifacts; accepted catalogue rows remain unchanged.

## Forty-fourth parallel exact-reference batch (retrieved 2026-09-03)

Four additional configurations passed the Perplexity worker and were checked
against primary or specialist reference sources:

- Davosa Argonautic 39 `161.532.50` — [official product page](https://www.davosa.com/en-int/products/argonautic-39-16153250) explicitly confirms the model, reference, and black-dial steel-bracelet product identity.
- Steinhart Ocean One 39 nova green `103-1547` — [official English product page](https://www.steinhartwatches.de/en/ocean-one-39-nova-green.html) and [official German product page](https://www.steinhartwatches.de/de/taucheruhren/ocean-one-39-nova-green.html) confirm the exact SKU. The worker's URL path was rejected as a reference code.
- Archimede Pilot 42 A . LS `UA7929-A1.1` — [official exact product page](https://www.archimede-watches.com/us/Pilot-42-A-.-LS/) and [official Pilot 42 family page](https://www.archimede-watches.com/us/PILOT/PILOT-42/) confirm the exact leather-strap configuration and product number.
- Guinand Werksfahrer Chrono 1 — [official product page](https://www.guinand-uhren.de/werksfahrer-en.html) and [specialist announcement](https://uhrforum.de/threads/neue-uhr-guinand-werksfahrer-chrono-1.371191/page-2) confirm the exact Series 60 chronograph model. No separate manufacturer reference is published; the worker's inferred `.60.50.01` was rejected.

All four remain research-only `needs_more_evidence`; no M1 facts or catalogue
rows were promoted. The manifest now reports 230 `needs_review` targets and
293 review artifacts; accepted catalogue rows remain unchanged. Four goals
remain `planned`, including Claude Meylan Tortue Swirls.

## Forty-fifth parallel exact-reference batch (retrieved 2026-09-03)

Three additional research targets produced schema-valid Perplexity results and
were checked against primary or specialist reference sources:

- Montblanc 1858 Iced Sea Automatic Date `MB129371` — [official product page](https://www.montblanc.com/en-us/montblanc-iced-sea-automatic-date-MB129371.html) confirms the exact black steel-and-ceramic configuration and identifier.
- Heuer Lemania 5100 Chronograph `510.500` — [OnTheDash exact-reference page](https://www.onthedash.com/chronograph/reference-510-500-stainless-steel-finish/) and [specialist dealer archive](https://www.bachmann-scher.de/en/sold-watches/heuer-vintage-chronograph-ref-510500-stainless-steel-lemania-5100-bj-1977-6096.html) confirm the Heuer-branded stainless-steel watch and Lemania 5100 calibre. The target's “Lemania-signed” label was corrected in the review rather than treating the movement maker as the watch brand.
- Claude Meylan Tortue Swirl — [GPHG watch listing](https://www.gphg.org/en/watches/tortue-swirl) and [specialist hands-on](https://monochrome-watches.com/hands-on-new-claude-meylan-tortue-swirls-specs-price/) confirm the model. The sources describe two steel case expressions and publish no separate manufacturer reference, so the URL path was rejected as a code and the exact case variant remains unresolved.

Record Watch Co. remains `planned`: the worker returned no exact candidate
identity, and no review artifact was created. The three confirmed model-level
targets remain research-only `needs_more_evidence`; no M1 facts or catalogue
rows were promoted. The manifest now reports 233 `needs_review` targets, 296
review artifacts, and one remaining `planned` target; accepted catalogue rows
remain unchanged.

## Forty-ninth exact-reference negative result (retrieved 2026-09-03)

The Record Watch Co. signed-vintage-automatic target was checked through
Perplexity and its source set. The historical brand account supports a
discontinued Record Watch Co. line and historical automatic production, but the
available forum and marketplace material combines unrelated Calatrava, Datofix,
chronometer, military, and other vintage examples. No source chain establishes
one authenticated, materially homogeneous reference with a stable product URL.

The target is therefore recorded as `needs_more_evidence` with all M1 fields
missing. No catalogue row is promoted, and the historical Record Watch Co. line
is explicitly kept separate from the modern Longines Record collection. The
manifest now reports 246 `needs_review` targets, zero `planned` targets, and 309
review artifacts; accepted catalogue rows remain unchanged.

## Fiftieth parallel exact-reference batch (retrieved 2026-09-03)

Four additional dossier models were checked after schema-valid Perplexity
extraction:

- SevenFriday M-Series M2/02 — [official India product page](https://in.sevenfriday.com/products/sf-m2-02) confirms the exact reference and current regional technical card; the global manufacturer route was also checked.
- SevenFriday Q-Series Q2/03 “CHOO-CHOO” — [official product page](https://www.sevenfriday.com/products/sf-q2-03) confirms the exact reference, configuration, Fast Strap Changer, Miyota 8219, and 3 ATM rating.
- REC Watches Mark I M1 Mini Cooper `REC-M1` — [Mini specialist evidence](https://www.somerfordmini.co.uk/mark-i-discover-collection) and an [exact-reference retailer listing](https://watchard.com/rec-mark-i-chronograph-m1-men-s-watch) corroborate the historical model; no current REC factory page was found.
- REC Watches DNA Edition RJM-01 — [official product page](https://www.recwatches.com/timepieces/limited-editions/aircraft/rjm-01/) confirms the exact Spitfire-derived reference and sold-out status.

All four remain research-only `needs_more_evidence`; no M1 facts or catalogue
rows were promoted. The manifest now reports 250 `needs_review` targets, zero
`planned` targets, and 313 review artifacts; accepted catalogue rows remain
unchanged.

## Fifty-first parallel exact-reference batch (retrieved 2026-09-03)

Four additional dossier models were checked after schema-valid Perplexity
extraction:

- Shinola Detrola Watch - Nude — [official product page](https://www.shinola.com/products/detrola-watch-nude) confirms the exact 41 mm configuration and SKU `S0120307637-1-Nude-41-USA`.
- Shinola Lake Ontario Monster Automatic Dive Watch 39 mm — [official product page](https://www.shinola.com/products/monster-automatic-dive-watch-lake-ontario) confirms the current exact product and publishes SKU `S0120484266-1-LakeGrnMOP-39-CHE`; the worker's `USA` suffix was rejected as a localization conflict.
- FIYTA Extreme `WGA868001.BBB` — [exact-reference retail evidence](https://www.jamtangan.com/p/fiyta-extreme-wga868001.bbb-men-3d-time-automatic-black-leather-nato-strap-86241) identifies the reference, but no live factory page was located.
- FIYTA Aerospace Space Walk `GA880026.WBW` — [specialist retailer evidence](https://chinawatchshop.com/products/4014) and [technical retailer corroboration](https://www.good-stuffs.com/Fiyta-Space-Walk-Chronograph-Watch-Grade-5-Titanium-ETA-7750-18K-Gold-Coin-Aerospace-Series-GA880026WBW-_p_898.html) agree on the exact reference; manufacturer-level product evidence was not located.

All four remain research-only `needs_more_evidence`; no M1 facts or catalogue
rows were promoted. The manifest now reports 254 `needs_review` targets, zero
`planned` targets, and 317 review artifacts; accepted catalogue rows remain
unchanged.

## Fifty-second parallel exact-reference batch (retrieved 2026-09-03)

Three of four Grand Seiko references returned schema-valid Perplexity results
and were checked against official pages:

- Heritage Spring Drive “Shunbun” `SBGA413` — [official product page](https://www.grand-seiko.com/us-en/collections/sbga413g) confirms the exact 62GS configuration.
- Heritage quartz `SBGX261` — [official product page](https://www.grand-seiko.com/us-en/collections/sbgx261g) and [official boutique listing](https://grandseikoboutique.us/products/watch-quartz-37mm-black-sbgx261) confirm the exact black-dial 37 mm configuration.
- Evolution 9 White Birch `SLGH005` — [official White Birch page](https://www.grand-seiko.com/us-en/special/whitebirch/slgh005) confirms the exact reference and 9SA5 identity; the collection route was also checked.
- Heritage 44GS `SBGW291` — eight Perplexity attempts failed schema validation because the provider repeatedly marked null values as observed; it remains `planned` with no review artifact and no claims accepted.

The three successful targets remain research-only `needs_more_evidence`; no M1
facts or catalogue rows were promoted. The manifest now reports 257
`needs_review` targets, one `planned` target, and 320 review artifacts; accepted
catalogue rows remain unchanged.

## Forty-sixth parallel exact-reference batch (retrieved 2026-09-03)

Four additional configurations produced schema-valid Perplexity results and
were checked against official or specialist reference sources:

- Limes Endurance GMT `. BL.R` `U8778R-LG2BL-1.1` — [official product page](https://www.limes-watches.com/diver/endurance-gmt/340/endurance-gmt.-bl.r) explicitly confirms the exact model, reference, and configuration.
- Nivrel Deep Ocean `N 145.001 CASMB` — [official product page](https://www.nivrel.com/en/deep-ocean_119_1068) confirms the item number, model, and exact black steel-bracelet product identity. The page currently marks it out of stock, so availability was not treated as production proof.
- Alexander Shorokhoff Levels `AS.DT03-3` — [specialist exact-reference listing](https://www.thewatchpages.com/watches/alexander-shorokhoff-levels-asdt03-3) and [Alexander Shorokhoff distributor record](https://www.alexander-shorokhoff.sk/eshop/levels/p-142.xhtml) corroborate the exact reference and blue Levels configuration. The manufacturer's reference URL was identified but exceeded the browser fetch limit.
- Poljot International Basilika Chronograph `3133.8031888` — [specialist product page](https://www.poljot24.de/en/basilika.html) confirms the SKU, 44mm steel case, and Poljot 3133 configuration. The linked manufacturer page was not fetchable, so this remains specialist-source confirmed and research-only.

All four remain research-only `needs_more_evidence`; no M1 facts or catalogue
rows were promoted. The manifest now reports 237 `needs_review` targets, 300
review artifacts, and one remaining `planned` target; accepted catalogue rows
remain unchanged.

## Forty-seventh parallel exact-reference batch (retrieved 2026-09-03)

Four additional configurations produced schema-valid Perplexity results and
were checked against official or specialist sources:

- Zarya `G5241401` — [Zarya product-store page](https://zaria-time.ru/shop/watchzaria/zarja-g5241401/) confirms the exact SKU and black-dial leather-strap configuration.
- Meccaniche Veloci QuattroValvole Nardi Edition `W10NV1NE` — [official product page](https://www.meccanicheveloci.com/en/watches/quattrovalvole/quattrovalvole-collection/quattrovalvole-nardi-edition) explicitly confirms the watch reference. The worker's `MV8802` was rejected as the calibre, not the watch reference.
- Gorilla Fastback GT Modena `FBY21.0` — [specialist exact-model listing](https://www.thewatchpages.com/watches/gorilla-fastback-gt-modena) confirms the model/configuration, while [retailer evidence](https://www.elpalaciodehierro.com/gorilla-reloj-fastback-gt-modena-unisex-42795354.html) corroborates model FBY21.0.
- Dietrich SD-1 Skin Diver Pacific Blue — [official product page](https://dietrich.com/product/sd1-pacific-blue/) confirms the exact product configuration. No separate manufacturer reference code is published; the worker's marketing name was not promoted as a reference.

All four remain research-only `needs_more_evidence`; no M1 facts or catalogue
rows were promoted. The manifest now reports 241 `needs_review` targets, 304
review artifacts, and one remaining `planned` target; accepted catalogue rows
remain unchanged.

## Forty-eighth parallel exact-reference batch (retrieved 2026-09-03)

Four further configurations produced schema-valid Perplexity results and were
checked against current manufacturer pages where available:

- SevenFriday P-Series P1B/01 Industrial Essence — [official product page](https://www.sevenfriday.com/products/sf-p1b-01) confirms the exact reference, 47 x 47.6 mm stainless-steel configuration, black leather strap, Miyota 82S7, 3 ATM rating, and current price. The bracelet P1B/01M remains a separate configuration.
- REC Watches P51-01 Mustang — [official product page](https://www.recwatches.com/timepieces/limited-editions/muscle-cars/p51-01/) confirms the exact DNA Edition, salvaged Mustang provenance, limited run, and reference-specific technical block; [the current product route](https://www.recwatches.com/timepieces/p51-01/) shows the same identity and sold-out status.
- Shinola Runwell Watch - White — [official product page](https://www.shinola.com/products/runwell-watch-white) confirms the exact 41 mm white-dial SKU `S0110000109-1-Wht-41-USA`, Argonite 1069 quartz movement, 10.1 mm thickness, 5 ATM rating, and tan leather configuration.
- FIYTA Photographer Automatic Skeleton `GA860012.BBB` — [exact-reference dealer evidence](https://www.good-stuffs.com/Fiyta-Photographer-series-automatic-wristwatch-GA860012BBB_p_360.html) and [independent dealer corroboration](https://novahora.com/gb/fiyta-photographer/8470-fiyta-photographer-watch-ga860012bbb.html) agree on the identity. A live FIYTA factory product page for this reference was not located, so this remains secondary-source confirmation.

All four remain research-only `needs_more_evidence`; no M1 facts or catalogue
rows were promoted. The manifest now reports 245 `needs_review` targets, 308
review artifacts, and one remaining `planned` target; accepted catalogue rows
remain unchanged.

## Fifty-fifth parallel exact-reference batch (retrieved 2026-09-03)

Five remaining Citizen dossier references produced schema-valid Perplexity
results and were checked against official Citizen pages:

- Series 8 880 GMT `NB6030-59L` — [official Citizen Canada product page](https://www.citizenwatch.com/ca/en/product/NB6030-59L.html) confirms the exact reference, blue dial, steel bracelet, 9054 automatic movement, and GMT configuration.
- Attesa Satellite Wave GPS `CC4055-65E` — [official Citizen LATAM product page](https://www.citizenwatch.com/latam/producto/CC4055-65E.html?cgid=caballero-satellite-wave) confirms the exact reference, Super Titanium/DLC case and bracelet, F950 Eco-Drive, and Satellite Wave GPS configuration.
- The Citizen Chronomaster `AQ4091-56M` — [official Citizen Global lineup](https://www.citizenwatch-global.com/the-citizen/lineup/5sec/product/index.html) confirms the exact reference, hand-dyed indigo Washi dial, Super Titanium, A060 Eco-Drive, and ±5 seconds-per-year specification.
- The Citizen Caliber 0100 `AQ6021-51E` — [official Citizen US product page](https://www.citizenwatch.com/us/en/product/AQ6021-51E) confirms the exact limited-edition reference, Caliber 0100 Eco-Drive, Super Titanium case and bracelet, and black dial.
- Campanola Cosmosign `AO4010-51E` — [official Campanola product page](https://www.citizenwatch-global.com/campanola/collection/AO4010-51E.html) confirms the exact reference, Caliber 4398, black dial, stainless-steel case and bracelet, and Cosmosign astronomical display.

All five remain research-only `needs_more_evidence`; no M1 facts or catalogue
rows were promoted. The manifest now reports 270 `needs_review` targets, one
remaining `planned` target, and 333 review artifacts; accepted catalogue rows
remain unchanged. The direct Japanese Citizen URLs for the Attesa and
Chronomaster were retained as fetch-blocked provenance, while accessible
official regional/global pages independently confirmed both references.

## Fifty-sixth parallel exact-reference batch (retrieved 2026-09-03)

Five remaining Seiko dossier references produced schema-valid Perplexity
results and were checked against official Seiko product pages:

- Prospex Turtle `SRPE93` — [official Seiko USA product page](https://seikousa.com/products/srpe93) confirms the exact reference, black-dial silicone-strap configuration, 4R36 automatic movement, and 200 m dive rating.
- Prospex Samurai `SRPL13` — [official Seiko USA product page](https://seikousa.com/products/srpl13) confirms the exact reference, black-dial steel-bracelet configuration, 4R35 automatic movement, and 200 m dive rating.
- Presage Cocktail Time `SRPB43J1` — [official Seiko Malaysia product page](https://www.seikowatches.com/my-en/products/presage/srpb43j1) confirms the exact reference, 4R35 automatic movement, leather band, 40.5 mm case, and 5 bar rating.
- King Seiko KSK `SPB281J1` — [official Seiko Boutique Malaysia listing](https://seikoboutique.com.my/product/spb281j1/) confirms the exact reference, 6R31 automatic movement, and 37 mm by 43.6 mm case geometry.
- Astron GPS Solar `SSJ013J1` — [official Seiko US product page](https://www.seikowatches.com/us-en/products/astron/ssj013j1) confirms the exact reference, 3X62 GPS Solar movement, titanium case, and GPS/date configuration.

All five remain research-only `needs_more_evidence`; no M1 facts or catalogue
rows were promoted. The manifest now reports 275 `needs_review` targets, one
remaining `planned` target, and 338 review artifacts; accepted catalogue rows
remain unchanged.

## Fifty-seventh parallel exact-reference batch (retrieved 2026-09-03)

Five remaining Tissot dossier references produced schema-valid Perplexity
results and were checked against official Tissot US product pages:

- PRX Quartz 35 `T137.210.11.031.00` — [official product page](https://www.tissotwatches.com/en-us/T1372101103100.html) confirms the exact reference, silver dial, quartz movement, and steel bracelet.
- PRX Powermatic 80 35 `T137.207.11.111.00` — [official product page](https://www.tissotwatches.com/en-us/T1372071111100.html) confirms the exact reference, white mother-of-pearl dial, automatic movement, and steel bracelet.
- PRX Powermatic 80 40 `T137.407.11.041.00` — [official product page](https://www.tissotwatches.com/en-us/T1374071104100.html) confirms the exact reference, blue dial, automatic movement, and integrated steel bracelet.
- PRX Automatic Chronograph `T137.427.11.011.00` — [official product page](https://www.tissotwatches.com/en-us/T1374271101100.html) confirms the exact reference and PRX 42 mm automatic chronograph identity.
- Gentleman Powermatic 80 Silicium `T127.407.11.041.00` — [official product page](https://www.tissotwatches.com/en-us/T1274071104100.html) confirms the exact reference, blue dial, Powermatic 80 Silicium automatic family, and steel bracelet.

All five remain research-only `needs_more_evidence`; no M1 facts or catalogue
rows were promoted. The manifest now reports 280 `needs_review` targets, one
remaining `planned` target, and 343 review artifacts; accepted catalogue rows
remain unchanged.

## Fifty-eighth Grand Seiko recheck (retrieved 2026-09-03)

The planned Grand Seiko Heritage 44GS `SBGW291` target was retried through the
Perplexity worker with eight additional attempts at concurrency one. Every
attempt failed schema validation because the provider marked unknown values as
observed `null`; no schema-valid evidence was accepted and no review artifact
was created. The target remains `planned` rather than being promoted from a
non-confirming response.

## Fifty-ninth parallel exact-reference batch (retrieved 2026-09-03)

Five remaining Tissot dossier references produced schema-valid Perplexity
results and were checked against official Tissot regional product pages:

- Seastar 1000 40 `T120.807.11.051.00` — [official US product page](https://www.tissotwatches.com/en-us/T1208071105100.html) confirms the exact reference, 40 mm automatic configuration, steel bracelet, and 300 m water resistance.
- Seastar 2000 Professional `T120.607.11.041.00` — [official US product page](https://www.tissotwatches.com/en-us/T1206071104100.html) confirms the exact reference, 46 mm automatic configuration, steel bracelet, and ISO-certified 600 m diver specification.
- Le Locle Powermatic 80 `T006.407.11.033.00` — [official US product page](https://www.tissotwatches.com/en-us/T0064071103300.html) confirms the exact reference and silver-dial steel-bracelet configuration.
- Heritage Visodate Powermatic 80 `T118.430.11.041.00` — [official Thailand product page](https://www.tissotwatches.com/en-th/T1184301104100.html) confirms the exact reference, blue dial, and automatic steel-bracelet configuration.
- T-Touch Connect Solar `T121.420.47.051.07` — [official UK product page](https://www.tissotwatches.com/en-gb/T1214204705107.html) confirms the exact reference and connected solar multifunction configuration.

All five remain research-only `needs_more_evidence`; no M1 facts or catalogue
rows were promoted. The manifest now reports 285 `needs_review` targets, one
remaining `planned` target, and 348 review artifacts; accepted catalogue rows
remain unchanged.

## Sixtieth parallel exact-reference batch (retrieved 2026-09-04)

Five Hamilton dossier references produced schema-valid Perplexity results and
were checked against official Hamilton US product pages:

- Khaki Field Murph 38 `H70405730` — [official product page](https://www.hamiltonwatch.com/en-us/h70405730-khaki-field-murph-38mm.html) confirms the exact reference, black dial, leather strap, H-10 automatic movement, and current collection status.
- Khaki Aviation Pilot Pioneer `H76419931` — [official product page](https://www.hamiltonwatch.com/en-us/h76419931-khaki-pilot.html) confirms the exact reference, 36 × 33 mm case, H-50 hand-wound movement, and textile strap.
- Khaki Navy Scuba Auto `H82505140` — [official product page](https://www.hamiltonwatch.com/en-us/h82505140-khaki-navy-scuba-auto.html) confirms the exact reference, blue dial, steel bracelet, H-10 automatic movement, and 300 m water resistance.
- Khaki Navy Frogman Auto `H77825330` — [official product page](https://www.hamiltonwatch.com/en-us/h77825330-khaki-navy-frogman-auto.html) confirms the exact reference and 46 mm black-dial rubber-strap diver configuration.
- Ventura Quartz `H24411732` — [official product page](https://www.hamiltonwatch.com/en-us/h24411732-ventura-quartz.html) confirms the exact reference, black dial, black leather strap, and quartz configuration.

All five remain research-only `needs_more_evidence`; no M1 facts or catalogue
rows were promoted. The manifest now reports 290 `needs_review` targets, one
remaining `planned` target, and 353 review artifacts; accepted catalogue rows
remain unchanged.

## Sixty-first parallel exact-reference batch (retrieved 2026-09-04)

The final three Hamilton dossier references produced schema-valid Perplexity
results and were checked against official Hamilton US product pages:

- Jazzmaster Open Heart Auto 40 `H32675140` — [official product page](https://www.hamiltonwatch.com/en-us/h32675140-jazzmaster-open-heart-auto.html) confirms the exact reference, blue gradient dial, steel bracelet, H-10 automatic movement, and current collection status.
- Intra-Matic Auto Chrono 40 `H38416711` — [official product page](https://www.hamiltonwatch.com/en-us/h38416711-intramatic-auto-chrono.html) confirms the exact reference, white dial, leather strap, H-31 automatic chronograph movement, and current collection status.
- Pan Europ Day Date Auto 42 `H35405741` — [official product page](https://www.hamiltonwatch.com/en-us/h35405741-american-classic-pan-europ-day-date-auto.html) confirms the exact reference, blue dial, H-30 automatic movement, and current collection status.

All three remain research-only `needs_more_evidence`; no M1 facts or catalogue
rows were promoted. The manifest now reports 293 `needs_review` targets, one
remaining `planned` target, and 356 review artifacts; accepted catalogue rows
remain unchanged.

## Sixty-second parallel exact-reference batch (retrieved 2026-09-04)

Five additional Oris dossier references produced schema-valid Perplexity
results and were checked against official Oris product pages:

- Aquis Date Upcycle `01 733 7766 4135-07 8 22 05PEB` — [official product page](https://www.oris.ch/en-US/product/watch/aquis/aquis-date/01-733-7766-4135-07-8-22-05PEB) confirms the exact reference, 41.5 mm blue-dial configuration, and stainless-steel bracelet.
- Divers Sixty-Five Date `01 733 7707 4057-07 8 20 18` — [official regional product page](https://www.oris.ch/en-DE/product/watch/divers/divers-sixty-five-date/01-733-7707-4057-07-8-20-18) confirms the exact reference, 40 mm green-dial configuration, and stainless-steel bracelet; the direct US route redirected to an unrelated product during review.
- Divers Date 39 `01 733 7795 4054-Set` — [official product page](https://www.oris.ch/en-US/product/watch/divers/new-divers/01-733-7795-4054-Set) confirms the exact reference and black 39 mm diver identity.
- Big Crown Pointer Date Calibre 403 — [official product page](https://www.oris.ch/en-US/product/watch/big-crown/big-crown-pointer-date-calibre-403/01-403-7776-4065-07-8-19-06) confirms the actual reference `01 403 7776 4065-07 8 19 06`, 38 mm blue-dial configuration, and stainless-steel bracelet. The dossier/manifest requested `...8 20 06`, so that reference discrepancy remains explicitly unresolved.
- ProPilot X Calibre 400 `01 400 7778 7153-07 7 20 01TLC` — [official product page](https://www.oris.ch/en-US/product/watch/propilot-x/propilot-x-calibre-400/01-400-7778-7153-07-7-20-01TLC) confirms the exact reference, 39 mm grey-dial titanium configuration, and titanium bracelet.

All five remain research-only `needs_more_evidence`; no M1 facts or catalogue
rows were promoted. The manifest now reports 298 `needs_review` targets, one
remaining `planned` target, and 361 review artifacts; accepted catalogue rows
remain unchanged. The Big Crown reference mismatch is preserved in the review
artifact rather than silently changing the dossier target.

## Sixty-third parallel exact-reference batch (retrieved 2026-09-04)

Five Cartier dossier references produced schema-valid Perplexity results and
were checked against official Cartier regional product pages:

- Tank Must `WSTA0042` — [official product page](https://int.cartier.com/es-eu/collections/gifts/mother-s-day-at-the-maison/es-la-ocasi%C3%B3n-de-demostrar-el-amor/wsta0042-reloj-tank-must.html) confirms the small quartz steel-and-leather configuration, 29.5 × 22 mm case, and 30 m water resistance.
- Tank Must `WSTA0052` — [official product page](https://www.cartier.com/th-th/%E0%B8%99%E0%B8%B2%E0%B8%AC%E0%B8%B4%E0%B8%81%E0%B8%B2/%E0%B8%84%E0%B8%AD%E0%B8%A5%E0%B9%80%E0%B8%A5%E0%B8%8A%E0%B8%B1%E0%B9%88%E0%B8%99/tank/%E0%B8%99%E0%B8%B2%E0%B8%AC%E0%B8%B4%E0%B8%81%E0%B8%B2-tank-must-de-cartier-CRWSTA0052.html?lang=th_TH) confirms the large High Autonomy quartz steel-bracelet configuration, 33.7 × 25.5 mm case, and 30 m water resistance.
- Tank Must `WSTA0106` — [official product page](https://www.cartier.com/en-gb/watches/collections/tank/tank-must-de-cartier-watch-CRWSTA0106) confirms the large High Autonomy quartz steel-bracelet configuration, 33.7 × 25.5 mm case, and 30 m water resistance.
- Santos-family reference `WSSA0023` — [official product page](https://www.cartier.com/en-kw/watches/collections/santos-de-cartier/santos-dumont-watch-CRWSSA0023.html) confirms that the exact reference is Santos-Dumont small, High Autonomy quartz, steel case, and navy alligator strap; the broad dossier label was corrected at identity level.
- Santos de Cartier `WSSA0018` — [official product page](https://www.cartier.com/en-sa/watches/collections/santos-de-cartier/santos-de-cartier-watch-CRWSSA0018.html) confirms the large automatic steel configuration, calibre 1847 MC, 39.8 mm case width, and 100 m water resistance.

All five remain research-only `needs_more_evidence`; no M1 facts or catalogue
rows were promoted. The manifest now reports 303 `needs_review` targets, one
remaining `planned` target, and 366 review artifacts; accepted catalogue rows
remain unchanged. The WSSA0023 family correction is preserved in its review
artifact rather than treating the broad dossier label as a reference fact.

## Sixty-fourth parallel exact-reference batch (retrieved 2026-09-04)

Three Omega references explicitly present in the owner dossier produced
schema-valid Perplexity results and were checked against official Omega US
product pages:

- Speedmaster Moonwatch Professional `310.30.42.50.01.001` — [official product page](https://www.omegawatches.com/en-us/watch-omega-speedmaster-moonwatch-professional-co-axial-master-chronometer-chronograph-42-mm-31030425001001) confirms the exact 42 mm steel-on-steel reference and current listing.
- Speedmaster Moonwatch Professional `310.30.42.50.01.002` — [official product page](https://www.omegawatches.com/en-us/watch-omega-speedmaster-moonwatch-professional-co-axial-master-chronometer-chronograph-42-mm-31030425001002) confirms the exact 42 mm steel-on-steel reference and current listing.
- Seamaster Aqua Terra 150M `220.10.38.20.03.001` — [official product page](https://www.omegawatches.com/en-us/watch-omega-seamaster-aqua-terra-150m-co-axial-master-chronometer-38-mm-22010382003001) confirms the exact 38 mm blue-dial steel-on-steel reference and current listing.

All three remain research-only `needs_more_evidence`; no M1 facts or catalogue
rows were promoted. The manifest now reports 306 `needs_review` targets, one
remaining `planned` target, and 369 review artifacts; accepted catalogue rows
remain unchanged.

## Sixty-fifth parallel exact-reference batch (retrieved 2026-09-04)

Two Patek Philippe Calatrava references produced schema-valid Perplexity
results and were checked against primary or corroborating sources:

- Calatrava `6119R-001` — [official Patek Philippe product page](https://www.patek.com/en/collection/calatrava/6119r-001) confirms the exact rose-gold reference, 39 mm case, silvery grained dial, and manually wound 30-255 PS movement.
- Calatrava `6007G-001` — [official Patek Philippe press release](https://static.patek.com/pdf/pressreleases/en/2023_PatekPhilippe_Watches_and_Wonders.pdf) confirms the exact white-gold reference, graphic black dial with yellow accents, calibre 26-330 S C, and date; the exact product URL remains a secondary retailer link.

The `5227G-010` target was retried through all eight Perplexity attempts but
every response failed the provider schema because unknown values were marked as
observed `null`; it remains `planned` with no review artifact. The two valid
targets remain research-only `needs_more_evidence`; no M1 facts or catalogue
rows were promoted. The manifest now reports 308 `needs_review` targets, two
remaining `planned` targets, and 371 review artifacts; accepted catalogue rows
remain unchanged.

## Sixty-sixth Patek Philippe retry (retrieved 2026-09-04)

The previously failing Calatrava `5227G-010` target succeeded on the ninth
Perplexity attempt overall and was checked against the [official Patek Philippe
product page](https://www.patek.com/zh/%E6%97%B6%E8%AE%A1%E7%B3%BB%E5%88%97/calatrava%E7%B3%BB%E5%88%97/5227g-010).
The exact white-gold, black-dial automatic-date identity is confirmed; the
manufacturer marks it discontinued. It remains research-only
`needs_more_evidence`, with no M1 facts or catalogue row promoted. Only
Grand Seiko `SBGW291` remains `planned`.

## Sixty-seventh Grand Seiko retry (retrieved 2026-09-04)

The final planned target, Grand Seiko Heritage 44GS `SBGW291`, produced a
schema-valid Perplexity result on the seventeenth overall attempt and was
checked against the [official Grand Seiko product page](https://www.grand-seiko.com/us-en/collections/sbgw291g).
The exact identity is confirmed, including the 36.5 mm case, manual-winding
9S64 movement, 10 bar water resistance, 66 g weight, and current listing. It
remains research-only `needs_more_evidence`; no M1 facts or catalogue row were
promoted.

## One-hundredth Longines exact-SKU expansion (retrieved 2026-09-03)

The complete parallel audit extracted 798 unique current Longines SKUs from
pages 1–34 of the [official Longines watch
catalogue](https://www.longines.com/en-us/watches). Two exact references were
already represented in the manifest, and 796 missing exact references were
added as separate planned targets across Conquest, Flagship, Heritage,
HydroConquest, La Grande Classique, DolceVita, Master, PrimaLuna, Spirit,
Record, Avigation, and related collections. No corrections were found.
Perplexity was unavailable, so these additions retain identity-level primary
source confirmation only; no technical or commercial fields were promoted.

## Sixty-eighth Rolex recheck (retrieved 2026-09-04)

The Rolex recheck closed the identity/provenance gap on 11 previously
`fetch_blocked` workbook reviews:

- Current exact pages confirm Datejust 36 `126200-0008`, Deepsea Challenge `126067`, Submariner `124060`, and Yacht-Master 37 `268621-0003` ([Datejust](https://www.rolex.com/watches/datejust/m126200-0008), [Deepsea Challenge](https://www.rolex.com/en-us/watches/deepsea/m126067-0002), [Submariner](https://www.rolex.com/en-us/watches/submariner/m124060-0001), [Yacht-Master 37](https://www.rolex.com/en-us/watches/yacht-master/m268621-0003)).
- Official Rolex brochures confirm historical exact references Cellini Moonphase `50535-0002`, Cellini Time `50505`, Milgauss `116400GV-0002`, and GMT-Master II `126710BLRO` ([Cellini Moonphase](https://content.rolex.com/dam/media/brochures/cellini/m50535-0002.pdf), [Cellini Time](https://newsroom-content.rolex.com/-/media/project/rolex/newsroom/rolex/rolex-newsroom-int/brochures/en/02_rolex_cellini_time_english_2019.pdf), [Milgauss](https://content.rolex.com/dam/media/brochures/milgauss/m116400gv-0002.pdf), [GMT brochure](https://assets.rolex.com/api/brochure/ms/gmt-master-ii/m126710blro-0002.pdf)).
- Cellini Date `50519-0006` and Cellini Dual Time `50525-0015` now have official base-reference brochures plus exact-suffix secondary corroboration ([Cellini Date brochure](https://newsroom-content.rolex.com/-/media/project/rolex/newsroom/rolex/rolex-newsroom-int/brochures/en/02_rolex_cellini_date_english_2019.pdf), [Date exact listing](https://www.chrono24.com/rolex/-cellini-50519-silver-dial-white-gold-black-leather-strap-39mm--id45436090.htm), [Dual Time brochure](https://newsroom-content.rolex.com/-/media/project/rolex/newsroom/rolex/rolex-newsroom-int/brochures/en/02_rolex_cellini_dual-time_english_2019.pdf), [Dual Time exact listing](https://www.uret.se/rolex/cellini-dual-time/50525-0015/354104)).
- Yacht-Master II `116680` is corroborated by Rolex's historical platform newsroom material and a Rolex Certified Pre-Owned listing ([Rolex newsroom](https://newsroom.rolex.com/watches/oyster-collection/yacht-master-ii), [Bucherer CPO](https://www.bucherer.com/us/en/rolex-certified-pre-owned/watches/yacht-master-ii/1489-351-7.html)). Pearlmaster `80319-0040` is confirmed only by the exact WatchBase secondary page; no primary Rolex page for that historical suffix was found.

These 11 Rolex artifacts now carry identity/reference provenance and no longer
claim `identity` as missing; no M1 facts or catalogue rows were changed. The
Record Watch Co. historical target remains unresolved because no exact
reference has been established and is not replaced with an inferred model.

## Sixty-ninth Record Watch Co. recheck (retrieved 2026-09-03)

The Record Watch Co. target was retried through three additional Perplexity
attempts. All three responses failed the research schema because they either
marked unknown values as observed `null`, omitted a resolved product URL, or
returned no candidate identity; none was accepted as evidence.

A separate exact-reference check found a concrete historical example: the
specialist [WatchSteez listing](https://shop.watchsteez.com/products/record-sub-seconds-automatic-ref-889-salmon-dial)
identifies Record Watch Co. Geneve Sub-Seconds Automatic ref. `889`, Swiss Made
circa the 1950s, with a salmon dial and Record calibre 161 bumper automatic.
This is validated secondary evidence, not a manufacturer catalogue page. The
review artifact now records the identity, reference, variant, and product URL
as verified, while all M1 facts remain missing and no catalogue row is
promoted.

## Seventieth exact-reference follow-up (retrieved 2026-09-03)

The Claude Meylan target is now tied to exact secondary reference
`6047-SWIRL`: [The Watch Pages](https://www.thewatchpages.com/watches/claude-meylan-tortue-6047-swirl/)
identifies the Tortue skeleton configuration, 40 mm steel case, calibre 165
CM14, 42-hour reserve, and 3 ATM rating. These facts were added with
field-level provenance; price, remaining geometry, weight, accuracy, lume, and
attachment interface remain missing.

The Guinand Werksfahrer Chrono 1 review was also strengthened from the
[official archive page](https://www.guinand-uhren.de/werksfahrer.html): it
confirms the exact model's SW510 automatic chronograph, 40.5 mm diameter,
44.3 mm lug-to-lug, 20 mm band width, 14.9 mm height, approximately 60-hour
reserve, and 20 bar water resistance. Guinand still publishes no separate
numeric reference; that field remains unresolved rather than inferred.

## Seventy-first primary-source follow-up (retrieved 2026-09-03)

The exact [ArtyA product page](https://www.artya.com/product-page/purity-wavy-tourbillon-sport-edition-orange)
confirms the orange Purity Wavy Tourbillon Sport Edition and identifies
calibre `PUR-T1`, a 44 mm pure-sapphire case, 70-hour reserve, and 30 m water
resistance. `PUR-T1` is retained as the movement calibre, not promoted as a
watch reference because the manufacturer publishes no separate watch reference.

The [official Greubel Forsey history page](https://greubelforsey.com/en/history/quadruple-tourbillon-secret)
confirms the exact Quadruple Tourbillon Secret model, its 40-piece 2012–2018
production, 43.5 mm diameter, 16.11 mm height, 50-hour reserve, and 3 ATM
water resistance. The page does not publish a separate watch reference or
movement calibre, so those fields remain unresolved.

## Seventy-second exact-identity follow-up (retrieved 2026-09-03)

The Hautlence Vortex Bronze target is now tied to the exact specialist
[The Watch Pages listing](https://www.thewatchpages.com/watches/hautlence-vortex-03-h1370-1700/),
which identifies it as Vortex 03, reference `H1370-1700`, with a bronze 52 x
50 mm case, automatic HL2.0 movement, and 3 ATM water resistance. [About
Timepieces](https://about-timepieces.com/product/hautlence-vortex-03-bronze/)
independently repeats the reference and eight-piece limitation. The two
sources disagree on power reserve (45 versus 40 hours), so that field remains
unresolved; no conflicting value is promoted as canonical.

The HMT Pilot review now records the specialist source's exact family identity,
stainless-steel case, hand-wound operation, leather strap, and no-date layout.
Its approximately 35 mm size and approximately 38-hour reserve remain
explicitly unpromoted because the source does not establish a reference-specific
exact measurement.

The Philippe Dufour and Roger W. Smith reviews were also rechecked for false
variant matches. Phillips confirms a Simplicity 37 white-gold watch with a
white lacquer dial, not the candidate's silver guilloché configuration. The
maker confirms Series Two in 38 or 40 mm, while the exact yellow-gold 40 mm
secondary lot found during recheck is Mark 1 rather than the candidate's Mark
2. Neither near-match is merged into the candidate or used to promote M1
facts.

## Seventy-third corroboration pass (retrieved 2026-09-03)

The Greubel Forsey target was checked against the manufacturer's [official
technical sheet](https://greubelforsey.com/user/pages/11.history-timepieces/09.quadruple-tourbillon-secret/03._bloc-tech/greubel-forsey-quadruple-tourbillon-secret-technical-sheet-fr.pdf),
which confirms hand winding and the 50-hour reserve. Its material-specific
edition count (8 rose-gold plus 8 platinum) differs from the 40-piece figure
on the manufacturer's historical overview, so no material-specific reference
was inferred for the generic target.

The Philippe Dufour Simplicity review now has a stronger configuration match:
[FHH](https://www.hautehorlogerie.org/en/watches-and-culture/watchmaking-scene/watches-and-novelties/simplicity)
describes the 37 mm white-gold silver-guilloché variant, while [Sotheby's
lot 2198](https://www.sothebys.com/en/auctions/ecatalogue/2017/important-watches-hk0743/lot.2198.html)
confirms a matching 37 mm white-gold guilloché Simplicity with manual calibre
11. The lot's movement number is not treated as a model reference.

The official [Lang & Heyne Hektor Edition II page](https://www.lang-und-heyne.de/en/modelle/hektor-edition-ii/)
was corroborated by an exact-model technical article, adding 45.3 mm
lug-to-lug, 20 mm lug width, 5 ATM water resistance, and a dated EUR 19,999
MSRP observation. Super-LumiNova is recorded only as a material mention; no
specific lume grade is invented.

## Seventy-fourth Rolex field-level recheck (retrieved 2026-09-03)

Four exact current Rolex product pages were rechecked and their field-level
facts were added to the research reviews without catalogue promotion:

- [Day-Date 40 `228236-0007`](https://www.rolex.com/en-us/watches/day-date/m228236-0007): US MSRP $68,800, 40 mm platinum case, calibre 3255, -2/+2 sec/day, 100 m, approximately 70-hour reserve, President bracelet, and day/date.
- [Land-Dweller 36 `127234-0001`](https://www.rolex.com/en-us/watches/land-dweller/m127234-0001): US MSRP $15,350, 36 mm White Rolesor case, calibre 7135, -2/+2 sec/day, 100 m, approximately 66-hour reserve, Flat Jubilee bracelet, and date.
- [GMT-Master II `126718GRNR-0001`](https://www.rolex.com/en-us/watches/gmt-master-ii/m126718grnr-0001): US MSRP $50,800, 40 mm 18 kt yellow-gold case, calibre 3285, -2/+2 sec/day, 100 m, approximately 70-hour reserve, Jubilee bracelet, and date.
- [Oyster Perpetual 34 `124200-0007`](https://www.rolex.com/en-us/watches/oyster-perpetual/m124200-0007): US MSRP $6,400, 34 mm Oystersteel case, calibre 2232, -2/+2 sec/day, 100 m, approximately 55-hour reserve, Oyster bracelet, and no date.

In each case the source confirms the exact suffix URL and the listed
configuration. Remaining case-width/length/thickness, lug geometry, full
configured weight, and specific lume-grade fields remain null where Rolex's
page does not publish them.

## Seventy-fifth Rolex field-level recheck (retrieved 2026-09-03)

Four additional exact Rolex pages were checked and their field-level facts
were added to the research reviews:

- [Day-Date 40 `228236-0018`](https://www.rolex.com/en-us/watches/day-date/m228236-0018): 40 mm platinum case, calibre 3255, current US price $68,800, -2/+2 sec/day, 100 m, approximately 70-hour reserve, President bracelet, and day/date.
- [GMT-Master II `126713GRNR-0001`](https://www.rolex.com/en-us/watches/gmt-master-ii/m126713grnr-0001): 40 mm Yellow Rolesor case, calibre 3285, current US price $20,450, -2/+2 sec/day, 100 m, approximately 70-hour reserve, Jubilee bracelet, and date.
- [Oyster Perpetual 31 `277200-0014`](https://www.rolex.com/en-us/watches/oyster-perpetual/m277200-0014): 31 mm Oystersteel case, calibre 2232, current US price $6,300, -2/+2 sec/day, 100 m, approximately 55-hour reserve, Oyster bracelet, and no date.
- [Yacht-Master 37 `268621-0003`](https://www.rolex.com/en-us/watches/yacht-master/m268621-0003): 37 mm Everose Rolesor case, calibre 2236, current US price $17,750, -2/+2 sec/day, 100 m, approximately 55-hour reserve, Oyster bracelet, and date. This exact reference is also linked to the owner-approved workbook review.

The entries remain research-only where their residual case geometry, full
configured weight, or specific lume grade is not published; no unsupported
defaults were added.

## Seventy-sixth Perplexity exact-reference pass (retrieved 2026-09-03)

Five new targets completed the Perplexity worker and were independently
checked against manufacturer pages before review artifacts were created:

- [Richard Mille RM 72-01](https://www.richardmille.com/collections/rm-72-01-automatic-flyback-chronograph): official model identity, CRMC1 automatic movement, approximately 50-hour reserve, 38.40 x 47.34 x 11.68 mm case dimensions, 30 m resistance, rubber strap, and date display.
- [Parmigiani Fleurier Tonda PF Micro-Rotor No Date `PFC914-1020023-100182`](https://www.parmigiani.com/en/watches/tonda-pf-micro-rotor-no-date-steel-agave-blue/): exact reference, CHF 24,200 price, steel/950-platinum construction, 40 mm x 7.8 mm case, PF703, 48-hour reserve, 100 m resistance, steel bracelet, and no date.
- [MB&F HM12 The Guardian Green `12.TL.GR`](https://www.mbandf.com/machines/mbf-machines/horological-machines/hm12): official Green edition identity and CHF 280,000 price; the per-colour reference remains dealer-correlated because MB&F does not publish a public SKU. Secondary technical corroboration supplies 49.3 x 43.6 x 13.8 mm dimensions, 84-hour reserve, 30 m resistance, and Velcro quick-release strap.
- [Kari Voutilainen 28CG Platinum](https://www.voutilainen.ch/portfolio/28cg-platinum/): official model identity, 37 mm platinum configuration, in-house hand-wound movement, 65-hour reserve, sapphire crystals, and no-date display; the CHF 105,600 price and diameter are separately corroborated by technical coverage.
- [URWERK UR-100V Lightspeed Ceramic](https://www.urwerk.com/collections/ur-satellite/ur-100v): official variation identity, 43 x 51.7 x 14.55 mm dimensions, ceramic composite case, UR 12.02 automatic movement, 48-hour reserve, and 50 m resistance; technical coverage corroborates the CHF 67,000 price and rubber-strap configuration.

The five reviews remain research-only. Their exact identities and published
facts are retained with source provenance, while absent price/accuracy/lug,
configured-weight, or lume fields remain null. The Laurent Ferrier yellow-gold
counterpart was manually reconciled from its official product card after three
malformed Perplexity responses; the malformed payloads were not imported.

## Seventy-seventh Perplexity exact-reference pass (retrieved 2026-09-03)

Sixteen additional exact targets completed the Perplexity worker and were
cross-checked against manufacturer product pages before review artifacts were
created. The references remain `needs_review`; only confirmed fields were
recorded, and unverified M1 fields remain null:

- [Vacheron Constantin Overseas `4600V/200A-H127`](https://www.vacheron-constantin.com/us/en/collections/overseas/4600v-200a-h127.html): 34.5 mm steel, 9.33 mm, calibre 1088/1, 40-hour reserve, 150 m, date and interchangeable bracelet/strap system.
- [Vacheron Constantin Historiques 222 `4200H/222A-B934`](https://www.vacheron-constantin.com/us/en/collections/historiques/4200h-222a-b934.html): 37 mm steel, 7.95 mm, calibre 2455/2, 40-hour reserve, 50 m, date and integrated steel bracelet.
- [Cartier Tank Française `WSTA0129`](https://www.cartier.com/en-us/watches/collections/tank/tank-francaise-watch-CRWSTA0129.html): small steel quartz configuration, 25.7 x 21.2 x 6.8 mm, 30 m, no date and steel bracelet.
- [Cartier Santos `W3SA0007`](https://www.cartier.com/en-us/watches/collections/santos-de-cartier/santos-de-cartier-watch-CRW3SA0007.html): exact medium configuration, 41.9 x 35.1 x 8.83 mm, calibre 1847 MC, 40-hour reserve, 100 m and no date.
- [Omega Speedmaster Moonwatch `310.30.42.50.01.004`](https://www.omegawatches.com/en-us/watch-omega-speedmaster-moonwatch-professional-co-axial-master-chronometer-chronograph-42-mm-31030425001004): 42 mm reverse-panda steel reference, calibre 3861, 50-hour reserve, 50 m and no date.
- [Omega Aqua Terra `220.10.41.21.03.006`](https://www.omegawatches.com/en-us/watch-omega-seamaster-aqua-terra-150m-co-axial-master-chronometer-41-mm-22010412103006): 41 mm steel reference, calibre 8900, 60-hour reserve, 150 m and date.
- [A. Lange & Söhne LANGE 1 `191.032`](https://www.alange-soehne.com/us-en/timepieces/lange-1/lange-1/lange-1-in-750-pink-gold-191-032): 38.5 mm pink-gold reference, 9.8 mm, calibre L121.1, 72-hour reserve, 30 m and outsized date.
- [A. Lange & Söhne ODYSSEUS `363.179`](https://www.alange-soehne.com/us-en/timepieces/odysseus/odysseus/odysseus-in-stainless-steel-363-179): 40.5 mm steel reference, 11.1 mm, calibre L155.1 DATOMATIC, 50-hour reserve, 120 m and large date.
- [Grand Seiko Snowflake `SBGA211`](https://www.grand-seiko.com/us-en/collections/sbga211g): 41 x 49 x 12.5 mm titanium Spring Drive reference, 100 g, calibre 9R65, 72-hour reserve, 100 m and date.
- [Grand Seiko Heritage `SBGW281`](https://www.grand-seiko.com/us-en/collections/sbgw281g): 37.3 x 44.3 x 11.7 mm manual-wind steel reference, 61 g, calibre 9S64, 72-hour reserve, splash resistance and no date.
- [Audemars Piguet Royal Oak Concept `26589IO.OO.D056CA.01`](https://www.audemarspiguet.com/us/en/watch-collection/royal-oak-concept/26589IO.OO.D056CA.01): 44 x 16.1 mm titanium flying-tourbillon GMT, calibre 2954, 237-hour reserve, 100 m and rubber strap.
- [Audemars Piguet Royal Oak Chronograph `26240ST.OO.1320ST.05`](https://www.audemarspiguet.com/us/en/watch-collection/royal-oak/26240ST.OO.1320ST.05): 41 x 12.4 mm steel flyback chronograph, calibre 4401, 70-hour reserve, 50 m, date and integrated bracelet.
- [Audemars Piguet Royal Oak Selfwinding `15510ST.OO.1320ST.09`](https://www.audemarspiguet.com/us/en/watch-collection/royal-oak/15510ST.OO.1320ST.09): 41 x 10.5 mm current steel reference, calibre 4302, 70-hour reserve, 50 m and date; the archived anniversary reference remains rejected.
- [Audemars Piguet Royal Oak Offshore Diver `15720ST.OO.A009CA.01`](https://www.audemarspiguet.com/us/en/watch-collection/royal-oak-offshore/15720ST.OO.A009CA.01): 42 x 14.2 mm steel diver, calibre 4308, 60-hour reserve, 300 m, rubber strap and date.
- [Audemars Piguet Code 11.59 `15210ST.OO.A009KB.01`](https://www.audemarspiguet.com/us/en/watch-collection/code-1159/15210ST.OO.A009KB.01): 41 x 10.7 mm steel-toned reference, calibre 4302, 70-hour reserve, 30 m, rubber-coated strap and date.
- [Audemars Piguet Royal Oak `77450ST.OO.1361ST.02`](https://www.audemarspiguet.com/us/en/watch-collection/royal-oak/77450ST.OO.1361ST.02): compact 34 x 8.8 mm steel reference, calibre 5800, 50-hour reserve, 50 m, bracelet and date.

The 16 review artifacts retain Perplexity job provenance and manufacturer URLs.
No model was promoted to the accepted catalogue because residual M1 gaps remain
for fit geometry, configured weight, daily accuracy, lume grade, or regional
price as applicable.

## Seventy-eighth Breguet exact-reference pass (retrieved 2026-09-03)

The Breguet catalogue audit found 12 exact current references absent locally;
six were sent through Perplexity and independently checked against their exact
manufacturer pages:

- [Classique Souscription 2025 `2025BH/28/9W6`](https://www.breguet.com/en/watches/classique/classique-souscription-2025/2025bh289w6): 40 mm, 18K Breguet gold, manual VS00, 96-hour reserve, 3 bar, Grand Feu enamel and alligator.
- [Classique Tourbillon `7357BH/1H/386`](https://www.breguet.com/en/watches/classique/classique-tourbillon-7357/7357bh1h386): 35 mm, 18K Breguet gold, manual 187B, 60-hour reserve, 3 bar and tourbillon.
- [Tradition GMT `7067PT/NM/5W6`](https://www.breguet.com/en/watches/tradition/tradition-gmt-7067/7067ptnm5w6): 40 mm platinum, manual 507DRF, 50-hour reserve, 3 bar, GMT/day-night/power-reserve indications.
- [Marine `5517TI/Y1/TZ0`](https://www.breguet.com/en/watches/marine/marine-5517/5517tiy1tz0): 40 mm titanium, automatic 777A, 55-hour reserve, 100 m, date and titanium bracelet.
- [Marine Chronographe `5527TI/Y1/TW0`](https://www.breguet.com/en/watches/marine/marine-chronographe-5527/5527tiy1tw0): 42.3 mm titanium, automatic 582QA, 48-hour reserve, 100 m, flyback chronograph and date.
- [Reine de Naples `8925BH/5W/J40 D0`](https://www.breguet.com/en/watches/reine-de-naples/reine-de-naples-8925/8925bh5wj40d0): 33 x 25 x 8.5 mm shaped gold case, automatic 586/1, 38-hour reserve, 3 bar and diamond-set bracelet.

All six remain `needs_review`: exact identity and manufacturer-published facts
are retained with provenance, while price, configured weight, accuracy and
other unpublished M1 fields remain null.

## Seventy-ninth Perplexity exact-reference pass (retrieved 2026-09-03)

The next catalogue sweep added ten exact references after Perplexity discovery
and manufacturer-page cross-checking:

- [Rolex Oyster Perpetual 41 `134300-0010`](https://www.rolex.com/en-us/watches/oyster-perpetual/m134300-0010): Oystersteel, 41 mm, calibre 3230, approximately 70-hour reserve, 100 m, Oyster bracelet and no date.
- [Rolex Datejust 41 `126334-0033`](https://www.rolex.com/en-us/watches/datejust/m126334-0033): White Rolesor, 41 mm, calibre 3235, approximately 70-hour reserve, 100 m, Oyster bracelet and instantaneous date.
- [Patek Philippe Calatrava `5226G-001`](https://www.patek.com/en/collection/calatrava/5226g-001): white gold, 40 x 8.53 mm, calibre 26-330 S C, 35–45-hour reserve, 30 m and date.
- [Patek Philippe Aquanaut Luce `5261R-001`](https://www.patek.com/en/collection/aquanaut/5261r-001): rose gold, 39.9 x 10.94 mm, calibre 26-330 S QA LU, 35–45-hour reserve, 30 m and annual calendar/moon phase.
- [Blancpain Fifty Fathoms `5010 12B30 B64B`](https://www.blancpain.com/en-us/fifty-fathoms/fifty-fathoms-automatique-5010-12b30-b64b): Grade 23 titanium, 42.3 x 14.3 mm, calibre 1315, 120-hour reserve, 300 m and date.
- [Blancpain Air Command `AC03 12B40 98S`](https://www.blancpain.com/en/air-command/air-command-ac03-12b40-98s): 36.2 x 11.5 mm titanium flyback chronograph, calibre F188B, 40-hour reserve and titanium bracelet.
- [Zenith Defy Skyline `03.9300.3620/51.I001`](https://www.zenith-watches.com/en_nl/product/defy-skyline-03-9300-3620-51-i001): 41 mm steel, calibre El Primero 3620, 60-hour reserve, 100 m, quick-change bracelet/strap system and date.
- [Zenith Chronomaster Sport `03.3100.3600/69.M3100`](https://www.zenith-watches.com/en_us/product/chronomaster-sport-03-3100-3600-69-m3100): 41 mm steel-bracelet reference, El Primero 3600, 60-hour reserve, 100 m and date.
- [Tudor Black Bay Ceramic `M7941A1ACNU-0001`](https://www.tudorwatch.com/en/watches/black-bay/m7941a1acnu-0001): 41 mm ceramic, MT5602-U, 70-hour reserve, 200 m and no date.
- [Tudor Pelagos Ultra `M2543C1A7NU-0001`](https://www.tudorwatch.com/en/watches/pelagos/m2543c1a7nu-0001): 43 mm titanium, MT5612-U, 65-hour reserve, 1,000 m, rubber/bracelet options and date.

The malformed first Zenith Chronomaster response was not imported; a forced
retry succeeded and produced a field-level review. All ten entries remain
`needs_review` with provenance, and no absent fit, weight, accuracy or lume
fields were filled with estimates.

## Eightieth Perplexity exact-reference pass (retrieved 2026-09-03)

Eleven additional exact references completed the Perplexity worker and were
cross-checked against the exact manufacturer pages before review artifacts were
created:

- [IWC Pilot's Watch Mark XX Le Petit Prince `IW328221`](https://www.iwc.com/us-en/watches/pilot-watches/iw328221-pilots-watch-mark-xx-le-petit-prince): 40 x 10.8 mm stainless steel case, calibre 32112, 120-hour reserve, 100 m, blue rubber EasX-CHANGE strap, and date.
- [IWC Portugieser Automatic 42 `IW501701`](https://www.iwc.com/us-en/watches/portugieser/iw501701-portugieser-automatic-42): 42.4 x 12.9 mm stainless steel case, calibre 52011, 168-hour reserve, 50 m, black alligator strap, and date.
- [Chopard Alpine Eagle 41 XPS `298623-3003`](https://www.chopard.com/en-us/watch/298623-3003.html): 41 x 8.0 mm Lucent Steel case, L.U.C 96.40-L micro-rotor, 65-hour reserve, 100 m, integrated Lucent Steel bracelet, and no date.
- [Breitling Chronomat B01 Chronograph 42 `AB0158101A1A1`](https://www.breitling.com/us-en/watches/chronomat/chronomat-b01-42-my26/AB0158101A1A1/): 42 x 13.77 mm stainless steel case, Manufacture Caliber 01, 70-hour reserve, 200 m, Rouleaux bracelet, and date.
- [Breitling Avenger Automatic GMT 44 `A32320101B1A1`](https://www.breitling.com/us-en/watches/avenger/avenger-automatic-gmt-44-my23/A32320101B1A1/): 44 x 12.05 mm stainless steel case, 172.52 g configured weight, Caliber 32 GMT, 42-hour reserve, 300 m, steel bracelet, and date.
- [Panerai Radiomir Quaranta `PAM01573`](https://www.panerai.com/en/collections/watch-collection/radiomir/pam01573-radiomir-quaranta.html): 40 mm steel case, P.900 automatic movement, 72-hour reserve, 50 m, strap, and date.
- [Panerai Luminor Luna Rossa GMT `PAM01791`](https://www.panerai.com/gb/en/collections/watch-collection/luminor/pam01791-luminor-luna-rossa-gmt.html): 40 mm steel case, 156 g configured weight, P.900/GMT, 72-hour reserve, 100 m, steel bracelet, and date.
- [Hublot Classic Fusion Titanium Blue `565.NX.7170.RX`](https://www.hublot.com/en-us/watches/classic-fusion/classic-fusion-titanium-blue-38-mm): 38 mm titanium case, HUB1110, 48-hour reserve, 50 m, blue rubber strap, and no date.
- [Hublot Big Bang Original Soft Touch All Black `431.RXN.2740.RX.VEL`](https://www.hublot.com/en-us/watches/big-bang/big-bang-original-soft-touch-all-black-43-mm): 43 mm titanium/rubber case, HUB1280 UNICO flyback chronograph, 72-hour reserve, 100 m, and black rubber strap.
- [Jaeger-LeCoultre Reverso Classic Monoface `Q2608442`](https://www.jaeger-lecoultre.com/us-en/watches/reverso/reverso-classic/reverso-classic-q2608442): 35.78 x 21 x 7.4 mm steel case, manual JLC 846, 50-hour reserve, 30 m, blue alligator strap, and no date.
- [Jaeger-LeCoultre Polaris Date `Q906867J`](https://www.jaeger-lecoultre.com/us-en/watches/polaris/polaris-date-stainless-steel-q906867j): 42 x 13.92 mm steel case, automatic JLC 899A/1, 70-hour reserve, 200 m, quick-change strap, and date.

The separate Chopard [L.U.C `168629-3001`](https://www.chopard.com/en-us/watch/168629-3001.html)
target remains `planned`: all three forced Perplexity attempts failed strict
normalization because the provider returned malformed null claims. Its exact
official identity was independently located, but no review artifact or
provisional worker facts were created from the failed payloads.

All eleven successful entries remain `needs_review`; the review artifacts keep
the Perplexity job IDs and manufacturer URLs. Unpublished fit geometry,
configured weight, accuracy, lume, and regional price fields remain null, so no
entry was promoted to the accepted recommendation catalogue.

## Eighty-first Perplexity exact-reference expansion (retrieved 2026-09-03)

The follow-up sweep checked the remaining candidates from the six specialist
brand audits. Perplexity was used for discovery and strict normalization, with
the exact manufacturer page as the acceptance gate. Thirty-three targets
produced successful normalized jobs and now have review artifacts:

- **IWC:** [Big Pilot's Watch Constant Force Tourbillon `IW590503`](https://www.iwc.com/us-en/watches/pilot-watches/iw590503-big-pilots-watch-constant-force-tourbillon), [Portugieser Chronograph `IW371624`](https://www.iwc.com/us-en/watches/portugieser/iw371624-portugieser-chronograph), [Portugieser Chronograph Ceratanium `IW371631`](https://www.iwc.com/us-en/watches/portugieser/iw371631-portugieser-chronograph-ceratanium), Ingenieur Automatic 35 `IW324902`, Ingenieur Automatic 40 `IW328907`, Ingenieur Automatic 42 `IW338902`, and Aquatimer Automatic `IW328803`.
- **Chopard:** [Alpine Eagle 41 `298600-3035`](https://www.chopard.com/en-us/watch/298600-3035.html), [L.U.C XPS `168629-3001`](https://www.chopard.com/en-us/watch/168629-3001.html), Mille Miglia Power Control `168566-3022`, Mille Miglia Chrono `168571-3001`, Happy Sport 33 `278608-3006`, Happy Sport Sun Moon and Stars `278573-6027`, and Happy Sport `278559-3001`/`278559-6019`.
- **Hublot:** Big Bang Titanium Peach Ceramic `441.NCU.5920.RX`, Big Bang Original Unico Titanium Ceramic `431.NM.1370.RX`, Classic Fusion Original Titanium `542.NX.1270.RX.MDM`, Classic Fusion Racing Grey Chronograph `541.NX.7070.RX`, and Spirit of Big Bang Black Magic `642.CI.0170.RX`.
- **Jaeger-LeCoultre:** Reverso Classic Monoface Origin `Q3878560`, Reverso Tribute Duoface Calendar `Q3918420`, Polaris Chronograph `Q902843J`, Master Control Chronometre Date `Q4158120`, Master Control Date Power Reserve `Q4168120`, Master Control Perpetual Calendar `Q4178180`, Duometre Chronograph Moon `Q622252J`, and Duometre Heliotourbillon Perpetual `Q6206150`.
- **Panerai:** Luminor Luna Rossa Chrono `PAM01768`, Submersible Navy SEALs GMT `PAM01323`, Submersible `PAM01590`, Submersible `PAM01595`, and Submersible `PAM02068`.

The exact manufacturer checks also supplied the following corrections: IWC
`IW590503` has no published current price; JLC `Q6206150`'s 11.15 mm figure is
movement thickness rather than case thickness; and Panerai `PAM01347` was not
counted because its exact page and current retail status could not be
established. Hublot `601.NE.0172.LR.1104.JPN19` was likewise excluded because
its official result redirects to the home page rather than an active product
card.

Six targets remain `planned` after all three worker attempts returned malformed
claims: IWC `IW388305`, Chopard `168574-3013`, Hublot
`421.EX.5129.NR.RLD` and `642.QK.0110.NR`, and Panerai `PAM03313` and
`PAM01731`. Their official pages were located by the agents, but no failed
payload was imported and no review artifact was created. All successful
targets remain `needs_review`; no model was promoted without field-level M1
closure.

## Eighty-second current-catalogue recheck (retrieved 2026-09-03)

A new six-agent pass rechecked Rolex, Omega, Cartier, Grand Seiko, Tudor, and
Seiko. Perplexity was used for discovery where available; every retained
candidate was checked against an exact current manufacturer product page.

- **Rolex:** 12 missing current references were confirmed: Submariner Date
  `126610LV`, Sea-Dweller `126603`, Submariner Date `126613LB` and
  `126613LN`, Datejust 36 `126234` and `126231`, Datejust 31 `278240` and
  `278241`, Day-Date 36 `128239` and `128235`, Cosmograph Daytona `126503`,
  and Day-Date 40 `228239`. Existing and legacy references were explicitly
  excluded from duplication; `126719BLRO` failed the live product-page gate.

  Exact primary pages: [126610LV](https://www.rolex.com/watches/submariner/m126610lv-0002), [126603](https://www.rolex.com/watches/sea-dweller/m126603-0001), [126613LB](https://www.rolex.com/watches/submariner/m126613lb-0002), [126613LN](https://www.rolex.com/watches/submariner/m126613ln-0002), [126234](https://www.rolex.com/watches/datejust/m126234-0015), [126231](https://www.rolex.com/watches/datejust/m126231-0018), [278240](https://www.rolex.com/watches/datejust/m278240-0002), [278241](https://www.rolex.com/watches/datejust/m278241-0004), [128239](https://www.rolex.com/watches/day-date/m128239-0063), [128235](https://www.rolex.com/watches/day-date/m128235-0070), [126503](https://www.rolex.com/watches/cosmograph-daytona/m126503-0001), and [228239](https://www.rolex.com/watches/day-date/m228239-0004).

  The subsequent targeted worker pass successfully normalized all 12 Rolex
  targets; each now has a review artifact with its Perplexity job ID and exact
  product URL.
- **Omega:** 10 missing exact references were confirmed across Speedmaster,
  Seamaster, Aqua Terra, Constellation, and De Ville. The first worker pass
  successfully normalized six of them: Speedmaster Moonwatch
  `310.30.42.50.04.001`, Speedmaster Pilot `332.10.41.51.01.002`, Aqua Terra
  `220.10.30.20.02.001` and `220.10.41.21.01.002`, and Constellation
  `131.10.39.20.02.001` and `131.30.41.21.04.001`.
- **Cartier:** 10 exact product pages were confirmed. The worker pass
  normalized Tank Louis `WJTA0037`, Santos `WSSA0071`, Panthère `W3PN0010`,
  Ballon Bleu `WSBB0061`, and Pasha `WSPA0009`. Panthère `W3PN0010` retains a
  documented official-dimension conflict and is not promoted.
- **Grand Seiko:** 10 exact missing references were confirmed across Heritage,
  Sport, Elegance, and Evolution 9; they remain queued for worker
  normalization.
- **Tudor:** 10 exact missing references were confirmed across Black Bay,
  Pelagos, Ranger, 1926, and Royal; they remain queued for worker
  normalization. The agent's Perplexity request returned 401, so only official
  pages were used and no provider result was imported.
- **Seiko:** eight of the new exact references were successfully normalized in
  this worker pass: `HAB005J1`, `SSK025`, `SJE103J1`, `SJE105J1`, `SSJ039J1`,
  `HCC001J1`, `HCC002J1`, and `SPB453J1`. `SPB507J1` exhausted malformed
  retries and remains `planned`.

The successful targets received review artifacts with their Perplexity job IDs
and exact manufacturer URLs. All remain research-only `needs_review`; no model
is promoted to the recommendation catalogue until its M1 fields are reviewed.

## Eighty-third targeted Perplexity worker pass (retrieved 2026-09-03)

The queued current-catalogue references were sent through the strict Perplexity
normalization worker. Nine targets returned valid normalized jobs and were
cross-checked against exact manufacturer pages before adding research-only
review artifacts:

- **Cartier:** Santos de Cartier `WSSA0061`, Panthère de Cartier `WSPN0007`,
  Ballon Bleu de Cartier `WSBB0030`, and Pasha de Cartier `WSPA0013`.
- **Omega:** Seamaster Diver 300M `210.30.42.20.01.010`, Seamaster Planet
  Ocean 600M `217.30.42.21.01.001`, and De Ville Trésor
  `435.13.40.21.02.001`.
- **Grand Seiko:** Heritage quartz `SBGX265` and Heritage Hi-Beat `SBGH347`.

The exact primary checks are [Cartier WSSA0061](https://www.cartier.com/en-us/watches/collections/santos-de-cartier/santos-de-cartier-watch-CRWSSA0061.html), [Cartier WSPN0007](https://www.cartier.com/en-bl/watches/collections/panthere-de-cartier/panthere-de-cartier-watch-CRWSPN0007), [Cartier WSBB0030](https://www.cartier.com/en-us/watches/collections/ballon-de-cartier/ballon-bleu-de-cartier-watch-CRWSBB0030.html), [Cartier WSPA0013](https://www.cartier.com/en-sa/watches/collections/pasha-de-cartier/pasha-de-cartier-watch--CRWSPA0013.html), [Omega 210.30.42.20.01.010](https://www.omegawatches.com/en-us/watch-omega-seamaster-diver-300m-co-axial-master-chronometer-42-mm-21030422001010), [Omega 217.30.42.21.01.001](https://www.omegawatches.com/en-us/watch-omega-seamaster-planet-ocean-600m-co-axial-master-chronometer-42-mm-21730422101001), [Omega 435.13.40.21.02.001](https://www.omegawatches.com/en-us/watch-omega-de-ville-tresor-co-axial-master-chronometer-40-mm-43513402102001), [Grand Seiko SBGX265](https://www.grand-seiko.com/us-en/collections/sbgx265g), and [Grand Seiko SBGH347](https://www.grand-seiko.com/gr-en/collections/sbgh347g).

The remaining 28 queued targets exhausted their worker attempts because the
provider returned malformed or otherwise unusable structured claims: Cartier
Tank Must `W4TA0031`; Omega De Ville Prestige `434.10.40.20.10.001`; Grand
Seiko `SBGJ237`, `SBGE255`, `SBGC253`, `SBGM255`, `SBGY007`, `SBGA293`,
`SLGA021`, and `SLGC001`; IWC `IW388305`; Chopard `168574-3013`; Tudor
`M79000B-0001`, `M7939G1A0NRU-0003`, `M7943A1A0NU-0001`, `M79310N-0001`,
`M79470-0004`, `M25610TNL-0001`, `M2542G267NU-0002`, `M79930-0007`,
`M91560-0002`, and `M2840D1A0-0001`; Panerai `PAM03313` and `PAM01731`;
Hublot `421.EX.5129.NR.RLD` and `642.QK.0110.NR`; and Seiko `SPB507J1` and
`SRPL83`. Their exact identities may be documented by primary pages from the
catalogue recheck, but no malformed payload was imported and no review
artifact was created for a failed worker target.

All nine successful targets remain `needs_review` with identity, reference
code, and manufacturer URL confirmed. Non-identity claims remain provisional
until field-level M1 review; missing facts remain null and no model is
promoted to the recommendation catalogue.

## Eighty-fourth primary-catalogue gap audit (retrieved 2026-09-03)

The four parallel read-only audits rechecked the 28 failed worker targets
against current manufacturer pages. All 28 exact identities were confirmed as
current, including Cartier `W4TA0031`, Omega `434.10.40.20.10.001`, Seiko
`SPB507J1` and `SRPL83`, IWC `IW388305`, Chopard `168574-3013`, Panerai
`PAM03313` and `PAM01731`, Hublot `421.EX.5129.NR.RLD` and
`642.QK.0110.NR`, eight Grand Seiko references (`SBGJ237`, `SBGE255`,
`SBGC253`, `SBGM255`, `SBGY007`, `SBGA293`, `SLGA021`, `SLGC001`), and ten
Tudor references (`M79000B-0001`, `M7939G1A0NRU-0003`, `M7943A1A0NU-0001`,
`M79310N-0001`, `M79470-0004`, `M25610TNL-0001`, `M2542G267NU-0002`,
`M79930-0007`, `M91560-0002`, `M2840D1A0-0001`). The official checks include
[Cartier W4TA0031](https://www.cartier.com/en-ca/watches/collections/tank/tank-must-de-cartier-watch-CRW4TA0031.html), [Omega 434.10.40.20.10.001](https://www.omegawatches.com.hk/en-hk/watch-omega-de-ville-prestige-co-axial-master-chronometer-40-mm-43410402010001), [Seiko SPB507J1](https://www.seikowatches.com/us-en/products/prospex/spb507j1), [Seiko SRPL83](https://www.seikowatches.com/pl-pl/products/5sports/srpl83), [IWC IW388305](https://www.iwc.com/us-en/watches/pilot-watches/iw388305-pilots-watch-performance-chronograph-41-amg), [Chopard 168574-3013](https://www.chopard.com/en-us/watch/168574-3013.html), [Panerai PAM03313](https://www.panerai.com/en/collections/watch-collection/luminor/pam03313-luminor-marina.html), [Panerai PAM01731](https://www.panerai.com/en/collections/watch-collection/luminor/pam01731-luminor.html), [Hublot 421.EX.5129.NR.RLD](https://www.hublot.com/en-us/watches/big-bang/big-bang-reloaded-blue-ceramic-44-mm), [Hublot 642.QK.0110.NR](https://www.hublot.com/en-us/watches/big-bang/spirit-of-big-bang-frosted-carbon-42-mm), [Grand Seiko SBGJ237](https://www.grand-seiko.com/us-en/collections/sbgj237g), and [Tudor M79000B-0001](https://www.tudorwatch.com/en/watches/black-bay-54/m79000b-0001).

Complete exact-card index for the remaining 28 targets: Grand Seiko
[SBGJ237](https://www.grand-seiko.com/us-en/collections/sbgj237g),
[SBGE255](https://www.grand-seiko.com/us-en/collections/sbge255g),
[SBGC253](https://www.grand-seiko.com/us-en/collections/sbgc253g),
[SBGM255](https://www.grand-seiko.com/us-en/collections/sbgm255g),
[SBGY007](https://www.grand-seiko.com/us-en/collections/sbgy007g),
[SBGA293](https://www.grand-seiko.com/us-en/collections/sbga293g),
[SLGA021](https://www.grand-seiko.com/us-en/collections/slga021g), and
[SLGC001](https://www.grand-seiko.com/us-en/collections/slgc001g); Tudor
[M79000B-0001](https://www.tudorwatch.com/en/watches/black-bay-54/m79000b-0001),
[M7939G1A0NRU-0003](https://www.tudorwatch.com/en/watches/black-bay-58/m7939g1a0nru-0003),
[M7943A1A0NU-0001](https://www.tudorwatch.com/en/watches/black-bay-68/m7943a1a0nu-0001),
[M79310N-0001](https://www.tudorwatch.com/en/watch-family/daring-watches/m79310n-0001),
[M79470-0004](https://www.tudorwatch.com/en/watches/black-bay-pro/m79470-0004),
[M25610TNL-0001](https://www.tudorwatch.com/en/watches/pelagos/m25610tnl-0001),
[M2542G267NU-0002](https://www.tudorwatch.com/en/watches/pelagos-fxd/m2542gxx7nu-0002),
[M79930-0007](https://www.tudorwatch.com/en/watches/ranger/m79930-0007),
[M91560-0002](https://www.tudorwatch.com/en/watches/1926/m91560-0002), and
[M2840D1A0-0001](https://www.tudorwatch.com/en/watches/tudor-royal/m2840d1a0-0001);
IWC [IW388305](https://www.iwc.com/us-en/watches/pilot-watches/iw388305-pilots-watch-performance-chronograph-41-amg);
Chopard [168574-3013](https://www.chopard.com/en-us/watch/168574-3013.html);
Panerai [PAM03313](https://www.panerai.com/en/collections/watch-collection/luminor/pam03313-luminor-marina.html)
and [PAM01731](https://www.panerai.com/en/collections/watch-collection/luminor/pam01731-luminor.html);
Hublot [421.EX.5129.NR.RLD](https://www.hublot.com/en-us/watches/big-bang/big-bang-reloaded-blue-ceramic-44-mm)
and [642.QK.0110.NR](https://www.hublot.com/en-us/watches/big-bang/spirit-of-big-bang-frosted-carbon-42-mm);
Cartier [W4TA0031](https://www.cartier.com/en-ca/watches/collections/tank/tank-must-de-cartier-watch-CRW4TA0031.html);
Omega [434.10.40.20.10.001](https://www.omegawatches.com.hk/en-hk/watch-omega-de-ville-prestige-co-axial-master-chronometer-40-mm-43410402010001);
Seiko [SPB507J1](https://www.seikowatches.com/us-en/products/prospex/spb507j1) and
[SRPL83](https://www.seikowatches.com/pl-pl/products/5sports/srpl83).

The same audits identified 39 additional exact references and added them to
the manifest as `planned` targets for later Perplexity normalization: 12 Grand
Seiko references (`SBGE295`, `SLGC009`, `SBGA481`, `SBGE253`, `SBGE257`,
`SBGM221`, `SBGW301`, `SBGA407`, `SBGY043`, `SBGM257`, `SLGA019`, `SLGA015`),
three Tudor references (`M79000-0001`, `M7939A1A0RU-0001`, `M25407N-0001`),
three IWC Performance Chronograph variants (`IW388304`, `IW388306`,
`IW388309`), nine Chopard references (`168619-3010`, `168619-3020`,
`278598-6002`, `278573-3030`, `168629-3002`, `298601-3012`, `203787-0001`,
`168860-3005`, `168627-3003`), three Hublot Big Bang Reloaded variants
(`421.GM.1144.NR.RLD`, `421.MX.1133.NR.RLD`, `421.NM.1123.NR.RLD`), Cartier
`WJSA0013`, four Omega De Ville Prestige dial variants
(`434.10.40.20.01.001`, `.02.001`, `.03.001`, `.06.001`), and four Seiko
references (`SPB519J1`, `SSK003`, `SSK033`, `SRPL85`). Individual primary
checks include the [Grand Seiko collection](https://www.grand-seiko.com/us-en/collections), [Tudor M79000-0001](https://www.tudorwatch.com/en/watch-family/daring-watches/m79000-0001), [IWC IW388304](https://www.iwc.com/us-en/watches/pilot-watches/iw388304-pilots-watch-performance-chronograph-41-amg), [IWC IW388306](https://www.iwc.com/us-en/watches/pilot-watches/iw388306-pilots-watch-performance-chronograph-41-mercedes-amg-petronas), [IWC IW388309](https://www.iwc.com/us-en/watches/pilot-watches/iw388309-pilots-watch-performance-chronograph-41), [Chopard 168619-3010](https://www.chopard.com/en-intl/watch/168619-3010.html), [Chopard 168629-3002](https://www.chopard.com/en-intl/watch/168629-3002.html), [Hublot dark-green](https://www.hublot.com/en-us/watches/big-bang/big-bang-reloaded-dark-green-ceramic-44-mm), [Hublot Magic Gold](https://www.hublot.com/en-us/watches/big-bang/big-bang-reloaded-magic-gold-44-mm), [Cartier WJSA0013](https://www.cartier.com/en-us/watches/collections/santos-de-cartier/santos-de-cartier-watch-CRWJSA0013.html), [Omega black Prestige](https://www.omegawatches.com.hk/en-hk/watch-omega-de-ville-prestige-co-axial-master-chronometer-40-mm-43410402001001), [Seiko SPB519J1](https://www.seikowatches.com/us-en/products/prospex/spb519j1), and [Seiko SRPL85](https://www.seikowatches.com/us-en/products/5sports/srpl85).

The Panerai collection audit additionally surfaced many candidate references,
including Luminor `PAM01732`, `PAM01733`, `PAM01735`, `PAM01629`, `PAM01631`,
`PAM01678`, `PAM01783`, `PAM03312`, `PAM03314`, `PAM03323`, `PAM03325`,
`PAM01460`, `PAM05218`, and Submersible `PAM01756`, `PAM01738`, `PAM01495`,
`PAM01089`, `PAM01565`, `PAM01697`, `PAM01698`, `PAM01596`, `PAM01518`,
`PAM01676`, `PAM01287`, `PAM01289`, `PAM01543`, `PAM01579`, `PAM01466`,
`PAM01513`. Because this pass only established collection-level visibility for
these additional Panerai candidates, they remain discovery notes until each
exact product card is independently checked.

The Perplexity API returned `401 insufficient_quota` during these audits, so no
new provider jobs or review artifacts were fabricated. Exact primary-page
confirmation is recorded separately from the required Perplexity normalization
and field-level M1 review; all newly queued targets remain `planned`.

## Eighty-fifth Rolex current-catalogue recheck (retrieved 2026-09-03)

A fresh check of the official [Rolex all-models catalogue](https://www.rolex.com/watches/find-rolex) and [2026 new-watches catalogue](https://www.rolex.com/watches/new-watches) found 17 active collection families and 56 current model cards. The earlier Rolex queue already covers the visible Land-Dweller, Oyster Perpetual, Datejust, Day-Date, GMT-Master II, Yacht-Master II, and other current reference families. Two exact product cards were absent from the manifest and were added as `planned`: [Submariner 124060-0001](https://www.rolex.com/watches/submariner/m124060-0001.html) and [Day-Date 40 228235-0055](https://www.rolex.com/watches/day-date/m228235-0055).

This Rolex pass used the official catalogue for current-model discovery and the
exact product cards for identity confirmation. It did not create a Perplexity
job because the API remains at `401 insufficient_quota`; both new references
therefore stay `planned` until strict Perplexity normalization succeeds.

## Eighty-sixth Omega current-release check (retrieved 2026-09-03)

The official [OMEGA press room release](https://press.omegawatches.com/omega-extends-the-speedmaster-38-mm-collection/)
dated 2026-08-25 reports seven new Speedmaster 38 mm references, including
steel, bicolour, and diamond-set configurations, with six date variants using
calibre 3330 and one no-date variant using calibre 3332. The current manifest
does not enumerate the codes, but a parallel exact-page audit confirmed all
seven on individual official Omega product pages: [324.30.38.50.01.002](https://www.omegawatches.com/watch-omega-speedmaster-38-co-axial-chronometer-chronograph-38-mm-32430385001002), [324.30.38.50.02.003](https://www.omegawatches.com/watch-omega-speedmaster-38-co-axial-chronometer-chronograph-38-mm-32430385002003), [324.30.38.50.04.001](https://www.omegawatches.com/watch-omega-speedmaster-38-co-axial-chronometer-chronograph-38-mm-32430385004001), [324.20.38.50.02.002](https://www.omegawatches.com/watch-omega-speedmaster-38-co-axial-chronometer-chronograph-38-mm-32420385002002), [324.20.38.50.02.001](https://www.omegawatches.com/watch-omega-speedmaster-38-co-axial-chronometer-chronograph-38-mm-32420385002001), [324.15.38.50.05.001](https://www.omegawatches.com/watch-omega-speedmaster-38-co-axial-chronometer-chronograph-38-mm-32415385005001), and [324.15.38.50.03.001](https://www.omegawatches.com/watch-omega-speedmaster-38-co-axial-chronometer-chronograph-38-mm-32415385003001). They are now manifest targets, but remain `planned` until a valid Perplexity job provides the research-normalization record.

Primary-page index for the 39 newly queued targets: Grand Seiko
[SBGE295](https://www.grand-seiko.com/us-en/collections/sbge295g),
[SLGC009](https://www.grand-seiko.com/us-en/collections/slgc009g),
[SBGA481](https://www.grand-seiko.com/us-en/collections/sbga481g),
[SBGE253](https://www.grand-seiko.com/us-en/collections/sbge253g),
[SBGE257](https://www.grand-seiko.com/us-en/collections/sbge257g),
[SBGM221](https://www.grand-seiko.com/us-en/collections/sbgm221g),
[SBGW301](https://www.grand-seiko.com/us-en/collections/sbgw301g),
[SBGA407](https://www.grand-seiko.com/us-en/collections/sbga407g),
[SBGY043](https://www.grand-seiko.com/us-en/collections/sbgy043g),
[SBGM257](https://www.grand-seiko.com/us-en/collections/sbgm257g),
[SLGA019](https://www.grand-seiko.com/us-en/collections/slga019g), and
[SLGA015](https://www.grand-seiko.com/us-en/collections/slga015g); Tudor
[M79000-0001](https://www.tudorwatch.com/en/watch-family/daring-watches/m79000-0001),
[M7939A1A0RU-0001](https://www.tudorwatch.com/en/watches/black-bay-58/m7939a1a0ru-0001),
and [M25407N-0001](https://www.tudorwatch.com/en/watches/pelagos/m25407n-0001);
IWC [IW388304](https://www.iwc.com/us-en/watches/pilot-watches/iw388304-pilots-watch-performance-chronograph-41-amg),
[IW388306](https://www.iwc.com/us-en/watches/pilot-watches/iw388306-pilots-watch-performance-chronograph-41-mercedes-amg-petronas),
and [IW388309](https://www.iwc.com/us-en/watches/pilot-watches/iw388309-pilots-watch-performance-chronograph-41);
Chopard [168619-3010](https://www.chopard.com/en-intl/watch/168619-3010.html),
[168619-3020](https://www.chopard.com/en-intl/watch/168619-3020.html),
[278598-6002](https://www.chopard.com/en-intl/watch/278598-6002.html),
[278573-3030](https://www.chopard.com/en-intl/watch/278573-3030.html),
[168629-3002](https://www.chopard.com/en-intl/watch/168629-3002.html),
[298601-3012](https://www.chopard.com/en-intl/watch/298601-3012.html),
[203787-0001](https://www.chopard.com/en-intl/watch/203787-0001.html),
[168860-3005](https://www.chopard.com/en-intl/watch/168860-3005.html), and
[168627-3003](https://www.chopard.com/en-intl/watch/168627-3003.html); Hublot
[421.GM.1144.NR.RLD](https://www.hublot.com/en-us/watches/big-bang/big-bang-reloaded-dark-green-ceramic-44-mm),
[421.MX.1133.NR.RLD](https://www.hublot.com/en-us/watches/big-bang/big-bang-reloaded-magic-gold-44-mm),
and [421.NM.1123.NR.RLD](https://www.hublot.com/en-us/watches/big-bang/big-bang-reloaded-titanium-ceramic-44-mm);
Cartier [WJSA0013](https://www.cartier.com/en-us/watches/collections/santos-de-cartier/santos-de-cartier-watch-CRWJSA0013.html);
Omega [434.10.40.20.01.001](https://www.omegawatches.com.hk/en-hk/watch-omega-de-ville-prestige-co-axial-master-chronometer-40-mm-43410402001001),
[434.10.40.20.02.001](https://www.omegawatches.com.hk/en-hk/watch-omega-de-ville-prestige-co-axial-master-chronometer-40-mm-43410402002001),
[434.10.40.20.03.001](https://www.omegawatches.com.hk/en-hk/watch-omega-de-ville-prestige-co-axial-master-chronometer-40-mm-43410402003001),
and [434.10.40.20.06.001](https://www.omegawatches.com.hk/en-hk/watch-omega-de-ville-prestige-co-axial-master-chronometer-40-mm-43410402006001);
Seiko [SPB519J1](https://www.seikowatches.com/us-en/products/prospex/spb519j1),
[SSK003](https://www.seikowatches.com/us-en/products/5sports/ssk003),
[SSK033](https://www.seikowatches.com/pl-pl/products/5sports/ssk033), and
[SRPL85](https://www.seikowatches.com/us-en/products/5sports/srpl85).

## Eighty-eighth Omega exact-reference expansion (retrieved 2026-09-03)

The independent Omega catalogue audit found 14 more current exact references
on official product cards: nine Constellation Observatory references
(`140.13.39.21.01.001`, `140.13.39.21.02.001`, `140.13.39.21.03.001`,
`140.13.39.21.10.001`, `140.50.39.21.99.001`, `140.53.39.21.99.001`,
`140.53.39.21.99.002`, `140.53.39.21.99.004`, `140.93.39.21.99.001`),
Seamaster Diver 300M `210.32.44.51.01.002`, `522.92.44.20.04.001`, and
`522.92.44.20.04.002`, and Speedmaster Moonwatch `310.60.42.50.01.002` and
`310.60.42.50.10.002`. Representative exact primary checks are [Constellation Observatory 140.13.39.21.01.001](https://www.omegawatches.com.hk/en-hk/watch-omega-constellation-observatory-co-axial-master-chronometer-39-4-mm-14013392101001), [Seamaster Diver 300M 007 First Light](https://www.omegawatches.com.hk/en-hk/watch-omega-seamaster-diver-300m-co-axial-master-chronometer-chronograph-44-mm-21032445101002), [Seamaster Milano Cortina](https://www.omegawatches.com.hk/en-hk/watch-omega-seamaster-diver-300m-co-axial-master-chronometer-43-5-mm-52292442004001), and [Speedmaster Moonwatch 310.60.42.50.01.002](https://www.omegawatches.com.hk/en-hk/watch-omega-speedmaster-moonwatch-professional-co-axial-master-chronometer-chronograph-42-mm-31060425001002).

All 14 were added as separate `planned` targets. Their primary identities are
confirmed, but none has a successful Perplexity normalization job while the
provider quota remains exhausted.

## Eighty-ninth Rolex GMT exact-reference recheck (retrieved 2026-09-03)

The official [Rolex GMT-Master II model index](https://www.rolex.com/en-us/watches/gmt-master-ii/all-models)
and the individual [126710GRNR-0004 product card](https://www.rolex.com/en-us/watches/gmt-master-ii/m126710grnr-0004)
showed one current Oystersteel/Oyster configuration absent from the manifest.
It was added as `rolex-gmt-master-ii-126710grnr-0004` with `planned` status.
The card identifies the exact reference, 40 mm Oystersteel case, calibre 3285,
GMT function, and 100 m water resistance; Perplexity normalization is still
pending because the API quota remains exhausted.

## Ninetieth Tudor current-catalogue expansion (retrieved 2026-09-03)

The official Tudor 2026 catalogue and exact product cards exposed five
references absent from the manifest: Black Bay 58 `M7939A1A0NU-0001`,
`M7939A1A0NU-0002`, and `M7939A1A0NU-0003`, Monarch `M2639W1A0U-0001`, and
Northflag `M9140G1A0U-0001`. The exact checks are the [Black Bay 58
five-link card](https://www.tudorwatch.com/en/watches/black-bay-58/m7939a1a0nu-0001),
[three-link card](https://www.tudorwatch.com/en/watches/black-bay-58/m7939a1a0nu-0002),
[rubber-strap card](https://www.tudorwatch.com/en/watches/black-bay-58/m7939a1a0nu-0003),
[Monarch card](https://www.tudorwatch.com/en/watches/tudor-monarch/m2639w1a0u-0001),
and [Northflag card](https://www.tudorwatch.com/en/watches/tudor-northflag/m9140g1a0u-0001).
All five were added as separate `planned` targets. Their exact identities are
confirmed by Tudor; Perplexity normalization remains pending while the API
quota is exhausted, so no unverified field was promoted.

The same catalogue pass also confirmed [Black Bay Chrono Carbon 26
`M79377KN-0003`](https://www.tudorwatch.com/en/watch-family/daring-watches/m79377kn-0003),
[Royal 30 `M2830A1A0-0004`](https://www.tudorwatch.com/en/watches/tudor-royal/m2830a1a0-0004),
and [Royal 40 steel-and-gold
`M2840D1A3-0002`](https://www.tudorwatch.com/en/watches/tudor-royal/m2840d1a3-0002).
They were added as separate `planned` targets with identity-only primary
evidence; no characteristics were promoted without the required normalization
review.

## Ninety-first high-horology catalogue expansion (retrieved 2026-09-03)

An independent exact-reference pass found 49 additional current cards absent
from the manifest: 16 Patek Philippe, 18 Audemars Piguet, and 15 Vacheron
Constantin. The Patek cards are [6301P-001](https://www.patek.com/en/collection/grand-complications/6301P-001),
[5330G-001](https://www.patek.com/en/collection/complications/5330g-001),
[5328G-001](https://www.patek.com/en/collection/complications/5328G-001),
[5236P-011](https://www.patek.com/en/collection/grand-complications/5236p-011),
[5270P-015](https://www.patek.com/en/collection/grand-complications/5270p-015),
[5227G-015](https://www.patek.com/en/collection/calatrava/5227g-015),
[6007G-010](https://www.patek.com/en/collection/calatrava/6007g-010),
[5822P-001](https://www.patek.com/en/collection/cubitus/5822P-001),
[5168G-010](https://www.patek.com/en/collection/aquanaut/5168G-010),
[5738/1R-001](https://www.patek.com/en/collection/golden-ellipse/5738-1r-001),
[7300/1200A-011](https://www.patek.com/en/collection/twenty4/7300-1200A-011),
[7340/1R-001](https://www.patek.com/en/collection/twenty4/7340-1R-001),
[5738G-001](https://www.patek.com/en/collection/golden-ellipse/5738g-001),
[7200/50G-001](https://www.patek.com/en/collection/calatrava/7200-50g-001),
[7200/50G-012](https://www.patek.com/en/collection/calatrava/7200-50g-012), and
[5320G-011](https://www.patek.com/en/collection/grand-complications/5320G-011).

The Audemars Piguet cards are [26665SG.ZZ.D209CR.01](https://www.audemarspiguet.com/us/en/watch-collection/code-1159/26665SG.ZZ.D209CR.01),
[77410BC.ZZ.D132CR.01](https://www.audemarspiguet.com/us/en/watch-collection/code-1159/77410BC.ZZ.D132CR.01),
[77410OR.ZZ.D343CR.01](https://www.audemarspiguet.com/us/en/watch-collection/code-1159/77410OR.ZZ.D343CR.01),
[26242OR.ZZ.1322OR.02](https://www.audemarspiguet.com/us/en/watch-collection/royal-oak/26242OR.ZZ.1322OR.02),
[16202BA.HH.1241BA.01](https://www.audemarspiguet.com/us/en/watch-collection/royal-oak/16202BA.HH.1241BA.01),
[16202BC.ZZ.1241BC.01](https://www.audemarspiguet.com/us/en/watch-collection/royal-oak/16202BC.ZZ.1241BC.01),
[26715BC.ZZ.1356BC.01](https://www.audemarspiguet.com/us/en/watch-collection/royal-oak/26715BC.ZZ.1356BC.01),
[26715OR.ZZ.1356OR.01](https://www.audemarspiguet.com/us/en/watch-collection/royal-oak/26715OR.ZZ.1356OR.01),
[26715ST.ZZ.1356ST.01](https://www.audemarspiguet.com/us/en/watch-collection/royal-oak/26715ST.ZZ.1356ST.01),
[77451ST.ZZ.1361ST.03](https://www.audemarspiguet.com/us/en/watch-collection/royal-oak/77451ST.ZZ.1361ST.03),
[77451ST.ZZ.1361ST.04](https://www.audemarspiguet.com/us/en/watch-collection/royal-oak/77451ST.ZZ.1361ST.04),
[77452BC.ZZ.1365BC.01](https://www.audemarspiguet.com/us/en/watch-collection/royal-oak/77452BC.ZZ.1365BC.01),
[77452OR.ZZ.1365OR.01](https://www.audemarspiguet.com/us/en/watch-collection/royal-oak/77452OR.ZZ.1365OR.01),
[67651OR.ZZ.1261OR.02-A](https://www.audemarspiguet.com/us/en/watch-collection/royal-oak/67651OR.ZZ.1261OR.02-A),
[75220BA.OO.7522BA.01](https://www.audemarspiguet.com/us/en/watch-collection/Etablisseurs/75220BA.OO.7522BA.01),
[67650ST.OO.1261ST.01-A](https://www.audemarspiguet.com/us/en/watch-collection/royal-oak/67650ST.OO.1261ST.01-A),
[67651ST.ZZ.1261ST.01-A](https://www.audemarspiguet.com/us/en/watch-collection/royal-oak/67651ST.ZZ.1261ST.01-A), and
[67630OR.OO.1312OR.01-B](https://www.audemarspiguet.com/us/en/watch-collection/royal-oak/67630OR.OO.1312OR.01-B).

The Vacheron Constantin cards are [4600V/200A-B980](https://www.vacheron-constantin.com/ww/en/collections/overseas/4600v-200a-b980.html),
[4600V/200R-H128](https://www.vacheron-constantin.com/ww/en/collections/overseas/4600v-200r-h128.html),
[3200T/000P-H167](https://www.vacheron-constantin.com/ww/en/collections/traditionnelle/3200t-000p-h167.html),
[7930V/210T-H072](https://www.vacheron-constantin.com/ww/en/collections/overseas/7930v-210t-h072.html),
[7930V/210T-H074](https://www.vacheron-constantin.com/ww/en/collections/overseas/7930v-210t-h074.html),
[2500V/220P-H028](https://www.vacheron-constantin.com/ww/en/collections/overseas/2500v-220p-h028.html),
[1100S/000R-H115](https://www.vacheron-constantin.com/ww/en/collections/historiques/1100s-000r-h115.html),
[5000H/000A-B582](https://www.vacheron-constantin.com/ww/en/collections/historiques/5000h-000a-b582.html),
[4305T/000G-H135](https://www.vacheron-constantin.com/ww/en/collections/traditionnelle/4305t-000g-h135.html),
[85180/000G-H035](https://www.vacheron-constantin.com/ww/en/collections/patrimony/85180-000g-h035.html),
[4600E/000R-H101](https://www.vacheron-constantin.com/ww/en/collections/fiftysix/4600e-000r-h101.html),
[1410U/000G-H017](https://www.vacheron-constantin.com/ww/en/collections/patrimony/1410u-000g-h017.html),
[8005F/000R-B498](https://www.vacheron-constantin.com/ww/en/collections/egerie/8005f-000r-b498.html),
[6000E/000R-B488](https://www.vacheron-constantin.com/ww/en/collections/fiftysix/6000e-000r-b488.html), and
[5520V/210A-B481](https://www.vacheron-constantin.com/ww/en/collections/overseas/5520v-210a-b481.html).
All 49 were added as separate `planned` targets. Their identities are
primary-source-confirmed; no Perplexity normalization or non-identity field
was accepted because the provider quota remains exhausted.

## Ninety-second Cartier and Grand Seiko exact-card expansion (retrieved 2026-09-03)

The parallel catalogue audit compared the manifest against the official
[Cartier all-watches catalogue](https://www.cartier.com/en-us/watches/collections/clash-unlimited/)
and [Grand Seiko watch finder](https://www.grand-seiko.com/us-en/collections/all).
It found 113 Cartier references absent from the manifest across Baignoire,
Ballon Bleu, Panthère, Roadster, Santos/Santos-Dumont, Tank, and Tortue, plus
110 Grand Seiko references across Elegance, Evolution 9, Heritage, Masterpiece,
and Sport. Each retained reference was checked against an individual official
product card by the agent; all 223 were added as separate `planned` targets.
These are identity-level catalogue confirmations only. Perplexity was
unavailable because the API quota is exhausted, so no technical or commercial
fields were promoted and these targets remain outside the accepted catalogue.

## Ninety-sixth Hublot, Panerai and Seiko recheck (retrieved 2026-09-03)

The exact-card audit found no omissions among the eight reviewed Hublot or
eight reviewed Panerai references. It found five Seiko regional/configuration
codes absent from the manifest: `SNE573P1`, `SPB143J1`, `SPB281J1`, `SRPB43J1`,
and `SSJ013J1`. These were checked on the official [SNE573P1](https://www.seikowatches.com/middleeast-en/products/prospex/sne573),
[SPB143J1](https://www.seikowatches.com/ph-en/products/prospex/spb143j1),
[SPB281J1](https://seikoboutique.com.my/product/spb281j1/),
[SRPB43J1](https://www.seikowatches.com/my-en/products/presage/srpb43j1), and
[SSJ013J1](https://www.seikowatches.com/us-en/products/astron/ssj013j1)
cards, then added as separate `planned` targets. These are identity-level
regional references; no technical fields were promoted.

## Ninety-third Rolex current-reference recheck (retrieved 2026-09-03)

The parallel Rolex audit compared all current family indexes and individual
product cards. It found 77 displayed reference codes absent from the manifest:
1908 (2), Cosmograph Daytona (13), Datejust (18), Lady-Datejust (13), Day-Date
(13), Deepsea (1), Oyster Perpetual (7), Sky-Dweller (6), Submariner (2), and
Yacht-Master (2). The official sources are the [Rolex all-models
finder](https://www.rolex.com/en-us/watches/find-rolex) and the family indexes
for [1908](https://www.rolex.com/en-us/watches/1908/all-models),
[Daytona](https://www.rolex.com/en-us/watches/cosmograph-daytona/all-models),
[Datejust](https://www.rolex.com/en-us/watches/datejust/all-models),
[Lady-Datejust](https://www.rolex.com/en-us/watches/lady-datejust/all-models),
[Day-Date](https://www.rolex.com/en-us/watches/day-date/all-models),
[Deepsea](https://www.rolex.com/en-us/watches/deepsea/all-models),
[Oyster Perpetual](https://www.rolex.com/en-us/watches/oyster-perpetual/all-models),
[Sky-Dweller](https://www.rolex.com/en-us/watches/sky-dweller/all-models),
[Submariner](https://www.rolex.com/en-us/watches/submariner/all-models), and
[Yacht-Master](https://www.rolex.com/en-us/watches/yacht-master/all-models).
All 77 exact identities were added as separate `planned` targets. The audit
found no displayed-reference gap in Air-King, Explorer, Explorer II, GMT-Master
II, Land-Dweller, Sea-Dweller, or Yacht-Master II. No specs or prices were
promoted, and Perplexity normalization remains pending because its API quota
is exhausted.

## Ninety-fourth Breguet, Blancpain, Breitling and Zenith expansion (retrieved 2026-09-03)

The parallel exact-card pass found 142 additional references absent from the
manifest: 40 Breguet, 23 Blancpain, 47 Breitling, and 32 Zenith. Discovery and
identity checks used the official [Breguet watch finder](https://www.breguet.com/en/find-a-watch),
[Blancpain Fifty Fathoms finder](https://www.blancpain.com/en/watch-finder?facets_query=collection/12236),
[Breitling collections](https://www.breitling.com/us-en/collections/), and
[Zenith watch catalogue](https://www.zenith-watches.com/int/products/watches),
with each retained reference checked against an official product card. All 142
were added as separate `planned` targets. These are identity-level
confirmations only; Perplexity normalization remains pending because its API
quota is exhausted, and no unverified specifications were promoted.

## Ninety-fifth Omega exact-card expansion (retrieved 2026-09-03)

The independent Omega audit compared the 42 existing Omega targets with the
official HK catalogue and product cards, finding 241 additional current
references: 34 Seamaster, 63 Speedmaster, 117 Constellation, and 27 De Ville.
Evidence is retained through the official [Seamaster catalogue](https://www.omegawatches.com.hk/en-hk/watches/seamaster/catalog),
[Speedmaster catalogue](https://www.omegawatches.com.hk/en-hk/watches/speedmaster/catalog),
[Constellation catalogue](https://www.omegawatches.com.hk/en-hk/watches/constellation/constellation/catalog),
and [De Ville catalogue](https://www.omegawatches.com.hk/en-hk/watches/de-ville/catalog).
All 241 exact identities were added as separate `planned` targets. The source
cards are primary confirmation of identity only; no technical or commercial
fields were promoted without successful Perplexity normalization and the
repository’s field-level review.

## Ninety-seventh IWC and Chopard exact-card expansion (retrieved 2026-09-03)

The parallel catalogue audit compared the manifest with the official
[IWC Schaffhausen watch catalogue](https://www.iwc.com/eu-en/watches) and
[Chopard watch catalogue](https://www.chopard.com/en-intl/watches). It found
208 additional IWC references across Aquatimer, Ingenieur, Pilot's Watches,
Portofino, and Portugieser, plus 221 additional Chopard references. IWC
identities were checked against the manufacturer catalogue; Chopard identities
were checked against individual official cards using the manufacturer's
reference URL pattern. All 429 were added as planned targets.
These are identity-level confirmations only. Perplexity normalization remains
pending because the API quota is exhausted, so no specifications or prices
were promoted.

## Ninety-eighth Tudor exact-card recheck (retrieved 2026-09-03)

The independent Tudor audit compared the 24 existing targets with current
official family pages and individual product cards, using the [TUDOR 2026
catalogue](https://www.tudorwatch.com/en/new-watches) and family pages for
[Black Bay](https://www.tudorwatch.com/en/watch-family/black-bay),
[Black Bay 54](https://www.tudorwatch.com/en/watch-family/black-bay-54),
[Black Bay 58](https://www.tudorwatch.com/en/watch-family/black-bay-58),
[Black Bay One](https://www.tudorwatch.com/en/watches/black-bay-one),
[Black Bay GMT](https://www.tudorwatch.com/en/watch-family/black-bay-gmt),
[Black Bay Chrono](https://www.tudorwatch.com/en/watch-family/black-bay-chrono),
[Pelagos FXD](https://www.tudorwatch.com/en/watch-family/pelagos-fxd),
[Pelagos](https://www.tudorwatch.com/en/watch-family/pelagos),
[Ranger](https://www.tudorwatch.com/en/watch-family/ranger),
[Clair de Rose](https://www.tudorwatch.com/en/watch-family/clair-de-rose),
[1926](https://www.tudorwatch.com/en/watches/1926), and
[Royal](https://www.tudorwatch.com/en/watch-family/tudor-royal). It identified
191 current reference codes in the comparison and added 188 new exact targets
after deduplicating already represented codes and excluding one malformed
Royal code whose linked official card resolves to a different reference. The
audit also corrected the manifest's M79000-0001 to M79000B-0001 and
M2542G267NU-0002 to M2542GXX7NU-0002. No technical or commercial fields
were promoted; Perplexity normalization remains pending because its API quota
is exhausted.

## Ninety-ninth Rado identity normalization (retrieved 2026-09-03)

The interrupted parallel audit confirmed the existing Rado HyperChrome Quartz
reference R32280109 against the [official Rado watch
catalogue](https://www.rado.com/en_us/watches/all-watches/men-watches.html).
No complete catalogue omission list was accepted from that pass. The existing
target label was normalized to expose the explicit Rado HyperChrome reference
while retaining its existing review-artifact ID; no technical, price, or
availability claims were promoted.

## One-hundred-first NOMOS exact-reference expansion (retrieved 2026-09-03)

The parallel NOMOS audit expanded 164 official product cards into 251 unique
exact references, including slash-separated variants, using the [official
NOMOS all-models catalogue](https://nomos-glashuette.com/en-us/store/watches)
and collection pages. The manifest already represented Ref. 746; the other
250 references across Tangente, Ludwig, Orion, Tetra, Zürich, Ahoi, Tangomat,
Club, Lux, Metro, Lambda, Minimatik, and Autobahn were added as separate
planned targets. Perplexity was unavailable, so these remain identity-level
primary-source confirmations without promoted technical or commercial fields.

## One-hundred-second Bell & Ross exact-reference expansion (retrieved 2026-09-03)

The complete Bell & Ross audit used the official catalogue JSON and product
pages, finding 130 current exact references in BR-03, BR-05, BR-X3, and BR-X5.
One exact reference was already represented; the other 129 were added as
separate planned targets. The primary sources are the [Bell & Ross all-watches
catalogue](https://bellross.com/en-us/collections/toutes-nos-montres),
[BR-03](https://bellross.com/en-us/collections/br-03),
[BR-05](https://bellross.com/en-us/collections/br-05),
[BR-X3](https://bellross.com/en-us/collections/br-x3), and
[BR-X5](https://bellross.com/en-us/collections/br-x5). Perplexity was
unavailable; no technical or commercial fields were promoted.

## One-hundred-third Mido exact-reference expansion (retrieved 2026-09-03)

The complete parallel Mido audit compared the manifest with 244 current exact
references from the official [Mido watch catalogue](https://www.midowatches.com/en/watches.html)
and official product cards. One reference was already represented; 243
additional references across Baroncelli, Belluna, Commander, Multifort, Ocean
Star, and Rainflower were added as separate planned targets. Perplexity was
unavailable, so no technical, price, or availability fields were promoted.

## One-hundred-fourth DOXA exact-reference expansion (retrieved 2026-09-03)

The complete parallel DOXA audit compared the manifest with 301 unique exact
references extracted from the official [DOXA all-watches catalogue](https://doxawatches.com/collections/all-doxa-watches),
official collection pages, product cards, and the product feed. One reference
was already represented; the other 300 references were added as separate
planned targets, including the previously omitted 130th Anniversary
`799.10.101LE.10` card. Sixteen published references were unavailable for
purchase at retrieval time but remain identity-confirmed. Perplexity was
unavailable because of quota exhaustion; no technical, price, or availability
fields were promoted.

## One-hundred-fifth Baltic product-identity expansion (retrieved 2026-09-03)

The parallel Baltic audit found 60 current product identities in the official
[Baltic all-watches catalogue](https://baltic-watches.com/en/collections/watches).
Two Aquascaphe Classic Blue Gilt and Black Gilt configurations were already
represented; 58 additional configurations were added as planned targets.
Baltic does not publish one public full-SKU registry for these configurations,
so the manifest retains the official product handle and configuration name
instead of inferring codes. Three archived Aquascaphe GMT identities were
excluded from the current count using the [official archive](https://baltic-watches.com/en/archives/aquascaphe-gmt).
Perplexity was unavailable; no technical, price, or availability fields were
promoted.

## One-hundred-sixth Farer product-identity expansion (retrieved 2026-09-03)

The parallel Farer audit found 37 current product identities in the official
[Farer all-watches catalogue](https://farer.com/collections/all-watches?pp=0).
The Alert identity was already represented; 36 additional models were added as
planned targets. Farer exposes product handles rather than a separate public
reference field, and strap `W-*` SKUs were deliberately not treated as watch
models. Perplexity was unavailable; no technical, price, or availability fields
were promoted.

## One-hundred-seventh Citizen exact-reference expansion (retrieved 2026-09-03)

The complete Citizen audit compared the manifest with 454 unique current
references and explicit Model fields from the official US catalogue and
collection pages. Five references were already represented; 449 additional
references were added as separate planned targets. The audit also retained
the officially published `AW5008-06W` product card even though it was sold out
and absent from collection pagination. Perplexity was unavailable because of
quota exhaustion; no technical, price, or availability fields were promoted.

## One-hundred-eighth Hamilton exact-reference expansion (retrieved 2026-09-03)

The reconciled Hamilton audit used the official [US catalogue](https://www.hamiltonwatch.com/en-us/collection.html),
[International catalogue](https://www.hamiltonwatch.com/en-int/collection.html),
and product cards, checking exact Reference values and
`Status = Current collection`. The deduplicated union contained 265 current
references; all 10 manifest references were present and 255 additional exact
references were added as planned targets. Twelve `Past collection` cards and
three necklace accessory SKUs were excluded. Perplexity was unavailable because
of quota exhaustion; no technical, price, or availability fields were
promoted.

## One-hundred-ninth Tissot exact-reference expansion (retrieved 2026-09-03)

The complete Tissot audit compared the manifest with 454 unique exact
references from 454 official product cards in the [Tissot collection catalogue](https://www.tissotwatches.com/en-us/collection.html).
Nine manifest references matched current cards; two legacy manifest targets
were not found in the current catalogue. The other 445 exact references were
added as separate planned targets, with duplicate references removed after
normalizing card URLs and punctuation. Perplexity was unavailable because of
quota exhaustion; no technical, price, or availability fields were promoted.

## One-hundred-tenth Citizen US/EU regional supplementation (retrieved 2026-09-03)

The follow-up Citizen audit widened the comparison from the US catalogue to
the official [Citizen US catalogues](https://www.citizenwatch.com/us/en/collection/mens)
and [Citizen EU catalogue](https://citizenwatch.eu/en/watches/). Their
deduplicated union contained 783 exact references; 455 were already represented
after the US expansion and 328 additional regional references were added as
planned targets. Each supplemental identity was checked against an official
product card; no technical, price, or availability fields were promoted.
Perplexity was unavailable because of quota exhaustion.

## One-hundred-eleventh Certina exact-reference expansion (retrieved 2026-09-03)

The complete Certina audit compared the manifest with 139 unique current
references from the official [Certina all-watches catalogue](https://www.certina.com/en/watch/all-watches)
and its official product-card URLs. The existing exact reference
`C048.807.44.051.01` was present; 138 additional exact references were added
as planned targets. The separate generic mid-price mechanical target remains
unpromoted. Product URLs encode the exact reference identity, while technical,
price, and availability fields remain unpromoted until captured from each
product sheet. Perplexity was unavailable because of quota exhaustion.

## One-hundred-twelfth Junghans exact-reference follow-up (retrieved 2026-09-03)

The official [Junghans watch catalogue](https://junghans.de/en/collection/) exposed 23 product-card entries that
were present in the watch catalogue API but absent from the public SKU search
index. Official card image metadata and item-number fields confirmed 19 unique
exact watch references; four duplicate max bill Quarz entries repeated the
same `41/4660.46` identity and were not duplicated in the manifest. The 19
confirmed references were added as planned targets. Technical, price, and
availability fields remain unpromoted. Perplexity was unavailable because of
quota exhaustion.

## One-hundred-thirteenth Rado exact-reference expansion (retrieved 2026-09-03)

The complete Rado audit used the official [men's catalogue](https://www.rado.com/en_us/watches/all-watches/men-watches.html)
and [women's catalogue](https://www.rado.com/en_us/watches/all-watches/women-watches.html).
The catalogues contained 238 and 258 current cards respectively; their
deduplicated union contained 343 unique exact SKUs. The existing
`R32280109` reference was confirmed in the union, and 342 additional exact
references were added as planned targets. No technical, price, or availability
fields were promoted.

## One-hundred-fourteenth Oris exact-reference expansion (retrieved 2026-09-03)

The complete Oris audit compared the manifest with 207 unique current
references from the official [current Oris catalogue](https://www.oris.ch/en-US/product/watch?page=5)
and canonical product pages. Four current references were already represented;
203 additional exact references were added as planned targets. Three
manifest-only references were not counted as current, and 1,630 Previous/
archived references were excluded using the [official archived catalogue](https://www.oris.ch/en-US/product/watch?mode=watches_archived&page=0).
Every added target retains its official product-card URL in the coverage
rationale. No technical, price, or availability fields were promoted.
Perplexity was unavailable because of quota exhaustion.

## One-hundred-fifteenth Seiko US-en exact-reference expansion (retrieved 2026-09-03)

The Seiko US-en audit compared the manifest with 376 official catalogue cards,
representing 375 unique current references across the [5 Sports](https://www.seikowatches.com/us-en/products/5sports/lineup),
[Astron](https://www.seikowatches.com/us-en/products/astron/lineup),
[Coutura](https://www.seikowatches.com/us-en/products/coutura/coutura),
[Diamond Collection](https://www.seikowatches.com/us-en/products/diamondcollection),
[Discover More](https://www.seikowatches.com/us-en/products/discovermore/lineup),
[King Seiko](https://www.seikowatches.com/us-en/products/kingseiko/lineup),
[Presage](https://www.seikowatches.com/us-en/products/presage/lineup),
[Prospex](https://www.seikowatches.com/us-en/products/prospex/lineup), and
[Seiko Power Design Project](https://www.seikowatches.com/us-en/products/seiko-power-design-project)
catalogues. Twenty-one current references were already represented; 354
additional exact references were added as planned targets. The duplicate
`SJE107` card was counted once. Nine manifest-only regional references were
not treated as current US-en coverage. Technical, price, and availability
fields remain unpromoted. Perplexity was unavailable because of quota
exhaustion.

## One-hundred-sixteenth Hamilton current-reference follow-up (retrieved 2026-09-03)

The official Hamilton US and International current-collection filters exposed
267 exact watch references. The manifest contained 265 matching records, but
one of those (`H31231140`) is a necklace accessory and was excluded from the
watch catalogue. The remaining 264 represented watches leave three confirmed
current gaps, which were added as planned targets with their official product
pages: [H32301161](https://www.hamiltonwatch.com/en-int/h32301161-jazzmaster-quartz.html),
[H78505331](https://www.hamiltonwatch.com/en-int/h78505331-khaki-navy-belowzero-auto-limited-edition.html), and
[H89479970](https://www.hamiltonwatch.com/en-us/h89479970-khaki-field-mechanical-lancaster.html).
Technical, price, and availability fields remain unpromoted. Perplexity was
unavailable because of quota exhaustion.

## One-hundred-seventeenth DOXA exact-reference recheck (retrieved 2026-09-03)

The official [DOXA SUB 200 130th Anniversary Celebration product page](https://doxawatches.com/products/sub-200-130th-anniversary-celebration)
confirmed the previously added exact reference `799.10.101LE.10`. The current
DOXA comparison remains 301 unique references with no additional manifest
change required in this recheck. Technical, price, and availability fields
remain unpromoted. Perplexity was unavailable because of quota exhaustion.

## One-hundred-eighteenth Swatch US-en exact-reference expansion (retrieved 2026-09-03)

The complete Swatch audit used the official [US watches catalogue](https://www.swatch.com/en-us/watches/)
and its paginated product endpoint. It returned 298 current watch cards, all
marked as non-archived, with one exact reference already represented and 297
additional exact references added as planned targets. The audit excluded 86
accessory records plus three archived accessory records from the watch
universe. Every added target retains its official Swatch product-page URL;
technical, price, and availability fields remain unpromoted. Perplexity was
unavailable because of quota exhaustion.

## One-hundred-nineteenth Marathon exact-reference expansion (retrieved 2026-09-03)

The Marathon audit reconciled the official US and EU watch catalogues,
product JSON feeds, product database, and canonical product pages. It found
272 current exact references; two were already represented and 270 additional
references were added as planned targets. The non-watch `CO194001-BK` wrist
compass was excluded. Every added target retains an official Marathon product
URL in its coverage rationale. Technical, price, and availability fields
remain unpromoted. Perplexity was unavailable because of quota exhaustion.

## One-hundred-twentieth Orient exact-reference expansion (retrieved 2026-09-03)

The complete Orient audit reconciled the official [Orient search catalogue](https://orient-watch.com/en/orient/search/)
with the official [Orient sitemap](https://orient-watch.com/sitemap.xml) and
canonical product pages. It found 273 current exact references; two were
already represented and 271 additional exact references were added as planned
targets. Six sitemap entries returned HTTP 404 during current-catalogue
verification and were recorded as excluded rather than treated as watches.
Every added target retains its official Orient product-page URL. Technical,
price, and availability fields remain unpromoted. Perplexity was unavailable
because of quota exhaustion.

## One-hundred-twenty-first Girard-Perregaux exact-reference expansion (retrieved 2026-09-03)

The complete Girard-Perregaux audit reconciled the official watches catalogue,
collection pages, GraphQL catalogue, and canonical product pages. It found 140
current exact references; one was already represented and 139 additional exact
references were added as planned targets. The `coming_soon` placeholder and a
non-watch/archived-accessory bucket were recorded as excluded. Every added
target retains its official Girard-Perregaux product-page URL. Technical,
price, and availability fields remain unpromoted. Perplexity was unavailable;
the official catalogue and product pages were used as primary-source fallback.

## One-hundred-twenty-second Sinn exact-reference expansion (retrieved 2026-09-03)

The complete Sinn audit reconciled the official [Sinn watches catalogue](https://www.sinn.de/en/watches/),
series index, official 2025/2026 catalogue PDF, and canonical product pages.
It found 172 current exact references; one was already represented and 171
additional exact references were added as planned targets. No accessory or
archived record was admitted to the current watch universe. Every added target
retains its official Sinn product-page URL. Technical, price, and availability
fields remain unpromoted. Perplexity was unavailable because of quota
exhaustion.

## One-hundred-twenty-third Ulysse Nardin exact-reference expansion (retrieved 2026-09-03)

The complete Ulysse Nardin audit reconciled the official [watches catalogue](https://www.ulysse-nardin.com/en-us/watches),
collection pages, official GraphQL catalogue, canonical product pages, and
[discontinued-models catalogue](https://www.ulysse-nardin.com/en-us/watches/discontinued-models).
It found 202 current exact references; one was already represented and 201
additional exact references were added as planned targets. The discontinued
catalogue set and accessories scope were recorded as excluded from the current
watch universe. Every added target retains its official Ulysse Nardin
product-page URL. Technical, price, and availability fields remain
unpromoted. Perplexity was unavailable because of quota exhaustion.

## One-hundred-twenty-fourth TAG Heuer exact-reference expansion (retrieved 2026-09-03)

The TAG Heuer audit reconciled the official [all-watches catalogue](https://www.tagheuer.com/us/en/timepieces/discover/discover-all-watches/),
regional catalogue pagination, collection pages, and the official vintage and
accessories scopes. It found 175 current exact references; one was already
represented and 174 additional exact references were added as planned targets.
Accessories and archived/discontinued timepieces were recorded as excluded
from the current watch universe. Each added target retains an official TAG
Heuer catalogue or collection source. Technical, price, and availability
fields remain unpromoted. Perplexity was unavailable because of quota
exhaustion.

## One-hundred-twenty-fifth Glashütte Original exact-reference expansion (retrieved 2026-09-03)

The Glashütte Original audit reconciled the official [watch finder](https://www.glashuette-original.com/en/watch-finder/),
watch-finder API response, collection pages, and current catalogue scope. It
found 267 current exact references; one was already represented and 266
additional exact references were added as planned targets. Archived/discontinued
records and accessories were recorded as excluded from the current watch
universe. Each added target retains an official Glashütte Original catalogue
or collection source. Technical, price, and availability fields remain
unpromoted. Perplexity was unavailable because of quota exhaustion.

## One-hundred-twenty-sixth F.P. Journe exact-variant expansion (retrieved 2026-09-03)

The F.P. Journe audit reconciled the official [current collections catalogue](https://www.fpjourne.com/en/collections),
the 2025–2028 official catalogue and PDF, and the individual collection pages.
It found 48 current model variants; one was already represented and 47
additional variants were added as planned targets. Accessories, non-watch
items, retrospective collections and unique pieces were recorded as excluded
from the current watch universe. Each added target retains an official F.P.
Journe collection-page source. Technical, price, and availability fields
remain unpromoted. Perplexity was unavailable in this session; official F.P.
Journe pages and catalogue were used as the primary-source fallback.

## One-hundred-twenty-seventh H. Moser & Cie. exact-reference expansion (retrieved 2026-09-03)

The H. Moser & Cie. audit reconciled the official [collections catalogue](https://www.h-moser.com/en/collections),
Streamliner, Pioneer, Endeavour and Heritage collection pages, and official
archive pages. It found 78 current exact references; one was already
represented and 77 additional exact references were added as planned targets.
The Alpine wall clock, archived/sold-out watches and other non-current records
were recorded as excluded from the current watch universe. Each added target
retains an official H. Moser & Cie. catalogue or collection source. Technical,
price, and availability fields remain unpromoted. Perplexity was unavailable;
official H. Moser & Cie. pages were used as the primary-source fallback.

## One-hundred-twenty-eighth Piaget exact-reference expansion (retrieved 2026-09-03)

The Piaget audit reconciled the official [all-watches catalogue](https://www.piaget.com/us-en/watches/all-watches),
official sitemap, regional watch catalogue and individual product pages. It
found 189 current exact references; one was already represented and 188
additional exact references were added as planned targets. A duplicate sitemap
URL, straps, jewelry and other non-watch or service scopes were recorded as
excluded from the current watch universe. Each added target retains its direct
official Piaget product-page URL. Technical, price, and availability fields
remain unpromoted. Perplexity was unavailable; official Piaget pages and
sitemap were used as the primary-source fallback.

## One-hundred-twenty-ninth Christopher Ward exact-reference expansion (retrieved 2026-09-03)

The Christopher Ward audit reconciled the official current catalogue and its
product listings. It found 506 current exact references; one was already
represented and 505 additional exact references were added as planned targets.
No accessory or archived record was promoted. Each added target retains an
official Christopher Ward catalogue/product source. Technical, price, and
availability fields remain unpromoted. Perplexity was unavailable because of
quota/connector limits; official Christopher Ward pages were used as the
primary-source fallback.

## One-hundred-thirtieth Bulgari exact-reference expansion (retrieved 2026-09-03)

The Bulgari audit reconciled the official [current watches catalogue](https://www.bulgari.com/en-us/watches),
Octo, Bvlgari Bvlgari, Bvlgari Aluminium, Serpenti, Divas' Dream and Lvcea
collections, plus official product details and the horlogerie editorial scope.
It found 167 current retail watch references; one was already represented and
166 additional exact references were added as planned targets. Jewelry and
other accessories, a legacy candidate, and editorial-only Serpenti Aeterna
references were recorded as excluded from the current watch universe. Each
added target retains an official Bulgari catalogue or product source.
Technical, price, and availability fields remain unpromoted. Perplexity was
unavailable; official Bulgari pages were used as the primary-source fallback.

## One-hundred-thirty-first Casio G-SHOCK exact-reference expansion (retrieved 2026-09-03)

The Casio G-SHOCK audit reconciled the official [US G-SHOCK catalogue](https://www.casio.com/us/watches/gshock/),
official sitemap, product pages, and an international product page for the
represented reference. It found 407 current exact references; one was already
represented and 406 additional exact references were added as planned
targets. Fifty-nine records explicitly marked discontinued/old on official
pages were recorded as excluded from the current watch universe. Each added
target retains a direct official Casio product-page URL. Technical, price, and
availability fields remain unpromoted. Perplexity was unavailable; official
Casio pages were used as the primary-source fallback.

## One-hundred-thirty-second MB&F exact-variant expansion (retrieved 2026-09-03)

The MB&F audit reconciled the official [MB&F Machines catalogue](https://www.mbandf.com/machines/mbf-machines),
official Eshop, machine pages, catalogue PDFs and special-project scopes. It
found 62 current machine variants; two were already represented and 60
additional variants were added as planned targets. Past machines,
performance-art/unique scopes, M.A.D.Editions and non-watch co-creations were
recorded as excluded from the current MB&F Machines universe. Where MB&F does
not publish a separate SKU, the official model identity is retained without
inventing one. Technical, price, and availability fields remain unpromoted.
Perplexity was unavailable; official MB&F pages and PDFs were used as the
primary-source fallback.

## One-hundred-thirty-third Richard Mille exact-reference expansion (retrieved 2026-09-03)

The Richard Mille audit reconciled the official [current collections catalogue](https://www.richardmille.com/collections),
collection product pages, sitemap and historical-models scope. It found 32
current exact references; two were already represented and 30 additional exact
references were added as planned targets. Historical models, watchcase and
other accessory scope, the motorcycle collaboration, unique haute-joaillerie
pieces and pre-owned inventory were recorded as excluded. Each added target
retains an official Richard Mille collection-page source. Technical, price,
and availability fields remain unpromoted. Perplexity was unavailable;
official Richard Mille pages were used as the primary-source fallback.

## One-hundred-thirty-fourth De Bethune exact-reference expansion (retrieved 2026-09-03)

The De Bethune audit reconciled the official [current collections](https://www.debethune.ch/collections/),
family pages, watch sitemap and historical catalogue. It found 28 current
exact references; none were represented and all 28 were added as planned
targets. The previously listed DB28XSZM was reclassified as archived, while
historical, no-current-model, accessory, clock and unique-piece scopes were
recorded as excluded. Each added target retains an official De Bethune
collection-page source. Technical, price, and availability fields remain
unpromoted. Perplexity was unavailable; official De Bethune pages were used as
the primary-source fallback.

## One-hundred-thirty-fifth Czapek & Cie. exact-reference expansion (retrieved 2026-09-03)

The Czapek & Cie. audit reconciled the official [Watch Finder](https://www.czapek.com/czapek-watch-finder),
current product pages, sitemap and Archives scope. It found 62 current exact
references; one was already represented and 61 additional exact references
were added as planned targets. Archived products, sitemap-only records,
accessories and the non-watch coffee-table book were recorded as excluded from
the current watch universe. Each added target retains an official Czapek & Cie.
product-page URL. Technical, price, and availability fields remain
unpromoted. Perplexity was unavailable; official Czapek & Cie. pages, Finder
and Archives were used as the primary-source fallback.

## One-hundred-thirty-sixth Parmigiani Fleurier exact-reference expansion (retrieved 2026-09-03)

The Parmigiani Fleurier audit reconciled the official [watches catalogue](https://www.parmigiani.com/en/watches/),
collections pages, official WooCommerce API and individual product pages. It
found 69 current exact references; two were already represented and 67
additional exact references were added as planned targets. Legacy exception
pieces and pocket-watch records were recorded as excluded from the current
wristwatch universe. Each added target retains an official Parmigiani Fleurier
product-page source. Technical, price, and availability fields remain
unpromoted. Perplexity was unavailable; official Parmigiani Fleurier API and
product pages were used as the primary-source fallback.

## One-hundred-thirty-seventh Arnold & Son exact-reference expansion (retrieved 2026-09-03)

The Arnold & Son audit reconciled the official [all-watches listing](https://www.arnoldandson.com/all-watches/),
[collection index](https://www.arnoldandson.com/collections/) and current
collection/product pages. It found 75 current watch variants; one was already
represented and 74 additional variants were added as planned targets. The HM
London Skyline Red Gold page does not publish a manufacturer reference, so its
model identity was retained without inventing an SKU. Three unique, sold-out
Double Tourbillon pieces were recorded as excluded. Technical, price, and
availability fields remain unpromoted. Perplexity was unavailable; official
Arnold & Son pages were used as the primary-source fallback.

## One-hundred-thirty-eighth Angelus exact-reference expansion (retrieved 2026-09-03)

The Angelus audit reconciled the official [current watch collections](https://angelus-watches.com/collections/),
[Lab and La Fabrique pages](https://angelus-watches.com/collections/lab/) and
official heritage and calibre scopes. It found 25 current watch references;
one was already represented and 24 additional exact references were added as
planned targets. Historical watches, clocks, calibre pages and accessories
were recorded as excluded. Each added target retains an official Angelus
source. Technical, price, and availability fields remain unpromoted.
Perplexity was unavailable; official Angelus pages and sitemap were used as
the primary-source fallback.

## One-hundred-thirty-ninth BOVET 1822 variant expansion (retrieved 2026-09-03)

The BOVET audit reconciled the official [collections index](https://www.bovet.com/collections/),
[Dimier collections](https://www.bovet.com/collections/dimier/) and
[Fleurier collections](https://www.bovet.com/collections/fleurier/). It found
44 current watch variants; one was already represented and 43 additional
official variants were added as planned targets. Bespoke commissions,
accessories and archived/discontinued scope were recorded as excluded. Where
the official page exposes a model variant rather than a separate SKU, the
published identity was retained without inventing a reference. Technical,
price, and availability fields remain unpromoted. Perplexity was unavailable;
official BOVET pages and sitemap were used as the primary-source fallback.

## One-hundred-fortieth Speake-Marin exact-reference expansion (retrieved 2026-09-03)

The Speake-Marin audit reconciled the official [current product catalogue](https://speake-marin.com/),
[product API](https://speake-marin.com/products.json?limit=250) and current
product pages. It found 29 current watch references; one was already
represented and 28 additional exact references were added as planned targets.
A unique Minute Repeater Carillon, an archived 2018 Resilience piece and
non-watch product types were recorded as excluded. Each added target retains
an official Speake-Marin product source. Technical, price, and availability
fields remain unpromoted. Perplexity was unavailable; official Speake-Marin
pages and product API were used as the primary-source fallback.
