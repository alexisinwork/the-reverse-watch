# Research workspace contract

`brand-manifest.json` is a planning queue, not a source of accepted watch facts.
Coverage intents describe which catalogue gaps a target is meant to investigate;
they do not claim that a not-yet-reviewed reference satisfies those axes.

The manifest contains the complete 200-dossier owner knowledge pack plus one
existing roadmap brand and the first coverage-priority research tranche. A
knowledge-dossier link is M0/M2 intake context only: it does not make a family
or variant eligible for recommendations. New research targets are added only
with a stated coverage or original-plan purpose. Raw brand count is not a
success metric.

Future job artifacts use these paths:

```text
data/research/raw/<job-id>.json          # immutable provider/manual capture
data/research/normalized/<job-id>.json   # Zod-validated provisional facts
data/research/reviewed/<job-id>.json     # reviewer decision and migration link
data/research/jobs/<job-id>.json         # mutable job state and artifact pointers
```

Raw and normalized artifacts may contain copyrighted source extracts or paid
provider output and are excluded from git by default. Accepted structured facts
enter PostgreSQL only through a reviewed additive migration. Extraction never
writes `accepted` status directly.
