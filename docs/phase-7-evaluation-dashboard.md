# Phase 7 evaluation dashboard

Vercel Web Analytics is the production dashboard for the quiz funnel. It is
fed by the privacy-redacted pageview component and by the following custom
events. Query parameters and fragments are removed from pageview URLs before
collection. Profile answers and email addresses are never custom-event
properties.

## Event contract

| Event | Emission point | Dashboard dimensions |
| --- | --- | --- |
| `quiz_started` | First forward action in a diagnostic | `questionnaireVersion` |
| `quiz_restarted` | Explicit restart control | `questionnaireVersion` |
| `quiz_evaluation` | Server-accepted core or refinement result without an email request | `intent`, `catalogueOrigin`, recommendation/verification/why-not counts, hard-filter violation count, duration, provider cost, top score, and mean confirmed score |
| `quiz_subscription` | Server-accepted email request | `intent`, `catalogueOrigin`, and `status` |

The server also retains the validated `quiz_evaluation` and
`quiz_subscription` aggregates as `quiz_funnel` JSON runtime logs. Those logs
are the fallback audit surface; the Web Analytics events are the durable
dashboard surface.

## Dashboard panels and calculations

- Completion: count `quiz_evaluation` where `intent = core`, divided by
  `quiz_started`. Do not publish the rate until both counts cover the same
  reporting window and the denominator is large enough to be useful.
- Refinement use: count `quiz_evaluation` where `intent = refine`, divided by
  core evaluations in the same window.
- Hard-filter validity: filter `quiz_evaluation` by
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
- Subscription conversion: count `quiz_subscription` by `status`; compare
  requests and successful outcomes (`sent`, `partial`, or
  `already_requested`) with core evaluations over the same window.

The dashboard must not be used to infer conversion, quotas, or retention from
an empty or trivial sample. Any published observation records the exact UTC
window and event counts.
