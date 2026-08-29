# Coverage-first research pipeline

Status: **Phase 5 contract active**
Last verified: **2026-08-29**

This pipeline expands the relational catalogue without turning provider output,
Markdown, or a brand name into an accepted fact. PostgreSQL remains canonical;
the research layer produces provisional evidence for review.

## Boundaries

```text
coverage audit
  -> brand/reference planning manifest
  -> resumable discovery/extraction job
  -> immutable raw artifact
  -> Zod-normalized provisional facts
  -> human/source review
  -> additive SQL migration
  -> live catalogue + parity + coverage audits
```

- [`brand-manifest.json`](../data/research/brand-manifest.json) describes why a
  brand/reference slot should be researched. Its coverage intent is a
  hypothesis, not a watch specification.
- `app/domain/research.ts` is the versioned Zod contract for the manifest, jobs,
  and provisional facts.
- Extraction can emit only `reviewStatus: provisional`. It cannot write
  `accepted` facts or mutate the live catalogue.
- An accepted manifest target must link to a canonical catalogue variant. The
  manifest audit also requires every accepted bundled variant to be linked.
- Markdown dossiers are generated M2 editorial artifacts. They never become the
  parser input for M0/M1 decision facts.

No chunking, embedding model, vector extension, vector database, Mastra, Ollama,
or RunPod service is involved in this phase.

## Manifest and queue

Run:

```bash
npm run audit:research
npm run plan:research
```

The first command rejects duplicate brand/target IDs, invalid state transitions,
broken accepted catalogue links, and missing accepted seed rows. `--strict`
also requires the manifest to reach its declared approximately 200-brand target;
it is expected to fail while Phase 5 is incomplete.

The planner intersects each active coverage intent with all 28,800 core cells.
It reports how many targeted cells are empty, under three brands, or lack a
complete M1 candidate. A score combines those ratios, intent specificity, and
the manually reviewed P0–P3 priority. It does not predict that a planned watch
will pass those cells; source research must prove every dimension first.

Current checkpoint:

- the complete 200-dossier owner knowledge pack is linked into the manifest as
  research-only M0/M2 context, alongside one existing roadmap brand;
- 13 accepted catalogue targets linked to all current reviewed variants;
- 18 active coverage-intent targets;
- P0 tranche led by small formal quartz, compact solar field tools, ultralight
  time-only watches, compact mechanical GMTs, and affordable small-wrist
  mechanicals.

The first live batch on 2026-08-29 produced schema-valid provisional artifacts
for Cartier WSTA0107, Casio G-5600UE-1, and Swatch SO28N100. Independent review
did not promote any of them:

- Cartier still needs independently fetchable price, fit, weight, and accuracy
  evidence, and its rectangular 29.5 x 22 mm case cannot be collapsed into a
  circular `caseDiameterMm` fact.
- Casio has strong official dimensional, weight, solar, accuracy, water, and
  function evidence, but still needs a supported price/FX path, band-interface
  width, attachment classification, and reviewed illumination mapping.
- Swatch's official page supports identity, quartz, and 3 bar; the extracted
  lug-width source was for a different reference and was rejected.

Committed artifacts under `data/research/reviewed/` retain those decisions and
M1 gaps. Paid raw/normalized/job artifacts remain ignored.

The next ranked batch researched Christopher Ward mechanical GMT, Sinn compact
mechanical GMT, and Citizen compact lightweight solar. Exact primary-source
review made Christopher Ward C63-39AGM4-S00W0-B0 the first Phase 5
`ready_for_migration` candidate: its official page supplies every M1 field,
including the independently retrieved U.S. price and 20 mm interface. The
additive seed row raises exact core coverage from 180 to 212 cells. Citizen
BM8180-03E remains `needs_more_evidence` after its official E101 manual resolved
accuracy and its official regional page resolved a weight conflict; generic
luminous wording does not establish a graded lume class, and buckle is a clasp,
not the strap attachment. The first two Sinn responses failed strict extraction
consistency and remain immutable failed attempts rather than reviewable facts.

A third ranked batch subsequently produced valid provisional artifacts for Sinn
856 UTC, Marathon WW194003BK-0108, and Omega 310.30.42.50.01.001. Independent
review held all three at `needs_more_evidence`:

- Sinn's current official sheet describes several separately priced attachment
  configurations and reports 70 g without a strap, so it does not establish one
  homogeneous full-watch row; lug-to-lug, accuracy, attachment type, and graded
  lume also remain unresolved.
- Marathon's exact product page and specification sheet establish its identity,
  $575 USD offer, dimensions, movement, 3 ATM rating, and no-date status, but
  provide no numeric full weight, accuracy tolerance, attachment-interface
  classification, or categorical lume grade.
- Omega's exact official product page and sheet were blocked during independent
  retrieval. The detailed provider result remains provisional, and `Steel
  bracelet` was rejected as an attachment-interface value.

The strict checkpoint now contains eight committed reviews: one
`ready_for_migration` and seven `needs_more_evidence`. The next coverage-ranked
queue begins with Seiko compact mechanical no-date, Vostok affordable mechanical
field, and Baltic compact mechanical.

## Job idempotency and retention

Each research attempt receives a UUID and a SHA-256 request fingerprint over
the target ID, provider/preset, normalized request, and contract version.
Retries increment `attempt`; they do not overwrite an earlier raw artifact.
The same successful fingerprint may be reused rather than billed twice.
The worker defaults to one active provider request, honors `Retry-After`, and
caps retry waits at 60 seconds; higher concurrency remains an explicit CLI
choice.

Job states are `queued -> running -> succeeded|failed`. A succeeded job records:

- provider and model/preset;
- queued, started, and completed timestamps;
- immutable raw and normalized artifact paths;
- every discovered source URL;
- null error state.

A failed job retains its error and any raw response. Resumption creates a new
globally incremented attempt with the same fingerprint unless the request
contract changes. A successful extraction moves the manifest target to
`needs_review`; reuse repairs that transition if a prior process stopped after
writing the successful job.

Raw and normalized artifacts live under the ignored paths documented in
`data/research/README.md`. This prevents paid output, large captures, or
copyrighted excerpts from leaking into git while retaining local auditability.
Reviewed decisions may be committed when they contain structured facts and
source links rather than copied source text.

## Source and acceptance policy

Research order for a reference variant:

1. official product page, technical sheet, and manual;
2. official service/ownership material for brand-level claims;
3. central bank for FX;
4. reviewed market source only for facts the manufacturer cannot establish.

Manufacturer absence is not evidence of a negative. Missing weight,
lug-to-lug, service geography, availability, or market ratios remains `null`.
Retail price from one country cannot establish another purchase market.

Before a provisional fact becomes accepted, review verifies:

- the URL supports the exact value and variant/material/size;
- units and condition/channel/country are explicit;
- observed/retrieved timestamps and the field-specific expiry are present;
- the target row is homogeneous;
- value hash and source relationship are reproducible;
- conflicts are retained and resolved, not overwritten silently.

Acceptance is an additive migration followed by:

```bash
npm run project:seed-coverage
npm run render:seed-migration -- db/migrations/00NN_expand_catalogue.sql --only=<variant-id>
npm run audit:research
npm run audit:coverage
npm run audit:catalogue-parity
npm run check
```

The live RPC remains fail-closed if a newly accepted row cannot satisfy the
strict catalogue shape or exact SQL hard-filter coverage contract.

## Batch policy

Research and accept small batches organized around one coverage problem, not
one prestige tier. The first planned batch is:

1. compact formal quartz;
2. compact solar field/high-function tool;
3. ultralight low-cost time-only;
4. compact mechanical GMT alternatives;
5. affordable small-wrist mechanical alternatives.

After each batch, compare the number of newly covered cells, complete M1 cells,
and distinct brands in eligible top-three sets. A reference that adds no useful
coverage may still enter as reviewed context, but it does not displace a P0
research job merely to raise the brand count.
