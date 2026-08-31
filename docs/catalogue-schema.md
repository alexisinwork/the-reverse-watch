# Catalogue schema contract

The first additive migration is
[`0001_reference_variant_catalogue.sql`](../db/migrations/0001_reference_variant_catalogue.sql).
It implements the accepted
[`SQL-first architecture`](sql-first-recommendation-architecture.md) without
enabling `pgvector`.

The second migration,
[`0002_server_only_catalogue_access.sql`](../db/migrations/0002_server_only_catalogue_access.sql),
revokes all table access from Supabase browser roles and fixes the two missing
foreign-key indexes reported by the database advisor. The tables remain
server-only; Phase 4 later adds two deliberately narrow read-only RPC contracts
without granting table access.

The remaining Phase 3 migrations add dated FX snapshots, load the reviewed seed,
index its source relationship, and expose reviewed deployment/service-tolerance
classifications as typed filter tables:

- [`0003_fx_rate_snapshots.sql`](../db/migrations/0003_fx_rate_snapshots.sql)
- [`0004_seed_reference_catalogue.sql`](../db/migrations/0004_seed_reference_catalogue.sql)
- [`0005_fx_source_index.sql`](../db/migrations/0005_fx_source_index.sql)
- [`0006_reference_filter_profiles.sql`](../db/migrations/0006_reference_filter_profiles.sql)

The Phase 4 read path and grant hardening are additive as well:

- [`0007_recommendation_catalogue_rpc.sql`](../db/migrations/0007_recommendation_catalogue_rpc.sql)
  adds product URLs and returns only accepted, evidence-backed facts in the
  strict runtime catalogue shape;
- [`0008_recommendation_hard_filter_rpc.sql`](../db/migrations/0008_recommendation_hard_filter_rpc.sql)
  returns hard-reject and missing-fact codes for every accepted variant;
- [`0009_harden_recommendation_rpc_grants.sql`](../db/migrations/0009_harden_recommendation_rpc_grants.sql)
  removes the unnecessary signed-in-user execution path.

Phase 5 adds
[`0015_add_rectangular_case_geometry.sql`](../db/migrations/0015_add_rectangular_case_geometry.sql),
which prepares nullable case-width and overall-case-length columns for honest
non-round geometry. Existing round rows and RPC output remain backward
compatible. It is followed by
[`0016_correct_reverso_rectangular_geometry.sql`](../db/migrations/0016_correct_reverso_rectangular_geometry.sql),
which maps the accepted Reverso Q3988481 to its manufacturer-labelled 47 x
28.3 mm length/width pair, retains the separately explicit 47 mm lug-to-lug,
and exposes non-round facts and fit behavior through v2 read RPCs. Migration
[`0018_add_field_applicability.sql`](../db/migrations/0018_add_field_applicability.sql)
then adds a reviewed evidence value state and v3 read RPCs that distinguish an
unknown null from a physical `not_applicable` exception.

Both RPCs are fixed `SECURITY DEFINER` SQL with an empty `search_path`, no
dynamic SQL, and no mutation. The anonymous client role can execute them;
Supabase role inheritance also makes the same read-only surface available to
signed-in clients. `anon` and `authenticated` retain zero direct table grants,
and all public catalogue tables have RLS enabled without direct-table policies.

## Entity boundary

```text
brand
  -> collection
      -> reference model
          -> reference variant  <-- filters and ranking
              -> complications
              -> price snapshots
              -> market snapshots
              -> reviewed traits

every factual field value
  -> field evidence
      -> source
```

A `reference_variant` is split whenever size, case/bracelet material, movement,
weight, attachment, reference code, production state, or commercial behavior
changes enough to affect filtering. `Datejust 31/36/41` is therefore not one
filterable record. A broad family may be summarized only through a derived
read-only view later.

## Questionnaire-to-column coverage

| Requirement | Canonical facts |
| --- | --- |
| Budget | `price_snapshots.amount_*_minor`, `currency`, kind, condition, market, observed/stale times |
| Wrist/fit | diameter for round cases or width plus overall length for non-round cases, thickness, lug-to-lug, measured/estimated flag, lug width, curvature, integrated bracelet |
| Deployment | water resistance, crown type, shock facts, thickness, materials |
| Service/accuracy | movement type/source, calibre, normalized accuracy range/period, service region |
| Weight | head and full-watch grams |
| Complications/date | `reference_complications` |
| Attachment | attachment type, lug width, integrated bracelet, clasp adjustment |
| Lume/crown | lume grade, crown position |
| Geography | price/market country and brand service regions |
| Condition/vintage | snapshot condition and production years/status |
| Allergy | contact-risk classification plus explicit case/back/bracelet materials |
| Hype and speculation | hype risk, momentum, `speculative_bubble` |
| Liquidity | liquidity level, sale-day range, spread, secondary ratio |

Questionnaire bands are never stored on a variant. Price-band and wrist-band
coverage projections are derived from numeric facts and the shared Phase 2
constants. Because the finite coverage matrix does not add a currency axis,
its price bands are derived only after converting each sourced price through
the catalogue's dated FX snapshot into the canonical EUR base; raw PLN, USD,
GBP, or CHF numbers are never compared directly with one band boundary.

`case_diameter_mm` is never a generic “size” slot. Rectangular dimensions use
`case_width_mm` and `case_length_mm`. Fit uses verified `lug_to_lug_mm` when it
exists, otherwise verified overall case length; an unevidenced fallback cannot
satisfy the wrist hard filter. The database permits both rectangular columns to
be null during research, but migration `0016` rejects a partial width/length
pair so a half-specified non-round case cannot enter the typed surface.

`reference_deployment_profiles` and
`reference_ownership_friction_profiles` are reviewed reference-level query
surfaces. The classifications retain field evidence, but are not hidden inside
an evidence hash or promoted to brand-level rollups.

## Accuracy normalization

Published accuracy is stored as a lower/upper seconds range plus
`accuracy_period_days`. This preserves daily, monthly, and other source specs
without pretending they use the same period. For example, ±5 seconds/day uses
`-5`, `5`, and `1`; a compliant source that states ±15 seconds/month uses its
observed range and the applicable period length. The original wording remains
in `accuracy_basis` and in field evidence.

## Evidence policy

Typed columns are the query surface. `field_evidence` is a provenance sidecar,
not the source of filter values and not a generic EAV replacement. Each record
binds one value hash to one field and source with observed, retrieved, verified,
and stale-after times.

An accepted typed value needs at least one `verified` evidence record before it
can satisfy an active hard filter. `provisional` facts may appear only in a
verification-required result. `rejected` evidence is retained for audit and
cannot support a result.

Suggested initial refresh windows are policy defaults, not invented fact values:

| Fact family | Review window |
| --- | --- |
| Availability | 30 days |
| Hype, liquidity, ratio, momentum | 90 days |
| Retail price and production status | 180 days |
| Current ownership and service region | 365 days |
| Dimensions, materials, calibre, complications | no automatic expiry; review on contradiction/model revision |

## Null and completeness behavior

Schema columns are nullable while research is in progress. This permits honest
partial ingestion without fake defaults. Eligibility is enforced by
`completeness_evaluations` and the recommendation query:

- M0: discovery identity and minimum sourced reference facts;
- M1: every fact required by the active hard-filter contract;
- M2: deeper brand and editorial context.

`null` never passes an active hard predicate. The query may place the variant in
a separate verification-required set and list the missing fields.

`null` does not itself mean “not applicable.” Migration `0018` and catalogue
contract version 2 add a sparse `fieldApplicability` sidecar backed by
`field_evidence.value_state`. The first supported exception is
`lugWidthMm: not_applicable` for an evidenced proprietary or central-lug case
with no conventional between-lugs width. A numeric width is applicable; an
unevidenced null remains unknown; an evidenced null without the explicit state
is rejected as ambiguous. When a user requires a conventional width, verified
non-applicability is a deterministic `lug_width_not_applicable` hard mismatch,
whereas an unknown null remains the `lug_width` verification-required fact.
No historical null is reclassified automatically, and new applicability fields
must be added deliberately to the typed seed, RPC, and filter contracts.

## Coverage projection

`npm run project:seed-coverage` regenerates and `npm run audit:coverage` validates
[`data/coverage/reference-variants.json`](../data/coverage/reference-variants.json)
and enumerates 28,800 meaningful core-axis cells:

```text
8 price bands × 5 wrist bands × 3 environments × 3 ownership-friction levels
× 4 accuracy tolerances × 4 weight limits × 5 representative function profiles
```

The reviewed 18-variant local seed currently projects into 496 of 28,800 cells
(1.72%). Of those, 492 have one candidate, all 496 have fewer than three brands,
and 224 contain at least one under-evidenced candidate. This is a coverage
baseline, not a market-coverage claim. After canonical EUR conversion, no
accepted local row currently occupies `15000_plus`; that empty band is retained
as an explicit gap. The audit separately reports:

- empty cells;
- cells with one candidate;
- cells with fewer than three brands;
- cells whose candidates lack complete active hard facts.

Run `npm run audit:coverage -- --json` for machine-readable output and
`npm run audit:coverage -- --strict` only after the seed projection is expected
to satisfy the agreed coverage gate. The five function profiles are a stable
basis set; exhaustive arbitrary multi-complication combinations are generated
as targeted fixtures rather than inflating the global matrix with impossible
permutations.

## Applied database evidence

Migrations `0001` through `0020` are applied additively to Supabase project
`osfqexnzgkksfvaocjvl`. As verified on 2026-08-30, the live catalogue contains
16 brands, 18 homogeneous variants, 18 price snapshots, 11 availability
snapshots, 404 verified field-evidence rows, 5 FX rows, 37 deployment profiles,
and 18 ownership-friction profiles. The two Rolex Explorer materials remain
distinct rows (`124270` steel and `124273` steel/yellow gold).

Migration `0010_expand_catalogue_christopher_ward.sql` adds the independently
reviewed C63 Sealander GMT exact SKU. Migration
`0011_expand_catalogue_orient.sql` then adds Orient RA-AC0M03S and its exact
manufacturer evidence plus the reviewed exact-reference attachment source.
Migration `0012_expand_catalogue_marathon.sql` then adds Marathon
WW194003BK-0108 with its reviewed exact-reference movement, weight, lume, and
fixed-interface evidence. Migration `0013_expand_catalogue_casio.sql` then adds
G-SHOCK G-5600UE-1 with exact illumination, 16 mm spring-bar interface, and
current secondary-market evidence. Migration
`0014_expand_catalogue_seiko.sql` then adds Presage HCC004J1 with its reviewed
exact-reference no-lume conflict resolution. Together they form the intermediate
15-brand/17-variant state. All five are applied in sequence and retain their
reviewed field-level evidence.

Migration `0015_add_rectangular_case_geometry.sql` then adds only the nullable
non-round geometry columns; it adds no reference row. Migration
`0016_correct_reverso_rectangular_geometry.sql` then corrects the accepted JLC
row, replaces its diameter evidence with width/length evidence, recalculates
its geometry-aware M0/M1 completeness, and makes
`recommendation_catalogue_v2()` and `recommendation_hard_filter_v2()` the
rectangular-aware contracts. Both v1 contracts become internal implementation
details.

Migration `0017_expand_catalogue_tudor.sql` then adds the homogeneous Black Bay
54 M79000N-0001. TUDOR's exact dossier explicitly identifies the through-lug
spring-bar holes, and the retained exact-reference fitment guide identifies the
corresponding bars. The row is M1-complete with a 139 g normalized full-length
bracelet configuration and a measured 45.8 mm lug-to-lug. Together the applied
expansion migrations bring the live catalogue to 16 brands and 18 variants.

Migration `0018_add_field_applicability.sql` must follow `0017`. It adds
`field_evidence.value_state` with existing rows defaulted to `observed`, a
partial verified-applicability index, and the v3 catalogue and hard-filter
contracts. V3 emits sparse per-field applicability, maps verified
non-applicable conventional lug width to `lug_width_not_applicable`, and leaves
unknown null as missing evidence. Anonymous execution moves from v2 to v3. The
current 18 accepted rows have no non-applicable field, so their facts and
predicates remain unchanged; the migration prepares future reviewed rows such
as the still research-only Blancpain.

Migration `0019_repair_casio_price_evidence.sql` restores the verified source
link omitted when the first `secondary_ask` snapshot was rendered; the snapshot
and price fact are unchanged. The generator now derives the snapshot and its
evidence lookup from one acquisition-channel mapping. Migration
`0020_enable_catalogue_rls.sql` enables RLS on all 20 public catalogue tables.
No direct-table policies were added, so the versioned RPC pair remains the sole
browser read path.

`npm run audit:catalogue-parity` validates the strict RPC response against the
bundled snapshot and compares the PostgreSQL and TypeScript hard-filter codes
and result partitions for every variant across six golden profiles. Its
evaluation time is the latest observation inside the catalogue's common
mutable-fact freshness window. The live 18-row audit passes after RLS.

The Supabase security advisor reports expected informational no-policy notices
for the server-only RLS tables plus intentional anonymous and inherited
signed-in execution warnings for the two `SECURITY DEFINER` RPCs. This is the
intended public catalogue boundary; the functions expose only accepted
catalogue facts and fixed filter codes, while `anon` and `authenticated` have
no table access and RLS is enabled. Broader direct-table access remains revoked.
See the advisor's
[security-definer guidance](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).
Performance findings are only unused-index informational notices expected on a
newly loaded 18-row catalogue; the indexes are retained for the expansion phase.
See the advisor's
[unused-index guidance](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

## Rolex workbook expansion checkpoint

Migration `0036_expand_catalogue_rolex_workbook.sql` adds only the independently
reviewed Rolex Submariner `124060` and Sea-Dweller `126600` from the owner's
35-target workbook intake. Both are materially homogeneous, M1-complete rows.
Their fit spans are marked measured in PostgreSQL; their full-weight facts use
documented full-link factory-unworn control configurations. The migration also
adds exact current USD retail snapshots and 40 verified reference-level field
evidence rows.

Remote verification on 2026-08-31 reports 24 accepted brands and 30 accepted
variants. The catalogue and all six SQL/TypeScript hard-filter profiles pass
exact parity. The 33 unaccepted workbook targets remain outside PostgreSQL's
recommendation catalogue and retain their missing-field decisions in the
research layer.
