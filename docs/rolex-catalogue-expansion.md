# Rolex workbook catalogue expansion

Status: **35 exact-reference targets researched and owner-approved for the user-visible catalogue; 2 independently M1-complete, 33 accepted with explicit evidence gaps**
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
USD 3.52509 provider cost. Provider output remains distinguishable from
independent verification. On 2026-08-31 the owner explicitly approved all 35
researched exact references for recommendation use with their currently
supported data. That curator decision does not erase evidence gaps:
unsupported fields remain `null`, field-level provenance is retained, and an
active hard filter cannot treat an unknown as satisfied.

The extended desktop workbook preserves the source worksheets and adds:

- `Research Summary`, including review counts, model, retrieval date, cost,
  and fail-closed policy;
- `Exact Reference Research`, one row per exact-reference target, with verified
  corrections overlaid on provisional values;
- `Field Evidence`, retaining both provider facts and separately identified
  independent-review evidence with source links.

## Follow-up owner reference approval

The follow-up ledger
[`rolex-owner-reference-intake.json`](../data/research/rolex-owner-reference-intake.json)
preserves all 34 explicitly supplied reference numbers, status labels, and
official Rolex family URLs. All 34 resolve against the accepted catalogue. Ten
exact configurations were additional to the workbook targets and received
separate source and review packets. The combined catalogue contains 45 Rolex
variants, all explicitly approved for recommendation use; this approval does
not replace missing facts or their field-level evidence state.

## Exact-reference target ledger

`Owner-approved` means recommendation-eligible by explicit curator direction,
not independently M1-complete. The detailed per-field gaps and source
decisions remain in
[`data/research/reviewed`](../data/research/reviewed); the two independently
complete rows retain their stronger `ready_for_migration` outcome.

| Workbook family / size | Exact target | Review decision |
| --- | --- | --- |
| Submariner No-Date 41 | `124060` | Accepted as `rolex-124060` |
| Submariner Date 41 | `126610LN` | Owner-approved as `rolex-126610ln` |
| Cosmograph Daytona 40 | `126500LN-0002` | Owner-approved as `rolex-126500ln-0002` |
| GMT-Master II 40 | `126710BLRO` | Owner-approved as `rolex-126710blro` |
| Datejust 31 | `278274` | Owner-approved as `rolex-278274` |
| Datejust 36 | `126200-0008` | Owner-approved as `rolex-126200-0008` |
| Datejust 41 | `126300` | Owner-approved as `rolex-126300` |
| Oyster Perpetual 28 | `276200` | Owner-approved as `rolex-276200` |
| Oyster Perpetual 31 | `277200` | Owner-approved as `rolex-277200` |
| Oyster Perpetual 34 | `124200` | Owner-approved as `rolex-124200` |
| Oyster Perpetual 36 | `126000` | Owner-approved as `rolex-126000` |
| Oyster Perpetual 41 | `134300` | Owner-approved as `rolex-134300` |
| Day-Date 36 | `128238` | Owner-approved as `rolex-128238` |
| Day-Date 40 | `228238` | Owner-approved as `rolex-228238` |
| Explorer 36 Oystersteel | `124270` | Owner-approved existing `rolex-124270`; fit evidence extended |
| Explorer 36 Rolesor | `124273-0001` | Owner-approved existing `rolex-124273`; fit evidence extended |
| Explorer 40 | `224270` | Owner-approved as `rolex-224270` |
| Explorer II 42 | `226570` | Owner-approved as `rolex-226570` |
| Sea-Dweller 43 | `126600` | Accepted as `rolex-126600` |
| Deepsea 44 | `136660` | Owner-approved as `rolex-136660`; retained configuration caution |
| Deepsea Challenge 50 | `126067` | Owner-approved as `rolex-126067` |
| Sky-Dweller 42 | `336934` | Owner-approved as `rolex-336934` |
| Yacht-Master 37 | `268621-0003` | Owner-approved as `rolex-268621-0003` |
| Yacht-Master 40 | `126622` | Owner-approved as `rolex-126622` |
| Yacht-Master 42 | `m226659-0002` | Owner-approved as `rolex-m226659-0002` |
| Yacht-Master II 44 | `116680` | Owner-approved historical `rolex-116680` |
| Air-King 40 | `126900` | Owner-approved as `rolex-126900` |
| Perpetual 1908 39 | `52508` | Owner-approved as `rolex-52508` |
| Lady-Datejust 28 | `279160` | Owner-approved as `rolex-279160` |
| Pearlmaster 29 | `80319-0040` | Owner-approved historical `rolex-80319-0040` |
| Milgauss 40 | `116400GV-0002` | Owner-approved historical `rolex-116400gv-0002` |
| Cellini Time 39 | `50505` | Owner-approved historical `rolex-50505` |
| Cellini Date 39 | `50519-0006` | Owner-approved historical `rolex-50519-0006` |
| Cellini Dual Time 39 | `50525-0015` | Owner-approved historical `rolex-50525-0015` |
| Cellini Moonphase 39 | `50535-0002` | Owner-approved historical `rolex-50535-0002` |

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
contains the two independently complete rows. The subsequent additive
[`0037_approve_rolex_workbook_recommendations.sql`](../db/migrations/0037_approve_rolex_workbook_recommendations.sql)
implements the owner's explicit catalogue approval for all 35 references.
Together with 10 separately owner-supplied exact Rolex configurations retained
by the shared research workstream, the catalogue now contains 71 accepted
variants, including 45 Rolex variants. Missing facts remain `null` and
continue to produce missing-fact or mismatch decisions under active filters.
Connected verification reports 34/34 follow-up references present and exact
catalogue plus six-profile SQL/TypeScript parity. Additive migration
[`0039_repair_speculative_hard_filter.sql`](../db/migrations/0039_repair_speculative_hard_filter.sql)
preserves applicability and fail-closed speculative-risk behavior in the live
v3 hard-filter function.
