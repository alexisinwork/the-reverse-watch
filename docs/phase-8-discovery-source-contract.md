# Phase 8 discovery source and publication contract

Last verified: 2026-08-31

This contract governs public-figure and fictional-character watch claims. It
does not research, accept, or modify recommendation-catalogue variants.

## Separate claims, separate evidence

`owned`, `worn_publicly`, `screen_worn`, `reported`, and `unconfirmed` are
different assertions. Evidence for one cannot silently establish another:

- a public appearance can establish `worn_publicly`, not private ownership;
- a production record or identifiable scene can establish `screen_worn`, not
  the actor's private ownership;
- reporting that repeats another source remains `reported` until the underlying
  claim is independently reviewed;
- unresolved visual resemblance remains `unconfirmed`.

Every attribution names either a work or an event, never both. A screen-worn
claim requires a work. Scene, episode, event, and observation dates remain
nullable when the source does not establish them; plausible defaults are
forbidden.

## Identification precision and public labels

The stored precision and public confidence label are explicit:

| Stored precision | Public label | Meaning |
| --- | --- | --- |
| `exact_reference` | **Confirmed identification** | An exact reference code or an already reviewed catalogue-variant link is supported. |
| `model_family` or `brand_only` | **Model family only** | Evidence supports a bounded identity but not an exact reference. |
| any supported precision with unresolved contradiction | **Disputed identification** | Credible sources conflict and an open correction record explains the dispute. |
| `unidentified` or insufficient evidence | **Unconfirmed identification** | No more precise claim is publishable. |

“Confirmed” is not a general confidence adjective. It requires
`exact_reference`; a model-family, brand-only, or unconfirmed record cannot use
that label. An optional `reference_variant_id` may point only to an existing,
reviewed exact catalogue variant. It never accepts a discovery record into the
catalogue or changes recommendation eligibility.

## Source registry and evidence

Every evidence row references the canonical `sources` registry, preserving its
URL, source type, publication time when known, retrieval time, archive URL when
available, and immutable retrieval identity. Claim evidence adds:

- stance: `supports`, `contradicts`, or `context`;
- role: official production record, direct interview, primary visual,
  contemporaneous reporting, specialist corroboration, or other;
- precise locator such as a page, inventory identifier, episode, or timestamp;
- observation time when known, review status, review time, and a concise
  editorial note.

Quoted excerpts are optional and must remain short enough for the editorial
need and source licence. A URL without a reviewed supporting evidence row does
not support publication.

Packet 8.2 will rank official production/prop records and direct interviews
first, contemporaneous reporting next, and specialist sources as
corroboration. Social posts, fan claims, search snippets, and unlicensed image
libraries are not bulk-ingestion sources.

## Publication gate

An attribution is publishable only when all of the following are true:

1. its review status is `accepted` and it has a publication timestamp;
2. at least one related evidence row is accepted, reviewed, and supports the
   claim;
3. an image-rights decision exists, including the valid text-only decision
   `no_image_stored`;
4. confirmed claims retain exact-reference precision and an exact reference
   code or reviewed catalogue link;
5. disputed claims retain an open correction record.

PostgreSQL enforces the cross-row publication gate when `published_at` is set;
the shared Zod publication schema repeats the same rules before application
data can render. Tests specifically reject an unsupported confirmed claim.

## Images, corrections, and withdrawal

No image is assumed reusable because it is publicly visible. Each attribution
records one of: no image stored, licensed asset, owner-created asset, public
domain asset, or cleared external embed. Any used asset requires a URL, a
rights basis, and a review time. Licence, rights-holder, credit, and expiry data
remain explicit rather than inferred.

Corrections retain the affected attribution, optional source, opened time,
status, public note, and resolution. A dispute remains visible while open.
Withdrawn claims are not published and are retained for audit rather than
destructively deleted.

## Database access boundary

Migrations `0034_add_discovery_claims.sql` and
`0035_harden_discovery_trigger_grants.sql` create additive discovery tables in
`public`, enable RLS on every table, revoke browser table and sequence
privileges, and remove inherited browser execution from the invoker trigger.
Packet 8.1 exposes no public read or write API. Later explorer pages must use a
narrow published-claim contract rather than granting raw evidence or
editorial-write access. This follows Supabase's current requirement to enable
RLS explicitly for SQL-created tables in exposed schemas and to grant only the
roles that need access
([Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security),
retrieved 2026-08-31).
