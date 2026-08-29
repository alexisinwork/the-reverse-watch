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

Both RPCs are fixed `SECURITY DEFINER` SQL with an empty `search_path`, no
dynamic SQL, and no mutation. Only `anon` and the administrative service role
can execute them. `anon` and `authenticated` retain zero direct table grants.

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
| Wrist/fit | diameter, thickness, lug-to-lug, measured/estimated flag, lug width, curvature, integrated bracelet |
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
constants.

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

## Coverage projection

`npm run project:seed-coverage` regenerates and `npm run audit:coverage` validates
[`data/coverage/reference-variants.json`](../data/coverage/reference-variants.json)
and enumerates 28,800 meaningful core-axis cells:

```text
8 price bands × 5 wrist bands × 3 environments × 3 ownership-friction levels
× 4 accuracy tolerances × 4 weight limits × 5 representative function profiles
```

The reviewed 16-variant local seed currently projects into 408 of 28,800 cells
(1.42%). Of those, 404 have one candidate, all 408 have fewer than three brands,
and 184 contain at least one under-evidenced candidate. This is a coverage
baseline, not a market-coverage claim. The audit separately reports:

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

The first nine migrations were applied additively to Supabase project
`osfqexnzgkksfvaocjvl` on 2026-08-28. The live catalogue contains 11 brands, 12
homogeneous variants, 12 retail-price snapshots, 7 availability snapshots, 236
field-evidence rows, 5 FX rows, 25 deployment profiles, and 12
ownership-friction profiles. The two Rolex Explorer materials remain distinct
rows (`124270` steel and `124273` steel/yellow gold).

Migration `0010_expand_catalogue_christopher_ward.sql` adds the independently
reviewed C63 Sealander GMT exact SKU. Migration
`0011_expand_catalogue_orient.sql` then adds Orient RA-AC0M03S and its exact
manufacturer evidence plus the reviewed exact-reference attachment source.
Migration `0012_expand_catalogue_marathon.sql` then adds Marathon
WW194003BK-0108 with its reviewed exact-reference movement, weight, lume, and
fixed-interface evidence. Migration `0013_expand_catalogue_casio.sql` then adds
G-SHOCK G-5600UE-1 with exact illumination, 16 mm spring-bar interface, and
current secondary-market evidence. Together they bring the intended live
catalogue to 15 brands and 16 variants. All four remain unapplied while the
Supabase MCP OAuth connection is expired; the bundled seed must not be pushed
until the migrations are applied in order and the 16-row parity audit succeeds.

`npm run audit:catalogue-parity` validates the strict RPC response against the
bundled snapshot and compares the PostgreSQL and TypeScript hard-filter codes
for every variant across six golden profiles.

The Supabase security advisor reports two intentional warnings because the
anonymous role can execute the two `SECURITY DEFINER` RPCs. This is the intended
public catalogue boundary; the functions expose only accepted catalogue facts
and fixed filter codes, while `anon` and `authenticated` have no table access.
The broader authenticated execution grants were revoked. See the advisor's
[security-definer guidance](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).
Performance findings are only unused-index informational notices expected on a
newly loaded 12-row catalogue; the indexes are retained for the expansion phase.
See the advisor's
[unused-index guidance](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).
