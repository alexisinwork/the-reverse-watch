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
