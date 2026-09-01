# Phase 8 editorial operations

Last reviewed: 2026-08-31

## Refresh schedule

| Record | Routine review | Immediate review trigger |
| --- | --- | --- |
| Confirmed exact-reference attribution | Every 180 days | Correction, source conflict, or withdrawn source |
| Model-family-only or disputed attribution | Every 90 days | New primary evidence or credible contradiction |
| Unconfirmed attribution | Every 90 days | Identification claim or production-record release |
| Public appearance or mutable event context | Every 90 days | Material new reporting |
| Source availability and retrieval metadata | Monthly automated/manual link check | Redirect to unrelated content, paywall change, or dead URL |
| Image-rights decision | At every asset or licence change | Takedown, expiry, or rights-holder request |

The initial pilot is text-only, so its image-rights review remains an explicit
`none_stored` decision rather than an omitted field.

## Monthly editorial review

1. Inspect every due or stale record and every open correction.
2. Reopen the highest-ranked available source; do not silently replace a
   primary source with weaker corroboration.
3. Re-run publication validation after any evidence, precision, confidence,
   image-rights, or correction change.
4. Verify that exact catalogue links still target a reviewed homogeneous
   reference variant. Missing or stale catalogue facts cannot satisfy a hard
   filter.
5. Record retrieval time, reviewer, disposition, and conflicting evidence.
6. Review the 30- and 90-day funnel contract without using traffic to upgrade
   attribution confidence.

## Correction service levels

- Acknowledge a credible correction within two working days.
- Hide or downgrade a materially unsafe claim immediately while it is reviewed.
- Resolve, publish a correction note, or document why evidence remains
  inconclusive within ten working days.
- Preserve the correction history; do not rewrite a disputed record as though
  the earlier publication did not exist.

Only accepted evidence can restore a withdrawn or downgraded claim. Social
posts, fan databases, and search snippets remain leads, not publication proof.

## Roles and release gate

The owner may perform the underlying brand/model research separately. The
editorial release gate is unchanged: a reviewer confirms source rank, claim
scope, precision, image rights, and correction state before publication. The
product funnel never promotes a discovery attribution into the recommendation
catalogue.

Phase 9 outbound market links remain dormant until commercial disclosure,
availability/staleness, and affiliate-boundary contracts are approved. The
allowlisted aggregate event exists now so later links do not need to expand the
privacy schema.
