# Phase 8 — Celebrity & Cinema Watch Discovery

Status: **in progress — packets 8.1–8.3 complete; packet 8.4 next**

## Purpose

Create a research-led discovery product for watches worn by public figures and
fictional characters. It is a top-of-funnel route into The Reserve's existing,
evidence-led recommendation engine; it does not replace the core diagnostic or
weaken its hard-filter rules.

The public name may be **Watches of Celebrity & Cinema**. The editorial tone
remains precise, dry, and sceptical of marketing mythology.

## Product shape

```text
Search, YouTube, social share, or a direct topic page
  -> celebrity/cinema research card or short archetype quiz
  -> cited watch attribution and accessible alternatives
  -> "Find the right equivalent for you" CTA
  -> existing progressive /quiz
  -> SQL-first, cited recommendation result
  -> optional Beehiiv opt-in
```

There are two distinct products that must not be conflated:

1. **Explorer pages** answer questions such as “What did this person wear?” or
   “What watch appears in this film?” They are source-led editorial pages.
2. **The viral archetype quiz** asks three to five light preference questions
   and returns an archetype plus a shareable card. It then hands the user to
   the core diagnostic for real purchase constraints.

## Evidence and claim model

Public figures and screen appearances are separate claim types. A statement
that a person owns a watch is not evidence that they wore it publicly, and a
watch worn by an actor in a role is not evidence of the actor's private
ownership.

Each accepted claim must retain:

- entity type: `public_figure` or `fictional_character`;
- person or character identity;
- exact reference variant where it is confirmed; otherwise a bounded brand or
  model-family identification, never a guessed reference;
- claim type: `owned`, `worn_publicly`, `screen_worn`, `reported`, or
  `unconfirmed`;
- work, episode, event, scene, and observed date when applicable;
- source URL, retrieval time, source type, review status, and confidence;
- image rights/licence or a record that no image is stored;
- a correction/dispute state and editorial note.

The existing exact `reference_variant` is the only candidate that can link to
the recommendation catalogue. Celebrity and screen claims are contextual
records and cannot promote an unreviewed variant into recommendations.

## Delivery packets

### 8.1 — Discovery schema and source contract

- Design additive PostgreSQL tables and TypeScript/Zod schemas for entities,
  works/events, attributions, evidence, confidence, corrections, and image
  rights.
- Reuse the catalogue's source registry and field-level evidence conventions
  where possible.
- Define a published confidence vocabulary and the exact labels shown for
  confirmed, disputed, family-only, and unconfirmed identifications.
- Add tests proving an unsupported claim cannot be published as confirmed.

Exit: schema, migrations, validation, and source contract pass `npm run check`.

### 8.2 — Editorial research protocol and pilot corpus

- Write a source hierarchy: official production/prop records and direct
  interviews first; reputable contemporaneous reporting next; specialist
  secondary sources only as corroboration.
- Define a correction workflow and a policy for contradictory sources.
- Research a pilot of 20–30 high-intent stories across cinema, television, and
  public figures. Each record must be independent, sourced, and reviewed.
- Do not bulk-import social posts, unlicensed image libraries, or fan claims.

Exit: pilot cards meet the evidence contract and link only to reviewed catalogue
variants or clearly labelled non-catalogue references.

Completed 2026-08-31. The source hierarchy, contradictory-source rules, and
correction/withdrawal workflow are recorded in
[`phase-8-editorial-protocol.md`](phase-8-editorial-protocol.md). The executable
TypeScript pilot contains 21 independently reviewed, text-only cards across
cinema, television, and public figures. Twelve claims have exact-reference
support, eight remain explicitly model-family-only, and one production prop is
published as unidentified. Every card passes the shared publication schema,
stores no image, and has a null catalogue link.

### 8.3 — Explorer pages

- Build index, entity, work, and attribution pages with citations, confidence
  labels, correction information, and accessible navigation.
- Show the exact configuration when known; disclose uncertainty where it is
  not.
- Offer existing-catalogue alternatives only through the deterministic engine.
- Include no affiliate link or paid claim until Phase 9's commercial disclosure
  contract is in place.

Exit: pages render sourced claims, handle empty/uncertain records safely, and
preserve the existing application quality gate.

Completed 2026-08-31. `/watches` now exposes the schema-gated pilot through a
narrow public read model, with entity, work, and attribution routes. Pages show
citations, confidence and precision labels, editorial qualifications,
correction state, and the core diagnostic handoff. Unknown routes return 404,
the unidentified Community prop stays visibly unconfirmed, and no raw
editorial table or browser database grant is exposed.

### 8.4 — Viral archetype quiz and sharing

- Create a three-to-five-question quiz for social signal, aesthetic direction,
  operational context, and indicative price comfort.
- The result is an editorial archetype, never a claim that the user “is” a
  celebrity or character.
- Generate a shareable card without using unlicensed celebrity or studio
  imagery; use The Reserve's own graphic system or cleared assets.
- Map only valid soft-preference values into the existing `/quiz`; require its
  numeric budget, wrist, and other active hard constraints before matching.

Exit: shared result, core-quiz handoff, consent boundaries, and invalid-input
handling are tested.

### 8.5 — Funnel evaluation and editorial operations

- Instrument page view, quiz start/completion, share, core-quiz handoff,
  completed recommendation, opt-in, and future outbound-market click events.
- Review the pilot for evidence quality, corrections, share rate, core-quiz
  completion, and qualified recommendation conversion.
- Publish an editorial refresh schedule because public appearances, sources,
  availability, and attributions can change.

Exit: retain and expand the feature only if it creates qualified core-quiz
traffic without degrading research standards or recommendation validity.

## Guardrails

- Do not imply sponsorship, endorsement, affiliation, or personal ownership
  without evidence.
- Respect copyright, image licences, publicity rights, and platform terms.
- Do not identify a watch more precisely than the evidence supports.
- Results remain available without an email address; Beehiiv consent is
  explicit and separate.
- Run the fast quality gate for each packet. Full browser/integration testing
  follows the Phase 7 policy and any later documented verification plan.
