# Phase 8 discovery funnel evaluation

Last reviewed: 2026-08-31

## Decision being tested

The discovery archive and editorial archetype should earn qualified traffic for
the deterministic diagnostic without weakening attribution standards or hard
filters. Traffic alone is not success.

## Aggregate event contract

The application records only these allowlisted events:

| Event | Allowed dimension | Meaning |
| --- | --- | --- |
| `page_view` | surface | A discovery index, entity, work, story, or archetype view |
| `archetype_start` | none | First answer interaction |
| `archetype_completion` | archetype ID | A valid result was rendered |
| `share` | archetype ID | Native share completed or the result URL was copied |
| `core_handoff` | archetype ID | The full-diagnostic link was used |
| `qualified_recommendation` | none | A discovery-attributed diagnostic returned a result |
| `opt_in` | none | A discovery-attributed user explicitly requested email |
| `outbound_market_click` | surface | Reserved for disclosed Phase 9 market links |

The store contains no questionnaire answers, result URLs, story slugs, email
addresses, IP addresses, user identifiers, request identifiers, or cross-session
identity. Consequently, event ratios are aggregate directional measures, not
user-level cohorts. Vercel pageview URLs remain stripped of query strings and
fragments by the existing analytics boundary.

Raw tables have RLS enabled and no browser grants. Writes and bounded 90-day
summaries use explicit, allowlisted RPCs. Invalid event/dimension combinations
are rejected in TypeScript and PostgreSQL.

## Denominators

- archetype completion = completions / starts;
- share rate = shares / completions;
- core handoff = handoffs / completions;
- qualified recommendation conversion = qualified recommendations / handoffs;
- opt-in rate = opt-ins / qualified recommendations;
- research correction rate = corrections opened / published claims, reviewed
  separately from product traffic.

A zero denominator is reported as an insufficient sample, never as 0%.

## Retain, revise, or stop

Do not make a product decision before at least 200 eligible discovery page
views and 30 archetype completions within a rolling 90-day window. Automated
traffic and internal verification requests are excluded when traffic tooling
can identify them; the aggregate store itself does not fingerprint visitors.

Retain and expand only when all of the following hold:

- published claims still have accepted evidence and an image-rights decision;
- hard-filter violations remain zero;
- at least 25% of completed archetypes hand off to the core diagnostic;
- at least 30% of those handoffs produce a qualified recommendation;
- the correction queue meets the response schedule in the operations protocol.

Revise the questions, placement, or handoff when research quality remains
intact but either conversion threshold misses after the minimum sample. Stop
promotion and review the feature immediately if unsupported claims publish,
image-rights status is missing, a hard filter is bypassed, or correction work
falls outside its service level. No threshold authorizes looser evidence.

The no-index `/evaluation` dashboard reports the trailing 30-day aggregate.
Monthly editorial review records the 30- and 90-day values plus a written
retain/revise/stop decision; low-volume windows remain explicitly inconclusive.
