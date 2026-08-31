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
data/research/reviewed/<target-id>.json  # reviewer decision and migration link
data/research/jobs/<job-id>.json         # mutable job state and artifact pointers
```

Raw and normalized artifacts may contain copyrighted source extracts or paid
provider output and are excluded from git by default. Accepted structured facts
enter PostgreSQL only through a reviewed additive migration. Extraction never
writes `accepted` status directly.

## Owner handoff

Brand/model selection and source verification are owner-managed. Before
promoting any owner-supplied record, keep the exact variant homogeneous and run:

```bash
npm run audit:knowledge
npm run audit:research -- --strict
npm run project:seed-coverage
npm run audit:coverage
npm run audit:catalogue-parity
npm run check
```

The live parity command requires the configured public Supabase URL and
publishable key. A failed or incomplete fact remains provisional or `null`; it
must not be converted into a plausible default to make the checks pass.

## Rolex workbook intake

`rolex-workbook-intake.json` is the immutable, SHA-256-linked mapping from the
owner's 34-row workbook to 35 exact-reference targets. The Explorer 36 source
row is intentionally split into steel and Rolesor material variants.

```bash
npm run research:sync-intake -- data/research/rolex-workbook-intake.json
npm run research -- --target=<target-id> --model=sonar-pro
npm run research:review-rolex-intake
npm run research:export-rolex-workbook -- <source.xlsx> <extended.xlsx>
```

The initial review command never overwrites an existing review artifact. The
export keeps provider facts visible, overlays independently verified
corrections, and adds those corrections as separate field-evidence rows. The
original workbook remains untouched.
