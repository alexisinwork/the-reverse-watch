# Original-plan requirements ledger

This ledger prevents product intent from being lost while the duplicated and
partly superseded [`original_context.md`](original_context.md) is converted into
delivery work. It is an index, not a replacement: read the entire original file
before planning or implementing every phase.

The [`implementation roadmap`](implementation-roadmap.md) controls sequence and
accepted technical decisions. The catalogue audit accepted on 2026-08-28 is
recorded in
[`sql-first-recommendation-architecture.md`](sql-first-recommendation-architecture.md).
Where it conflicts with a provisional vector-first sketch, preserve the product
behavior and use the SQL-first decision.

## Decisions that must survive implementation

- Build the application and research pipeline in TypeScript/JavaScript. Do not
  introduce the older Python/FastAPI service.
- Use React Router v7 Framework Mode and Vite for the web application, Zod at
  input boundaries, and PostgreSQL as the canonical catalogue.
- Launch with SQL hard filters and a transparent, versioned weighted score.
  Chunking, embeddings, `pgvector`, a separate vector database, Mastra, an LLM,
  Ollama, and RunPod are not baseline dependencies.
- Treat a materially and dimensionally homogeneous reference variant—not a
  brand or broad model family—as the filtering and ranking unit.
- Keep brand history, ownership, perception, psychology, and service reality as
  sourced context. Never apply a brand-level rollup as a reference-level fact.
- Store exact price, wrist, dimension, performance, and market facts as numeric
  values. Derive UI bands from a single constants module.
- Preserve the documentary voice: precise, dry, skeptical of marketing myth,
  and respectful of real engineering. Avoid empty labels such as “timeless,”
  “iconic,” “grail,” and “legendary” in generated dossiers.
- Keep the dossier visible without requiring email. Beehiiv delivery and
  subscription require explicit opt-in.

## Progressive questionnaire

The original eight questions are retained as product intent, not as a mandatory
eight-step conversion wall. The 2026-08-28 audit adds missing hard constraints
and changes Phase 2 to a progressive flow.

### Core six-screen flow

1. Exact acquisition ceiling and currency. Price ranges remain UI shortcuts;
   the normalized payload contains a numeric maximum.
2. Measured wrist circumference. It is normalized to millimetres; the canonical
   display bands are derived from one constants module.
3. Operational deployment: field/water/abuse, studio/desk/daily, or
   formal/architectural.
4. Movement/service tolerance and required accuracy. Seconds-per-month accuracy
   can exclude mechanical movements; it is not inferred from a vague
   “mechanical acceptable” answer.
5. Maximum comfortable weight.
6. Required complications and date preference, including GMT, chronograph,
   moon phase, power reserve, alarm, world time, perpetual calendar, date, and
   no-date.

The user receives a deterministic profile summary after the core flow and may
continue into refinement without losing state.

### Optional refinement dimensions

- social signal: discreet competence, quiet continuity, unapologetic benchmark,
  or anti-luxury counter-signal;
- aesthetic DNA: structural tool, mid-century industrial, integrated geometry,
  extravagant/creative, or high art and fine finishing;
- provenance/corporate architecture: sovereign independent, industrial reality,
  or transparent modern rebirth;
- emotional objective: dependable armor, generational custody, creative
  differentiation, or milestone marker;
- hype/market stance, including explicit speculative-risk tolerance;
- lug curvature, fit sensitivity, integrated-bracelet tolerance, attachment
  type, quick release, and lug-width requirements;
- purchase channel, availability/wait-list tolerance, and a bounded explicit
  premium allowance;
- liquidity/resale preference;
- lume and crown-position preferences;
- purchase and service geography;
- cosmetic wear/patina tolerance;
- new, certified pre-owned, other pre-owned, or vintage condition;
- nickel/contact-allergy constraint.

Colour, cyclops, and similar visual details belong after the first result. Every
active hard requirement must map to a structured catalogue fact; when it does
not, the UI must label the result as requiring verification rather than pretend
the filter ran.

The UI must retain progress, Back/Next behavior, disabled incomplete
transitions, measurement guidance, server validation, recoverable state, and an
optional email field that is separate from recommendation access.

## Complete brand and reference knowledge

The initial seed is a calibration step, not the final scope. Maintain a complete
manifest for approximately 200 brands unless the owner changes the target.
However, run the combinatorial coverage audit before bulk acquisition. Seed
selection must cover hard-filter cells rather than merely prestigious brands.

The original plan explicitly names or groups Rolex, Cartier, Patek Philippe,
Seiko, Grand Seiko, Omega, Casio/G-Shock, Nomos, Jaeger-LeCoultre, Blancpain,
Audemars Piguet, Marathon, Sinn, Swatch, Vostok, Hamilton, transparent
microbrands, and resurrected or “zombie” marks. These are required examples,
not an exhaustive allowlist.

### Brand records

Brand data covers sourced founding and discontinuities, ownership, movement
sourcing policy, service network and parts access, public and collector
perception, buyer archetypes, narrative risks, and editorial context. Derived
catalogue ranges may be shown for explanation but never enter scoring.

### Reference-variant records

Every filterable record represents one commercially and mechanically coherent
variant. Different size, material, bracelet, movement, or price behavior means a
separate row. Required fact families include:

- exact identity, material, production state, and availability;
- diameter, thickness, lug-to-lug, lug width, lug curvature, integrated-bracelet
  status, and weight;
- movement type, calibre, power reserve, accuracy, antimagnetic specification,
  and normalized complications;
- water resistance, crown type/position, crystal, lume, attachment type, and
  clasp adjustment;
- retail and market price snapshots, secondary ratios, hype, liquidity, and
  market momentum as distinct concepts;
- active-field completeness and source evidence.

Every accepted value retains field-level source provenance, observed/retrieved/
verified times, verification status, and a staleness policy appropriate to the
fact. Missing facts remain `null`.

### Completeness levels

- M0 admits a brand/reference set to catalogue discovery.
- M1 provides the active hard-filter facts required for ranked recommendations.
- M2 adds history, psychology, perception, buyer's-remorse, patent, and other
  editorial enrichment.

A record missing an active hard-filter fact cannot rank in the top three. It may
appear only as “verification required.”

## Recommendation dossier contract

The original output concepts—The Watch, The Mechanism, The Historical Reality,
and The Psychological Fit—remain required. The default response contains three
cited candidates, no more than one per brand, with distinct primary archetypes.
Each candidate includes:

- exact brand, model, reference, and material/configuration identity;
- corporate status and verified historical context;
- mechanical verdict, dimensional fit, maintenance reality, and hard-filter
  compliance;
- psychological alignment, social signal, aesthetic rationale, and perception;
- deterministic score contributions, confidence/completeness, trade-offs, and
  citations.

It also contains two or three “why not” near-matches and the exact filter or
trade-off that removed each one. Empty results use the published relaxation
ladder and never weaken budget, fit, safety, allergy, accuracy, or functional
requirements silently.

References marked `speculative_bubble` are suppressed unless the user accepts
both premium/secondary acquisition and speculative risk. When shown, they carry
an explicit volatility disclaimer.

## Optional AI and semantic work

LLM or semantic functionality is limited initially to:

- extracting questionnaire fields from free text; and
- matching curated subjective descriptions when an evaluation proves that the
  explicit tag score loses material nuance.

Arbitrary dossier chunking is not required. If embeddings are tested, they
index curated reference- or claim-level passages and never replace structured
facts. The experiment must outperform the deterministic baseline without hard
constraint violations before it can enter the production path.

## Media, funnel, and release workstream

The original non-code plan remains preserved even though the application
roadmap cannot perform the owner's physical and editorial tasks:

- resolve the monetized-side-project handbook check;
- measure Episode 01 speaking rate and trim Episode 11 to the measured runtime;
- photograph the sterile dial, movement plate, case back, and aged brass
  paperclip with the specified macro setup;
- prepare A/B thumbnails and maintain a two-video production buffer;
- use a single late-video CTA to `thereserve.watch`;
- review the specified conversion, CTR, and retention analytics on the planned
  Day 18 checkpoint.

These items are not complete merely because the web application advances.

## Phase mapping

| Original or audited requirement | Current delivery phase |
| --- | --- |
| Landing identity, design tokens, Vercel, Beehiiv embed | Phase 1 |
| Progressive questionnaire, shared numeric/band contracts | Phase 2 |
| Reference-variant schema, field evidence, coverage audit | Phase 3 |
| SQL filtering, scoring, diversity, relaxation, “why not” | Phase 4 |
| Full manifest research and approximately 200-brand expansion | Phase 5 |
| Optional free-text/semantic experiment | Phase 6 |
| Cited dossier UI, explicit email opt-in, analytics, production funnel | Phase 7 |
| Celebrity/cinema watch discovery and archetype-quiz funnel | Phase 8 |
| Affiliate validation, paid dossiers, concierge, sponsorship, and B2B assessment | Future expansion |
| Physical production, episodes, thumbnails, and YouTube cadence | Owner/media workstream |

## 2026-08-28 implementation trace

- The core questionnaire, Q17-style complications, explicit accuracy,
  geography, cosmetic tolerance, condition/vintage, and allergy inputs are in
  the progressive `/quiz` contract.
- Recommendation engine v2 implements field-level missing/expiry behavior,
  candidate-specific premium eligibility, speculative suppression, transparent
  score factors, diversity, verification-required, why-not, and relaxation
  output.
- The production server now reads strictly validated accepted facts and the
  authoritative hard-filter partition from versioned PostgreSQL RPCs. Exact
  seed/database fact parity and SQL/TypeScript predicate parity are audited;
  the reviewed local bundle remains a visible all-or-nothing fallback.
- The first 12 reviewed variants are split by material/configuration and loaded
  into PostgreSQL with field evidence. This includes separate Rolex Explorer
  `124270` and `124273` rows.
- Provenance and cosmetic selections are disclosed as unscored where the seed
  lacks reviewed supporting fields. They are not silently treated as matches.
- Semantic infrastructure remains deferred. No chunks, embeddings, vector
  database, Mastra, Ollama, or RunPod dependency was introduced.
