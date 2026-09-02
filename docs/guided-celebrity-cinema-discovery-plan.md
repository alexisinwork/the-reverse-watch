# Guided Celebrity & Cinema Discovery Plan

Status: **D0–D7 complete — verified 2026-09-02**

This document is the executable continuation of the completed Phase 8 pilot.
It preserves the existing four-question archetype quiz and turns its result
into a fork between the full personal diagnostic and guided discovery by film,
series, actor or public figure, or fictional character.

This continuation does **not** reopen Phase 8, start the commercial Phase 9
workstream, or authorize autonomous brand/model catalogue research. The owner
retains catalogue selection, research, verification, and population. It also
does not authorize automatic publication, affiliate links, unlicensed images,
or weaker recommendation filters.

## Product decision

The canonical entry flow is:

```text
/watches/archetype
  -> four light questions
  -> deterministic archetype result and share card
  -> choose one next step

     A. Find the right watch for me
        -> existing full /quiz
        -> exact budget, wrist, use, and technical constraints
        -> normal SQL-first recommendation result

     B. Find a watch from film and culture
        -> choose Film or TV / Actor or public figure / Fictional character
        -> search accepted discovery records
        -> choose a work, person, character, or attribution
        -> read the evidence or ask for a personal equivalent
        -> full /quiz when a personal recommendation is requested
```

The existing `/watches` archive remains a tertiary browse option. Public
archive/search and anonymous research intake do not require an email address.
The full `/quiz` branch follows the current owner-approved landing subscription
and signed access-grant boundary; that opt-in remains explicit. Results-page
dossier delivery remains a separate consent decision.

## Non-negotiable product rules

1. The first quiz remains exactly four questions: social signal, aesthetic
   DNA, deployment environment, and price comfort.
2. Its result is editorial orientation, not a purchase recommendation.
3. Social-signal and aesthetic answers may be carried into the full quiz as
   validated optional preferences. Deployment and price comfort remain
   directional and must never become exact hard constraints.
4. The full diagnostic must still ask for canonical numeric budget and wrist
   circumference plus every active operating and technical hard constraint.
5. All handoff query values are parsed through the existing Zod contracts.
   Unknown, forged, or stale values fail closed.
6. An actor, a fictional character, and a work are different entities. Their
   watch claims must never be merged because their names or screen credits are
   related.
7. AI output is provisional research material. Only reviewed canonical rows
   can appear as accepted facts on public pages.
8. A missing fact remains `null`. Missing data cannot satisfy an active hard
   filter or be shown as a plausible identification.
9. This plan may link an accepted discovery attribution to an already reviewed
   catalogue variant. It may not create, approve, or enrich catalogue variants.

## Shared vocabulary

Use these terms consistently in UI, TypeScript, PostgreSQL, tests, and
documentation:

| Term | Meaning |
| --- | --- |
| Public figure | A real person, including an actor. |
| Fictional character | A role within a film, series, or other work. |
| Work | A film, television series, or a bounded instalment such as an episode. |
| Cast credit | Reviewed relation between a public figure, a fictional character, and a work. |
| Attribution | A bounded claim that a watch was owned, publicly worn, screen worn, reported, or remains unconfirmed. |
| Exact reference | Evidence supports a materially homogeneous exact reference variant. |
| Family-only | Evidence supports a model family but not an exact reference. |
| Custom prop | The object is a production prop or modification and must not be represented as the ordinary retail reference. |
| Unconfirmed | The appearance is real or reported, but available evidence does not support a bounded identification. |
| Personal equivalent | A normal catalogue recommendation influenced by reviewed story context but still subject to the full diagnostic. |

The following implications are forbidden:

- an actor's personal ownership does not prove a character wore the watch;
- a character's screen watch does not prove the actor owned it;
- a retail tie-in does not prove screen use;
- a custom prop is not the corresponding retail reference;
- a visually similar catalogue item is not an identified screen watch.

## User journeys

### 1. Archetype result fork

Keep the current result, explanation, reproducible URL, and CSS-only share
card. Replace the single dominant continuation with two equally legible choices:

- **Find the right watch for me** — opens the existing full `/quiz` and carries
  only valid social-signal and aesthetic preferences;
- **Find a watch from film and culture** — opens `/watches/find` and may carry
  the four archetype answers only as optional ranking context.

The result also retains a quieter link to browse `/watches`.

### 2. Choose the cultural anchor

`/watches/find` first presents exactly three anchor types:

1. Film or TV;
2. Actor or public figure;
3. Fictional character.

After selection, display one search field. Search starts after two normalized
characters and queries accepted local records only. It must not call
Perplexity on each keypress. Results show enough context to disambiguate:

- works: title, release year, and type;
- people: name plus a short reviewed descriptor when available;
- characters: character name, work title, and release year.

Aliases may include localized titles and alternate names, but the selected
result always resolves to one canonical record.

### 3. Known film or series

Show the work header, release context, characters with accepted attributions,
and separate unattributed work-level prop records where applicable. Do not
collapse several characters or several watches into one answer. A series may
group claims by season and episode when that information exists.

### 4. Known actor or public figure

Keep two visible sections:

- **On screen** — claims reached through reviewed cast credits and screen-worn
  attributions;
- **In public life** — ownership and public-wear claims about the real person.

The same reference may appear in both sections only when each claim has its own
evidence. No relationship is inferred from the duplicate model name.

### 5. Known fictional character

Group the character's accepted attributions by work, season, episode, and scene
where available. Preserve exact, family-only, custom-prop, disputed, and
unconfirmed labels. Never roll an actor's public-life watches into this view.

### 6. Unknown or ambiguous query

If accepted local records do not provide an unambiguous result:

1. state that the subject is not yet verified in the archive;
2. ask for the smallest useful clarification, normally release year, work, or
   whether the name is a person or character;
3. offer **Research this subject** without requiring email or identity data;
4. normalize and deduplicate the topic server-side;
5. return an opaque status URL at `/watches/research/:requestToken`;
6. process research asynchronously.

At initial launch, AI candidates are never rendered as confirmed facts and are
not exposed to public indexing. A status page may say queued, researching,
under review, matched, no sufficient evidence, or failed. It must not expose
provider prompts, raw responses, internal IDs, or reviewer notes.

### 7. Attribution selection and personal equivalent

An accepted attribution offers:

- the evidence-led story page;
- the exact catalogue reference only when an already reviewed link exists;
- **Find my equivalent** to enter the full diagnostic with bounded story
  context.

Story context is a soft preference only. Exact budget, wrist, availability,
accuracy, water resistance, material, and other active constraints are
re-asked and enforced normally. If the selected screen watch fails them, it is
not smuggled into confirmed recommendations; it may appear only in a clearly
labelled why-not explanation when the existing engine supports that outcome.

## Deterministic discovery ranking baseline

Version the first ranking contract as `discovery_context_v1`. It operates only
over reviewed attribution traits. It does not call an embedding or language
model.

| Matching dimension | Points |
| --- | ---: |
| Social signal | 3 |
| Aesthetic DNA | 3 |
| Deployment environment | 2 |
| Price comfort | 1 |

Rules:

- a missing reviewed trait contributes zero and is not treated as a match;
- price comfort is editorial positioning, not current market price;
- order equal scores by published/accepted state, exact before family-only,
  most recent completed review, then stable slug;
- evidence precision breaks a tie but does not become a style score;
- return the score factors for tests and internal diagnosis;
- add semantic retrieval only after a documented evaluation shows it beats
  this baseline without reducing evidence quality.

## Data architecture

### Canonical publication tables

The existing Phase 8 tables remain the only publication destination:

- `discovery_entities`;
- `discovery_works`;
- `discovery_events`;
- `discovery_attributions`;
- `discovery_attribution_evidence`;
- `discovery_image_rights`;
- `discovery_corrections`.

Add only the following reviewed canonical support tables when packet D2 needs
them:

1. `discovery_entity_aliases` — normalized alternate names and locale;
2. `discovery_work_aliases` — alternate/localized titles and locale;
3. `discovery_cast_credits` — public figure + fictional character + work;
4. `discovery_attribution_traits` — reviewed values for the four archetype
   dimensions and their evidence/review metadata.

Every new table uses lowercase identifiers, a `bigint generated always as
identity` primary key, `timestamptz`, explicit check constraints, indexed
foreign keys, and explicit review state. TypeScript and PostgreSQL validation
must agree on every enum-like value. Exact duplicate aliases and cast credits
must have database uniqueness constraints.

### Private research intake

Anonymous requests and AI output must not write directly to canonical tables.
Create a private schema where deployment tooling supports it; otherwise use
RLS-enabled tables with all browser table and sequence privileges revoked.

`discovery_research_topics` stores:

- numeric internal ID and random opaque public status token;
- anchor kind;
- bounded original display text and normalized text;
- optional release year;
- deterministic deduplication key;
- status: `needs_clarification`, `queued`, `researching`, `review_pending`,
  `matched`, `no_evidence`, or `failed`;
- optional matched canonical entity/work IDs;
- aggregate request count and timestamps.

It does not store email, user ID, raw IP, cookies, profile answers, or analytics
identity.

`discovery_research_runs` stores provider, model, preset, contract version,
status, retry count, provider request ID, timestamps, usage/cost, normalized
artifact, a private raw-response pointer or bounded JSON retention field, and a
redacted failure category.

`discovery_research_candidates` stores provisional entity/work/character and
watch-attribution fields. Identifiers remain nullable. It explicitly records
custom-prop possibility, contradiction state, normalization status, and review
status.

`discovery_research_candidate_sources` stores one source per row: canonical
URL, source role, supporting/contradicting stance, locator, retrieval time,
independent-fetch status, and reviewer status.

Required safeguards:

- service credentials remain server-only;
- browser roles receive no raw-table access;
- the public form calls one narrow server action with bounded input;
- any `security definer` function has an empty/search-safe `search_path`,
  validates all inputs, revokes execution from `PUBLIC`, and grants only the
  exact required role;
- every foreign key has a supporting index;
- queue scans use a partial/composite index for queued rows;
- migrations are additive and reversible; no canonical or production data is
  dropped, truncated, or bulk-deleted;
- Supabase security and performance advisors are checked after live migration.

## Perplexity research contract

Reuse the existing TypeScript worker's transport, bounded retry, provenance,
and usage/cost patterns, but define a separate discovery-specific schema.
Verify the current official API and model contract again during D5 rather than
copying stale provider assumptions.

### Request sequence

```text
accepted canonical lookup
  -> existing fresh deduplicated topic
  -> reusable successful run within staleness window
  -> enqueue one bounded research topic
  -> server-side provider call
  -> validate structured candidate
  -> independent source fetch and human review
  -> explicit promotion to canonical draft
  -> existing publication gate
```

Each provider request covers one atomic target, such as `Drive (film, 2011)` or
`Don Draper in Mad Men`. Do not request a celebrity's whole lifetime or a
series' whole prop inventory in one call.

The structured response requires:

- target kind, canonical-looking name, year, and aliases;
- ambiguity and target-mismatch flags;
- separate public figure, character, and work candidates;
- work, season, episode, scene, and timecode when known, otherwise `null`;
- claim type;
- brand, family, exact reference, and custom-prop state, each nullable;
- identification precision;
- source URLs with role, stance, and locator;
- contradictions and an explicit insufficient-evidence outcome.

Source URLs are captured from the provider's top-level citations or search
results and then independently fetched. URLs appearing only in generated prose
are not accepted as evidence.

The prompt must say:

- use retrieved sources only;
- return insufficient evidence instead of guessing;
- disclose name, date, medium, and cast mismatches;
- distinguish actor ownership, actor public wear, character screen wear,
  retail tie-ins, and custom props;
- keep unsupported values `null`;
- report contradictory sources.

Perplexity is a source-discovery and extraction tool. It is not the factual
source, reviewer, catalogue, or publication authority.

### Cost and abuse controls

- deduplicate normalized topics before enqueueing;
- reuse one fresh successful run inside the documented staleness window;
- retry no more than twice and only for transient provider failures;
- do not auto-escalate to deep-research modes;
- set daily request and spend caps;
- reject oversized, URL-bearing, control-character, or otherwise abusive input;
- add request throttling and a honeypot at the public boundary;
- use an ephemeral network-level rate-limit signal if needed, but do not
  persist raw IP addresses.

## Worker and editorial promotion

Use the PostgreSQL-backed topic/run tables as the queue. A protected TypeScript
worker route, invoked by the deployment scheduler, claims a bounded number of
jobs atomically with `FOR UPDATE SKIP LOCKED`. The normal page action only
enqueues; it never waits for a long provider call.

The worker must authenticate the scheduler secret, cap jobs and wall-clock
work per invocation, recover stale leases, and write redacted failures. A
provider outage must leave existing archive and quiz routes healthy.

Promotion is a separate TypeScript command or protected editorial operation.
For each candidate it must:

1. independently fetch and inspect every proposed source;
2. reject target mismatch, circular sourcing, snippets without underlying
   evidence, and unsupported exact-reference claims;
3. resolve or create canonical entity, work, alias, and cast-credit drafts;
4. insert a draft attribution and one evidence row per accepted source;
5. record `no_image_stored` unless separately reviewed rights allow an image;
6. preserve contradictions and conservative precision;
7. pass the existing publication contract before any public state change.

Promotion never creates or approves a catalogue variant. A catalogue link is
allowed only when the exact existing variant has already passed its independent
recommendation review.

## Moving the pilot from static data to PostgreSQL

The current 21-story TypeScript corpus is the public source and must remain the
fallback until database parity is proved.

D2 creates an idempotent, transactional TypeScript importer that maps every
fixture story into canonical entity, work, event, attribution, evidence,
image-rights, and correction rows. It must preserve all 21 cards, their source
locators, exact/family/unconfirmed precision, and the absence of catalogue
links.

Expose a narrow, versioned server read contract or RPC for published discovery
records. Raw canonical tables remain unavailable to browser roles. Switch the
public loader only after exact 21-card parity passes locally and against the
live project. Keep a documented feature flag or single-code rollback path to
the fixture while the new read path stabilizes.

## Route and module map

Expected routes:

- `/watches/archetype` — existing four-question quiz and two-way result fork;
- `/watches/find` — anchor choice, accepted search, disambiguation, and request
  submission;
- `/watches/research/:requestToken` — privacy-safe request status;
- `/internal/discovery-research/run` — protected bounded scheduler endpoint.

Expected modules may be adjusted to existing conventions, but responsibilities
must remain separate:

- `discovery-selection.ts` — anchor and handoff schemas;
- `discovery-search.server.ts` — accepted-record search/read only;
- `discovery-research.ts` — shared intake and candidate schemas;
- `discovery-research-store.server.ts` — queue persistence and status reads;
- `perplexity-discovery-research.server.ts` — provider adapter only;
- `discovery-promotion.ts` — independent review/promotion workflow;
- focused tests beside each domain module plus route/integration coverage.

## Privacy-safe analytics

Only low-cardinality events are allowed:

- archetype result branch selected;
- cultural anchor kind selected;
- accepted result selected;
- research request submitted;
- coarse request status reached;
- attribution selected;
- personal-equivalent handoff started.

Never send raw query text, name, URL, opaque request token, canonical/internal
ID, email, IP, user ID, quiz answers, or other free text to analytics. Demand
for a deduplicated topic is represented only by its private aggregate
`request_count`.

## Delivery packets for a constrained executor

Execute D0 through D8 in order. Each packet is one small verified commit. Do
not begin the next packet when the current exit criteria fail. Do not combine
schema, provider, UI, and production rollout into one change.

For every packet, even when the executor is a smaller model:

1. read `AGENTS.md`, then read `docs/original_context.md` completely from its
   first line through its last line;
2. read the controlling roadmap, requirements ledger, this plan, and the files
   named by the active packet before proposing edits;
3. inspect `git status` and preserve unrelated owner changes;
4. write a packet-local checklist containing scope, files, tests, migration or
   external-system impact, and explicit non-goals;
5. implement only the active packet and keep provider/database seams mockable;
6. run the packet's documented checks plus `npm run check`; do not defer a
   failing check by silently weakening the contract;
7. inspect the final diff for credentials, personal data, catalogue mutations,
   actor/character conflation, unsupported precision, and unrelated changes;
8. record evidence and rollback instructions in the relevant docs;
9. commit and push the verified packet to `main` under the repository delivery
   rules, then mark that packet complete before opening the next one.

If required authority, a secret, a provider connection, or an owner editorial
judgement is unavailable, complete all provider-free work and report the exact
blocked exit criterion. Never guess a secret, publish a candidate, approve a
catalogue row, or weaken evidence rules to make a packet appear complete.

### D0 — Freeze contracts and golden fixtures

Scope:

- add the anchor, handoff, topic-status, candidate, and ranking TypeScript/Zod
  contracts without routes or external writes;
- freeze the four-question contract and `discovery_context_v1` weights;
- encode the golden scenario matrix below as provider-free fixtures/tests;
- document the topic/run/candidate state transitions.

Checks:

- invalid kinds, aliases, years, query sizes, states, and handoff values fail;
- deterministic ranking and tie-breaks are reproducible;
- no provider, database migration, or catalogue file changes.

Exit: `npm run check` passes and the contracts can be consumed independently.

#### D0 implementation record

`app/domain/discovery-selection.ts` is the provider-free boundary for this
packet. It validates the three canonical anchors, bounded local-search input,
topic states, candidate precision, soft handoff values, and the four reviewed
context traits. Topic state is deliberately one-way at this boundary:
`needs_clarification -> queued -> researching -> review_pending -> matched |
no_evidence | failed`; routes and persistence remain later-packet concerns.
`discovery_context_v1` returns its score factors and orders equal scores by
precision, review time, then stable slug. It carries no budget, wrist, or other
hard filter into the full diagnostic.

Packet-local checklist: D0 changes only the new domain module, its focused
tests, and this contract record; it makes no route, database, provider,
catalogue, analytics, or external-system change. Rollback is deletion of the
unreferenced module and tests before D1 consumes it.

### D1 — Add the archetype result fork

Scope:

- preserve all four current questions and result URL behavior;
- add the two primary choices and tertiary archive link;
- add the empty `/watches/find` route shell and validated handoff parsing;
- extend only low-cardinality funnel events.

Checks:

- result/share URLs remain reproducible;
- full quiz receives only valid soft preferences;
- discovery handoff works with and without archetype context;
- discovery browse/intake adds no email wall and makes no research provider
  call.

Exit: route/unit tests and `npm run check` pass.

#### D1 implementation record

The archetype result now presents two equal continuations: the existing full
diagnostic receives only validated social and aesthetic preferences, while the
new `/watches/find` shell receives the same optional editorial context. The
finder has exactly three disabled anchor choices until D3 supplies accepted
local search. It requests no email, invokes no provider, and writes no data.
The archive remains a tertiary browse link. Rollback is a single route and CTA
removal; no persisted state or migration is involved.

### D2 — Establish canonical database parity

Scope:

- add aliases, cast credits, and reviewed attribution traits via additive
  migration;
- add narrow published-read access;
- implement the idempotent transactional 21-story importer;
- retain the static fixture fallback.

Checks:

- all foreign keys are indexed and all constraints mirror Zod;
- browser roles cannot read raw tables or mutate canonical records;
- local and live imports produce exactly 21 equivalent cards;
- repeated import is a no-op, and rollback is documented;
- Supabase security/performance advisors show no new relevant findings.

Exit: fast gate, migration gate, parity audit, and live read smoke test pass.
This packet does not research or populate catalogue variants.

#### D2 implementation record

Migrations `0041` through `0044` establish the additive canonical support
layer and the protected pilot import/read boundary. Aliases, cast credits, and
attribution traits are RLS-enabled and unavailable to browser table roles; cast
credits additionally validate that their two entities are respectively a public
figure and a fictional character. Traits use the four existing archetype
vocabularies and retain a reviewed source and timestamp.

The reviewed 21-story corpus imports through the service-role-only,
transactional `import_discovery_pilot_v1` RPC. It preserves every public card's
slug, headline, summary, bounded attribution, accepted source locator, and
text-only image-rights decision. A second import updates the same canonical
rows rather than creating additional cards. The public
`discovery_published_stories_v1` RPC returns only accepted, evidence-gated card
projections; it is the sole browser-readable discovery database boundary.

The public archive routes now try that projection server-side and use the
already-reviewed static corpus when configuration, transport, or response
validation fails. `scripts/import-discovery-pilot.ts` performs the service-role
import, and `scripts/audit-discovery-parity.ts` checks the live public RPC
against the static fixture. Rollback is application-only: disable the RPC read
path or remove its environment configuration and the archive immediately uses
the fixture again. Canonical rows and evidence are retained for audit; no
rollback deletes or truncates discovery data.

### D3 — Build accepted-record finder

Scope:

- implement the three anchor choices, accepted local search, aliases, and
  disambiguation;
- build work, public-figure, and character result compositions;
- separate on-screen from public-life claims;
- connect accepted results to existing evidence pages.

Checks:

- search performs no provider calls;
- two-character threshold, limits, and escaping are enforced;
- work/year and character/work collisions remain distinct;
- exact/family/custom/unconfirmed labels match canonical evidence.

Exit: component, route, accessibility, and `npm run check` gates pass.

#### D3 implementation record

Migrations `0045` and `0046` add `discovery_search_v1`, a narrow anonymous
read RPC that accepts only one anchor and a two-to-160-character query. It
searches accepted canonical names plus accepted aliases, escapes literal `%`,
`_`, and backslash characters, caps output at twelve compact results, and never
exposes raw tables. The server finder uses that RPC with the reviewed fixture as
a failure fallback.

`/watches/find` now offers Film or TV, Actor or public figure, and Fictional
character anchors. A selected anchor enables a bounded GET search and renders
work/year/type, person descriptor, or character/work/year disambiguation. Work
results route to work evidence pages; people and characters route to their
separate entity evidence pages. Public-figure pages retain separate **On
screen** and **In public life** sections, so neither route composition nor a
shared watch identity can silently imply the other claim type. No provider,
research request, email capture, or catalogue mutation is part of D3.

### D4 — Add private research intake without AI

Scope:

- add topic, run, candidate, and source tables plus least-privilege access;
- implement normalized deduplication, bounded enqueueing, opaque status tokens,
  and the status page;
- add throttling, honeypot, and privacy-safe analytics;
- keep the worker disabled.

Checks:

- duplicate requests increment one topic instead of creating provider work;
- status token cannot enumerate another request;
- no identity/profile/query text reaches analytics;
- browser roles cannot inspect queue/raw artifacts;
- no request can mutate canonical discovery or catalogue tables.

Exit: migration/security tests, route tests, advisors, and `npm run check` pass.

#### D4 implementation record

Migrations `0047` and `0048` establish the private, additive topic, run,
candidate, and source queue, and repair the opaque-token generator for the
connected PostgreSQL environment. Anonymous and authenticated browser roles
have no `private` schema or table privileges; their only queue access is the
bounded enqueue RPC and an opaque-token status RPC that returns the coarse topic
state alone. A repeated normalized anchor/title/year request updates the same
private topic's `request_count`; it neither creates another provider run nor
touches canonical discovery or catalogue rows.

`/watches/find` now offers the research form only after an accepted-record
search has no match. It rejects a honeypot submission without writing a topic,
validates the same length, control-character, URL, anchor, and year rules on
the server as PostgreSQL, and redirects a successful enqueue to
`/watches/research/:requestToken`. The status route displays only the
allowlisted state. The worker remains deliberately absent and no provider is
called.

The intake stays visibly unavailable until the separately measured
`DISCOVERY_RESEARCH_RATE_LIMIT_MAX_REQUESTS` and
`DISCOVERY_RESEARCH_RATE_LIMIT_WINDOW_SECONDS` production values are configured.
When configured, the action uses a short-lived, SHA-256-derived network signal
solely as an in-memory throttle key; it does not put an IP address in the queue
or analytics. Migration `0049` adds only aggregate cultural-anchor and coarse
status dimensions to the existing funnel RPC. It rejects raw query text,
tokens, IDs, URLs, identity, profile, and network fields by contract and by
database event shape.

### D5 — Add bounded Perplexity research worker

Scope:

- verify current official provider documentation;
- implement the discovery-specific structured response contract;
- add protected scheduled job claiming, bounded retries, cost accounting,
  staleness reuse, and redacted failures;
- validate citations/search results and save provisional candidates only.

Checks:

- provider adapter has fixture-based success, ambiguity, no-evidence,
  contradiction, malformed-output, timeout, and rate-limit tests;
- concurrent workers cannot claim the same run;
- outage does not affect `/watches`, `/watches/archetype`, or `/quiz`;
- no candidate becomes public or creates a catalogue row.

Exit: provider-free tests, one bounded staging smoke run, cost record, and fast
gate pass. Keep the public submit control disabled until caps and scheduler
authentication are verified in deployment.

#### D5 implementation record

The worker boundary uses the current Perplexity Agent API at
`/v1/agent` with the `pro-search` preset, web search, JSON Schema output, a
bounded output-token limit, and `store: false`. The API contract was checked
against Perplexity's [Agent API reference](https://docs.perplexity.ai/api-reference/agent-post)
and [structured-output guidance](https://docs.perplexity.ai/docs/agent-api/output-control),
retrieved 2026-09-02. The discovery-specific contract
keeps public figures, fictional characters, and works separate; exact-reference
precision, custom-prop possibility, contradictions, and source roles remain
explicit. Candidate URLs are accepted only when they also appear in the
provider's returned annotations/search results. Malformed, mismatched, or
unsupported output remains private and never reaches canonical discovery or the
recommendation catalogue.

Migration `0050_add_discovery_research_worker.sql` adds bounded leases, private
raw-response retention, atomic daily-cost checking, stale-lease recovery, and
service-role-only claim/complete/fail RPCs. The four D4 private tables now also
have RLS enabled with no browser policies. The protected
`/internal/discovery-research/run` route requires a separate worker secret,
Supabase service credential, provider key, per-run job cap, output-token cap,
and daily USD cap; missing configuration returns 503 and never calls either
provider or database. Retryable provider failures are reduced to an allowlisted
category and retried by the queue up to two times. Worker completion writes only
draft provisional candidates and evidence links with `review_status = draft`;
no public record or catalogue variant is created. Rollback is disabling the
worker configuration or the route; queue data and canonical records are
retained, and the migration is additive.

Verification on 2026-09-02: the provider-free D5 suites cover successful
structured output, ambiguity, no evidence, contradictions, malformed output,
timeouts, rate limits, citation enforcement, and bounded worker outcome
mapping. The live migration check claimed and failed a queued run inside a
rollback transaction; a second claim cannot see that leased topic, and the
four private tables have RLS enabled with no browser-role table grants. The
protected route's staging smoke stayed provider-free because incomplete worker
configuration returns 503 before either provider or database access. The
configured daily cost ceiling is passed into the atomic claim RPC and each
successful run records provider token usage and cost; no provider spend was
incurred during verification. Security and performance advisors report no
critical finding for the D5 objects; expected informational notices remain
for private tables without browser policies and not-yet-used indexes.

### D6 — Add review and canonical promotion

Scope:

- implement independent source-fetch checks and editorial review states;
- resolve aliases/cast relations and promote accepted candidates into
  canonical drafts;
- reuse the existing evidence, rights, correction, and publication gates;
- expose no private provider artifact in public reads.

Checks:

- mismatched target, circular source, unsupported exact reference, unlicensed
  image, and unresolved contradiction cannot publish;
- actor/character and public/screen claims remain separate;
- publication needs accepted evidence and a rights decision;
- catalogue linking accepts only an already reviewed exact variant.

Exit: golden promotion tests, rolled-back live rejection/acceptance proof,
advisors, and `npm run check` pass.

#### D6 implementation record

The review boundary is server-only at
`/internal/discovery-research/review`, with a separate reviewer secret and
Supabase service credential. It fetches each candidate source independently
over HTTPS with redirect-following disabled, rejects application/private
targets, caps response bytes, and records only fetch status, timestamp, and a
SHA-256 content hash. Source bodies and provider prose are never copied into
public records.

Migrations `0051`–`0059` add source-fetch state, reviewer metadata, preserved
structured work fields, and service-role-only review/promotion RPCs. Accepted
candidates create canonical entities, works, aliases, claim-level sources and
evidence as drafts; actor/public-figure and character/screen claims remain
separate. A reviewed cast-credit RPC validates the two entity kinds and the
work independently, without implying watch ownership or screen wear.

Publication is a second, atomic transition. It requires independently verified
supporting sources, a reviewed exact catalogue variant with matching reference
evidence, an explicit image-rights decision, an exact-reference claim, no
target mismatch/ambiguity/insufficient-evidence flag, no unresolved
contradiction, and no possible custom prop. Canonical catalogue variants are
never created or accepted by this path. The existing publication trigger and
public projection remain the final gates.

Verification on 2026-09-02: source-fetch safety and promotion gates have
provider-free tests; the live Supabase rollback proof accepted a canonical
draft in a transaction and rejected a contradictory publication, leaving no
rows behind. Supabase security/performance advisors were rerun after the D6
DDL, and `npm run check` passed with 48 test files and 227 tests.

### D7 — Connect story context to the full diagnostic

Scope:

- add **Find my equivalent** on accepted attributions;
- pass a bounded signed-or-validated story-context identifier and optional
  archetype preferences;
- map reviewed attribution traits into soft score factors only;
- explain when the original watch fails the user's hard constraints.

Checks:

- budget, wrist, deployment, and technical inputs are re-asked;
- forged, unpublished, or stale context fails closed;
- recommendation output without context remains byte-for-byte or fixture-level
  equivalent to the existing baseline;
- context cannot bypass SQL hard filters or promote missing facts.

Exit: SQL/TypeScript parity, golden profiles, route tests, and `npm run check`
pass.

#### D7 implementation record

Accepted story pages now offer a `Find the right equivalent` handoff carrying
only the published story slug. The diagnostic validates the slug, preserves a
valid handoff through the subscriber-unlock redirect, resolves it through the
narrow published-story context RPC, and falls back only to the bundled
reviewed corpus when the public read is unavailable. Unknown, unpublished,
malformed, or stale context is rejected before evaluation.

The full diagnostic still asks for budget, wrist, deployment, movement/service,
accuracy, weight, complications, and date constraints. Accepted story traits
can add only low-priority social-signal and aesthetic score factors when the
user has not answered those optional questions. SQL hard-filter results,
missing-fact separation, and catalogue linking remain authoritative; context
cannot promote a rejected or verification-only reference. The result explains
whether an exact reviewed reference is absent, fails a hard constraint, or
meets it, without treating a family-only or unidentified claim as an exact
catalogue match.

Verification on 2026-09-02: the D7 context RPC was applied additively; golden
domain tests cover bounded slugs, soft-trait mapping, hard rejection, and the
no-context baseline; route tests cover the story CTA, forged context, unknown
context, and accepted context. The fast gate reached lint, strict typecheck,
50 test files and 238 tests, and the production build. The repository-wide
format check remains blocked by two separately added, owner-owned reviewed
JSON files; all tracked and D7-scoped files pass formatting, and those files
were not modified.

### D8 — Production funnel and operations verification

Scope:

- enable the bounded intake/worker only after production secrets, caps, and
  scheduler authentication are present;
- execute the full deferred browser/integration suite at the roadmap-approved
  stage;
- verify analytics privacy, queue recovery, correction flow, feature rollback,
  and production routes;
- update operator and session-handoff documentation.

Checks:

- all golden journeys work on production;
- duplicate demand does not duplicate provider spend;
- provider outage/recovery and stale lease recovery are demonstrated;
- logs contain no secrets, raw prompts with user input, status tokens, or
  personal data;
- production Supabase advisors and deployment logs are clean;
- archive and full quiz remain available if the research feature is disabled.

Exit: production evidence is recorded, rollback is rehearsed, and this
continuation can be marked complete without starting catalogue research or
commercial Phase 9.

## Golden scenario matrix

Every relevant packet extends, rather than replaces, these scenarios:

| Scenario | Required outcome |
| --- | --- |
| Archetype completed | Exactly two primary next-step choices appear. |
| Full-quiz branch | Only validated social/aesthetic preferences carry; hard constraints are asked normally. |
| `Mad Men` selected | Don Draper and Roger Sterling remain separate attributions. |
| `Don Draper` selected | Only character/work screen claims appear. |
| `Marlon Brando` selected | Screen roles and public-life claims appear in separate sections. |
| Ambiguous `Drive` search | User must choose the intended work/year; no silent match. |
| Synthetic unknown title | One privacy-safe research topic and opaque status URL are created. |
| Same unknown requested twice | Request count rises; no duplicate fresh provider cost is created. |
| Fan-only identification | Remains unverified and cannot publish as exact. |
| Conflicting exact references | Candidate remains disputed/review-pending until resolved or downgraded. |
| Custom production prop | Never represented as the ordinary retail watch. |
| Selected story watch fails budget/wrist | Normal hard-filter rejection applies; only a compliant equivalent may confirm. |
| Perplexity unavailable | Archive, archetype, accepted finder, and full quiz continue working. |

Pilot-specific fixtures should include at least:

- Don Draper's Omega Seamaster De Ville `166.020`;
- Roger Sterling's Tudor `7967`;
- Colonel Kurtz's Rolex GMT-Master `1675` in *Apocalypse Now*;
- Marlon Brando as a separate public figure from Colonel Kurtz;
- the three separate *Oppenheimer* character stories;
- the authenticated but unidentified *Community* prop.

## Definition of complete

This continuation is complete only when:

- the four-question quiz is preserved and offers the two owner-approved paths;
- accepted search handles works, public figures, and fictional characters
  without conflation;
- the 21 pilot stories have exact PostgreSQL/public-read parity with a safe
  fallback;
- an unknown topic can be saved without collecting identity data;
- Perplexity runs only server-side, asynchronously, within explicit cost and
  retry limits, and creates provisional research only;
- independent review and existing publication gates control every public fact;
- personal equivalents still obey all SQL hard filters and missing-data rules;
- no AI flow selects, researches, verifies, creates, or approves catalogue
  brands/models on the owner's behalf;
- fast checks, required integration/E2E checks, live migration checks,
  Supabase advisors, deployment logs, and rollback evidence pass.

Until then, the completed Phase 8 static pilot and current full diagnostic are
the production-safe fallback.
