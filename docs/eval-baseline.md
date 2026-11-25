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

## Known gaps the scores point to

- Alternatives: 14 of the 20 test-set watches do not resolve to a catalogue
  record with comparison specifications (styles, size, movement), so their
  cases cannot score. Filling those specifications is research work with a
  cost; it needs an owner decision on budget.
- Film: an independent labelled set (above).
- Evaluations need database credentials, so they run locally, not in CI;
  adding read-only credentials to CI secrets is an owner action.
