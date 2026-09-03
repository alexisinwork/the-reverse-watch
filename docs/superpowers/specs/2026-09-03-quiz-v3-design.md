# Quiz v3 and sheet-native catalogue — design

Date: 2026-09-03
Status: accepted design, not yet implemented
Owner amendment to: [`original-plan-requirements.md`](../../original-plan-requirements.md)

## 1. Purpose

Replace the version-2 progressive diagnostic with a smaller questionnaire whose
every question maps one-to-one onto a column of the owner's model intake sheet.
The sheet becomes the canonical intake format for the catalogue, and the
recommendation engine asks for nothing the sheet cannot supply.

This is an explicit owner amendment. The version-2 questionnaire, its 21
optional personal dimensions, and the social/aesthetic/provenance/emotional
screens are recorded in `original-plan-requirements.md` as preserved product
intent. They are superseded for `/quiz` by this document. They are **not**
removed from the codebase: `/watches/archetype` and the celebrity-discovery
trait matching keep using `SOCIAL_SIGNALS`, `AESTHETIC_DNA`, and
`DEPLOYMENT_ENVIRONMENTS`.

## 2. The intake sheet is the contract

The owner's sheet has 19 columns per model:

| # | Column | Maps to |
|---|---|---|
| 1 | Модель / reference | identity: brand, model, referenceCode, variantName |
| 2 | Ссылка производителя | `productUrl` + the evidence source for the row |
| 3 | lug2lug, mm | `geometry.lugToLugMm` |
| 4 | Толщина корпуса, mm | `geometry.caseThicknessMm` |
| 5 | Диаметр корпуса, mm | `geometry.caseDiameterMm` |
| 6 | Форма корпуса | `geometry.caseShape` (new) |
| 7 | Дно: display-back | `materials.displayCaseback` (new) |
| 8 | Интегрированный браслет | `geometry.integratedBracelet` |
| 9 | Механизм: тип | `movement.type` |
| 10 | Механизм: массовый / мануфактурный (Калибр) | `movement.construction` (new) + `movement.caliber` |
| 11 | Водозащита | `operation.waterResistanceM` |
| 12 | Стекло | `operation.crystal` |
| 13 | Ширина крепления (lug width), mm | `geometry.lugWidthMm` |
| 14 | Микрорегулировка | `operation.microAdjustment` (new, structured) |
| 15 | Сценарий ношения | `wearingScenarios[]` — DB vocabulary (new) |
| 16 | Социальный контекст | `positioningLine` + `positioningGroup` (new) |
| 17 | Complications (Усложнения) | `complications[]` — DB vocabulary (replaces enum + `dateStatus`) |
| 18 | Цена (ориентир, USD) | `price.amountMinor`, currency USD |
| 19 | Allergic (риск аллергии) | `operation.nickelContactRisk` |

Fields outside the sheet — weight, accuracy bounds, lume grade, crown position
and type, availability, acquisition channels, conditions, market/hype,
liquidity, service countries, lug curvature, attachment type, shock resistance,
production status, traits — remain in the schema, stay `null` for sheet-sourced
rows, and are no longer asked or filtered. `null` never satisfies a filter.

## 3. Questionnaire v3

Version constant moves to `3`; storage key to `the-reserve:diagnostic:v3`.
Six screens, thirteen questions.

| Screen | Question | Role | Source |
|---|---|---|---|
| 1 Budget | currency | required | fixed enum |
| 1 Budget | maximum | **hard** | numeric |
| 2 Use | wearing scenarios (multi-select) | **hard** | DB vocabulary |
| 2 Use | minimum water resistance | **hard** | fixed bands + "no requirement" |
| 3 Case | diameter range (min, max) | **hard** | numeric pair |
| 3 Case | maximum thickness | soft | numeric + "no preference" |
| 3 Case | case shape | soft | fixed enum + "no preference" |
| 4 Movement | acceptable types (multi-select) | **hard** | fixed enum |
| 4 Movement | construction | soft | fixed enum + "no preference" |
| 4 Movement | display caseback | soft | yes / no / "no preference" |
| 5 Details | crystal | soft | fixed enum + "no preference" |
| 5 Details | micro-adjustment required | soft | yes / no preference |
| 6 Requirements | complications (multi-select, may be empty) | **hard** | DB vocabulary |
| 6 Requirements | contact allergy | **hard** | none / nickel |

Budget maximum and case-diameter range are required. Every other hard question
accepts an explicit "no requirement" that disables its filter. Every soft
question defaults to "no preference" and contributes nothing when unset.

### Rationale for hard/soft split

Hard: budget, diameter, water resistance, movement type, wearing scenario,
complications, allergy. Budget, functional requirements, and allergy are hard
because `original-plan-requirements.md` forbids weakening budget, safety,
allergy, or functional requirements silently; the other four are the owner's
explicit instruction.

Soft: thickness, shape, display caseback, movement construction, crystal,
micro-adjustment.

### Accepted consequences

1. **Wrist circumference is removed.** The lug2lug-to-wrist ratio filter
   (`fit_exceeds_wrist`, `MAX_LUG_TO_LUG_TO_WRIST_RATIO`) is deleted. Case
   diameter becomes the fit control. `lugToLugMm` is still stored and exported
   but no longer filters. This was raised with the owner and accepted.
2. **Speculative candidates are permanently suppressed.** Suppression currently
   lifts only when the visitor accepts both a secondary channel and speculative
   risk; both questions are removed, so `speculative_bubble` variants never
   surface. Safe default.
3. **`dateStatus` is deleted.** Date is a complication in the sheet, so
   `date_required` and `date_forbidden` disappear as hard-reason codes.
4. **Accuracy filtering is removed.** `supportedAccuracyTolerances` becomes
   unreferenced by the engine and is deleted along with `ACCURACY_TOLERANCES`.

## 4. Vocabularies in PostgreSQL

Three sheet columns are open vocabularies, not enums. They live in the database
so the owner can extend them without a code change.

```
catalogue_vocabulary
  id            bigint identity primary key
  kind          text not null check (kind in
                  ('wearing_scenario','complication','positioning_group'))
  slug          text not null                       -- stable machine key
  label_en      text not null                       -- public UI label
  source_alias  text[] not null default '{}'        -- Russian intake tokens
  sort_order    integer not null default 100
  active        boolean not null default true
  unique (kind, slug)
```

`source_alias` is an ingest key, not a label. It lets the importer match the
owner's Russian tokens deterministically while the site stays English, per the
owner's "English only" decision.

Two join tables link variants to vocabulary rows for `wearing_scenario` and
`complication`. `positioning_group` is a single nullable column on the variant.

**Unknown tokens fail the import.** An unmapped Russian value is reported by
reference and row number and blocks that row; it is never dropped, guessed, or
mapped to a nearest neighbour.

### Vocabulary seeds

`wearing_scenario` — approximately 50 slugs derived from the owner's sheet, for
example `office`, `suit`, `everyday`, `smart_casual`, `sport_chic`, `sport`,
`diving`, `professional_diving`, `deep_sea`, `sailing`, `regatta`, `yachting`,
`resort`, `beach`, `travel`, `aviation`, `business_travel`, `expedition`,
`field`, `caving`, `motorsport`, `laboratory`, `evening`, `club`, `gala`,
`reception`, `high_society`, `theatre`, `cocktail`, `auction`, `collection`,
`art`, `weekend`, `boardroom`, `negotiation`, `black_tie`, `status`.

`complication` — approximately 20 slugs, for example `date`, `instant_date`,
`pointer_date`, `day_of_week`, `time_only`, `gmt_second_timezone`,
`bezel_24h`, `dive_bezel`, `chronograph`, `tachymeter`, `flyback`,
`regatta_timer`, `annual_calendar`, `moonphase`, `small_seconds`,
`helium_valve`, `antimagnetic_shield`, `ring_command`, `ringlock`,
`day_night_indicator`.

`positioning_group` — 11 groups derived from the positioning phrases in the
owner's sample, for the result-page facet:

| Slug | Label | Example source phrase |
|---|---|---|
| `instrument` | Instrument | эталонный инструмент; мировой рекорд глубины |
| `quiet_classic` | Quiet classic | тихая классика; современная неоклассика |
| `recognised_benchmark` | Recognised benchmark | визитная карточка Rolex; эталонный статус |
| `bicolour` | Two-tone | неовинтажный биколор; премиальный яркий биколор |
| `precious_metal` | Solid precious metal | массивное золото Everose |
| `platinum_ice` | Platinum / Ice Blue | ультимативная платина Ice Blue |
| `high_jewellery` | High jewellery | высокий ювелирный багетный декор |
| `avant_garde` | Avant-garde | авангардный флагман с открытым калибром |
| `sport_luxe` | Sport-luxe | элегантный каучуковый хронограф |
| `expressive_dial` | Expressive dial | модный фисташковый акцент; градиентный циферблат |
| `mechanical_showcase` | Mechanical showcase | годовой календарь Saros; диск фаз луны из метеорита |

The full phrase-to-group mapping is generated during implementation and
committed as reviewable data, not hidden in code.

## 5. New and changed catalogue fields

| Field | Type | Notes |
|---|---|---|
| `geometry.caseShape` | `round \| tonneau \| rectangular \| cushion \| square \| oval \| other \| null` | "круглая (интегрир.)" → shape `round`; the integrated flag comes from its own column |
| `materials.displayCaseback` | `boolean \| null` | Explicit. `materials.caseback` free text is retained but never inferred from |
| `movement.construction` | `mass_produced \| manufacture \| null` | Parsed with the caliber from one cell; brand-level `movement_origin` in the knowledge base must not be used, per AGENTS.md |
| `operation.microAdjustment` | `{ present: boolean, systemName: string \| null, rangeMm: number \| null } \| null` | "Glidelock (до 20 мм)" → `{true, "Glidelock", 20}`; "нет (Crownclasp)" → `{false, "Crownclasp", null}` |
| `positioningLine` | `string \| null` | The owner's phrase, verbatim, shown on the result card |
| `positioningGroup` | slug \| null | Facet key |
| `complications` | vocabulary slugs | Replaces the 7-value enum |
| `wearingScenarios` | vocabulary slugs | Replaces `eligibleEnvironments` |
| `dateStatus` | **deleted** | Absorbed into complications |

Each new field gets an `EvidenceField` entry so it inherits the existing
field-level provenance, verification, and staleness machinery. Missing values
stay `null`.

## 6. Recommendation engine v3

`RECOMMENDATION_ENGINE_VERSION` becomes `3`.

Hard-reason codes reduce from 23 to 7:

```
over_budget
case_diameter_out_of_range
water_resistance_below_minimum
movement_type_mismatch
scenario_mismatch
missing_complication
allergy_risk
```

Missing-fact codes reduce from 15 to 6: `fx_rate`, `price`, `case_diameter`,
`water_resistance`, `nickel_contact_risk`, `wearing_scenarios`.

Score factors: `budget_headroom` and `evidence_completeness` are retained;
`fit_proportion` is replaced by `diameter_centring` (distance from the midpoint
of the requested range); new soft factors are `thickness_fit`, `shape_match`,
`display_caseback_match`, `construction_match`, `crystal_match`, and
`micro_adjustment_match`.

Diversity, relaxation ladder, why-not, verification-required, and the
unscored-preference channel are unchanged in structure.

### Phasing

The owner accepted "capture now, score later". Phasing is by dimension, not by
layer, so the product is never in a state where a question drives nothing:

- **Wired on delivery** — budget, diameter, water resistance, movement type,
  scenario, complications, allergy, thickness, crystal. All have data after the
  sheet import.
- **Captured, reported as unscored** — shape, display caseback, construction,
  micro-adjustment, until the sheet columns are populated across the catalogue.
  They flow through the existing `unscoredPreferences` output, which already
  tells the visitor a preference was recorded but did not affect ranking.

## 7. Result-page positioning facet

Positioning is a result facet only; the quiz never asks for it. The shortlist
is computed first, then chips built from active `positioning_group` rows narrow
what is displayed. The facet never re-ranks, never changes hard-filter
outcomes, and renders nothing when the vocabulary is empty or unreachable.
Each result card shows its `positioningLine` verbatim.

## 8. Sheet import and deduplication

A new importer reads the owner's tab-separated sheet and produces validated
catalogue rows.

Deduplication rules, in order:

1. **Normalise the reference code** from column 1 (strip brand words, size
   words, dial/material descriptors; keep the manufacturer reference).
2. **Collapse exact duplicate rows** — identical reference and identical
   values. Keep one, record the collapsed source line numbers.
3. **Conflicting duplicates** — same reference, differing values — are
   **rejected**, listed by reference and line number, for the owner to resolve.
   No automatic winner is chosen.
4. **Drop workbook artifacts** — rows whose complications cell reads
   `needs research`, or whose final cell contains
   `Нет точного варианта в seed-catalogue`.

Issues already identified in the owner's sample, which the importer must catch:

- Exact duplicates: Sky-Dweller `336933`, `336935`, `336938`; Submariner
  `126618LB`, `126618LN`; Yacht-Master `126621`, `268655`.
- Same reference under two names: Explorer `124270` and `124273` appear as both
  "Explorer 124270 steel" and "Rolex Explorer 36 124270 M1 Geometry".
- Seven trailing workbook-artifact rows.
- Two incorrect URLs: `134300-0006 Pistachio` and `134300-0010 Silver Classic`
  both point at `m124300-*` pages. Reported, not auto-corrected.

The existing 71 reviewed variants are mapped forward: `eligibleEnvironments`
values expand to scenario slugs (`field_water_abuse` → `sport`, `diving`,
`field`; `studio_desk_daily` → `office`, `everyday`, `smart_casual`;
`formal_architectural` → `suit`, `evening`, `reception`). Where the sheet
supplies the same reference, the sheet supersedes and the duplicate is removed.

## 9. SQL parity

The engine's TypeScript predicates and the PostgreSQL hard-filter partition
must stay identical; `npm run audit:catalogue-parity` enforces this.

New additive migrations provide `recommendation_catalogue_v4` and
`recommendation_hard_filter_v4`, the vocabulary and join tables, the new
variant columns, and a narrow read-only vocabulary RPC. The v3 RPCs are
retained for rollback. No table is dropped, truncated, or reset.

## 10. Blast radius

Rewritten: `app/domain/questionnaire.ts`, `app/domain/recommendation.ts`,
`app/routes/quiz.tsx`, `app/domain/catalogue.ts`,
`app/domain/evaluation-fixtures.ts`, `app/domain/catalogue-parity.ts`,
`data/catalogue/seed-catalogue.json`, golden profiles, E2E specs.

New: sheet importer script, vocabulary domain module and store, positioning
facet component, migrations, phrase-to-group mapping data.

Unchanged: `/watches/*` discovery, `/watches/archetype`, Beehiiv and Resend
delivery, diagnostic access grant, rate limiting, analytics, Sentry.

## 11. Related cleanup workstream

Agreed with the owner in the same session and delivered alongside this work,
but independent of it:

- Refresh `docs/session-handoff.md`, which still claims packets D0–D8 are
  unimplemented and migrations stop at `0039`; the repository is at `0064` with
  D0–D7 verified.
- Document the undocumented `private.movie_watch_intake` pipeline (migrations
  `0061`–`0064`, three scripts, three domain modules) as its own workstream.
- Add the four missing unit tests: `movie-watch-grouping.ts`,
  `perplexity-movie-watch-verification.server.ts`, the worker RPC store, and
  the `watch-work` / `watch-entity` database-versus-fallback branch.
- Delete `runConfiguredDiscoveryResearchBatch`, which is exported but never
  called.
- Remove repository-level duplicated data: `data/research/brand-manifest.txt`
  is a byte-identical 8.5 MB copy of `brand-manifest.json`. Decide whether
  `data/knowledge base/All Movies.txt` is tracked or ignored.
- Perplexity: align the `/v1/agent` request shape with the published contract,
  add the missing verification-module tests, and leave a smoke script for when
  credits exist.

## 12. Out of scope

Live Perplexity verification (no API credits). The agent-endpoint request shape
stays unverified against the real API; a smoke script and a written note record
that risk.

## 13. Verification

- `npm run check` — format, lint, types, unit tests, build.
- `npm run audit:catalogue-parity` — bundled facts, live facts, TypeScript
  predicates, and the SQL partition agree.
- `npm run evaluate:baseline` — determinism and zero hard-filter violations
  over golden profiles rebuilt for v3.
- `npm run test:e2e` — desktop and mobile flows through the new six screens.
- Importer tests: dedup collapse, conflicting-duplicate rejection, artifact
  drop, unknown-vocabulary rejection, micro-adjustment parsing, allergy
  mapping.
