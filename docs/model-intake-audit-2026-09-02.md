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
