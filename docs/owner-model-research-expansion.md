# Owner model research expansion

Status: **approved planning scope; research not yet executed**

Source snapshot: **2026-08-31**

Worker model: **GPT-5.6 Luna**

Research provider/model: **Perplexity `sonar-pro`**

This document turns the four owner-supplied knowledge-base files into an
exhaustive, resumable research programme. It is a plan and intake contract, not
evidence that any listed family, model, reference, price, or specification is
correct. PostgreSQL remains the accepted-fact authority and materially and
dimensionally homogeneous exact reference variants remain the filtering and
ranking unit.

The worker/model separation is deliberate. OpenAI's current
[Codex model guidance](https://learn.chatgpt.com/docs/models#choosing-sol-terra-and-luna)
positions Luna for clear, repeatable extraction, classification, transformation,
and structured-summary work. Luna may therefore orchestrate this bounded
programme, but it is not a factual source and must not approve its own or Sonar's
claims without source review.

## Objective and boundaries

Every brand row and every listed model expression must receive a traceable
disposition:

```text
source expression
  -> canonical brand and verbatim expression ledger
  -> one or more atomic model/size/material/generation targets
  -> one exact homogeneous reference candidate per atomic target
  -> one Sonar Pro extraction per exact target
  -> independent field-level source review
  -> needs_more_evidence | ready_for_migration | excluded
  -> optional additive catalogue migration only after M1 completion
```

The programme must not:

- treat the list copy as a verified catalogue;
- treat a family, collection, or brand rollup as a reference fact;
- choose plausible defaults for omitted values;
- merge sizes, materials, dial configurations, movements, attachments,
  production states, or price markets;
- accept a citation merely because Sonar returned it;
- let M2 prose repair a missing M1 fact;
- write provider output directly into PostgreSQL; or
- reorder the controlling application-roadmap sequence. This is a prepared
  owner-managed catalogue workstream that may run when the owner explicitly
  starts its execution.

## Immutable source ledger

The four files were read in full. Preserve their bytes and record any future
change as a new source snapshot rather than silently changing the meaning of an
existing target.

| Source | Role | SHA-256 | Brand rows | Top-level model expressions |
| --- | --- | --- | ---: | ---: |
| `data/knowledge base/My Own brand-Model research.txt` | Required field and evidence template | `45bf1af2b2d31847f19033eff11bbd7c19dd4a9b751bf23e0f8c434ff438e563` | — | — |
| `data/knowledge base/top-15 brands.txt` | First research wave | `8f5f247c47e7696144d544bb16387cc08690fb217cc464e4f9e3ba644d3cc005` | 15 | 120 |
| `data/knowledge base/other brands.txt` | Second research wave | `aabe45843630ab45d9c164fe2ed3de9fce7d1ac0fccd2de370d90fcbcc87cb5b` | 45 | 869 |
| `data/knowledge base/last 100 brands.txt` | Third research wave; the filename is historical | `827c52e2649c350d253dd2d773a2816d339ec2bfff896c330d29da90114ee5e9` | 160 | 797 |
| **Total list intake** |  |  | **220** | **1,786** |

The 1,786 count is a lower bound, not a promised exact-reference count. Of
those expressions, 234 contain slash alternatives and 471 contain parentheses.
Many encode several sizes, references, materials, complications, or historical
generations. They must be atomized before provider work.

An exact normalized-name comparison currently matches 137 of the 220 source
brand rows to the 204-brand manifest and leaves 83 for canonical resolution.
That unresolved set includes both harmless aliases and genuinely new brands.
Do not report a final union count until aliases such as `Sinn Spezialuhren` /
`Sinn`, `Casio` / `Casio / G-Shock`, and `BOLDR (Boldr Supply Co.)` / `BOLDR
Supply Co.` have been reviewed. A source row may map to more than one canonical
brand when ownership, service, and reference namespaces differ; `Orient /
Orient Star` and `Poljot / Sturmanskie` require an explicit decision rather than
automatic punctuation-based merging.

## Packet R0 — make the intake lossless

No bulk Sonar calls may start until R0 passes. The current research contract
version 7 covers the principal M1 recommendation fields but cannot retain the
entire owner template. R0 must extend the TypeScript/Zod contracts and artifact
format before paid extraction.

### R0.1 Source-expression index

Create a schema-validated intake artifact with one row per top-level expression:

- source file SHA-256, source line, source ordinal, and verbatim brand/model
  text;
- canonical brand slug, canonical display name, and retained aliases;
- stable expression ID independent of later reference selection;
- parse state: `unreviewed`, `atomized`, `needs_clarification`, or `excluded`;
- all atomic target IDs produced by that expression; and
- an explicit exclusion reason when an expression is not a wristwatch model or
  cannot be researched safely.

The audit must prove:

- 220/220 brand rows mapped;
- 1,786/1,786 top-level expressions mapped;
- zero duplicate source coordinates;
- zero unmapped tokens after reviewed atomization; and
- every atomic target maps back to exactly one source expression while one
  expression may legitimately produce several targets.

### R0.2 Atomization rules

Apply these rules manually or through a deterministic parser followed by human
review:

1. A top-level comma separates expressions; commas inside parentheses do not.
2. Explicit slash alternatives, dimensions, reference codes, material options,
   movements, or named editions become separate atomic targets when any choice
   can change dimensions, movement, weight, attachment, production state, or
   commercial behavior.
3. An alias such as `Mako / Kamasu` becomes separate model targets. A phrase
   such as `manual / automatic` becomes separate movement targets. A phrase
   such as `36 / 40 mm` becomes separate size targets.
4. An expression containing several exact references produces one target per
   reference. Do not ask Sonar to pick whichever one is easiest.
5. A bare family or collection becomes an identity-resolution target. It cannot
   enter research as an accepted exact reference.
6. Current, limited, discontinued, and vintage examples remain separate. When
   the source explicitly names historical and current versions, research both.
7. Dial color is split only when it changes the reference code, availability,
   price, material, lume, or another recommendation fact. Otherwise select one
   named configuration and retain the exact dial identity.
8. Bracelet and strap configurations are split whenever price or full weight
   changes. Accessory straps do not change the supplied factory configuration.
9. Non-wristwatch entries, including clocks, remain in the ledger but receive a
   reviewed scope disposition before any call.
10. Russian/Cyrillic and accented names retain the owner spelling alongside an
    ASCII slug; transliteration never overwrites the source label.

### R0.3 Research-contract expansion

Contract version 8 must preserve every field in the owner's `Exact Watch
Variant Research Record`. Existing typed facts should be reused; missing
families require explicit typed additions rather than a generic prose blob.

| Owner template group | Required contract work before bulk research |
| --- | --- |
| Identity | Add country of manufacture and exact configuration components; retain production years separately from status. |
| Case and wearability | Add case shape, bezel/crystal materials, crystal profile, head-only weight, clasp type, and evidence-backed shock/antimagnetic values. Preserve non-round width/length and reviewed `not_applicable` states. |
| Movement and timekeeping | Add movement manufacturer, in-house classification, jewels, frequency, accuracy basis, battery type/life, solar reserve, service interval, service network, parts availability, and service risk. |
| Functions and operation | Keep normalized complications and date state; add date position, lume material plus observed-performance evidence, bezel type, and bezel function. |
| Materials and comfort | Add clasp material, supplied extra attachment, strap-change method, fit/comfort observations, and wearability limits. Nickel/contact risk remains evidence-backed and nullable. |
| Commercial facts | Add dated secondary price range, momentum, liquidity, sale-time range, dealer spread, purchase geography, and service geography. Keep retail and secondary data separate by condition/channel/market. |
| Brand and editorial context | Add sourced founding/continuity/ownership, movement-sourcing policy, service reality, historical/design context, social signal, buyer archetypes, collector reception, narrative risks, best use, trade-offs, and “who should not buy.” Store brand claims once and reference them; never score them as variant facts. |
| Completeness and evidence | Preserve M0/M1/M2, conflicts, rejected claims, researcher/reviewer, per-field observed/retrieved/verified/stale times, exact-reference applicability, and reviewer notes. |

For conditional facts such as battery life, lug width on a central-lug case, or
lume on an unlumed dress watch, the contract must distinguish `not_applicable`
from unknown. Absence from a page is not proof of `none`.

R0 exits only when an intake fixture representing round, rectangular,
integrated-bracelet, quartz/solar, high-complication, current, and historical
watches survives parse, normalization, artifact round-trip, and review without
losing any owner-template field.

## Research packet for every atomic target

Each exact target receives one dedicated Sonar Pro request through the existing
resumable worker. Do not combine models in one prompt. The request asks for all
applicable version-8 fields, but the output remains provisional.

### A. Identity lock

- Resolve brand, collection, model, exact reference/SKU, configuration,
  production state/years, country, and the strongest stable exact-product URL.
- For a live model, prefer a current manufacturer page. For discontinued or
  vintage models, use a manufacturer archive/catalogue/manual first, then a
  reputable exact-reference archive when the primary page no longer exists.
- If one source expression expands to several exact references, return to R0
  and create separate targets; never merge their facts.

### B. M1 decision facts

Resolve or explicitly leave null every approval-critical field:

- current price, currency, market, condition, channel, availability, and dated
  FX path where needed;
- round diameter or non-round width and length, thickness, lug-to-lug,
  conventional lug width/applicability, curvature, integrated status, and full
  configured weight;
- movement type, calibre, power reserve, normalized published accuracy and
  period;
- water resistance, crown type/position, crystal, evidence-backed lume grade,
  attachment type, clasp adjustment, shock and nickel/contact facts;
- complications and explicit date/no-date state; and
- production/condition plus purchase and service geography.

Missing M1 facts remain in `missingM1Fields`. The target cannot become
`ready_for_migration` while that array is non-empty.

### C. Operational and commercial enrichment

Research the remaining template facts, including service interval/network,
parts risk, battery/solar details, material interfaces, comfort limits, exact
market range, secondary-to-retail ratio, momentum, hype/speculation, liquidity,
sale time, and spread. Mutable claims need observed and stale-after dates.

### D. M2 brand/editorial dossier

Research brand history, discontinuities/revivals, present ownership, movement
sourcing, service reality, design origin, perception, buyer archetypes, social
signal, narrative myths, best use, trade-offs, and who should not buy. Brand
facts are researched once per canonical brand and reused only as brand context.
Reference-specific reception and trade-offs remain on the exact target.

Editorial classifications are structured reviewed judgments backed by cited
claims. Sonar prose is an input, not publishable copy. Avoid unsupported labels
such as “iconic,” “timeless,” “legendary,” or “investment.”

### E. Evidence and conflict register

For every non-null factual claim retain:

- exact field name and normalized value;
- source title, URL, source type, and exact-reference applicability;
- observed, retrieved, verified, and stale-after timestamps where applicable;
- provisional/verified/rejected state;
- configuration and measurement notes; and
- any contradictory value with a reasoned review decision.

## Source hierarchy and review independence

Use sources in this order:

1. manufacturer exact-product page, technical sheet, catalogue, and manual;
2. manufacturer corporate, service, warranty, and ownership material;
3. regulator, trademark/company registry, certification body, or central bank;
4. authorized dealer for a clearly identified market/configuration when the
   manufacturer does not publish that commercial fact;
5. exact-reference independent measurement or controlled test for weight, fit,
   lume, accuracy, or interface facts absent from primary material;
6. reviewed market sources for secondary price, liquidity, spread, and
   availability only; and
7. reputable editorial/academic/archival sources for reception and history.

Forums, owner posts, auction descriptions, marketplace listings, snippets, and
AI summaries are leads. They do not alone establish manufacturer
specifications. Two pages repeating the same press copy are one evidence
origin, not independent corroboration.

After Sonar succeeds, Luna must fetch the cited source independently, confirm
the exact reference and configuration, and review each field. A blocked source
is recorded `fetch_blocked`; it is not validated. Luna may create a committed
review artifact, but acceptance still follows the existing review schema and
owner-directed recommendation boundary.

## Execution waves and batch policy

Preserve source order within each wave. This gives a deterministic restart
point and ensures that every owner's interest is represented.

| Wave | Input | Minimum expression scope | Exit evidence |
| --- | --- | ---: | --- |
| R0 | All four files | 220 brands / 1,786 expressions indexed and atomized | Contract v8, intake audit, zero unmapped expressions |
| R1 | `top-15 brands.txt` | 15 brands / 120 expressions before atomization | Every atomic target has a review disposition; brand dossiers reviewed |
| R2 | `other brands.txt` | 45 brands / 869 expressions before atomization | Same gate; resume from exact source ordinal |
| R3 | `last 100 brands.txt` | 160 brands / 797 expressions before atomization | Same gate; filename does not cap the wave at 100 brands |
| R4 | Cross-wave closeout | All atomized targets | Alias/dedup audit, zero omissions, gap register, coverage report, cost report |

Operational batch size is **10 atomic targets**, with the provider worker's
default concurrency of **1**. A batch may be smaller at a brand boundary. Each
batch follows this sequence:

1. sync reviewed atomic targets into the manifest;
2. run strict manifest and provider-free dry-run checks;
3. call `sonar-pro` once for each selected target, preserving retries and
   fingerprint reuse;
4. validate JSON/Zod output and retain raw/normalized/job artifacts in their
   ignored audit paths;
5. independently fetch and review citations field by field;
6. commit review artifacts and a batch summary with spend, successes, failures,
   unresolved M1 facts, and exclusions;
7. promote only M1-complete exact variants through a separate additive
   migration batch; and
8. rerun coverage, catalogue parity, and the allowed repository gate.

Do not use a single Luna conversation as the only state store. The source
ordinal, manifest state, jobs, reviews, and batch report are the restart state.

## Luna operating contract

Use exact model identifier `gpt-5.6-luna`. Medium reasoning is the default for
atomization, structured extraction orchestration, and routine source checks.
Escalate a target to high reasoning or a separate senior review only for
conflicting identities, materially different configurations, unclear corporate
continuity, or an approval decision with unresolved evidence—not simply because
the brand is expensive or obscure.

For each batch Luna must:

- read `AGENTS.md`, all of `docs/original_context.md`, this plan, the research
  pipeline, and the current handoff before acting;
- preserve all unrelated dirty-worktree changes;
- never print keys or provider credentials;
- use the repository worker with explicit target IDs and `--model=sonar-pro`;
- keep provider facts provisional;
- never infer missing values or convert marketing language into performance;
- stop a target at `needs_more_evidence` without stopping the whole wave;
- record provider usage/cost and exact retrieval dates; and
- commit/push only verified batch artifacts and additive changes to `main`.

The batch command shape is:

```bash
npm run audit:research -- --strict
npm run research -- --dry-run --target=<target-id> --model=sonar-pro
npm run research -- --target=<target-id> --model=sonar-pro
npm run audit:research -- --strict
npm run audit:knowledge
npm run project:seed-coverage
npm run audit:coverage
npm run audit:catalogue-parity
npm run check
```

Repeat `--target` for the ten reviewed target IDs when the worker supports the
batch in one invocation. `audit:catalogue-parity` is required only after an
accepted catalogue change and requires the configured public Supabase values.
Do not run Playwright or install browsers for this owner-managed research
workstream unless the controlling roadmap explicitly reaches an integration
verification packet or the owner asks.

## Approval outcomes and definition of done

An atomic target is complete only when it has one of these durable outcomes:

- `ready_for_migration`: exact homogeneous identity, zero M1 gaps, every
  accepted fact independently reviewed, conflicts resolved, and additive
  migration input ready;
- `needs_more_evidence`: candidate and sources retained with explicit M1/M2
  gaps; it remains ineligible for confirmed ranking;
- `excluded`: duplicate exact target, outside wristwatch scope, unverifiable
  identity, fabricated/nonexistent source expression, or another recorded
  evidence-backed reason; or
- `owner_approved_for_recommendation`: only under the existing explicit owner
  direction and review contract; it must not erase gaps or rejected claims.

The full programme is complete when:

- all 220 source brand rows and all 1,786 seed expressions pass the mapping
  audit;
- every reviewed atomic target has a committed disposition and no source leaf
  is silently dropped;
- every canonical brand has a sourced dossier or an exclusion record;
- every non-null accepted factual claim has field evidence and staleness policy;
- every accepted reference is materially homogeneous and linked to the
  canonical catalogue variant;
- the final report separates raw counts, exact-reference counts, M1-complete
  counts, research-only counts, exclusions, provider failures, and spend;
- coverage and recommendation eligibility are reported independently of brand
  prestige or total count; and
- all required audits and `npm run check` pass on the committed state.

## Ready-to-use Luna handoff

Use the following as the execution brief after R0 is implemented and the owner
starts research:

> Continue the owner model expansion from
> `docs/owner-model-research-expansion.md`. Use GPT-5.6 Luna as the worker and
> the existing Perplexity worker with `sonar-pro`, one request per reviewed
> atomic target and concurrency 1. Resume from the first source expression
> without a durable disposition, process at most 10 atomic targets, validate
> every cited field independently, keep missing facts null, and do not promote
> a family or incomplete variant. Record batch spend and outcomes, run the
> documented non-browser gates, then commit and push only the verified batch.
