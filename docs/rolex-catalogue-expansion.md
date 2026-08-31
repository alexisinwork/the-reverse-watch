# Rolex workbook catalogue expansion

Status: **35 exact-reference targets researched; 2 accepted, 33 held for field review**
Retrieval date: **2026-08-31**

## Scope and method

The owner workbook `Rolex_Complete_Model_Research 2.xlsx` contains 34
family/size rows rather than homogeneous catalogue records. Its immutable
intake snapshot is
[`rolex-workbook-intake.json`](../data/research/rolex-workbook-intake.json),
with source SHA-256
`5de253c90049d400138c77c3cacb21b83afe7ffb228d4d06a8b6bd11efa92790`.
The Explorer 36 row maps to two already distinct database materials, so the
workbook creates 35 exact-reference research targets.

Every target received a Perplexity Sonar Pro run through `/v1/sonar` with the
version-7 strict structured-output contract. The retained job ledger records
USD 3.52509 provider cost. Provider output remains provisional: exact product
identity, configuration, price, fit, full configured weight, movement rate,
water resistance, graded lume, attachment interface, and date state must pass
independent field-level review before an accepted PostgreSQL row is allowed.

The extended desktop workbook preserves the source worksheets and adds:

- `Research Summary`, including review counts, model, retrieval date, cost,
  and fail-closed policy;
- `Exact Reference Research`, one row per exact-reference target, with verified
  corrections overlaid on provisional values;
- `Field Evidence`, retaining both provider facts and separately identified
  independent-review evidence with source links.

## Exact-reference target ledger

`needs_more_evidence` means that the Sonar result is useful research input but
is not recommendation-eligible. The detailed per-field gaps and source decisions
remain in [`data/research/reviewed`](../data/research/reviewed).

| Workbook family / size | Exact target | Review decision |
| --- | --- | --- |
| Submariner No-Date 41 | `124060` | Accepted as `rolex-124060` |
| Submariner Date 41 | `126610LN` | Needs more evidence |
| Cosmograph Daytona 40 | `126500LN-0002` | Needs more evidence |
| GMT-Master II 40 | `126710BLRO` | Needs more evidence |
| Datejust 31 | `278274` | Needs more evidence |
| Datejust 36 | `126200-0008` | Needs more evidence |
| Datejust 41 | `126300` | Needs more evidence |
| Oyster Perpetual 28 | `276200` | Needs more evidence |
| Oyster Perpetual 31 | `277200` | Needs more evidence |
| Oyster Perpetual 34 | `124200` | Needs more evidence |
| Oyster Perpetual 36 | `126000` | Needs more evidence |
| Oyster Perpetual 41 | `134300` | Needs more evidence |
| Day-Date 36 | `128238` | Needs more evidence |
| Day-Date 40 | `228238` | Needs more evidence |
| Explorer 36 Oystersteel | `124270` | Existing row; fit/weight gap review remains open |
| Explorer 36 Rolesor | `124273-0001` | Existing row; fit/weight gap review remains open |
| Explorer 40 | `224270` | Needs more evidence |
| Explorer II 42 | `226570` | Needs more evidence |
| Sea-Dweller 43 | `126600` | Accepted as `rolex-126600` |
| Deepsea 44 | `136660` | Needs more evidence; provisional URL/dial mismatch rejected |
| Deepsea Challenge 50 | `126067` | Needs more evidence |
| Sky-Dweller 42 | `336934` | Needs more evidence |
| Yacht-Master 37 | `268621-0003` | Needs more evidence |
| Yacht-Master 40 | `126622` | Needs more evidence |
| Yacht-Master 42 | `m226659-0002` | Needs more evidence |
| Yacht-Master II 44 | `116680` | Historical; needs more evidence |
| Air-King 40 | `126900` | Needs more evidence |
| Perpetual 1908 39 | `52508` | Needs more evidence |
| Lady-Datejust 28 | `279160` | Needs more evidence |
| Pearlmaster 29 | `80319-0040` | Historical; needs more evidence |
| Milgauss 40 | `116400GV-0002` | Historical; needs more evidence |
| Cellini Time 39 | `50505` | Historical; needs more evidence |
| Cellini Date 39 | `50519-0006` | Historical; needs more evidence |
| Cellini Dual Time 39 | `50525-0015` | Historical; needs more evidence |
| Cellini Moonphase 39 | `50535-0002` | Historical; needs more evidence |

## Accepted reference decisions

### Submariner `124060`

The exact [Rolex product page](https://www.rolex.com/en-us/watches/submariner/m124060-0001)
sets identity, current USD 10,050 U.S. retail price, configuration, 41 mm case,
calibre 3230, -2/+2 seconds per day, 70-hour reserve, 300 m resistance,
sapphire, long-lasting Chromalight, and no-date state. Bob's Watches' current
[in-house measurement table](https://www.bobswatches.com/rolex-blog/watch-101/rolex-watch-case-size.html)
sets 12.5 mm thickness and 47.6 mm lug-to-lug. Superlative Watch Co.'s
[configuration-controlled matrix](https://superlativewatchco.com/pages/rolex-weight-guide)
sets a 158.8 g full-link factory-unworn control. Everest's
[exact fitment page](https://www.everestbands.com/products/rolex-submariner-produced-after-2020-1-5mm-spring-bars)
sets 21 mm lug width and spring-bar attachment.

### Sea-Dweller `126600`

The exact [Rolex product page](https://www.rolex.com/en-us/watches/sea-dweller/m126600-0002)
sets identity, current USD 14,550 U.S. retail price, configuration, 43 mm case,
calibre 3235, -2/+2 seconds per day, 70-hour reserve, 1,220 m resistance,
sapphire, date, and an explicit Chromalight duration of up to eight hours.
Bob's in-house table sets 15.0 mm thickness and 51.0 mm lug-to-lug. The
full-link control matrix sets 194.0 g. Everest's
[reference-size guide](https://www.everestbands.com/blogs/bezel-barrel/guide-to-rolex-sizes-case-and-lug-dimensions-by-reference)
sets 22 mm lug width, and its
[exact strap fitment](https://www.everestbands.com/products/curved-end-rubber-strap-for-rolex-sea-dweller-43mm-126600-tang)
documents the spring-bar case connection.

Migration [`0036_expand_catalogue_rolex_workbook.sql`](../db/migrations/0036_expand_catalogue_rolex_workbook.sql)
adds only these two reviewed variants and their field evidence. It does not
promote any of the 33 unresolved targets or replace a missing fact with a
plausible default.
