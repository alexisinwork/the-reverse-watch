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

## Film and people search on real articles (2026-11-26)

Owner: "чтобы они всегда опирались на реальные статьи из реальных сайтов с
фактами", tested on 5–10 queries and on the IMDb Top 250 films, their actors
and characters, with every output reviewed by the owner; relevance before
cost.

Discovery now reads the articles and databases that catalogue a subject's
watches (up to three searches, social sites, forums and shops excluded). On
the 19 independent labels (`scripts/compare-film-discovery.ts`,
`docs/reports/film-discovery-comparison-2026-11-26.json`): labels found
14 → 19, ready for confirmation 10 → 12, invented sightings for the two
control subjects 0 → 0, cost per discovery $0.0014 → $0.0083 (at most
$0.0102).

Paid runs through the visitors' own function (`scripts/run-film-searches.ts`,
a ledger stop before each search; reports `docs/reports/film-searches-*.json`):

| Run | Searches | Spend | Confirmed watch | Any card |
| --- | ---: | ---: | ---: | ---: |
| Owner test, 30 films, actors and characters | 30 | $0.86 | 5 | 23 |
| IMDb Top 250 films, before the confirmation fixes | 250 | $2.24 | 6 | 97 |
| 100 actors and characters from those films | 100 | $3.05 | 12 | 83 |
| The 250 films again (possible answers served from the finished cache: defect fixed in `f6ccbe3`) | 250 | $1.78 | 6 | 98 |
| The 163 searches with possible cards only, checked again | 163 | $3.99 | 5 | 163 |

The latest answer to each of the 352 distinct requests: films 7 of 250 with a
confirmed watch (98 with any card), actors and characters 16 of 102 (84 with
any card); 30 confirmed cards in all, none of them for an invented subject.
Newly confirmed in the last pass, among others: Al Pacino's Bulgari Diagono
CH35S in Heat, Brad Pitt's IWC Ingenieur 1832 in F1, Leonardo DiCaprio's
Breitling Avenger E13360 in Blood Diamond, Matthew McConaughey's Hamilton
Khaki Pilot Day Date H64615135 in Interstellar, Vincent Vega's Timex Q 989502
in Pulp Fiction. Every card, with the passages each source page gave, is on
the owner's film review page (`docs/OWNER_QUESTIONS.md`, item 1;
`docs/reports/rating-sheet-films-2026-11-26.json`).

The articles were right; the confirmation dropped them. Traced subject by
subject (diagnostic scripts, about $0.30 outside the ledger):

1. The page check accepted only the sentence the provider quoted, which often
   lacked the brand or the reference ("…after Sigourney Weaver wore it as
   Ellen Ripley in Aliens"). It now reads the page's own sentences too, and
   on a page whose title names the subject ("Bruce Willis in Die Hard » BAMF
   Style") accepts a sentence with the brand and exact reference, stored as
   "heading … sentence".
2. Muse answered "not supported" from a short search snippet, or ran out of
   room while thinking. A sighting check reads more of each result, may open
   one page, thinks a little and has room to answer (about $0.006 a check).
3. Both checks landed on one site. Muse is told the first source's site and
   the wearer it names.
4. A film answer of possible cards only was cached as finished and never
   checked again (`f6ccbe3`).
5. Oracle of Time, the owner's example source, hangs up on the usual
   "Mozilla/5.0 (compatible; …)" bot name; page reads retry once as
   "TheReserveBot/1.0 (+https://thereserve.watch)" (`11a40e8`).

Pages often name the character ("Mark Hanna", "The Joker") where an actor's
card named only the actor. Owner: "yes, fix it". Discovery now writes the
wearer as "Role (Actor)" when the page names both, and an actor's or a
character's card keeps the role beside the film the source names
(`roleAttribution`, `d956574`); a passage may name the role or the actor
and must also name the film. Saved drafts from an older discovery are read
again instead of re-checked (`FILM_DISCOVERY_VERSION`, `d7afca0`). The 86
actor and character searches still without a confirmed watch were read again
(`--fresh`) once their backoff had passed: $2.30, no new confirmation: 18 searches
were still waiting, and 40 of the 50 rejections failed on the first
source's page. Two more changes followed (`docs/reports/film-searches-people-roles-2026-11-26.json`):
titles match without the year the provider adds, a description ("John Wick
films") is not kept as a film, and a sentence with the exact reference is
read with the section headings it sits under (`pageBlocks`), as film-watch
databases and actors' pages list watches. Re-opening the 107 logged rejected
page pairs without paid calls: both pages now pass on different sites for 11
(0 before these changes), at least one page for 73 (54). The paid re-check
follows when each search's backoff ends (one hour to one day); a visitor's
search then reads the new drafts.

## The owner's ratings (2026-11-26)

The owner rated 203 of the 321 cards on the rating page
(`docs/reports/owner-ratings-2026-11-26.json`) and stopped there: "либо
круто, либо годится в подавляющем большинстве".

| Tool | Rated | Strong or acceptable | Poor | Wrong facts |
| --- | ---: | ---: | ---: | ---: |
| Diagnostic quiz | 62 of 100 | 57 (92%) | 3 | 2 |
| Cheaper alternatives | 100 of 100 | 94 (94%) | 4 | 2 |
| Film and people (real sighting) | 41 of 41 | 40 (98%) | — | 0 |
| Archetype quiz | 0 of 80 | not rated | | |

What the flagged cards point to:

1. **Prices from a pre-owned dealer shown as ordinary approximate prices.**
   About 21,600 catalogue prices came from Space City Timepiece listings
   (its own import and the timepiecepedia one); quiz and archetype cards
   label them "Approximate price, may change", not "pre-owned". The TAG
   Heuer Aquaracer Calibre S Regatta CAF7111.BA0803 at USD 920 is one.
   Other flagged prices are out of date or from a dead source: Favre-Leuba
   Chief Date EUR 2,240 from favre-leuba.com (the domain does not answer;
   the maker's favreleuba.com shows EUR 2,775), Bvlgari Aluminium GMT
   103554 at USD 3,000 ("5000 usd new").
2. **A size error**: the Aquaracer "Regatta 43" is stored as 41 mm.
3. **A pocket watch** among film cards (Patek Philippe, Steve McQueen):
   now left out in code as well as in the instructions (`isWristwatch`).
4. **Taste**: budget picks from Invicta, Junkers and Lip, field watches as
   Aquanaut alternatives and a diver for the Snowflake were rated poor;
   ranking does not weigh brand standing or design language.

## The judge and the catalogue's facts (2026-11-26)

The owner asked for a judge that decides without them ("добавь судью. Чтобы
он умел грамотно решать сам — без моего участия"). `scripts/judge-cards.ts`
read the owner's 203 rated cards twice, with two model families, through
Perplexity's Agent API with web search. Every third rated card of each tool
was held out and never used to write the instructions.

| | Opus 5.5 | Gemini 4 Hydrogen |
| --- | ---: | ---: |
| Cards judged | 203 of 203 | 186 of 203 (17 errors) |
| Spend | $6.67 | $5.15 |
| Same rating as the owner, held-out cards | 41% | 37% |
| Same side as the owner (good/ok against poor/wrong), held out | 61% | 52% |
| Film cards: same rating as the owner, all | 90% | 90% |

Opus is the judge from here on: no errors and the closer agreement. The low
agreement on quiz and alternatives cards has one cause: the judges check
facts, and the owner's ratings judged the choice. Both judges named the same
wrong fact on 77 cards, 69 of them rated good or acceptable by the owner
(alternatives 50, quiz 17, film 2): water resistance 26, case size 24, model
20, reference 16, price 11, movement 7 (a card can have several). Six of
them were checked by hand on the makers' or retailers' pages, and all six
were real errors: Timex TW2V24700 is rated 100 m, not 200 m; the Excelsior
Park EP95000 is hand-wound, not automatic; Ball's Engineer III Outlier is
DG9000B, not DG3030A; Mühle's S.A.R. Rescue-Timer is M1-41-03-KB, not
M1-28-70-KB; the Nodus Sector Deep is 38 mm, not 40 mm; Mathey-Tissot
H453AN is a quartz Mathy I, not an automatic diver.

Where the wrong facts come from (cards both judges read):

| Where the card's watch came from | Cards | With a wrong fact |
| --- | ---: | ---: |
| Added by an AI search (source page from the maker or a retailer) | 128 | 72 (56%) |
| Imported from a watch database (dials) | 16 | 2 (13%) |
| Found live, not in the catalogue | 2 | 1 |

The archetype cards, which the owner checked by hand but did not rate
here, went to the judge alone ($2.65): 34 of 78 wrong (44%), 20 good, 19
acceptable, 5 poor; 76 of the 78 showed AI-found watches (model 14, size
14, price 14, reference 9, water resistance 8, movement 5; for example the
Cartier Tank Must Large WSTA0052 is quartz, not automatic).

The 3,590 AI-found watches are 14% of the catalogue but fill most result
places, because every field of theirs is filled. The free evaluation's zero
hard-rule violations is measured against the stored facts, so it cannot see
a stored fact that is wrong.

**Repair, step 1** (`scripts/fact-check-catalogue.ts`, pilot on 60 of those
watches, $2.92, nothing written): the judge model named the maker's page for
47; our server opened 42 (4 blocked, 1 gone), and 35 showed the reference
in their text. Per fact: model 25 confirmed and 3 corrected, case diameter
24 and 4, movement 28 and 3, water resistance 24 and 6; the rest could not
be confirmed. Twelve watches have a verified correction, among them Alpina
AL-730NS4AE6B (41 mm and 100 m on Alpina's page, not 42.5 mm and 200 m),
Lip 671541 (quartz), Laco 862100 (the Augsburg Blaue Stunde 42, not a Halle
38) and Oris 733 (automatic, not quartz). On the 19 watches both judges had
found clean it proposed no correction. Nine references look invented: no
maker page exists for them, and eight of their nine stored pages are gone.
Two rules were tightened afterwards: a page's address that contains the
reference proves nothing (one pilot page showed it only there), and a case
length, thickness or lug width is not a diameter (Frederique Constant's
"Case Length 40 mm", the one correction that no longer counts). A free first
pass that reads each watch's stored page confirmed the stored diameter for
19 and the water resistance for 18 of the 60, with one disagreement each
against the paid check.

## Catalogue repair, steps 2 and 3 (2026-11-27)

Owner: "Делай шаг 2 и шаг 3 на все часы и детально дополни существующий
каталог ... даю добро на траты до 100 долларов начиная с нуля". Method
and rules: `scripts/repair-catalogue.ts`, `scripts/repair-rules.ts` (held
to the calibration cases by `scripts/repair-rules.test.ts`), the log of
migration 0124. Numbers below are read back from the log
(`scripts/fact-log-report.ts`, `docs/reports/fact-log-2026-11-27.json`).

**Calibration** on the 60 pilot watches, five rounds against the Opus
pilot of step 1: the final rules found the reference on 48 pages (Opus 35),
made 13 of Opus's 16 corrections (the other three: Frederique Constant's
diameter, which the stricter rule refuses on purpose because the page says
"Case Length 40 mm", and two water resistances the read did not return,
Frederique Constant's and Glycine GL0088's), found four more that the pages
confirm (Seiko SRPL53 41.7 mm, Nodus Sector Deep 38 mm, Junkers 6050-5,
Grand Seiko SBGX295 100 m), dropped no real reference, and cost $0.003 a
watch instead of $0.049. Muse's own web search was dropped (2 verified
pages in 26 tries; it also called two real references missing).

**All 3,590 AI-found watches** (run `repair-1`, $19.94): the maker's page or
a shop's for the exact reference was found and opened by our server for
2,074 (58%). Per fact, from those pages:

| Fact | Confirmed | Corrected | Filled |
| --- | ---: | ---: | ---: |
| Case diameter | 860 | 293 | 28 |
| Water resistance | 1,205 | 193 | 115 |
| Movement | 1,639 | 95 | 29 |
| Case thickness | 260 | 133 | 162 |
| Case material | 1,498 | 119 | 108 |
| Strap or bracelet | 900 | 296 | 117 |
| Crystal | 1,244 | 37 | 106 |
| Case back | 148 | 115 | 81 |
| In-house calibre | 321 | 30 | 24 |
| Model name | 1,041 | 67 | |

1,096 watches changed, 2,390 values in all. 67 references belong to
another watch (the page names it with none of the stored words and differs
in a hard fact): they took the page's name and facts, and their prices are
parked until checked again (64 prices). 72 references were newly confirmed
on a maker's or listed authorised retailer's page; 9 lost the mark (stored
page gone, no page named by two Perplexity queries gives them), so they
show only under "Also worth a look". 90 records moved from a forum or a
dead page to the maker's page. A sampled review found and fixed, before
writing, an auction lot and a pre-owned dealer passing as shops and names
that differ only in writing ("SKYDWELLER") counted as another watch.

**Styles for database-imported watches** (run `styles-1`, $0.29): 15,458 of
15,724 got wearing styles from their own facts; 266 got none, because their
facts do not tell. A sample read by hand: Rolex Day-Date dress and
everyday, Daytona sport, Tudor Black Bay dive, sport and everyday, Patek
Calatrava dress. The 66 renamed AI-found watches were classified again.

**Live site:** thousands of quick writes made searches ten times slower
while they ran (archetype 12–19 s instead of 1–4 s); one writer with a
pause keeps them near normal. Every write run is now throttled, and speed
was measured again after each (`scripts/smoke-catalogue-windows.ts`).

## The judge after the repair (2026-11-27)

**The same 203 cards the owner rated**, rebuilt with today's facts
(`scripts/refresh-sheet-facts.ts`, `docs/reports/judge-refreshed-2026-11-27.json`,
$8.47): wrong 95 → 88 (17 cards fixed, 10 newly flagged). Wrong facts named:
case size 35 → 20, water resistance 34 → 25, reference 27 → 21; model name
32 → 34 and price 27 → 31 did not improve (the repair does not touch prices,
and its name check is too weak, below).

**A fresh live round** through the visitors' own search functions
(`docs/reports/eval-live-2026-11-27-after-repair.json`, $3.15): quiz 40 of
40 cases answered (39 reached ten), archetype 24 of 24, alternatives 60 of
60 (58 reached ten), 0 rule failures, every gate PASS. The judge on its 279
cards (`docs/reports/judge-after-repair-2026-11-27.json`, $10.03): 110 wrong
(39%): quiz 34 of 100, archetype 38 of 80, alternatives 38 of 99.

| Where the card's watch came from | Cards | Wrong |
| --- | ---: | ---: |
| AI search, maker's or shop's page found by the repair | 174 | 72 (41%) |
| AI search, no page found | 45 | 28 (62%) |
| Watch database import | 59 | 10 (17%) |

Why, from the repair's log: of the 136 wrong hard facts the judge names
(prices left out), 99 are facts the repair could not confirm on a page and
so left as the AI search stored them; 16 were "confirmed" (14 of them model
names: a page that shows the reference counts as confirming the stored
name even when its title names another model, e.g. Certina DS Action Diver
stored as "DS Action Day-Date"); 15 were corrected and still judged wrong;
6 are on database imports. A sample of the judge's reasons checked against
the makers' pages were real errors (Certina C032.607.11.051.00 is 43 mm and
300 m, not 41 mm and 200 m; Citizen NB6021-68L is 200 m, not 300 m).

**Saved answers keep the facts they were checked with.** 15 of the 279
cards (9 archetype, 6 alternatives) showed values the repair had already
corrected in the catalogue, such as Citizen NB6004-08E 41 → 46 mm, Seiko
SPB451 41.7 → 40 mm and Hamilton H77725335 41 → 42 mm: the search store
(`app/domain/ai-watch-store.server.ts`) and the archetype picks serve the
validated snapshots (`private.ai_watch_validated_cache_snapshots`) as they
were stored, so a catalogue correction, and an edit or rejection on
`/admin/catalogue`, reaches a saved answer only when it is checked again.

## Repair step 5 (2026-11-27, owner: "Да - давай заканчивай все что нужно")

**Saved answers show page-checked facts** (`app/domain/page-checked-facts.ts`).
A fact the repair read on a page our server opened, as the catalogue's
`source_details.factCheck` records it, now replaces a saved answer's older
value when a card is shown (`withSelectedFacts`, `mergeCatalogueFacts`;
archetype and alternatives cards learn it through `markPageCheckedFacts`).
Checked on production data: Bell & Ross BR03A-MIL-CE/SRB shows 41 mm instead
of the picks file's 42, Baume & Mercier M0A10468 40 mm instead of 39. The
free evaluation is unchanged (`docs/reports/eval-2026-11-27.json`: quiz 271
exact cards, 0 violations, precision 1; every gate PASS).

**Second read** of the 2,073 pages step 3 had found (run `reread-1`,
`scripts/repair-catalogue.ts --pages-from repair-1`, $0.68, no search). Why
step 3 missed facts that the makers' pages give, and the fix for each:

- Specification tables put a label and its value on lines of their own
  (Tissot's "Case width (mm)" then "42.00"); the lines read kept the label
  and dropped the value. A label now stays with its value.
- "Case width (mm): 42.00" did not count as a diameter (only "42 mm" did).
- On the maker's own product page for the exact reference, a name sharing
  only some words with the stored one blocked every other fact (Certina
  C032.607.11.051.00, stored as "DS Action Day-Date", is the 43 mm, 300 m DS
  Action Diver). There the maker's name now replaces a stored name that
  carries another size, colour or model (`makerName`); a shorter name for
  the same watch changes nothing.
- A general remark ("a transparent caseback, frequently made of sapphire")
  gives no fact.

Calibrated first on 80 watches from the judged cards (60 judged wrong, 20
good), three rounds: the rules that went live correct 18 of the 72 hard
facts the judge named there, rename seven watches the judge named, and change
nothing material on the 20 good cards (one bracelet material, one thickness).

| Fact | Corrected | Filled |
| --- | ---: | ---: |
| Case diameter | 69 | 6 |
| Water resistance | 62 | 18 |
| Movement | 14 | 2 |
| Case thickness | 73 | 135 |
| Model name (maker's own) | 101 | |
| Strap, case and caseback material, crystal, in-house calibre | 190 | 105 |

470 watches changed; 26 prices are parked because the maker's page shows
another model (another size or movement). 987 source addresses were
rewritten to the maker's page that step 3 had found, 605 of them to the same
address (a run-mode slip, now skipped). Of the 117 hard facts the judge named
on the fresh round, this read changes 22 and the catalogue already held 13
correctly (shown now through the page-checked facts); the rest belong to
AI-found watches without a page (29) or are facts the page does not give.
Writing ran as one writer with a 250 ms pause; searches stayed at their
usual speed (archetype 1.1–1.7 s, alternatives 0.35–0.74 s).

**Prices the judge named** (`scripts/recheck-catalogue-prices.ts
--references`, 33 records, $2.71): 11 confirmed again or newly (Oris
USD 2,600, Alpina USD 3,395, NOMOS 807 USD 6,870 and Nodus USD 650 now match
the makers' pages the judge cited), 5 changed and wait for review on
`/admin/catalogue` (A. Lange 201.027, Bell & Ross BR05 Skeleton, IWC
IW326905, Laco 862103, NOMOS 782), 17 could not be confirmed by two sources.
13 of those 17 keep the label "confirmed" from an earlier check under the
90-day rule (Cartier WSSA0010, Jaeger-LeCoultre Q9008160, LIP 671530, TAG
Heuer WAS2110.BA0732 and others): `docs/OWNER_QUESTIONS.md` #13.

**Live round of all four tools after step 5**
(`docs/reports/eval-live-2026-11-27-step5.json`, $2.57): quiz 40 of 40
answered (39 reached ten, 272 exact cards, precision 1), archetype 24 of 24
(all ten), alternatives 60 of 60 (58 reached ten), film 17 of 19 answered (2
waited out the re-check backoff); 0 rule failures, no invented sighting for a
control, every gate PASS.

**The judge on the same sample** (`docs/reports/judge-step5-2026-11-27.json`,
$10.72), compared with "The judge after the repair":

| | Before step 5 | After step 5 |
| --- | ---: | ---: |
| Cards with a fact called wrong | 110 of 279 (39%) | 97 of 280 (35%) |
| Quiz | 34% | 32% |
| Archetype | 48% | 39% |
| Alternatives | 38% | 34% |
| AI-found, maker's or shop's page found | 41% | 33% |
| AI-found, no page | 62% | 65% |
| Database import | 17% | 15% |

Wrong facts named: case size 39 → 32, water resistance 29 → 23, model 42 →
37, movement 7 → 4; price 33 → 34 and reference 19 → 24 did not improve (the
references belong to records an AI search invented or mixed up; the sample
of alternatives also differs a little, because the catalogue changed). Film:
the judge calls 55 of the 59 possible sightings real and 3 false links.

**Two more defects the round showed, fixed:**

- 12 of the 19 film searches paid for a check whose result could not be
  saved: film discovery cites up to eight pages, the saved check accepted
  five, and the error was logged as `ai_watch_store_read_error`. Saved
  checks now take eight (`235f924`); a rerun of the film searches logged
  none, at $0, because the earlier failures put them in the re-check backoff
  (5 minutes, 1 hour, 1 day, 7 days). Film confirmations are measured again
  as those backoffs end.
- A saved-research candidate whose record the candidate lookup leaves out
  (no usable price, for example a price parked as another model's) kept its
  old name: Panerai PAM01320 still read "Submersible Bronzo". Such cards now
  take the page-checked facts from the whole catalogue, and a rejected
  record drops out (`9477805`).

## Repair step 6 (2026-11-27, owner: "делай прогон судьей чтобы максимально улучшить результаты выдачи")

Of the 4,568 AI-found records, 2,534 never had a maker's or shop's page
behind them, and only 243 of those have a confirmed reference. In the quiz
they already stand only under "Also worth a look"; the archetype's catalogue
window admits only confirmed references; the alternatives finder ranked by
look first and used the confirmed reference only to break ties, so the
judge's sample held 29 such cards there, 21 of them wrong.

A confirmed reference (maker's page, authorised retailer or watch database)
now counts one point more than its look in the alternatives finder, out of 23
(`CONFIRMED_REFERENCE_POINTS`, `app/domain/alternatives.ts`). The weight was
chosen on the owner's labels with the real ranking
(`.scratch/reread/bonus-scan.mts`, same inputs as `scripts/run-evals.ts`):

| Weight | Owner's picks in the top ten | Unconfirmed records shown |
| --- | ---: | ---: |
| 0 (before) | 5 of 39 | 114 of 381 |
| 1 (chosen) | 6 of 39 | 36 of 381 |
| 2 | 5 of 39 | 20 of 381 |
| Strictly confirmed first | 4 of 39 | 0 of 381 |

The free evaluation with the weight (`docs/reports/eval-2026-11-27.json`):
every gate PASS; alternatives 6 of the owner's picks in the top ten (7 in the
morning, 5 on today's catalogue without the weight: the second read gave some
records the maker's name, which no longer matches the label's words); quiz 272
exact cards, 0 violations, precision 1.

## Known gaps the scores point to

- Facts: after step 5, 35% of the quiz, archetype and alternatives cards
  carry a fact the judge calls wrong; database imports 15%, AI-found watches
  without any maker's or shop's page 65% (above). What is left: those
  page-less records, prices that keep an earlier "confirmed" label
  (`docs/OWNER_QUESTIONS.md` #13), invented references, and facts the
  makers' pages do not give.
- Film: confirmations are strict (23 of 352 test requests confirmed); paid
  re-checks wait for the backoff.
- The evaluation can run in CI as the read-only `reserve_eval_reader`
  (migration 0123, `.github/workflows/eval.yml`) once the owner has run
  `scripts/set-eval-reader-password.ts` (`docs/OWNER_QUESTIONS.md` #6). The
  evaluation of 2026-11-26 after the price fixes passed every gate
  (`docs/reports/eval-2026-11-26-rest-check.json`), and the same run over the
  PostgreSQL path gave an identical report.
