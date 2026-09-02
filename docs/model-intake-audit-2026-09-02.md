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
