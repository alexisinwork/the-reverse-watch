# Phase 8 — Celebrity & Cinema Watch Discovery

Status: **complete — verified 2026-09-01**

## Owner-approved guided continuation

On 2026-09-01 the owner approved an additive guided-discovery continuation.
The existing four-question archetype remains the light entry point. Its result
will offer two explicit paths: continue to the full personal diagnostic, or
choose a film/series, actor or public figure, or fictional character and find
the associated reviewed watch attributions. An accepted story can then hand
back to the full diagnostic to find a personally suitable equivalent.

Unknown subjects may be submitted to a bounded, server-side Perplexity
research queue, but generated candidates remain private and provisional until
their sources are independently checked and the existing publication contract
passes. This does not authorize catalogue research or automatic publication.
The implementation is divided into constrained packets D0–D8 in
[`guided-celebrity-cinema-discovery-plan.md`](guided-celebrity-cinema-discovery-plan.md).

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

Completed 2026-08-31 and expanded 2026-09-01.
`/watches/archetype` asks four editorial questions and returns one of six
deterministic dispositions with a CSS-only, first-party share card and
reproducible URL. Scoring contract `2.0.0` separates mechanical connoisseurship
and the recognised institutional benchmark from expressive collecting through
an explicit weighted matrix. Its full 180-combination answer space keeps every
result reachable. New share URLs carry the scoring version, while unversioned
links retain the original four-result calculation. Invalid, incomplete, or
unknown-version shared inputs fail closed. The handoff carries only
schema-valid social-signal and aesthetic preferences; indicative price and
operating context never bypass the full diagnostic's exact budget, wrist, or
hard-constraint questions. Results require no contact detail, and later
newsletter/dossier consent remains separate.

Migration `0040_expand_discovery_archetypes.sql` was applied to production on
2026-09-01. Its validated check constraint accepts all six result IDs. A
rolled-back RPC transaction proved completion/share acceptance for the two new
IDs without retaining test events; the existing RLS, grant, RPC, and aggregate
privacy boundaries are unchanged.

### 8.5 — Funnel evaluation and editorial operations

- Instrument page view, quiz start/completion, share, core-quiz handoff,
  completed recommendation, opt-in, and future outbound-market click events.
- Review the pilot for evidence quality, corrections, share rate, core-quiz
  completion, and qualified recommendation conversion.
- Publish an editorial refresh schedule because public appearances, sources,
  availability, and attributions can change.

Exit: retain and expand the feature only if it creates qualified core-quiz
traffic without degrading research standards or recommendation validity.

Completed 2026-09-01. The archive and archetype now emit only allowlisted,
aggregate events through a separate RLS-protected store and narrow RPCs. The
trailing-30-day dashboard reports page views, starts, completions, shares,
core handoffs, qualified recommendations, explicit opt-ins, and the dormant
Phase 9 outbound-click event. The event contract contains no answers, URLs,
contact data, IPs, or user/request identifiers. Retain/revise/stop thresholds
and denominator rules are published in
[`phase-8-funnel-evaluation.md`](phase-8-funnel-evaluation.md); the 90/180-day
review cadence and correction service levels are in
[`phase-8-editorial-operations.md`](phase-8-editorial-operations.md).

## Guardrails

- Do not imply sponsorship, endorsement, affiliation, or personal ownership
  without evidence.
- Respect copyright, image licences, publicity rights, and platform terms.
- Do not identify a watch more precisely than the evidence supports.
- Public discovery and archetype results remain available without an email
  address. Entry to the full diagnostic follows the later owner-approved
  Beehiiv access boundary; its consent remains explicit.
- Run the fast quality gate for each packet. Full browser/integration testing
  follows the Phase 7 policy and any later documented verification plan.
