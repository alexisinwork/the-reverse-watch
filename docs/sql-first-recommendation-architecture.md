# SQL-first recommendation architecture

Status: **accepted**  
Decision date: **2026-08-28**

This decision reconciles the original product strategy with the catalogue and
questionnaire audit performed after Phase 1. The preserved
[`original_context.md`](original_context.md) remains product history. This
document and the controlling
[`implementation-roadmap.md`](implementation-roadmap.md) define the current
technical direction.

## Decision summary

The first production recommendation engine will not require document chunking,
embeddings, a vector database, Mastra, an LLM, Ollama, or RunPod.

The baseline is:

```text
progressive questionnaire
  -> server validation and normalization
  -> PostgreSQL hard filters over reference variants
  -> explicit versioned soft score
  -> deterministic diversity selection
  -> cited explanation assembled from accepted facts
```

Semantic retrieval remains a later, optional experiment for free-text intent
and genuinely subjective design-language matching. It must demonstrate a
measurable gain over the deterministic baseline before becoming a production
dependency.

## Catalogue boundaries

### Brand is context; reference variant is the ranking unit

`brands` contains only facts that are truly brand-level: ownership and lineage,
service-network reality, movement-sourcing policy, buyer archetypes, public and
collector perception, narrative risks, and sourced editorial context.

`reference_variants` is the unit that enters filters and ranking. A row must be
homogeneous enough that its price, material, dimensions, movement, weight,
availability, and market behavior are meaningful. Different sizes, case
materials, bracelets, movements, or commercially distinct configurations are
separate variants even when marketing presents them as one family.

Brand-wide min/max ranges are allowed only as derived explanatory rollups. They
never participate in reference scoring.

### Exact values, not category labels, are canonical

- Budget is stored and filtered as a numeric amount and currency. Price bands
  are derived from shared constants for UI and analytics.
- Wrist circumference is normalized to millimetres. Display bands are derived
  from shared constants; catalogue rows do not carry questionnaire band keys.
- Prices are time-stamped snapshots by market, condition, and channel. A
  material family never receives one timeless `price_tier` tag.
- Dimensions, water resistance, weight, accuracy, and market ratios are numeric
  structured values. Missing facts stay `null`.

This removes key-equality failures between questionnaire buckets and catalogue
tags. It also prevents a reference crossing a band boundary from being silently
misclassified.

## Progressive questionnaire contract

The original eight dimensions remain valuable, but eight long mandatory steps
are no longer the conversion boundary. The product uses two stages.

### Core screening

The first result is available after six short screens:

1. exact budget ceiling and currency;
2. wrist circumference with a measurement guide;
3. deployment environment;
4. movement/service tolerance and required accuracy;
5. maximum comfortable weight;
6. required complications and date preference.

These screens collect the constraints most likely to make a candidate
impossible. A screen may contain more than one tightly related field, so screen
count is not treated as domain-field count.

### Optional refinement

The user can then improve ranking with:

- social signal;
- aesthetic DNA;
- ownership/lineage preference;
- emotional objective;
- market stance and hype tolerance;
- lug curvature and fit sensitivity;
- strap/bracelet attachment requirements, lug width, and quick release;
- purchase channel, wait-list tolerance, and an explicit secondary-market
  premium allowance;
- resale/liquidity preference;
- lume and crown-position preferences;
- purchase and service geography;
- tolerance for scratches, patina, and polished surfaces;
- new, certified pre-owned, ordinary pre-owned, or vintage condition;
- nickel/contact-allergy constraints.

Refinement fields are optional unless the user explicitly marks one as a hard
requirement. Colour, cyclops, and similarly narrow visual choices belong in
post-result refinement, not the initial funnel.

## Budget and premium rule

`budget_ceiling` is always the user's actual maximum purchase outlay. A premium
does not silently sit inside or outside a band.

If the user explicitly accepts paying above the normal reference price, the
system calculates:

```text
effective_ceiling = budget_ceiling * (1 + premium_allowance_percent / 100)
```

The allowance is constrained to `0..100`. It is applied only to eligible
secondary/grey-market acquisition paths and is shown in the result. Increasing
the budget is never a silent relaxation.

## Minimum reference data

The relational schema must support at least the following reference-variant
facts.

### Geometry and wear

- case diameter, thickness, lug-to-lug, and lug width in millimetres;
- lug curvature: `flat`, `moderate`, or `steep`;
- integrated bracelet flag;
- head-only and full-watch weight;
- case and bracelet materials.

### Movement and function

- movement type: automatic, manual, quartz, solar, spring drive, or hybrid;
- calibre, power reserve, published accuracy, and antimagnetic specification;
- normalized complication set, including date, GMT, chronograph, moon phase,
  power reserve, alarm, world time, and perpetual calendar.

### Operation

- water resistance;
- crown type and position;
- crystal material;
- normalized lume grade;
- attachment type: spring bar, quick release, or proprietary;
- clasp micro-adjustment type.

### Commerce and market

- retail and market price snapshots rather than one price string;
- production status;
- availability state;
- secondary-to-retail ratio range;
- separately defined hype risk, liquidity, and market momentum.

Hype means scarcity/premium behavior. Liquidity means expected sale speed and
spread. They are orthogonal and must not share one proxy score.

## Evidence and staleness

Verification belongs to each accepted field value, not to an entire document.
Structured query columns are accompanied by an evidence ledger with:

- entity type and ID;
- field name and a hash/version of the accepted value;
- source ID and URL;
- observed, retrieved, and verified timestamps;
- verification tier: `verified`, `provisional`, or `rejected`;
- reviewer and review note;
- optional expiry/stale-after timestamp.

Mutable facts such as price, availability, production state, ownership, and
market ratios have short refresh policies. Stable dimensions and calibre facts
do not become false merely because a file-level snapshot date is old.

## Filter and ranking policy

### Hard filters

Hard requirements are SQL predicates. They include an explicit budget ceiling,
fit-critical geometry, deployment safety, movement/accuracy, required
complications, weight, material allergy, condition/channel restrictions, and
any optional refinement the user marked mandatory.

If a field needed by an active hard filter is `null`, that variant is not
eligible for the ranked top three. It may appear only in a separate
“verification required” section with the exact missing fact. A filter never
falls back to “match everything” or “match nothing” implicitly.

### Soft score

Soft ranking is an explicit versioned weighted function. Every contribution is
logged as a field, matched value, weight, and points. Subjective values use
reviewed categorical tags at first; cosine similarity is not a substitute for
a weighting policy.

Tie-break order is deterministic:

1. more complete hard-filter evidence;
2. higher soft score;
3. fresher mutable commercial facts;
4. narrower price uncertainty;
5. stable reference ID.

### Speculative-market rule

A variant flagged `speculative_bubble` is suppressed unless the user both:

- explicitly accepts secondary/grey-market or premium acquisition; and
- explicitly accepts speculative market risk.

Eligible speculative results carry a visible premium/volatility disclaimer.

### Diversity and “why not”

The default result contains three candidates with no more than one reference
per brand and distinct primary archetypes. Selection uses deterministic quotas
before any MMR experiment is considered.

The response also includes two or three rejected near-matches with the exact
hard filter or score trade-off that removed them.

## Empty-result relaxation

No hard requirement is weakened silently. When a result set is empty, the
engine proposes one change at a time in this order:

1. resale/liquidity preference;
2. ownership/lineage preference;
3. market/hype stance;
4. social signal;
5. aesthetic DNA;
6. acquisition convenience or wait-list tolerance;
7. budget up to ten percent, only after explicit confirmation.

Wrist fit, safety/deployment, allergies, required complications, accuracy, and
the current budget ceiling remain fixed until the user changes them.

## Completeness levels

- **M0 — eligible for catalogue discovery:** brand ownership/lineage summary
  plus at least three sourced variants with identity, price, diameter,
  lug-to-lug, water resistance, movement type, and source evidence.
- **M1 — eligible for a ranked top three:** all facts required by the active
  hard filters, plus weight, attachment, lug width, lume, crown position, and
  production status where relevant.
- **M2 — editorial enrichment:** history, perception, psychology, buyer's
  remorse, patents, narratives, and deeper source synthesis.

Completeness is computed against the active profile, not only as one global
percentage. A record below M1 cannot rank first and cannot pass an active hard
filter whose evidence is missing.

## Coverage before 200-brand expansion

The coverage audit is a gate before bulk research. It enumerates meaningful
combinations of the core hard-filter axes, reports empty and near-empty cells,
and distinguishes a genuinely rare market combination from missing catalogue
data.

The seed catalogue is selected to exercise coverage cells, not merely to list
prestigious brands. Expansion to the approximately 200-brand manifest begins
only after the schema, scoring fixtures, relaxation explanations, and coverage
report work end to end on the seed.

## Optional semantic phase

Semantic tooling is justified only for:

1. extracting a structured questionnaire profile from free text such as “like
   a Submariner, cheaper, and without the hype”; or
2. comparing reviewed aesthetic/editorial descriptions where categorical tags
   demonstrably lose useful nuance.

The experiment uses curated passages, not arbitrary fixed-size document
chunking. It must be evaluated against golden profiles for precision, hard-rule
violations, explanation quality, latency, and cost. PostgreSQL remains the
source of truth even if `pgvector` is later enabled. A separate vector database
is not planned at the current catalogue scale.

## Implementation checkpoint

On 2026-08-28, the normalized schema and 12-variant calibration seed were
applied to Supabase, and deterministic recommendation engine v2 was connected to
`/quiz`. The seed covers only 180 of 28,800 projected core cells (0.63%), which
confirms that structured catalogue expansion—not semantic retrieval—is the
current bottleneck.

Production temporarily reads the Zod-validated, versioned seed bundle because
its Vercel database placeholders are not usable connection values yet. Supabase
remains canonical; the next Phase 4 checkpoint is SQL-query parity and switching
the server read path, not adding embeddings.
