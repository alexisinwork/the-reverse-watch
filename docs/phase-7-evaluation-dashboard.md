# Phase 7 evaluation dashboard

The production dashboard is available at `/evaluation`. Vercel Web Analytics
continues to supply privacy-redacted pageviews, but its custom-event API is not
available on this project's current plan. Durable funnel aggregates therefore
use the existing Supabase project instead of requiring a paid upgrade.

The raw `quiz_funnel_events` table has RLS enabled and no direct grants for
browser roles. Narrow functions accept validated aggregate events and return a
bounded trailing-window summary. Profile answers, email addresses, IP
addresses, and request identifiers are never columns or function parameters.

## Event contract

| Event | Emission point | Stored dimensions |
| --- | --- | --- |
| `start` | First forward action in a diagnostic | Timestamp only |
| `evaluation` | Server-accepted core or refinement result without an email request | `intent`, `catalogueOrigin`, recommendation/verification/why-not counts, hard-filter violation count, duration, provider cost, top score, and mean confirmed score |
| `subscription` | Server-accepted email request | `intent`, `catalogueOrigin`, and `status` |

The server also retains evaluation and subscription aggregates as
`quiz_funnel` JSON runtime logs. Those logs are the fallback audit surface;
Supabase is the durable dashboard surface.

## Dashboard panels and calculations

- Completion: count `evaluation` where `intent = core`, divided by `start`. Do
  not publish the rate until both counts cover the same
  reporting window and the denominator is large enough to be useful.
- Refinement use: count `evaluation` where `intent = refine`, divided by
  core evaluations in the same window.
- Hard-filter validity: filter `evaluation` by
  `hardFilterViolationCount`. The launch invariant is zero for every returned
  confirmed recommendation.
- Ranking operations: inspect `topRecommendationScore`,
  `meanRecommendationScore`, `recommendationCount`, `verificationCount`, and
  `whyNotCount` by catalogue origin. These are monitoring signals, not a claim
  of relevance quality. Ranking-quality acceptance still comes from the
  versioned deterministic evaluation fixtures and requires reviewed ground
  truth before a precision claim is possible.
- Latency and cost: aggregate `evaluationDurationMs` and `providerCostUsd` by
  intent and catalogue origin.
- Subscription conversion: count `subscription` by `status`; compare
  requests and successful outcomes (`sent`, `partial`, or
  `already_requested`) with core evaluations over the same window.

The dashboard must not be used to infer conversion, quotas, or retention from
an empty or trivial sample. Any published observation records the exact UTC
window and event counts.
