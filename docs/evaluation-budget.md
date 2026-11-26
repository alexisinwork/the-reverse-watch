# Evaluation budget

Owner question, 2026-11-26: what budget is needed to really verify that the
four tools (diagnostic quiz, archetype quiz, cheaper alternatives, film and
people search) give honest and relevant watches. Every number below comes from
the production ledger or catalogue on 2026-11-26; the queries are in the
session record and can be rerun read-only.

## Already proven at no cost

`scripts/run-evals.ts` (no paid call, writes refused) shows on 2026-11-26:

- Diagnostic quiz: 0 of 263 exact cards break a hard rule (price, diameter,
  movement, water resistance).
- Film search: 0 invented confirmed sightings, including two invented
  subjects; the owner's 20 published stories are all found as confirmed.
- Film search on the independent set (`data/eval/film-labels-independent-2026-11-26.json`,
  19 sightings that are not owner stories): 0 of 19 confirmed, 6 of 19 shown
  only as possible, 13 not found because nothing was saved for them.

## What only paid calls can show

- Answers where the catalogue has fewer than ten fits: the quiz, archetype
  and alternatives tools then run paid discovery, which the free evaluation
  never starts.
- Film subjects with no saved research: 13 of the 19 independent labels.
- Whether a paid check confirms what it finds. Since 28 October, paid checks
  of film results published a confirmed result in 1 of 46 attempts (2%).
  Most of the rest were one saved search (Heat) retried 30 times; migration
  0121 now waits longer after each failure.

## Measured cost per paid check

| Paid checks (ledger) | Attempts | Average | Most expensive | Ceiling per attempt |
| --- | ---: | ---: | ---: | ---: |
| Film searches | 46 | $0.0148 | $0.0557 | $0.20 (8 cards × $0.025) |
| Quiz, selection and price rechecks | 20 | $0.0154 | $0.0353 | $0.20 |

A Perplexity search request costs $0.005; the existing monthly limit for paid
checks is $100 (spent this month: $0.05).

## One honest verification round

Each tool runs a fixed, labelled set through the live path, with completion
rounds where results fall short of ten. "Expected" uses the average and the
most expensive attempt above; "ceiling" is the hard per-attempt limit, which
the ledger enforces before any provider request.

| Tool | Cases | Paid attempts at most | Expected | Ceiling |
| --- | --- | ---: | ---: | ---: |
| Diagnostic quiz | the 40 labelled answers, two completion rounds | 80 | $1.20–4.50 | $16.00 |
| Archetype quiz | all 24 archetype and budget combinations, two rounds | 48 | $0.70–2.70 | $9.60 |
| Cheaper alternatives | research the 14 test watches without comparison data, then 60 cases, two rounds | 134 | $2.00–7.50 | $26.80 |
| Film and people | the 17 independent searches | 17 | $0.25–0.95 | $3.40 |
| **Total** | | **279** | **$4–16** | **$56** |

**Recommendation: $60 for one round, $150 for three** (a baseline, a run
after fixes, a final run). One round fits inside the existing $100 monthly
limit; no limit change is needed.

The money is the small part. Relevance beyond hard rules ("is this a good
watch for this person?") needs a human judgment on a sample: about 300 cards
(10 quiz answers, 8 archetype results and 10 alternatives cases at ten cards
each, plus the film results), roughly 4–6 hours for the owner, or $250–600 for an
independent watch specialist at $50–100 an hour. A judgment model can only be
trusted after it agrees with those human ratings.

## Separate: completing the catalogue (improves results, not needed for the check)

Of the 25,014 watches searches can show, 15,901 (64%) lack styles, case
diameter or movement, which the alternatives finder needs to compare watches:

| Missing | Watches |
| --- | ---: |
| Styles | 15,741 |
| Water resistance | 11,562 |
| Movement | 3,725 |
| Reference not confirmed | 1,612 |
| Case diameter | 817 |
| Price | 124 |

Research through the existing enrichment worker at $0.005–0.02 a watch would
cost about $80–320 once. Missing facts stay empty until a source states them;
nothing is filled with plausible defaults.

## Round 1, measured (2026-11-26)

Approved: $60 ("Да, $60"). Spent: **$3.89**, including $0.20 still reserved
for one check at the end (the ledger counts it until it settles). Unused:
$56.11; nothing more is charged unless another round is approved.

| Tool | Estimate | Actual | Per case |
| --- | ---: | ---: | ---: |
| Diagnostic quiz | $1.20–4.50 | $0.04 | $0.001 (most answers come from the catalogue) |
| Archetype quiz | $0.70–2.70 | $1.76 | $0.07 |
| Cheaper alternatives | $2.00–7.50 | $1.98 | $0.08 per searched case (36 of 60 stopped before searching) |
| Film and people | $0.25–0.95 | $0.11 | $0.006 |
| **Total** | **$4–16** | **$3.89** | |

A repeat round after fixes costs about the same, around $4, and fits in the
unused part of this approval if the owner agrees. Results and findings:
`docs/eval-baseline.md`, "Live round with paid research".

## After the yes (done 2026-11-26)

1. The live mode is `scripts/run-evals-live.ts` (a separate script, so the
   free evaluation keeps its network guard): the sets above through the paid
   path, with the ledger read before every case and a hard stop at the
   approved amount.
2. The baseline round ran: four of five gates PASS, archetype rules FAIL on
   one card, $3.89 spent (above).
3. The rating sheet has 321 cards (10 quiz answers, 8 archetype results, 10
   alternatives cases, every film card): `docs/reports/rating-sheet-2026-11-26.json`,
   rated on the owner's rating page (`docs/OWNER_QUESTIONS.md`, item 1).

## Film and people tests (2026-11-26, from the same $60)

The owner asked to retrain film search on real articles and to test it on
5–10 queries and on the IMDb Top 250 films with their actors and characters,
putting relevance before cost. Each run stopped itself before its own limit
by reading the ledger before every search (`scripts/run-film-searches.ts`).

| Run | Spend |
| --- | ---: |
| Paid evaluation round (above) | $3.89 |
| 30 owner test queries | $0.86 |
| Four stuck searches retried | $0.05 |
| IMDb Top 250 films | $2.24 |
| 100 actors and characters | $3.05 |
| The 250 films again | $1.78 |
| 163 possible-only answers checked again | $3.99 |
| 86 actors and characters read again after the role fix | $2.30 |
| Diagnostics and the discovery comparison, outside the ledger | about $0.51 |
| **Total of the $60** | **about $18.67** |

Unused: about $41.33. The ledger read $17.02 spent for November afterwards
(plus $1.20 still reserved by open checks), within the $100 monthly limit.
The provider counters, which started on 2026-11-26, read Perplexity $3.95
and Muse $6.59, so about $10–11 of the owner's $15 Perplexity balance is
left. Results: `docs/eval-baseline.md`, "Film and people search on real
articles".

## The judge, prices and the catalogue pilot (2026-11-26, from the same $60)

The owner asked for a judge that decides alone, for everything flagged to be
fixed, and for proof that every tool answers well ("лучше потратить немного
больше и убедиться"). Each run below stopped itself before its own limit.

| Run | Spend |
| --- | ---: |
| Film and people tests (above) | $18.67 |
| Price recheck of the prices the owner flagged | $0.76 |
| Archetype round, 24 requests, two rounds (its own report: $0.38; the ledger moved $0.67 while it ran) | $0.67 |
| Judge probe, 3 cards | $0.13 |
| Judge calibration, Opus 5.5, 203 cards | $6.67 |
| Judge calibration, Gemini 4 Hydrogen, 186 cards | $5.15 |
| Catalogue repair step 1, pilot on 60 watches | $2.92 |
| Judge on the 80 archetype cards | $2.65 |
| **Total of the $60** | **about $37.62** |

Unused: about $22.38. The judge costs about $0.033 a card with web search;
the repair pilot about $0.049 a watch. Results: `docs/eval-baseline.md`,
"The judge and the catalogue's facts".
