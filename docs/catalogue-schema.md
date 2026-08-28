# Catalogue schema contract

The first additive migration is
[`0001_reference_variant_catalogue.sql`](../db/migrations/0001_reference_variant_catalogue.sql).
It implements the accepted
[`SQL-first architecture`](sql-first-recommendation-architecture.md) without
enabling `pgvector`.

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
| Availability and market price | 30 days |
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

`npm run audit:coverage` validates
[`data/coverage/reference-variants.json`](../data/coverage/reference-variants.json)
and enumerates 28,800 meaningful core-axis cells:

```text
8 price bands × 5 wrist bands × 3 environments × 3 ownership-friction levels
× 4 accuracy tolerances × 4 weight limits × 5 representative function profiles
```

The input file is deliberately empty before seed research, so the initial audit
reports 28,800 empty cells instead of manufacturing coverage. The future
database projection may assign one variant to multiple compatible cells. The
audit separately reports:

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
