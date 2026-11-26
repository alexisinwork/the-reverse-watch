# Evaluation baseline

`node --env-file=.env --import tsx scripts/run-evals.ts` scores the real
search functions against labelled data, without paid calls or writes: a
network guard allows only read-only catalogue/cache functions, the published
stories read and the ECB rate feed. Any other host fails the run; writes the
code attempts (such as caching a completed answer) are refused and counted.
Reports: `docs/reports/eval-<date>.json`. Method: alexisinwork/ai_engineering
(AI_APP_ENGINEERING.md §4, PopChoice THEORY §7). The labelled sets are not
edited to make a run pass; a changed set gets a new baseline.

## Labelled sets

| Set | Source | Size |
| --- | --- | --- |
| Quiz answers | 40 seeded answers across budgets, currencies, wrists, styles, movements and water resistance; the oracle restates the questionnaire's hard rules (price after conversion, diameter range, movement type, water resistance) independently of the quiz code | 40 answers |
| Alternatives | The owner's test set, `data/alternatives/owner-test-set-2026-10-01.json` | 20 watches × 3 budgets = 60 cases |
| Film and people | The owner's published, source-reviewed stories, `data/eval/film-labels-2026-11-25.json`, plus one recorded correction as a negative (Skyfall Aqua Terra 231.10.30.20.06.001 is Eve's, not Daniel Craig's) | 20 positives, 1 negative |
| Film and people, independent | Sightings that are not owner stories, each from at least two opened sources, `data/eval/film-labels-independent-2026-11-26.json` (below) | 19 positives, 2 invented controls |

## Baseline (2026-11-25, before story sightings)

Report: `docs/reports/eval-baseline-2026-11-25.json`.

| Measure | Score | Random baseline |
| --- | --- | --- |
| Quiz exact cards breaking a hard rule | 0 of 263 (precision 100%) | 1.7% of random pool rows meet price and size |
| Quiz answers with at least one exact match | 30 of 40 | |
| Quiz close fits without a stated reason | 0 of 135 | |
| Alternatives: owner's pick in the top 10 | 7 of 60 (11.7%) | 2.0% |
| Alternatives: test-set watches resolved with comparison facts | 6 of 20 | |
| Film: labelled sighting shown as confirmed | 0 of 20 | about 1 in 25,000 per card |
| Film: labelled sighting shown at all (incl. possible) | 4 of 20 | |
| Film: forbidden negative shown as confirmed | 0 of 1 | |

## After story sightings (same day)

Report: `docs/reports/eval-2026-11-25.json`. Published stories now lead film
results as confirmed sightings (`film-story-sightings.ts`).

| Measure | Score |
| --- | --- |
| Film: labelled sighting shown as confirmed | 20 of 20 |
| Film: forbidden negative shown as confirmed | 0 of 1 |
| Quiz and alternatives | unchanged |

Read this film score honestly: the labels come from the same stories that now
feed the results, so 20 of 20 proves the owner's own reviewed facts reach the
search; it is not an independent measure of film-search quality. That needs
a labelled set of reviewed sightings that are not published stories.

## Independent film set (2026-11-26)

`data/eval/film-labels-independent-2026-11-26.json`: 19 sightings over 17
searches, none of them an owner story, each with at least two sources opened
and read on 2026-11-26 (makers, auction lots, independent publications),
plus two invented subjects as controls and five cases excluded with reasons.
It was committed (`e568a71`, SHA-256 `e6a60a06…4fb01`) before its first
score, and the site's film search had not been run on any of its subjects.
It awaits the owner's review; its review status says so.

Report: `docs/reports/eval-2026-11-26.json`, saved research only.

| Measure | Score |
| --- | --- |
| Labelled sighting shown as confirmed | 0 of 19 |
| Labelled sighting shown at all (only as possible) | 6 of 19: Le Mans and Steve McQueen (Monaco), Casino Royale (both Seamasters), Apocalypse Now (Seiko 6105), John F. Kennedy (OMEGA) |
| Not found: nothing saved for the subject | 13 of 19 |
| Confirmed card for an invented subject | 0 of 2 controls (gate) |
| Owner-story set, unchanged | 20 of 20 confirmed |

Read this honestly: without paid research the film search confirms only
what the owner's stories already say. Measuring what live research adds
needs paid calls (`docs/evaluation-budget.md`); on the evidence so far it
adds little, since paid checks of film results published 1 of 46 attempts.

## Live round with paid research (2026-11-26)

The owner approved $60 for one round ("Да, $60").
`node --env-file=.env --import tsx scripts/run-evals-live.ts --budget 60`
ran the same sets through the visitors' own search functions with paid
research on: 143 cases, then 9 reruns of answers that were short of ten or
failed, in 13 minutes. Before every case it read the spend ledger and would
have stopped before $60. A dry run with every provider request refused
reproduced the free scores first (263 exact quiz cards, film 0 / 6 / 13).
Report: `docs/reports/eval-live-2026-11-26.json`, with every card shown.

| Tool | Cases | Answered | Ten options | Hard-rule failures | Checked cards | Spend |
| --- | --- | --- | --- | --- | --- | --- |
| Diagnostic quiz | 40 answers | 40 | 39 | 0 of 263 exact cards | 394 of 398 (99%) | $0.04 |
| Archetype | 24 combinations | 24 | 24 | 1 (below) | 66 of 240 (28%) | $1.76 |
| Cheaper alternatives | 60 | 24 (8 of the 20 named watches) | 24 of 24 | 0 | 42 of 240 (18%) | $1.98 |
| Film and people | 17 searches, 2 invented controls | 13 | not required | 0 invented sightings | 1 of 41 | $0.11 |
| **Round** | | | | | | **$3.89 of $60** |

- Alternatives: the owner's suggested alternative is in the top ten in 10 of
  the 24 searched cases (42%); over all 60 cases 10 (17%), against 7 (12%)
  on the free path and 2% at random.
- Film, independent set: 0 of 19 confirmed, 15 of 19 found as possible
  (free path that morning: 6), 4 not found. The two invented subjects got
  nothing, neither confirmed nor possible. The only confirmed film card, a
  Rolex GMT-Master 1675 for Apocalypse Now, is correct (Colonel Kurtz) but
  is not one of the labels.
- The spend ledger went from 22 attempts (0 published) to 114 (32
  published, 81 failed, 1 still reserved at $0.20, counted above). Requests:
  420 to Perplexity, 391 to Muse Spark, 845 to the source pages themselves.
- Afterwards the free evaluation (`docs/reports/eval-2026-11-26-after-live.json`)
  is unchanged except film: what the paid research found is saved, so
  visitors now get 15 of 19 labelled sightings as possible at no cost.

Gates: within budget PASS; quiz hard rules PASS; alternatives rules PASS;
no invented sightings PASS; archetype rules FAIL (one card).

What the round found:

1. **Alternatives name resolution.** 11 of the 20 names resolve to a short
   imported record without comparison facts and stop at "comparison
   specifications are incomplete" ("Rolex Daytona" → 16519NG, "Patek
   Philippe Nautilus" → 3800, "Cartier Tank" → WGTA0074), although the
   catalogue holds complete records of the same models under their full
   names: Cosmograph Daytona (3 of 3 with facts), Datejust 36 and 41,
   Explorer 40, Navitimer B01, Royal Oak Chronograph 41, Overseas
   chronograph, Tank Must, Santos de Cartier Large. "Santos de Cartier"
   offers "Santos Demoiselle" first because "de" matches the start of
   "Demoiselle". This needs a code fix, not paid research.
2. **Archetype, unlabelled card without a price.** Paid checking confirmed
   the Maurice Lacroix AI6118-SS00E-430-C reference from the maker's page,
   then, finding no catalogue record, replaced its title with the reference
   and dropped the editorial price (EUR 8,900). The card then sat in the
   USD 10,000+ band as checked, with no price and no label.
3. **Film confirmation.** Paid discovery finds the right watch for 15 of 19
   labelled sightings, but the two-source confirmation confirmed none of
   them. Confirmation, not discovery, is the bottleneck.
4. One checked alternatives answer could not be saved ("image conflicts
   with catalogue"), so that check was paid without a saved answer.
5. Answer quiz-32 (USD 8,000–9,000, quartz or solar, 200 m) has 8 options
   after two rounds; such watches are scarce, and the page says so.

## Fixes after the paid round (2026-11-26, owner: "исправь")

Measured without paid calls: the same live harness with every provider
request refused (`scripts/run-evals-live.ts --dry-run`, report
`docs/reports/eval-live-2026-11-26-dry-run.json`) and the free evaluation
(`docs/reports/eval-2026-11-26-after-fixes.json`).

| Measure (visitor path) | Paid round, before | Dry run, after |
| --- | --- | --- |
| Alternatives cases that reach a search | 24 of 60 | 60 of 60 |
| Alternatives cases stopped at "specifications incomplete" | 36 of 60 | 0 |
| Owner's pick in the top ten (of the cases searched) | 10 of 24 | 14 of 60 |
| Archetype hard-rule failures | 1 | 0 |
| Quiz hard-rule failures (263 exact cards) | 0 | 0 |
| Invented film sightings | 0 | 0 |

1. **Alternatives name resolution** (`resolveNamedWatch`): when the name
   typed settles on records without comparison facts, it settles among the
   complete records of the same watch ("Rolex Daytona" → a complete
   Cosmograph Daytona record) or asks which one, complete models first. A
   typed word of one or two characters matches only a whole word, so "de"
   no longer finds "Demoiselle". The free evaluation's alternatives section
   counts only names that resolve without a question: 6 now, 17 before,
   because 11 of those 17 were the dead ends above; its recall (7 of 60) does
   not follow the "Which one?" chips, so the visitor-path figures above are
   the measure.
2. **Archetype**: a checked card gets back the title and price its local
   record had when the check dropped them (`withSelectedFacts`), and a card
   left without a price is labelled. Editorial picks priced outside the band
   at today's rates are left out (`curatedInBand`): the Maurice Lacroix pick
   is EUR 8,900, about USD 9,732, below the USD 10,000 band.
3. **Film confirmation**: a wearer is matched by any name the provider's
   attribution contains ("James Bond (Daniel Craig)" → "Daniel Craig"), and
   the passage may name the watch by its model words instead of the
   reference; the page must still show the exact reference, two providers
   must still agree, and their pages must be on different sites
   (`app/domain/attribution-names.ts`). On the round's own source pages the
   page check now passes for 10 of the 20 film cards that have a reference
   (8 before). Whether confirmations follow needs a paid re-check: the
   providers' passages are not stored.
4. **Saving checked answers**: migration 0122 keeps the catalogue's photo
   instead of refusing the whole answer when a check finds a different one
   (`scripts/test-image-conflict-publish.ts`: FAILS on the old function,
   PASS applied).

## Known gaps the scores point to

- Film: whether the new passage rule turns the 15 found sightings into
  confirmed ones is not yet measured; it needs a paid re-check (about
  $0.11 for the film searches).
- Relevance beyond hard rules needs the owner's (or a specialist's) ratings
  of the 321-card sample (`docs/reports/rating-sheet-2026-11-26.json`).
- Evaluations need database credentials, so they run locally, not in CI;
  adding read-only credentials to CI secrets is an owner action
  (`docs/OWNER_QUESTIONS.md`).
