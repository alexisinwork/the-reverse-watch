# Future Expansion Strategy

This document sequences commercial expansion after the core recommendation
engine and Phase 8's celebrity/cinema discovery product. It records hypotheses,
not revenue guarantees. Validate current partner terms, pricing, tax, consumer
law, privacy, and payment-provider requirements before each launch.

## Decision principle

Do not add a business line because it is fashionable or has a high nominal
margin. Add it only when it strengthens the user's purchase decision and has a
measurable, compliant operating path.

```text
Trusted free discovery
  -> deterministic personal recommendation
  -> cited market/education next step
  -> optional paid decision support or concierge service
  -> repeat engagement through editorial email
  -> later, isolated B2B product
```

## Phase 9 — Market links and affiliate validation

Goal: let a user investigate legitimate current offers for an exact reference
without presenting paid placement as neutral ranking.

Packets:

1. Research current affiliate/CPO programmes and jurisdictional disclosure
   requirements. Record terms, permitted promotional methods, attribution and
   payout mechanics, and any restrictions.
2. Design an outbound-offer schema: seller, exact variant, price snapshot,
   availability, retrieval time, geography, disclosure, and destination.
3. Put marketplace links after the cited recommendation, never inside the
   deterministic score. Clearly identify affiliate links.
4. Track clicks and confirmed conversions only where privacy and partner terms
   permit it. Separate organic from paid outcomes.

Exit: disclosures are visible, ranking is demonstrably independent of payout,
and offer claims have fresh evidence.

## Phase 10 — Buyer’s Due Diligence Dossier

Goal: test a small paid report for people considering a specific purchase.

The first dossier should cover a tightly bounded exact reference and include:

- reference and generation/configuration history;
- sourced price and market-data caveats;
- authenticity and condition checks with clear limits;
- service and ownership reality;
- known trade-offs, risks, and a citation register.

Packets:

1. Define scope, disclaimers, refund/support policy, and report template.
2. Build structured data inputs; do not fabricate price history, authentication
   advice, or service estimates where evidence is absent.
3. Add payment, entitlement, receipt, privacy, and support flows using a
   provider approved for the operating jurisdiction.
4. Pilot with a small set of highly researched references before automating
   generation.

Exit: purchasers receive a reproducible, cited report and the team can measure
conversion, refund rate, support load, and decision usefulness.

## Phase 11 — Private sourcing / concierge

Goal: offer paid human help for high-value, well-scoped purchases.

Preconditions:

- a written service definition and fee model;
- vetted dealer and service-partner criteria;
- conflicts-of-interest disclosure;
- clear limits: no authenticity guarantee or investment advice unless the
  service is separately qualified and insured to provide it;
- a secure enquiry workflow with minimal data collection.

Start with limited manual engagements, then standardise only proven tasks such
as shortlist review, offer comparison, and dealer introduction.

## Phase 12 — Newsletter sponsorships and retention

Goal: turn an opted-in, genuinely useful audience into a sustainable editorial
business without weakening trust.

Packets:

1. Segment newsletter content by research interests and recommendation intent,
   using consented first-party data only.
2. Define sponsor suitability, creative standards, rate card hypotheses, and
   explicit advertising labels.
3. Measure opens, clicks, unsubscribes, complaints, and subscriber retention;
   do not optimise solely for list size.
4. Keep sponsor influence entirely outside catalogue facts and ranking.

## Phase 13 — B2B white-label assessment

Goal: evaluate whether the deterministic recommendation engine can serve a
retailer without putting consumer data or catalogue authority at risk.

Do not begin implementation until discovery validates a real buyer, pricing,
support expectations, and data rights. If pursued, design it as a separate
tenant-aware product with:

- strict tenant and catalogue isolation;
- an auditable retailer catalogue ingestion/review path;
- configurable branding but non-negotiable provenance and disclosure rules;
- privacy/security review, usage limits, billing, and support boundaries.

## Shared measurement framework

Every expansion must report its own funnel:

| Product | Primary success signal | Guardrail |
| --- | --- | --- |
| Celebrity/cinema discovery | Qualified handoff to core quiz | Attribution accuracy and correction rate |
| Affiliate offers | Disclosed outbound offer engagement | Ranking independence and freshness |
| Paid dossier | Paid completion and decision usefulness | Refunds, support burden, citation completeness |
| Concierge | Qualified paid enquiries | Conflict disclosure and delivery quality |
| Sponsorship | Retained, engaged opted-in audience | Unsubscribes and editorial independence |
| B2B | Contracted recurring revenue | Tenant isolation and support load |

## Stop conditions

Pause or roll back an expansion when it causes unsupported claims, undisclosed
commercial influence, hard-filter violations, unacceptable support burden,
privacy/security issues, or a measurable decline in audience trust.
