# Status and handoff

The current state of the speed, caching and relevance rebuild, kept short so a
new chat can continue in minutes. Owner decisions: `AGENTS.md` ("Speed,
caching and relevance rebuild"). Detailed evidence: the roadmap section of the
same name in `docs/implementation-roadmap.md`. Audit:
https://claude.ai/artifact/X6DjxGiMJUZqJH2EEb3aX4. Final report with the
verification table (v9, updated 2026-11-26 at night with the judge, the
catalogue's facts, repair step 1 and the read-only evaluation; 16 of 16 PASS
again at 2026-11-26 22:19 UTC on the deployment of `8f83aea`,
`docs/reports/verify-all-2026-11-26.json`; GitHub checks green on it):
https://claude.ai/artifact/7X4Lo6q2mcvgw6ZoHDG1Wn. Owner's rating page:
https://claude.ai/artifact/HarGVRCT49WRcp5ervd4RC (ratings are stored under
`ratings/<rater>/cards` in its database; read them with ArtifactData).

Owner request, 2026-11-25: do every phase step by step, then give a full
report that proves with facts and tests that the output is excellent and the
code is sound, so the owner can verify everything independently. Owner
answers, 2026-11-26: Pro is on, Sentry may load later, episode links as
advised, the portfolio key is allowed, the film set as honest as possible,
a budget for an honest check, no Next.js version 2 (`AGENTS.md`, "Owner
decisions, 2026-11-26"). Later the same day the owner supplied Supabase's
certificate and approved $60 for one paid evaluation round ("Да, $60"); the
round ran and cost $3.89.

## The three rules

Every change reports before/after numbers for each rule.

| Rule | Measured by |
| --- | --- |
| Relevance | Hard-constraint violations (must be 0), exact-match and verified share, eval scores against random baselines |
| Speed | First-byte medians from `scripts/measure-page-speed.ts`, quiz API timings, database read times |
| Cost | Paid provider calls per request (0 on repeats), application verification ledger |

## Progress

| Step | Status | Evidence |
| --- | --- | --- |
| Phase 0.1 functions in `fra1`, CDN for content pages | done, verified on production | `44c4e21`, `docs/reports/page-speed-*.json` |
| Phase 0.2a quiz database window (migration 0115) | done, verified on production | `fd27073`, `docs/reports/quiz-window-equivalence-2026-11-25.json` |
| Phase 0.2b archetype database window (migration 0116) | done, verified on production | `96e081c`, `docs/reports/archetype-window-equivalence-2026-11-25.json` |
| Phase 0.2c alternatives name index and window (migration 0117) | done, verified on production | `0698273`, `docs/reports/alternatives-window-equivalence-2026-11-25.json`, `docs/reports/catalogue-windows-smoke-2026-11-25.json` |
| Phase 0.2d alternatives name lookups through indexes (migrations 0118–0120) | done, verified on production | `e85f307`, `docs/reports/name-lookup-equivalence-2026-11-25.json`, `docs/reports/catalogue-windows-smoke-{before,after}-name-lookups-2026-11-25.json` |
| Phase 0 film search confirmed-only; quiz exact vs compromise | done, verified on production | `055f39d` |
| Phase 0 CDN for finished film answers | done, verified on production | `df78c6d`, `docs/reports/page-speed-after-finished-cache-2026-11-25.json` |
| Phase 0 episode short links | done, verified on production | `4be1572`, `docs/episode-links.md` |
| Phase 0 public portfolio demo | partner created and portfolio pushed (2026-11-26); the owner then asked to ignore this test partner, so its Lovable publish is not tracked | `personal-website` `9c99572`, `docs/decisions/DECISION_REGISTER.md` |
| Episode links open the tool each video names; campaign tags survive the sign-up gate | done, verified on production | `9e37eac`, `docs/episode-links.md` |
| Profile page `/start` for Instagram and TikTok (`/ig`, `/tt` lead there): latest episode first, episodes appear at their release time, five-minute CDN copy | done 2026-11-27 | `docs/social-landing.md` |
| Vercel Pro; Web Analytics | done (owner), verified | `vercel teams ls`: plan `pro` |
| Paid re-checks back off after failures (migration 0121) | done, applied to production | `216b9b5`, `scripts/test-validation-backoff.ts` |
| Independent film label set, scored without paid calls | done; its review page is published (2026-11-26) and awaits the owner's marks | `e568a71`, `71d039c`, https://claude.ai/artifact/4Br4SRgzRsFAGkN7vLEd5b |
| Database scripts verify the server against Supabase's certificate (supplied by the owner) | done | `5e41865`, `scripts/database-tls.ts`, `docs/production-readiness.md` |
| Paid evaluation round ($60 approved) | done 2026-11-26: $3.89 spent; 4 of 5 gates PASS, archetype rules FAIL on one card; defects found (Known limits). All paid work of the day from the same $60 is in `docs/evaluation-budget.md` | `5e41865`, `docs/eval-baseline.md`, `docs/reports/eval-live-2026-11-26.json` |
| Fixes from the paid round: alternatives name resolution, archetype price and band, film passage rule, migration 0122 (photo conflict) | done 2026-11-26; measured without paid calls (alternatives 24 → 60 of 60 cases searched, archetype rule failures 1 → 0); film effect needs a paid re-check | `docs/eval-baseline.md`, "Fixes after the paid round" |
| Rating sheet, 321 cards | the owner rated 203 ("всё что мог уже оценил, там всё гуд") and checked the archetypes by hand ("там всё гуд") | `c1fd934`, `docs/reports/owner-ratings-2026-11-26.json` |
| Film and people search on real articles: discovery reads specialist articles; confirmation reads the page's own sentences and headings, Muse may open a page, avoids the first site; Bvlgari/Heuer/G-Shock brand rules; possible-only answers re-checked; Oracle of Time readable | done 2026-11-26, on production; tested on 30 owner queries, the IMDb Top 250 films and 100 of their actors and characters | `f7af14a`–`11a40e8`, `docs/eval-baseline.md` ("Film and people search on real articles"), `docs/reports/film-searches-*.json` |
| Spend alerts by email (ledger marks, Perplexity at $5 and $10, halt) | done, checked on production (401 without the secret) | `22ef05c`, `docs/production-readiness.md` |
| Film review page for the owner (541 cards for 182 requests, each with its quoted passages) | reviewed by the owner as far as possible: all good | https://claude.ai/artifact/Nw4UBgkUU3ANz5Egrtr6Ze, `docs/reports/rating-sheet-films-2026-11-26.json` |
| Pre-owned dealers' prices labelled as pre-owned; grey dealers and watch databases never confirm a price | done, on production | `cd75a20` |
| A judge (`scripts/judge-cards.ts`) calibrated on the owner's 203 ratings with two model families | done: film cards agree 90%; both judges name the same wrong fact on 69 cards the owner rated positively (50 alternatives, 17 quiz, 2 film); 6 of 6 checked on makers' pages were real errors | `cd75a20`, `docs/reports/judge-{opus,hydrogen}-2026-11-26.json` |
| The judge on the 80 archetype cards (facts; the owner checked their choice by hand) | done: 34 of 78 wrong (44%), 76 of 78 AI-found watches | `docs/reports/judge-archetype-2026-11-26.json` |
| Read-only evaluation sign-in (migration 0123) and CI job | done and applied; the same evaluation over it matched the usual one exactly; waits for the owner's one command (`docs/OWNER_QUESTIONS.md` #6) | `596b029`, `.github/workflows/eval.yml` |
| Catalogue repair, step 1: pilot on 60 AI-found watches, nothing written | done | `docs/reports/fact-check-pilot-2026-11-26.json` |
| Catalogue repair, steps 2 and 3: all 3,590 AI-found watches against makers' and shops' pages (migration 0124 log, revertible per run) | done 2026-11-27, written: 1,096 watches changed, 67 references belong to another watch (prices parked), 72 newly confirmed, 9 marks dropped; $19.94 | `docs/eval-baseline.md`, `docs/reports/fact-log-2026-11-27.json` |
| Styles for database-imported watches | done: 15,458 of 15,724 classified ($0.29) and written (run `styles-1`, throttled) | `docs/reports/styles-1-2026-11-27.json` |
| The judge after the repair: the owner's 203 cards with today's facts, and a fresh live round (all gates PASS) | done 2026-11-27: the 203 cards 95 → 88 wrong; the fresh round 110 of 279 wrong (39%; database imports 17%); 15 cards showed facts the repair had already corrected, from saved answers | `docs/eval-baseline.md` ("The judge after the repair") |
| Partner widgets on production, as a partner's page frames them | done 2026-11-27: 34 of 34 PASS after fixing `APP_URL` (it was `http://localhost:5173` in Vercel, so every widget's credit, the snippets on `/partners`, the API description and the archetype's share link pointed there) | `f143367`, `scripts/smoke-widgets.ts`, `docs/reports/widgets-smoke-2026-11-27.json` |
| Vercel Web Analytics receives the short links' three plain campaign tags | done 2026-11-27; splitting by them in Vercel needs the Web Analytics Plus add-on or Enterprise (the API answers 402 on Pro); `/admin/analytics` has them for free | `9221990`, `docs/episode-links.md` |
| Supabase Pro with Micro compute | done by the owner, verified 2026-11-27: daily backups (9, newest 10:27 UTC), PITR off, cache hit 99.9%, database 463 MB, disk 41% of 2 GB (grows by itself) | `docs/production-readiness.md` |
| "Enforce SSL" for direct database connections | done by the owner 2026-11-27 ("1 - готово"); the Management API reports `"database": true` | `docs/OWNER_QUESTIONS.md` (closed items) |
| Exclusive Watch Selection: a "Coming soon" panel under every result screen of the site's own pages, never in a widget; a press counts as interest (`exclusive_selection`) | done 2026-11-27 | `app/components/exclusive-selection.tsx` |
| Price of Exclusive Watch Selection | approved by the owner 2026-11-27: $79, $49 for the first 25 founding orders | `docs/business-plan.md` ("Paid watch selection") |
| Launch check (release readiness, 2026-11-27) | done; verdict in `docs/production-readiness.md` ("Launch check"): the production monitor was red since 2026-11-26 (six abandoned $0.20 reservations), settled and green again; robots.txt, sitemap.xml and canonical links added; review queue down to 3 watches for the owner; fresh backup restored in a rehearsal | `10acd2e`, `2ef81a0`, `docs/reports/verify-all-2026-11-27.json` |
| Prices to check by hand (31: 17 shown as confirmed, 14 as approximate) | page for the owner published 2026-11-27 | https://claude.ai/artifact/JmMRd9Uj9JuB2rcLBYknCE |
| A confirmed price a new check cannot reproduce becomes approximate (owner #13, migration 0127) | done 2026-11-28: applied and tested (12 checks, rolled back); the ten prices of 2026-11-27 are approximate now | `scripts/test-unconfirmed-price.ts`, `docs/reports/approximate-prices-2026-11-28.json` |
| Privacy policy names the controller (Oleksandr Kukhtin) | done 2026-11-28 | `app/routes/privacy.tsx` |
| Photos for watches without one, the owner's way (`scripts/find-catalogue-photos.ts`) | test 2026-11-28: 10 photos stored and checked by eye (a banner refused; rules added); the full run, watches the tools show first (2,090), runs until the rest of the $100 is spent | `docs/reports/photos-photos-test-1.json`, `docs/reports/photos-photos-1-progress.jsonl` |
| Repair step 6: a confirmed reference weighs a point in the alternatives; review queue checked and approved (470 of 473); sourced suggestions take page-checked facts; live round and judge | done 2026-11-27: wrong share 35% → 34% (quiz 28%), film 8 of 17 answers confirmed; owner decisions recorded in `AGENTS.md` ("Owner decisions, 2026-11-27") | `662a2c7`, `c0ba5e6`, `04fa54f`, `docs/eval-baseline.md` |
| Exclusive Watch Selection: process for the paid selection (reuse the diagnostic plus a short brief; merchant of record; research, judge, the owner's 15-minute review; delivery) | written 2026-11-27; price approved ($79, $49 for the first 25); built after the launch | `docs/exclusive-selection.md` |
| Repair step 5: saved answers show page-checked facts; second read of 2,073 found pages (470 watches changed); price recheck of the 33 records the judge named; live round of all four tools and the judge | done 2026-11-27: wrong share 39% → 35%, every gate PASS; two defects found and fixed (film checks not saved, `235f924`; saved-research cards with old names, `9477805`) | `8fbf9bd`, `docs/eval-baseline.md` ("Repair step 5"), `docs/reports/judge-step5-2026-11-27.json` |
| Phase 1 eval harness, baselines, leakage checks; stories as confirmed film sightings | done | `927bd63`, `docs/eval-baseline.md` |
| Phase 5 legacy archive | done | `c52ceba`, branch `archive/legacy-code`, tag `archive/legacy-2026-11-25` |
| Phase 5 security checks (gitleaks, Semgrep, npm audit), Dependabot | done, green on `3031e0d` | `.github/workflows/security.yml`, `docs/production-readiness.md` |
| Phase 5 self-hosted fonts | done, verified on production | `0474d57` |
| Phase 5 starter-kit skills, standards, continuity docs | done | `.agents/skills/`, `docs/NEXT_CHAT.md`, `docs/OWNER_QUESTIONS.md`, `docs/decisions/DECISION_REGISTER.md` |
| Phase 5 public pages under the 150 KB JS budget (Sentry after the first paint) | done, verified on production: home 168.4 → 122.2 KB | `35a4a77`, `docs/reports/page-weight-{before,after}-sentry.json` |
| Phases 2–4 Next.js v2 | cancelled by the owner, 2026-11-26 | `AGENTS.md`, `docs/decisions/DECISION_REGISTER.md` |
| One-command verification and final report | done | `scripts/verify-all.ts`, `docs/reports/verify-all-*.json` |

## How to verify

One command runs every check below in order and prints PASS, FAIL or NOT RUN
for each (about fifteen minutes; it writes `docs/reports/verify-all-<date>.json`):

```sh
node --import tsx scripts/verify-all.ts --production
```

Without `--production` it skips the four checks against the live site. The
individual checks:

```sh
npm run check
node --env-file=.env --import tsx scripts/test-quiz-window.ts
node --env-file=.env --import tsx scripts/test-archetype-window.ts
node --env-file=.env --import tsx scripts/test-alternatives-window.ts
node --env-file=.env --import tsx scripts/test-name-lookups.ts
node --env-file=.env --import tsx scripts/test-validation-backoff.ts --applied
node --env-file=.env --import tsx scripts/test-image-conflict-publish.ts --applied
node --env-file=.env --import tsx scripts/check-quiz-window-equivalence.ts
node --env-file=.env --import tsx scripts/check-archetype-window-equivalence.ts
node --env-file=.env --import tsx scripts/check-alternatives-window-equivalence.ts
node --env-file=.env --import tsx scripts/check-name-lookup-equivalence.ts
node --env-file=.env --import tsx scripts/run-evals.ts
node --import tsx scripts/measure-page-speed.ts --label check
node --import tsx scripts/measure-page-weight.ts --label check
node --env-file=.env --import tsx scripts/smoke-catalogue-windows.ts
node --env-file=.env --import tsx scripts/measure-quiz-api.ts --label check
node --env-file=.env --import tsx scripts/run-evals-live.ts --budget 60 --rounds 1 --dry-run
```

Every database check is read-only or runs in a rolled-back transaction. None
makes a paid provider call. The smoke and quiz API checks count a few uses
against the owner's test partner site allowance. The paid round itself
(`scripts/run-evals-live.ts --budget <usd>` without `--dry-run`) runs only
with the owner's approval of that amount.

## Known limits

- Copying secrets into a hosting project is an owner action; the agent never
  enters API keys or tokens.
- The first request to a new function instance takes 8–10 s (function start
  plus cold database buffers); not yet investigated.
- **Wrong facts on AI-found watches, after the repair.** On the fresh
  round of 2026-11-27, 39% of the cards carry a fact the judge calls wrong
  (AI-found watches with a page 41%, without one 62%, database imports 17%).
  Most are facts no maker's page confirmed, then model names and prices. The
  free evaluation's "0 hard-rule violations" is measured against stored
  facts, so it cannot see this. Next step: `docs/OWNER_QUESTIONS.md` #7.
- **Saved answers keep old facts.** Validated snapshots are served as
  stored, so catalogue corrections and `/admin/catalogue` edits or
  rejections reach a saved answer only when it is checked again (15 of 279
  cards on 2026-11-27).
- A local script that is killed while a paid check runs leaves its budget
  reservation open; after 15 minutes the protected health check answers 503
  and the hourly GitHub monitor fails (2026-11-26 to 2026-11-27). Settle such
  attempts as `ai_watch_validation_reserve_v5` does (the whole reserve is
  charged), never by deleting them (`docs/production-readiness.md`).
- On this Windows machine Node sometimes cannot reach thereserve.watch over
  IPv6 while curl can; run production scripts with
  `--dns-result-order=ipv4first` when one fails with a connect timeout.
- Film search confirms strictly: 23 of 352 test requests have a confirmed
  watch; the rest show only as possible. Paid re-checks wait for the backoff.
- A local production build (`npm start` with `.env`) writes real analytics
  rows; one test page view from 2026-11-26 (row 692, country empty) is in the
  analytics table.

## Next step

Launch is planned for 2026-12-06; Exclusive Watch Selection ($79, $49 for
the first 25, approved) is built after it (`docs/exclusive-selection.md`).
Repair steps 5 and 6 are done (`docs/eval-baseline.md`): the judge's wrong
share went 39% → 35% → 34% (quiz 28%), wrong prices 33 → 26, film 8 of 17
answers with confirmed sightings (0 before the save fix); the review queue is
approved after checks (470 of 473); every gate PASS on all four tools.

1. Owner actions before the launch (`docs/OWNER_QUESTIONS.md`): the edits
   of the three approved watches (#14), spot checks of the photo run (#16),
   and the 31 prices on https://claude.ai/artifact/JmMRd9Uj9JuB2rcLBYknCE.
2. What the judge still finds: AI-found records without any maker's or
   shop's page (61% of their cards), invented or mixed-up references, model
   names, prices. Next: measure the sourced-suggestion fix (`04fa54f`) in the
   next judged round; then decide whether such page-less records should only
   fill places in every tool (a relevance change, evaluated first).
3. Film confirmations grow as the re-check backoffs end; measure again in a
   week.
4. Completion of imported watches the tools show: `scripts/visible-catalogue.ts`,
   then `scripts/repair-catalogue.ts --set database --ids-file …` (throttled
   writes, at most two writers with a pause).
Of the owner's $100 for this work about $76.92 is spent before the photo run
(`docs/evaluation-budget.md`).
Run `scripts/verify-all.ts --production` before and after every change.
