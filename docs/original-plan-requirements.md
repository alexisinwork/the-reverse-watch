# Original-plan requirements ledger

This ledger prevents product intent from being lost while the duplicated and
partly superseded [`original_context.md`](original_context.md) is converted into
phased implementation work. It is an index, not a replacement: read the entire
original file before planning or implementing every phase.

The [`implementation roadmap`](implementation-roadmap.md) controls sequence,
phase evidence, and accepted technical decisions. Phases continue automatically
after their evidence is recorded. When an older sketch conflicts with an
explicit owner decision or the roadmap, retain the desired product behavior and
record the technical reconciliation instead of silently dropping the
requirement.

## Decisions that must survive implementation

- Build the application, research pipeline, and AI workflow entirely in
  TypeScript/JavaScript. Do not introduce the older proposed Python/FastAPI
  service.
- Use React Router v7 Framework Mode and Vite for the web application.
- Use Mastra where it adds useful workflow orchestration, Zod at external-data
  and model boundaries, PostgreSQL as the canonical catalogue, and `pgvector`
  for semantic retrieval.
- Keep an OpenAI provider adapter and an optional Ollama/RunPod path. The older
  Qdrant/Chroma-only sketches are historical alternatives, not permission to
  replace PostgreSQL as the factual source of truth.
- Preserve the documentary voice: precise, dry, skeptical of marketing myth,
  and respectful of real engineering. Avoid empty labels such as “timeless,”
  “iconic,” “grail,” and “legendary” in generated dossiers.
- Treat exact financial, physical, mechanical, ownership, and availability
  constraints deterministically. Use semantic retrieval for psychology,
  perception, provenance themes, design language, and emotional fit.
- Keep the dossier visible without requiring email. Beehiiv delivery and
  subscription require an explicit opt-in.

## Canonical eight-question diagnostic

The final eight-input version in the original plan supersedes its earlier
seven-question draft. Phase 2 must preserve the intent and option granularity of
all eight dimensions:

1. Acquisition constraint: eight price ceilings from under `$300` through
   `$15,000+`.
2. Wrist circumference and sizing: five measured wrist bands with case and
   lug-to-lug guidance.
3. Mechanical/operational friction: zero-maintenance, workhorse mechanical, or
   in-house/specialist tolerance.
4. Operational deployment: field/water/abuse, studio/desk/daily, or
   formal/architectural.
5. Social signal: discreet competence, quiet continuity, unapologetic
   benchmark, or anti-luxury counter-signal.
6. Aesthetic DNA: structural tool, mid-century industrial, integrated geometry,
   extravagant/creative, or high art and fine finishing.
7. Provenance/corporate architecture: sovereign independent, industrial
   reality, or transparent modern rebirth.
8. Emotional objective: dependable armor, generational custody, creative
   differentiation, or milestone marker.

The UI must retain progress, Back/Next behavior, disabled incomplete
transitions, measured-wrist guidance, server validation, recoverable state, and
an optional email field that is separate from recommendation access.

## Complete brand and reference knowledge

The initial seed is a calibration step, not the final scope. Maintain a complete
brand manifest for the planned catalogue—approximately 200 brands unless the
owner later changes the target—and process every manifest entry. Do not stop at
an arbitrary first 200 or last 200 records, and do not let seed-set examples
become the whole catalogue.

The original plan explicitly names or groups Rolex, Cartier, Patek Philippe,
Seiko, Grand Seiko, Omega, Casio/G-Shock, Nomos, Jaeger-LeCoultre, Blancpain,
Audemars Piguet, Marathon, Sinn, Swatch, Vostok, Hamilton, transparent
microbrands, and resurrected or “zombie” marks. Those are required coverage
examples, not an exhaustive allowlist. It also requires correct treatment of
Swatch Group, Richemont, LVMH, Citizen, foundation-backed, family-owned,
independent, and revival ownership structures.

Every brand dossier must cover, with claim-level sources and retrieval dates:

- detailed founding, lineage, discontinuities, acquisitions, relaunches, and
  current corporate ownership;
- the difference between verified history and invented or overstated heritage;
- brand psychology, buyer archetypes, emotional promise, and counter-signaling;
- public and collector perception, status legibility, liquidity/recognition,
  cultural associations, and likely social context;
- design DNA, form origins, recurring visual codes, finishing philosophy, and
  representative collections;
- movement sourcing and manufacture reality, serviceability, maintenance
  friction, accuracy, durability, and parts constraints;
- reference-level prices, dimensions, lug-to-lug fit, thickness, water
  resistance, use environment, availability, and trade-offs;
- provenance quality, conflicting claims, missing facts as `null`, and review
  status.

Embeddings may represent editorial passages about history, psychology,
perception, provenance, design, and emotional fit. Exact facts and filters must
remain in structured PostgreSQL columns linked to sources.

## Recommendation dossier contract

The original output concepts—The Watch, The Mechanism, The Historical Reality,
and The Psychological Fit—remain required. The production response expands
them into three to five cited candidates, each containing:

- exact brand, model, and reference identity;
- corporate status and verified historical context;
- mechanical verdict, dimensional fit, maintenance reality, and hard-filter
  compliance;
- psychological alignment, social signal, aesthetic rationale, and perception;
- confidence, rejection/trade-off reasoning, and citations for factual claims.

The model must not invent a reference or specification, and marketing language
must not override contradictory corporate or mechanical evidence.

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

These items are not complete merely because the web application advances. Any
future media plan should link back to the full original context rather than
reconstructing it from memory.

## Phase mapping

| Original requirement | Current delivery phase |
| --- | --- |
| Landing identity, design tokens, Vercel, Beehiiv embed | Phase 1 |
| Final eight-question diagnostic and state behavior | Phase 2 |
| Complete brand manifest, detailed sourced dossiers, canonical facts | Phase 3 |
| Embeddings, hard filters, scoring, Mastra, provider evaluation | Phase 4 |
| Cited dossier UI, explicit email opt-in, analytics, production funnel | Phase 5 |
| Physical production, episodes, thumbnails, and YouTube release cadence | Owner/media workstream, retained above |
